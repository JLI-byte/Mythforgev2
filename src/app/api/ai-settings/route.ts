import { NextResponse } from 'next/server';
import { redactSettings } from '@/lib/aiSettings';
import {
    readAISettings,
    writeAISettings,
    envConfiguredSecrets,
    AI_SETTINGS_PATH,
} from '@/lib/aiSettingsStore';

// Reads and writes the AI settings file. Secrets are accepted on PUT but never
// returned: every response goes through redactSettings, so an API key can be
// set or cleared from the UI but never read back out of it.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
    const settings = await readAISettings();
    return NextResponse.json({
        settings: redactSettings(settings, envConfiguredSecrets()),
        path: AI_SETTINGS_PATH,
    });
}

export async function PUT(request: Request) {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    try {
        const saved = await writeAISettings(body);
        return NextResponse.json({
            settings: redactSettings(saved, envConfiguredSecrets()),
            path: AI_SETTINGS_PATH,
        });
    } catch (e) {
        const detail = e instanceof Error ? e.message : 'unknown error';
        return NextResponse.json({ error: `Could not save settings: ${detail}` }, { status: 500 });
    }
}
