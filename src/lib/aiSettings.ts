/**
 * AI settings — shape, defaults, merging and redaction. LEAF MODULE (no fs,
 * no store), so it is safe to import from tests and from either side of the
 * wire. Reading and writing the file lives in aiSettingsStore.ts (server only).
 *
 * SECRETS NEVER REACH THE BROWSER. API keys live in a file outside the repo;
 * the client only ever receives `{ configured, hint }` for each secret. This
 * matters here specifically because the app's backup feature exports
 * localStorage verbatim — anything kept in the workspace store would end up in
 * a plaintext backup file.
 */

export type ChatProvider = 'claude' | 'local';
export type ClaudeAuthMode = 'subscription' | 'apiKey';
export type ImageProvider = 'openrouter' | 'comfyui';

export interface AISettings {
    /** Which backend the research chat opens with. */
    defaultProvider: ChatProvider;
    /** How Claude is authenticated: the signed-in Claude Code, or an API key. */
    claudeAuth: ClaudeAuthMode;
    claudeModel: string;
    anthropicApiKey: string;

    ollamaBaseUrl: string;
    defaultLocalModel: string;
    /** Start `ollama serve` automatically when local mode can't reach it. */
    autoLaunchOllama: boolean;

    imageProvider: ImageProvider;
    openrouterApiKey: string;
    imageModel: string;

    comfyuiUrl: string;
    /** Diffusion model file inside ComfyUI's models/diffusion_models. */
    comfyModel: string;
    /** Text encoder file — must match the model family. */
    comfyClip: string;
    comfyVae: string;
    comfySteps: number;
    /** Applied via CFGGuider; the main lever against the "AI plastic" look. */
    comfyNegative: string;
}

/** Fields that must never be sent to the browser. */
export const SECRET_KEYS = ['anthropicApiKey', 'openrouterApiKey'] as const;
export type SecretKey = (typeof SECRET_KEYS)[number];

export const DEFAULT_AI_SETTINGS: AISettings = {
    defaultProvider: 'claude',
    claudeAuth: 'subscription',
    claudeModel: 'claude-opus-4-8',
    anthropicApiKey: '',

    ollamaBaseUrl: 'http://localhost:11434/v1',
    defaultLocalModel: '',
    autoLaunchOllama: true,

    imageProvider: 'openrouter',
    openrouterApiKey: '',
    imageModel: 'black-forest-labs/flux.2-pro',

    comfyuiUrl: 'http://127.0.0.1:8188',
    comfyModel: 'flux-2-klein-base-9b-fp8.safetensors',
    comfyClip: 'qwen_3_8b_fp8mixed.safetensors',
    comfyVae: 'flux2-vae.safetensors',
    comfySteps: 20,
    comfyNegative: 'smooth plastic skin, airbrushed, waxy, doll-like, 3d render, illustration, cartoon, oversaturated colors',
};

/** What the client sees in place of a secret. */
export interface SecretStatus {
    configured: boolean;
    /** Last four characters, e.g. "…4f2a" — enough to tell two keys apart. */
    hint: string;
    /** True when the value came from the environment rather than the settings file. */
    fromEnv?: boolean;
}

export type RedactedAISettings =
    Omit<AISettings, SecretKey> & Record<SecretKey, SecretStatus>;

/** "…4f2a" for a key, or an empty string when there's nothing to hint at. */
export function maskSecret(value: string | undefined): string {
    const v = (value ?? '').trim();
    if (!v) return '';
    return `…${v.slice(-4)}`;
}

const PROVIDERS: ChatProvider[] = ['claude', 'local'];
const AUTH_MODES: ClaudeAuthMode[] = ['subscription', 'apiKey'];
const IMAGE_PROVIDERS: ImageProvider[] = ['openrouter', 'comfyui'];

function pickEnum<T extends string>(value: unknown, allowed: T[], fallback: T): T {
    return typeof value === 'string' && (allowed as string[]).includes(value) ? (value as T) : fallback;
}

function pickString(value: unknown, fallback: string, max = 400): string {
    if (typeof value !== 'string') return fallback;
    return value.trim().slice(0, max);
}

/**
 * Merge an untrusted partial (a request body, or a parsed settings file) onto
 * a base, validating every field. Unknown keys are dropped; a field that is
 * absent keeps its base value. Secrets are only replaced when the patch
 * actually carries a string, so a redacted round-trip can't wipe a key.
 */
export function mergeSettings(base: AISettings, patch: unknown): AISettings {
    // Request bodies are untrusted: anything that isn't a plain object (a
    // string, a number, null) leaves the base untouched rather than throwing.
    if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) return { ...base };
    const p = patch as Record<string, unknown>;
    const next: AISettings = { ...base };

    if ('defaultProvider' in p) next.defaultProvider = pickEnum(p.defaultProvider, PROVIDERS, base.defaultProvider);
    if ('claudeAuth' in p) next.claudeAuth = pickEnum(p.claudeAuth, AUTH_MODES, base.claudeAuth);
    if ('imageProvider' in p) next.imageProvider = pickEnum(p.imageProvider, IMAGE_PROVIDERS, base.imageProvider);

    if ('claudeModel' in p) next.claudeModel = pickString(p.claudeModel, base.claudeModel, 120) || base.claudeModel;
    if ('defaultLocalModel' in p) next.defaultLocalModel = pickString(p.defaultLocalModel, base.defaultLocalModel, 120);
    if ('imageModel' in p) next.imageModel = pickString(p.imageModel, base.imageModel, 160) || base.imageModel;
    if ('ollamaBaseUrl' in p) next.ollamaBaseUrl = pickString(p.ollamaBaseUrl, base.ollamaBaseUrl) || base.ollamaBaseUrl;
    if ('comfyuiUrl' in p) next.comfyuiUrl = pickString(p.comfyuiUrl, base.comfyuiUrl) || base.comfyuiUrl;
    if ('comfyModel' in p) next.comfyModel = pickString(p.comfyModel, base.comfyModel, 200) || base.comfyModel;
    if ('comfyClip' in p) next.comfyClip = pickString(p.comfyClip, base.comfyClip, 200) || base.comfyClip;
    if ('comfyVae' in p) next.comfyVae = pickString(p.comfyVae, base.comfyVae, 200) || base.comfyVae;
    if ('comfyNegative' in p) next.comfyNegative = pickString(p.comfyNegative, base.comfyNegative, 800);

    if ('comfySteps' in p) {
        const n = Math.round(Number(p.comfySteps));
        if (Number.isFinite(n) && n > 0) next.comfySteps = Math.min(60, n);
    }

    if ('autoLaunchOllama' in p && typeof p.autoLaunchOllama === 'boolean') {
        next.autoLaunchOllama = p.autoLaunchOllama;
    }

    // Secrets: a string replaces (empty string clears); anything else is ignored,
    // so posting back a redacted object leaves the stored key untouched.
    for (const key of SECRET_KEYS) {
        if (typeof p[key] === 'string') next[key] = (p[key] as string).trim();
    }

    return next;
}

/** Strip secrets down to a status the browser can safely render. */
export function redactSettings(
    settings: AISettings,
    envConfigured: Partial<Record<SecretKey, boolean>> = {},
): RedactedAISettings {
    const { anthropicApiKey, openrouterApiKey, ...rest } = settings;
    const status = (value: string, key: SecretKey): SecretStatus => {
        if (value) return { configured: true, hint: maskSecret(value) };
        if (envConfigured[key]) return { configured: true, hint: '', fromEnv: true };
        return { configured: false, hint: '' };
    };
    return {
        ...rest,
        anthropicApiKey: status(anthropicApiKey, 'anthropicApiKey'),
        openrouterApiKey: status(openrouterApiKey, 'openrouterApiKey'),
    };
}
