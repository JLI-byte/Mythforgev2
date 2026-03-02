import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { ConsistencyIssue } from '@/types';

// Strip HTML tags from a string to send clean text to the AI
function stripHtml(html: string): string {
    // Replace block-level tags with newlines to preserve spacing
    const blockTags = /<\/?(p|div|h[1-6]|br)[^>]*>/gi;
    const withNewlines = html.replace(blockTags, '\n');
    // Strip remaining tags
    return withNewlines.replace(/<[^>]*>?/gm, '');
}

/**
 * Handles the upstream fetch mapping across various AI providers.
 */
async function callAIProvider(
    provider: string,
    apiKey: string,
    systemPrompt: string,
    userPrompt: string,
    ollamaEndpoint: string,
    ollamaModel: string
): Promise<string> {
    switch (provider) {
        case 'anthropic': {
            const anthropic = new Anthropic({ apiKey });
            const message = await anthropic.messages.create({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 1024,
                system: systemPrompt,
                messages: [{ role: 'user', content: userPrompt }],
                temperature: 0.1,
            });

            let responseText = '';
            for (const block of message.content) {
                if (block.type === 'text') {
                    responseText += block.text;
                }
            }
            return responseText;
        }

        case 'openai': {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: 0.1
                })
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(`OpenAI error: ${errorData.error?.message || res.statusText}`);
            }

            const data = await res.json();
            return data.choices[0].message.content;
        }

        case 'gemini': {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemInstruction: {
                        parts: [{ text: systemPrompt }]
                    },
                    contents: [{
                        parts: [{ text: userPrompt }]
                    }],
                    generationConfig: {
                        temperature: 0.1
                    }
                })
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(`Gemini error: ${errorData.error?.message || res.statusText}`);
            }

            const data = await res.json();
            return data.candidates[0].content.parts[0].text;
        }

        case 'ollama': {
            // Ensure no trailing slash on endpoint
            const cleanEndpoint = ollamaEndpoint.replace(/\/$/, '');
            const res = await fetch(`${cleanEndpoint}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: ollamaModel,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    stream: false,
                    options: { temperature: 0.1 }
                })
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(`Ollama error: ${errorData.error || res.statusText}`);
            }

            const data = await res.json();
            return data.message.content;
        }

        default:
            throw new Error(`Unsupported AI provider: ${provider}`);
    }
}

/**
 * POST /api/consistency-check
 * Evaluates the provided document content against the provided entities 
 * to find any logical or factual inconsistencies.
 * 
 * Required body:
 * - documentContent: string (HTML or plain text)
 * - entities: array of entity objects (must include name, type, and description)
 */
export async function POST(req: Request) {
    try {
        // Resolve headers
        const providerHeader = req.headers.get('x-ai-provider') || 'anthropic';
        const apiKeyHeader = req.headers.get('x-api-key') || '';
        const ollamaEndpoint = req.headers.get('x-ollama-endpoint') || 'http://localhost:11434';
        const ollamaModel = req.headers.get('x-ollama-model') || 'llama3';

        // Fallback for Anthropic
        const apiKey = apiKeyHeader || (providerHeader === 'anthropic' ? process.env.ANTHROPIC_API_KEY : '');

        // Validation based on provider
        if (providerHeader !== 'ollama' && !apiKey) {
            return NextResponse.json(
                { error: `No API key provided. Add your ${providerHeader} API key in Settings.` },
                { status: 400 }
            );
        }

        const body = await req.json();
        const { documentContent, entities } = body;

        if (!documentContent || !entities || !Array.isArray(entities)) {
            return NextResponse.json(
                { error: 'Invalid request body. Requires documentContent and entities array.' },
                { status: 400 }
            );
        }

        // Apply input caps
        const cappedContent = documentContent.slice(0, 8000);
        const cappedEntities = entities.slice(0, 50);

        const safeEntities = cappedEntities.map((e: Record<string, unknown>) => ({
            name: typeof e.name === 'string' ? e.name : 'Unknown',
            type: typeof e.type === 'string' ? e.type : 'unknown',
            description: typeof e.description === 'string' ? e.description : ''
        }));

        // Strip HTML to reduce token usage and improve AI comprehension
        const cleanContent = stripHtml(cappedContent);

        // Format entities for the prompt
        const entitiesContext = safeEntities.map(e =>
            `Entity: ${e.name} (${e.type})\nDescription: ${e.description}`
        ).join('\n\n');

        const systemPrompt = `You are an expert consistency checker for a fantasy/sci-fi writing tool. 
Your job is to analyze the user's text and compare it against the provided world-building entities.
Look for contradictions, factual errors, or anachronisms based STRICTLY on the provided entities.
If there are no issues, return an empty array.
If there are issues, return a JSON array of issue objects. Each object must have:
- "entityName": the name of the entity involved
- "issueType": a short category (e.g., "Contradiction", "Missing Detail")
- "description": a clear explanation of what is inconsistent
- "severity": "High", "Medium", or "Low"

Respond ONLY with valid JSON. Do not include markdown formatting like \`\`\`json.`;

        const userPrompt = `WORLD ENTITIES:
${entitiesContext}

DOCUMENT CONTENT:
${cleanContent}`;

        // Send to unified execution layer mapping out across the 4 providers
        const responseText = await callAIProvider(
            providerHeader,
            apiKey as string,
            systemPrompt,
            userPrompt,
            ollamaEndpoint,
            ollamaModel
        );

        let issues: ConsistencyIssue[] = [];

        // Try to extract JSON if Claude wrapped it in markdown
        const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
        const rawJsonText = jsonMatch ? jsonMatch[1] : responseText;

        // Parse the JSON response
        try {
            const parsed = JSON.parse(rawJsonText.trim());
            if (Array.isArray(parsed)) {
                // Per-issue schema validation filter
                issues = parsed.filter(item =>
                    item &&
                    typeof item === 'object' &&
                    typeof item.entityName === 'string' &&
                    typeof item.issueType === 'string' &&
                    typeof item.description === 'string' &&
                    ['High', 'Medium', 'Low'].includes(item.severity)
                ).map(item => ({
                    ...item,
                    description: item.description.slice(0, 300)
                }));
            }
        } catch {
            // Bracket extraction fallback
            try {
                const firstBracket = responseText.indexOf('[');
                const lastBracket = responseText.lastIndexOf(']');
                if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
                    const substring = responseText.substring(firstBracket, lastBracket + 1);
                    const parsed = JSON.parse(substring);
                    if (Array.isArray(parsed)) {
                        issues = parsed.filter(item =>
                            item &&
                            typeof item === 'object' &&
                            typeof item.entityName === 'string' &&
                            typeof item.issueType === 'string' &&
                            typeof item.description === 'string' &&
                            ['High', 'Medium', 'Low'].includes(item.severity)
                        ).map(item => ({
                            ...item,
                            description: item.description.slice(0, 300)
                        }));
                    }
                } else {
                    throw new Error('No brackets found');
                }
            } catch {
                console.error('Failed to parse Claude response as JSON', responseText);
                // We log the error but return an empty array or a generic error issue
                // rather than throwing a 500 if the AI just formatted it badly.
                return NextResponse.json(
                    { error: 'AI returned invalid formatting. Please try again.' },
                    { status: 502 } // Bad Gateway (since AI is the upstream)
                );
            }
        }

        return NextResponse.json({ issues }, { status: 200 });

    } catch (error: unknown) {
        console.error('Error in consistency check API:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal Server Error' },
            { status: 500 }
        );
    }
}
