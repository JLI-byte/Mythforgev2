import { NextResponse } from 'next/server';
import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

// Must spawn the local Claude Code process — Node runtime, never edge.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Default model for the research assistant. */
const RESEARCH_CHAT_MODEL = 'claude-opus-4-8';

/** Fully-qualified names of the in-process tools (mcp__<server>__<tool>). */
const ADD_CARD_TOOL = 'mcp__research__add_research_card';
const CREATE_ARTICLE_TOOL = 'mcp__research__create_article';
const CREATE_CATEGORY_TOOL = 'mcp__research__create_category';
const MOVE_ARTICLE_TOOL = 'mcp__research__move_article';

/** The eight World Bible entity types. */
const ENTITY_TYPES = [
    'character', 'location', 'faction', 'artifact', 'lore', 'magic', 'religion', 'species',
] as const;

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
    let body: { messages?: ChatMessage[]; board?: string; world?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const messages = Array.isArray(body.messages) ? body.messages : [];
    const board = typeof body.board === 'string' ? body.board : '';
    const world = typeof body.world === 'string' ? body.world : '';
    if (messages.length === 0) {
        return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
    }

    const systemPrompt = [
        'You are a research and worldbuilding assistant embedded in LoreCanvas, a writing app for novelists and worldbuilders.',
        'Help the user develop, organize, and build their world. Be concise and concrete.',
        '',
        'TOOLS — only call a tool when the user explicitly asks you to create, add, save, or organize something. Never act unprompted.',
        '- add_research_card: place a short note on the research board.',
        '- create_article: create a World Bible article. Its type must be one of: ' + ENTITY_TYPES.join(', ') + '.',
        '  Give it a name, a one- or two-sentence description, and a body of titled sections (rich, multi-section prose).',
        '  Optionally pass `category` (an existing folder name from the World Bible below) to file it there; otherwise it is filed by type.',
        '- create_category: create a folder to organize articles, optionally nested under an existing folder.',
        '- move_article: move an existing article into a folder.',
        '',
        'BE PROACTIVE WITH SUGGESTIONS: as the user describes their world, suggest articles or categories worth creating',
        '(e.g. "Sounds like you need an article for the Crimson King — want me to make it?"). But only call a tool after they agree.',
        '',
        board.trim() ? `Research board:\n${board}` : 'The research board is empty.',
        '',
        world.trim() ? `World Bible (folders and articles):\n${world}` : 'The World Bible is empty.',
    ].join('\n');

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
            // Emit one NDJSON event on the response stream. The tool handlers
            // below run server-side but the board/World Bible live in the
            // browser, so each tool forwards its parameters as an event and the
            // client applies it to the store.
            const send = (event: Record<string, unknown>) => {
                controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
            };

            const addCardTool = tool(
                'add_research_card',
                "Add a note card to the user's research board. Only use when the user asks to save or add something.",
                { text: z.string().describe('The note text to place on the board') },
                async (args) => {
                    send({ type: 'card', text: args.text });
                    return { content: [{ type: 'text', text: 'Added a note card to the board.' }] };
                },
            );

            const createArticleTool = tool(
                'create_article',
                'Create a World Bible article (an entity). Only use when the user asks to create or add an article. Provide rich, multi-section content.',
                {
                    name: z.string().describe('The article / entity name'),
                    type: z.enum(ENTITY_TYPES).describe('The entity type'),
                    description: z.string().describe('A one- or two-sentence summary'),
                    sections: z
                        .array(
                            z.object({
                                heading: z.string().optional().describe('Section heading'),
                                body: z.string().describe('Section prose; blank lines separate paragraphs'),
                            }),
                        )
                        .describe('The article body, as titled sections'),
                    category: z.string().optional().describe('Existing folder name to file it under (optional)'),
                },
                async (args) => {
                    send({
                        type: 'article',
                        name: args.name,
                        entityType: args.type,
                        description: args.description,
                        sections: args.sections,
                        category: args.category,
                    });
                    return { content: [{ type: 'text', text: `Created the "${args.name}" article.` }] };
                },
            );

            const createCategoryTool = tool(
                'create_category',
                'Create a World Bible category (folder), optionally nested under an existing one. Only use when the user asks to create or add a category.',
                {
                    name: z.string().describe('The category (folder) name'),
                    icon: z.string().optional().describe('An emoji icon (optional)'),
                    parent: z.string().optional().describe('Existing category name to nest under (optional)'),
                },
                async (args) => {
                    send({ type: 'category', name: args.name, icon: args.icon, parent: args.parent });
                    return { content: [{ type: 'text', text: `Created the "${args.name}" category.` }] };
                },
            );

            const moveArticleTool = tool(
                'move_article',
                'Move an existing article into a category. Only use when the user asks to move or reorganize.',
                {
                    article: z.string().describe('The article name to move'),
                    category: z.string().describe('The destination category (folder) name'),
                },
                async (args) => {
                    send({ type: 'move', article: args.article, category: args.category });
                    return { content: [{ type: 'text', text: `Moved "${args.article}" to "${args.category}".` }] };
                },
            );

            const researchServer = createSdkMcpServer({
                name: 'research',
                version: '1.0.0',
                tools: [addCardTool, createArticleTool, createCategoryTool, moveArticleTool],
            });

            try {
                const q = query({
                    prompt,
                    options: {
                        model: RESEARCH_CHAT_MODEL,
                        systemPrompt,
                        tools: [], // no built-in file/bash tools
                        mcpServers: { research: researchServer },
                        allowedTools: [ADD_CARD_TOOL, CREATE_ARTICLE_TOOL, CREATE_CATEGORY_TOOL, MOVE_ARTICLE_TOOL], // auto-approve our tools (no prompt)
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
