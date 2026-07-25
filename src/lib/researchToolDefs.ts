/**
 * Shared research-assistant tool definitions.
 *
 * One source of truth for both chat backends: the Claude Agent SDK path wraps
 * each def with `tool()`, and the local (Ollama) path converts each shape to a
 * JSON schema via `z.toJSONSchema` and runs the same `run()` handlers. A handler
 * emits its NDJSON event(s) through `send` and returns the short confirmation
 * string the model sees as the tool result.
 */
import { z } from 'zod';

/** The eight World Bible entity types. */
export const ENTITY_TYPES = [
    'character', 'location', 'faction', 'artifact', 'lore', 'magic', 'religion', 'species',
] as const;

/** Emit one NDJSON event on the response stream. */
export type ToolSend = (event: Record<string, unknown>) => void;

export interface ResearchToolDef {
    name: string;
    description: string;
    /** Zod raw shape — feeds both the Agent SDK `tool()` and `z.toJSONSchema`. */
    shape: z.ZodRawShape;
    /** Perform the effect (via `send`) and return the model-facing confirmation. */
    run: (args: Record<string, unknown>, send: ToolSend) => Promise<string>;
}

/** Typed factory — each handler sees its inferred args; the stored def is erased. */
function def<S extends z.ZodRawShape>(
    name: string,
    description: string,
    shape: S,
    run: (args: z.infer<z.ZodObject<S>>, send: ToolSend) => Promise<string>,
): ResearchToolDef {
    return {
        name,
        description,
        shape,
        run: (args, send) => run(args as z.infer<z.ZodObject<S>>, send),
    };
}

import { resolveAISettings } from './aiSettingsStore';

/**
 * Pull a displayable image (a data URL) out of an OpenRouter image response,
 * tolerating both the /images shape (data[].b64_json) and the older
 * chat-completions image shape (message.images[].image_url.url).
 */
export function extractImageDataUrl(json: unknown): string | null {
    const j = json as {
        data?: Array<{ b64_json?: string; media_type?: string; url?: string }>;
        choices?: Array<{ message?: { images?: Array<{ image_url?: { url?: string } }> } }>;
    };
    const d = j?.data?.[0];
    if (d?.b64_json) return `data:${d.media_type || 'image/png'};base64,${d.b64_json}`;
    const chatImg = j?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (typeof chatImg === 'string') return chatImg;
    if (typeof d?.url === 'string') return d.url;
    return null;
}

/** Build the full list of research tool definitions. */
export function researchToolDefs(): ResearchToolDef[] {
    return [
        def(
            'add_research_card',
            "Add a note card to the user's research board. Only use when the user asks to save or add something.",
            { text: z.string().describe('The note text to place on the board') },
            async (args, send) => {
                send({ type: 'card', text: args.text });
                return 'Added a note card to the board.';
            },
        ),

        def(
            'ask_options',
            "Offer the user a small set of mutually-exclusive choices as clickable buttons instead of asking in prose. Use it for forks — e.g. 'hard or soft magic?', 'port city or mountain hold?'. Give a short prompt and 2-4 concise options. After calling this, STOP and wait: the user's click becomes their next message.",
            {
                prompt: z.string().describe('The question to put above the choices'),
                options: z.array(z.string()).min(2).max(4).describe('2-4 short, mutually-exclusive choices'),
            },
            async (args, send) => {
                send({ type: 'options', prompt: args.prompt, options: args.options });
                return 'Presented options; waiting for the user to choose.';
            },
        ),

        def(
            'suggest_article',
            "Add an entity to the Article Suggestions board as something that probably deserves its own World Bible article but doesn't have one yet. Non-destructive — this only suggests, it never creates the article. Call it freely as you talk whenever you name such a thing.",
            {
                name: z.string().describe('The proposed article / entity name'),
                type: z.enum(ENTITY_TYPES).describe('The entity type'),
                category: z.string().optional().describe('Best-fitting folder: an existing folder name, or a short new folder name if none fits'),
                reason: z.string().optional().describe('One line on what it is / why it matters'),
            },
            async (args, send) => {
                send({ type: 'suggest', name: args.name, entityType: args.type, category: args.category, reason: args.reason });
                return `Suggested "${args.name}".`;
            },
        ),

        def(
            'flag_issue',
            "Flag a consistency problem in the World Bible onto the Consistency & Gaps board. Use kind 'contradiction' when two articles disagree, or 'gap' when something is clearly missing (a faction with no leader, a place mentioned but never described). Non-destructive — this only flags. Skip anything already on the flags list below.",
            {
                kind: z.enum(['contradiction', 'gap']).describe('contradiction (two articles disagree) or gap (something missing)'),
                summary: z.string().describe('One-line statement of the problem'),
                detail: z.string().optional().describe('A sentence of explanation or how to resolve it'),
            },
            async (args, send) => {
                send({ type: 'flag', kind: args.kind, summary: args.summary, detail: args.detail });
                return `Flagged: ${args.summary}`;
            },
        ),

        def(
            'update_understanding',
            "Update your living 'What I Understand' note for this world: a short summary of the world as you now grasp it, and any preferences you've learned about how the user wants to work. Call it when your understanding materially changes or the user corrects you or signals a preference (including 👍/👎). Keep the summary to a tight paragraph.",
            {
                summary: z.string().describe('A tight paragraph summarizing the world as you understand it'),
                preferences: z.string().optional().describe('Learned preferences: tone, taste, what to avoid'),
            },
            async (args, send) => {
                send({ type: 'understanding', summary: args.summary, preferences: args.preferences ?? '' });
                return 'Updated my understanding.';
            },
        ),

        def(
            'generate_image',
            "Generate an image from a text prompt and show it in the chat. Use when the user asks you to draw, illustrate, visualize, or make a picture — a character portrait, a map, a location, an item. Write a rich, specific visual prompt (subject, setting, mood, style). Costs the user money, so only when asked.",
            { prompt: z.string().describe('A detailed visual description of the image to generate') },
            async (args, send) => {
                const { openrouterApiKey: key, imageModel } = await resolveAISettings();
                if (!key) {
                    return 'Image generation is not configured — tell the user to add their OpenRouter API key in Settings → AI.';
                }
                try {
                    const resp = await fetch('https://openrouter.ai/api/v1/images', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${key}`,
                            'Content-Type': 'application/json',
                            'HTTP-Referer': 'https://lorecanvas.app',
                            'X-Title': 'LoreCanvas',
                        },
                        body: JSON.stringify({ model: imageModel, prompt: args.prompt }),
                    });
                    if (!resp.ok) {
                        const errText = await resp.text().catch(() => '');
                        return `Image generation failed (HTTP ${resp.status}). ${errText.slice(0, 200)}`;
                    }
                    const dataUrl = extractImageDataUrl(await resp.json());
                    if (!dataUrl) return 'Image generation returned no usable image.';
                    send({ type: 'generated_image', prompt: args.prompt, dataUrl });
                    return `Generated an image for: ${args.prompt}`;
                } catch (e) {
                    return `Image generation error: ${e instanceof Error ? e.message : 'unknown'}`;
                }
            },
        ),

        def(
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
            async (args, send) => {
                send({
                    type: 'article',
                    name: args.name,
                    entityType: args.type,
                    description: args.description,
                    sections: args.sections,
                    category: args.category,
                });
                return `Created the "${args.name}" article.`;
            },
        ),

        def(
            'create_category',
            'Create a World Bible category (folder), optionally nested under an existing one. Only use when the user asks to create or add a category.',
            {
                name: z.string().describe('The category (folder) name'),
                icon: z.string().optional().describe('An emoji icon (optional)'),
                parent: z.string().optional().describe('Existing category name to nest under (optional)'),
            },
            async (args, send) => {
                send({ type: 'category', name: args.name, icon: args.icon, parent: args.parent });
                return `Created the "${args.name}" category.`;
            },
        ),

        def(
            'move_article',
            'Move an existing article into a category. Only use when the user asks to move or reorganize.',
            {
                article: z.string().describe('The article name to move'),
                category: z.string().describe('The destination category (folder) name'),
            },
            async (args, send) => {
                send({ type: 'move', article: args.article, category: args.category });
                return `Moved "${args.article}" to "${args.category}".`;
            },
        ),

        def(
            'edit_article',
            'Revise an existing article: replace its description, append new sections to its body, and/or add tags. Only use when the user asks to edit, expand, or flesh out an article.',
            {
                name: z.string().describe('The article to edit'),
                description: z.string().optional().describe('New summary (replaces the old one)'),
                append_sections: z
                    .array(z.object({ heading: z.string().optional(), body: z.string() }))
                    .optional()
                    .describe('New titled sections to append to the article body'),
                tags: z.array(z.string()).optional().describe('Tags to add'),
            },
            async (args, send) => {
                send({
                    type: 'edit',
                    name: args.name,
                    description: args.description,
                    append_sections: args.append_sections,
                    tags: args.tags,
                });
                return `Updated "${args.name}".`;
            },
        ),

        def(
            'rename_article',
            'Rename an existing article. Only use when the user asks to rename it.',
            { name: z.string().describe('Current article name'), new_name: z.string().describe('New name') },
            async (args, send) => {
                send({ type: 'rename_article', name: args.name, new_name: args.new_name });
                return `Renamed "${args.name}" to "${args.new_name}".`;
            },
        ),

        def(
            'delete_article',
            'Delete an article from the World Bible. Only use when the user asks to delete it.',
            { name: z.string().describe('The article to delete') },
            async (args, send) => {
                send({ type: 'delete_article', name: args.name });
                return `Deleted "${args.name}".`;
            },
        ),

        def(
            'rename_category',
            'Rename a category (folder). Only use when the user asks to rename it.',
            { name: z.string().describe('Current folder name'), new_name: z.string().describe('New name') },
            async (args, send) => {
                send({ type: 'rename_category', name: args.name, new_name: args.new_name });
                return `Renamed category "${args.name}" to "${args.new_name}".`;
            },
        ),

        def(
            'delete_category',
            'Delete a category (folder); its articles become unfiled. Only use when the user asks to delete it.',
            { name: z.string().describe('The folder to delete') },
            async (args, send) => {
                send({ type: 'delete_category', name: args.name });
                return `Deleted category "${args.name}".`;
            },
        ),
    ];
}
