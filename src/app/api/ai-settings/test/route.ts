import { NextResponse } from 'next/server';
import { resolveAISettings } from '@/lib/aiSettingsStore';

// Connection tests for the AI settings screen. Each returns { ok, detail } so
// the UI can show a green/red line per provider. Never echoes a key back.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface TestResult { ok: boolean; detail: string }

async function testOpenRouter(key: string): Promise<TestResult> {
    if (!key) return { ok: false, detail: 'No API key set.' };
    try {
        const r = await fetch('https://openrouter.ai/api/v1/credits', {
            headers: { Authorization: `Bearer ${key}` },
            cache: 'no-store',
            signal: AbortSignal.timeout(8000),
        });
        if (r.status === 401) return { ok: false, detail: 'Key rejected (401).' };
        if (!r.ok) return { ok: false, detail: `HTTP ${r.status}.` };
        const j = (await r.json()) as { data?: { total_credits?: number; total_usage?: number } };
        const total = Number(j?.data?.total_credits);
        const usage = Number(j?.data?.total_usage);
        if (Number.isFinite(total) && Number.isFinite(usage)) {
            return { ok: true, detail: `Connected — $${(total - usage).toFixed(2)} remaining.` };
        }
        return { ok: true, detail: 'Connected.' };
    } catch (e) {
        return { ok: false, detail: e instanceof Error ? e.message : 'Request failed.' };
    }
}

async function testOllama(baseUrl: string): Promise<TestResult> {
    try {
        const r = await fetch(`${baseUrl}/models`, {
            cache: 'no-store',
            signal: AbortSignal.timeout(4000),
        });
        if (!r.ok) return { ok: false, detail: `HTTP ${r.status}.` };
        const j = (await r.json()) as { data?: Array<{ id?: string }> };
        const n = (j?.data ?? []).length;
        return { ok: true, detail: `Running — ${n} model${n === 1 ? '' : 's'} installed.` };
    } catch {
        return { ok: false, detail: 'Not reachable. It will start on demand if auto-launch is on.' };
    }
}

async function testComfyUI(url: string): Promise<TestResult> {
    try {
        const r = await fetch(`${url.replace(/\/+$/, '')}/system_stats`, {
            cache: 'no-store',
            signal: AbortSignal.timeout(4000),
        });
        return r.ok ? { ok: true, detail: 'Connected.' } : { ok: false, detail: `HTTP ${r.status}.` };
    } catch {
        return { ok: false, detail: 'Not reachable — is ComfyUI running?' };
    }
}

async function testAnthropic(key: string): Promise<TestResult> {
    if (!key) return { ok: false, detail: 'No API key set.' };
    try {
        const r = await fetch('https://api.anthropic.com/v1/models?limit=1', {
            headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
            cache: 'no-store',
            signal: AbortSignal.timeout(8000),
        });
        if (r.status === 401) return { ok: false, detail: 'Key rejected (401).' };
        return r.ok ? { ok: true, detail: 'Connected.' } : { ok: false, detail: `HTTP ${r.status}.` };
    } catch (e) {
        return { ok: false, detail: e instanceof Error ? e.message : 'Request failed.' };
    }
}

export async function POST(request: Request) {
    let target = '';
    try {
        const body = (await request.json()) as { target?: string };
        target = typeof body?.target === 'string' ? body.target : '';
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const s = await resolveAISettings();

    switch (target) {
        case 'openrouter': return NextResponse.json(await testOpenRouter(s.openrouterApiKey));
        case 'ollama':     return NextResponse.json(await testOllama(s.ollamaBaseUrl));
        case 'comfyui':    return NextResponse.json(await testComfyUI(s.comfyuiUrl));
        case 'anthropic':  return NextResponse.json(await testAnthropic(s.anthropicApiKey));
        default:
            return NextResponse.json({ error: 'Unknown test target' }, { status: 400 });
    }
}
