import { NextResponse } from 'next/server';
import { query } from '@anthropic-ai/claude-agent-sdk';

// Must spawn the local Claude Code process — Node runtime, never edge.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Default model for the research assistant. */
const RESEARCH_CHAT_MODEL = 'claude-opus-4-8';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

/**
 * Research AI chat — LOCAL ONLY. Drives the user's signed-in Claude Code via
 * the Agent SDK, so replies run on their Max subscription. Built-in file/bash
 * tools are disabled (`tools: []`), so the assistant is purely conversational
 * and can never touch the machine, even under prompt injection from board text.
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
        (board.trim()
            ? `The user's current research board contains:\n${board}`
            : "The user's research board is currently empty.");

    // Render the conversation as a single prompt string.
    const prompt = messages
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n\n');

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            try {
                const q = query({
                    prompt,
                    options: {
                        model: RESEARCH_CHAT_MODEL,
                        systemPrompt,
                        tools: [], // disable ALL built-in tools — conversational only
                        permissionMode: 'default',
                    },
                });
                for await (const message of q) {
                    if (message.type === 'assistant') {
                        for (const block of (message as { content?: Array<{ type?: string; text?: string }> }).content ?? []) {
                            if (block?.type === 'text' && block.text) {
                                controller.enqueue(encoder.encode(block.text));
                            }
                        }
                    }
                }
            } catch (err) {
                const detail = err instanceof Error ? err.message : 'unknown error';
                controller.enqueue(
                    encoder.encode(
                        `\n\n[Could not reach Claude Code: ${detail}. Make sure Claude Code is installed and signed in.]`,
                    ),
                );
            } finally {
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
}
