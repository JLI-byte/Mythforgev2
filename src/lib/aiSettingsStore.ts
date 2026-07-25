/**
 * AI settings persistence — SERVER ONLY (uses node:fs).
 *
 * Settings live in a JSON file under the user's home directory, deliberately
 * outside the repo and outside localStorage:
 *   - the repo copy would risk committing keys,
 *   - localStorage would put keys in the browser AND inside the app's
 *     backup export, which writes localStorage verbatim to a download.
 *
 * Existing .env.local keys keep working: when the file has no value for a
 * secret, the environment is used as a fallback.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
    DEFAULT_AI_SETTINGS,
    mergeSettings,
    type AISettings,
    type SecretKey,
} from './aiSettings';

const DIR = process.env.LORECANVAS_CONFIG_DIR || path.join(os.homedir(), '.lorecanvas');
const FILE = path.join(DIR, 'ai-settings.json');

/** Which secrets the environment supplies, for the "from .env" badge. */
export function envConfiguredSecrets(): Partial<Record<SecretKey, boolean>> {
    return {
        openrouterApiKey: Boolean(process.env.OPENROUTER_API_KEY),
        anthropicApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
    };
}

/** Settings as stored on disk, merged over defaults. Never throws. */
export async function readAISettings(): Promise<AISettings> {
    try {
        const raw = await fs.readFile(FILE, 'utf8');
        return mergeSettings(DEFAULT_AI_SETTINGS, JSON.parse(raw));
    } catch {
        // Missing file or unreadable/corrupt JSON — fall back to defaults.
        return { ...DEFAULT_AI_SETTINGS };
    }
}

/** Apply a validated patch and persist. Returns the settings that were saved. */
export async function writeAISettings(patch: unknown): Promise<AISettings> {
    const next = mergeSettings(await readAISettings(), patch);
    await fs.mkdir(DIR, { recursive: true });
    // 0600: the file holds API keys, so keep it owner-only where the OS honours it.
    await fs.writeFile(FILE, JSON.stringify(next, null, 2), { encoding: 'utf8', mode: 0o600 });
    return next;
}

/**
 * The effective value of a secret: the saved key, else the environment.
 * Callers should use this rather than reading process.env directly.
 */
export async function resolveSecret(key: SecretKey): Promise<string> {
    const settings = await readAISettings();
    if (settings[key]) return settings[key];
    const envName = key === 'openrouterApiKey' ? 'OPENROUTER_API_KEY' : 'ANTHROPIC_API_KEY';
    return process.env[envName] ?? '';
}

/**
 * Settings with env fallbacks folded in, for the routes that need real values.
 * Env vars still win for the connection URLs so an operator can override a
 * deployment without touching the file.
 */
export async function resolveAISettings(): Promise<AISettings> {
    const s = await readAISettings();
    return {
        ...s,
        anthropicApiKey: s.anthropicApiKey || process.env.ANTHROPIC_API_KEY || '',
        openrouterApiKey: s.openrouterApiKey || process.env.OPENROUTER_API_KEY || '',
        ollamaBaseUrl: (process.env.OLLAMA_BASE_URL || s.ollamaBaseUrl).replace(/\/+$/, ''),
        defaultLocalModel: process.env.OLLAMA_MODEL || s.defaultLocalModel,
        imageModel: process.env.OPENROUTER_IMAGE_MODEL || s.imageModel,
    };
}

/** Where the settings file lives — surfaced in the UI so the user can find it. */
export const AI_SETTINGS_PATH = FILE;
