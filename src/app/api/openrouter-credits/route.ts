import { NextResponse } from 'next/server';

// Reads the user's OpenRouter balance server-side so the key never reaches the
// browser. Errors are returned as a 200 with an `error` field so the client can
// degrade quietly instead of logging failed requests.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) return NextResponse.json({ error: 'not_configured' });

    try {
        const resp = await fetch('https://openrouter.ai/api/v1/credits', {
            headers: { Authorization: `Bearer ${key}` },
            cache: 'no-store',
        });
        if (!resp.ok) return NextResponse.json({ error: `http_${resp.status}` });

        const json = (await resp.json()) as { data?: { total_credits?: number; total_usage?: number } };
        const total = Number(json?.data?.total_credits);
        const usage = Number(json?.data?.total_usage);
        if (Number.isFinite(total) && Number.isFinite(usage)) {
            return NextResponse.json({ remaining: total - usage, usage, total });
        }
        return NextResponse.json({ error: 'bad_shape' });
    } catch {
        return NextResponse.json({ error: 'fetch_failed' });
    }
}
