import { NextResponse } from 'next/server';
import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

// Must spawn the local Claude Code process — Node runtime, never edge.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Default model for the research assistant. */
const RESEARCH_CHAT_MODEL = 'claude-opus-4-8';

/** Fully-qualified name of the in-process card tool (mcp__<server>__<tool>). */
const ADD_CARD_TOOL = 'mcp__research__add_research_card';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

/**
 * Research AI chat — LOCAL ONLY. Drives the user's signed-in Claude Code via
 * the Agent SDK, so replies run on their Max subscription. Built-in file/bash
 * tools are disabled (`tools: []`); the only capability the assistant has is an
 * in-process `add_research_card` tool that places a note on the user's board.
 *
 * The response is newline-delimited JSON (NDJSON). Each line is one of:
 *   { "type": "text", "text": "..." }   — a chunk of the reply
 *   { "type": "card", "text": "..." }   — the model asked to add a board card
 * The card tool runs server-side here, but the board lives in the browser, so
 * the handler emits a `card` event on this stream and the client creates it.
 */
export async function POST(request: Request) {
    let body: { messages?: ChatMessage[]; board?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const messages = Array.isArray(body.messages) ? body.messages : [];
    const board = typeof body.board === 'string' ? body.board : '';
    if (messages.length === 0) {
        return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
    }

    const systemPrompt =
        'You are a research assistant embedded in LoreCanvas, a writing app for ' +
        'novelists and worldbuilders. Help the user develop, organize, and ' +
        'interrogate their research. Be concise and concrete. ' +
        'You have an add_research_card tool that places a note on the user\'s board. ' +
        'ONLY call it when the user explicitly asks you to save or add something ' +
        '(e.g. "add that to my board", "save these ideas"). Never add cards unprompted. ' +
        (board.trim()
            ? `The user's current research board contains:\n${board}`
            : "The user's research board is currently empty.");

    // Render the conversation as a single prompt string. A literal "User:" /
    // "Assistant:" line in board or user text could visually spoof a turn
    // boundary, but the only tool available is add_research_card, so the worst
    // case is a mangled reply or an unwanted note — accepted Phase-2 tradeoff.
    const prompt = messages
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n\n');

    // Force the spawned Claude Code to authenticate with the local Max
    // subscription login, not an API key. Next.js can surface an
    // ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN in the server environment, which
    // would otherwise bill API credits ("credit balance too low") instead of
    // the subscription. Stripping both env vars falls through to the OAuth
    // profile that `claude` is signed in with.
    const childEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined && key !== 'ANTHROPIC_API_KEY' && key !== 'ANTHROPIC_AUTH_TOKEN') {
            childEnv[key] = value;
        }
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            const send = (event: { type: 'text' | 'card'; text: string }) => {
                controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
            };

            // In-process tool: when the model calls it, emit a `card` event on
            // this response stream so the browser can add the note to the board.
            const addCardTool = tool(
                'add_research_card',
                "Add a note card to the user's research board. Only use when the user asks to save or add something.",
                { text: z.string().describe('The note text to place on the board') },
                async (args) => {
                    send({ type: 'card', text: args.text });
                    return { content: [{ type: 'text', text: 'Added a note card to the board.' }] };
                },
            );
            const researchServer = createSdkMcpServer({
                name: 'research',
                version: '1.0.0',
                tools: [addCardTool],
            });

            try {
                const q = query({
                    prompt,
                    options: {
                        model: RESEARCH_CHAT_MODEL,
                        systemPrompt,
                        tools: [], // no built-in file/bash tools
                        mcpServers: { research: researchServer },
                        allowedTools: [ADD_CARD_TOOL], // auto-approve the card tool (no prompt)
                        settingSources: [], // isolation: ignore ~/.claude settings, hooks, MCP, CLAUDE.md
                        permissionMode: 'default',
                        env: childEnv,
                    },
                });
                let gotText = false;
                for await (const message of q) {
                    if (message.type === 'assistant') {
                        // The SDK wraps the API message: text lives at message.message.content.
                        const wrapped = message as {
                            error?: string;
                            message?: { content?: Array<{ type?: string; text?: string }> };
                            content?: Array<{ type?: string; text?: string }>;
                        };
                        // Some failures (auth, billing, rate limit) arrive as data on the
                        // assistant message rather than a thrown error — surface them.
                        if (wrapped.error) {
                            send({ type: 'text', text: `\n\n[Claude Code error: ${wrapped.error}.]` });
                            gotText = true;
                            continue;
                        }
                        const blocks = wrapped.message?.content ?? wrapped.content ?? [];
                        for (const block of blocks) {
                            if (block?.type === 'text' && block.text) {
                                send({ type: 'text', text: block.text });
                                gotText = true;
                            }
                        }
                    } else if (message.type === 'result') {
                        // The terminal result can also report a non-thrown failure.
                        const r = message as { is_error?: boolean; subtype?: string; errors?: string[] };
                        if (r.is_error) {
                            const detail = r.errors?.join('; ') || r.subtype || 'unknown error';
                            send({
                                type: 'text',
                                text: `\n\n[Claude Code error: ${detail}. Make sure it is installed and signed in.]`,
                            });
                            gotText = true;
                        }
                    }
                }
                if (!gotText) {
                    send({ type: 'text', text: '[No response from Claude Code.]' });
                }
            } catch (err) {
                const detail = err instanceof Error ? err.message : 'unknown error';
                send({
                    type: 'text',
                    text: `\n\n[Could not reach Claude Code: ${detail}. Make sure Claude Code is installed and signed in.]`,
                });
            } finally {
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
    });
}
