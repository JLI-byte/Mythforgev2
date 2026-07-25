import { NextResponse } from 'next/server';
import { resolveAISettings } from '@/lib/aiSettingsStore';

// Lists the locally installed Ollama models so the composer's model picker can
// offer them. Deliberately does NOT auto-launch the server — merely opening a
// dropdown shouldn't start a process. Errors return a 200 with an empty list so
// the picker degrades to "Claude only" quietly.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
    // /v1/models is the OpenAI-compatible listing.
    const { ollamaBaseUrl } = await resolveAISettings();
    try {
        const resp = await fetch(`${ollamaBaseUrl}/models`, {
            cache: 'no-store',
            signal: AbortSignal.timeout(2500),
        });
        if (!resp.ok) return NextResponse.json({ models: [], reachable: false });
        const json = (await resp.json()) as { data?: Array<{ id?: string }> };
        const models = (json?.data ?? [])
            .map(m => m.id)
            .filter((id): id is string => typeof id === 'string' && id.length > 0)
            .sort((a, b) => a.localeCompare(b));
        return NextResponse.json({ models, reachable: true });
    } catch {
        return NextResponse.json({ models: [], reachable: false });
    }
}
