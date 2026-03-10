/**
 * route.ts — /api/ai/chat
 *
 * Streaming API route for the MythForge AI Chat feature.
 * Accepts a conversation history and system prompt, forwards them to the
 * Anthropic API, and streams the response back as raw text chunks.
 *
 * The ANTHROPIC_API_KEY is read from process.env server-side only —
 * it is never exposed to the client in any response, header, or log.
 */

import Anthropic from '@anthropic-ai/sdk';

// --- Types ---

interface ChatRequestBody {
    messages: { role: 'user' | 'assistant'; content: string }[];
    systemPrompt: string;
    model: string;
}

// --- Route handler ---

/**
 * POST /api/ai/chat
 *
 * Streams an Anthropic response for the given conversation.
 *
 * Request body:
 *   - messages:     Array of { role, content } message objects
 *   - systemPrompt: The assembled system prompt (includes world/character context)
 *   - model:        Anthropic model ID (e.g. 'claude-sonnet-4-6')
 *
 * Response:
 *   - 200: text/event-stream with raw text chunks
 *   - 400: JSON error for invalid request body
 *   - 500: JSON error for missing API key or upstream failure
 */
export async function POST(req: Request) {
    // --- 1. Validate API key ---
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
        return new Response(
            JSON.stringify({ error: 'ANTHROPIC_API_KEY is not configured. Add it to .env.local.' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }

    // --- 2. Parse and validate request body ---
    let body: ChatRequestBody;
    try {
        body = await req.json();
    } catch {
        return new Response(
            JSON.stringify({ error: 'Invalid JSON in request body.' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    const { messages, systemPrompt, model } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return new Response(
            JSON.stringify({ error: 'Request must include a non-empty messages array.' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    if (!systemPrompt || typeof systemPrompt !== 'string') {
        return new Response(
            JSON.stringify({ error: 'Request must include a systemPrompt string.' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    if (!model || typeof model !== 'string') {
        return new Response(
            JSON.stringify({ error: 'Request must include a model string.' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    // --- 3. Create Anthropic client and stream the response ---
    try {
        const anthropic = new Anthropic({ apiKey });

        const stream = anthropic.messages.stream({
            model,
            max_tokens: 2048,
            system: systemPrompt,
            messages: messages.map(m => ({
                role: m.role,
                content: m.content,
            })),
        });

        // Build a ReadableStream that forwards text deltas to the client
        const readableStream = new ReadableStream({
            async start(controller) {
                try {
                    const response = await stream.finalMessage();

                    // Extract all text blocks from the final response
                    for (const block of response.content) {
                        if (block.type === 'text') {
                            controller.enqueue(new TextEncoder().encode(block.text));
                        }
                    }

                    controller.close();
                } catch (streamError: unknown) {
                    const message = streamError instanceof Error
                        ? streamError.message
                        : 'Stream processing failed.';
                    controller.error(new Error(message));
                }
            },
        });

        return new Response(readableStream, {
            status: 200,
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal server error.';
        return new Response(
            JSON.stringify({ error: message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
