import { describe, it, expect } from 'vitest';
import {
    DEFAULT_AI_SETTINGS,
    maskSecret,
    mergeSettings,
    redactSettings,
    type AISettings,
} from './aiSettings';

const base: AISettings = { ...DEFAULT_AI_SETTINGS };

describe('maskSecret', () => {
    it('shows only the last four characters', () => {
        expect(maskSecret('sk-or-v1-abcd1234f2a9')).toBe('…f2a9');
    });

    it('returns empty for missing or blank values', () => {
        expect(maskSecret('')).toBe('');
        expect(maskSecret(undefined)).toBe('');
        expect(maskSecret('   ')).toBe('');
    });
});

describe('mergeSettings', () => {
    it('keeps the base when the patch is empty or junk', () => {
        expect(mergeSettings(base, {})).toEqual(base);
        expect(mergeSettings(base, null)).toEqual(base);
        expect(mergeSettings(base, 'nope')).toEqual(base);
    });

    it('applies valid enum values and rejects invalid ones', () => {
        expect(mergeSettings(base, { defaultProvider: 'local' }).defaultProvider).toBe('local');
        expect(mergeSettings(base, { defaultProvider: 'hacker' }).defaultProvider).toBe('claude');
        expect(mergeSettings(base, { claudeAuth: 'apiKey' }).claudeAuth).toBe('apiKey');
        expect(mergeSettings(base, { imageProvider: 'comfyui' }).imageProvider).toBe('comfyui');
    });

    it('trims strings and ignores non-strings', () => {
        expect(mergeSettings(base, { defaultLocalModel: '  mistral  ' }).defaultLocalModel).toBe('mistral');
        expect(mergeSettings(base, { claudeModel: 42 }).claudeModel).toBe(base.claudeModel);
    });

    it('never lets a blank wipe a field that needs a value', () => {
        expect(mergeSettings(base, { ollamaBaseUrl: '   ' }).ollamaBaseUrl).toBe(base.ollamaBaseUrl);
        expect(mergeSettings(base, { claudeModel: '' }).claudeModel).toBe(base.claudeModel);
    });

    it('allows clearing the optional local model', () => {
        const withModel = { ...base, defaultLocalModel: 'mistral' };
        expect(mergeSettings(withModel, { defaultLocalModel: '' }).defaultLocalModel).toBe('');
    });

    it('drops unknown keys entirely', () => {
        const merged = mergeSettings(base, { evil: 'payload', __proto__: { polluted: true } });
        expect(merged).toEqual(base);
        expect((merged as unknown as Record<string, unknown>).evil).toBeUndefined();
    });

    it('sets and clears secrets', () => {
        expect(mergeSettings(base, { openrouterApiKey: ' sk-or-123 ' }).openrouterApiKey).toBe('sk-or-123');
        const withKey = { ...base, openrouterApiKey: 'sk-or-123' };
        expect(mergeSettings(withKey, { openrouterApiKey: '' }).openrouterApiKey).toBe('');
    });

    it('leaves a stored secret alone when a redacted object is posted back', () => {
        const withKey = { ...base, openrouterApiKey: 'sk-or-123' };
        const roundTripped = mergeSettings(withKey, {
            openrouterApiKey: { configured: true, hint: '…-123' },
        });
        expect(roundTripped.openrouterApiKey).toBe('sk-or-123');
    });

    it('honours the boolean toggle', () => {
        expect(mergeSettings(base, { autoLaunchOllama: false }).autoLaunchOllama).toBe(false);
        expect(mergeSettings(base, { autoLaunchOllama: 'false' }).autoLaunchOllama).toBe(true);
    });
});

describe('redactSettings', () => {
    it('replaces secrets with a status and never leaks the value', () => {
        const settings = { ...base, openrouterApiKey: 'sk-or-v1-secret9999' };
        const red = redactSettings(settings);
        expect(red.openrouterApiKey).toEqual({ configured: true, hint: '…9999' });
        expect(JSON.stringify(red)).not.toContain('secret9999');
    });

    it('reports an unset secret as not configured', () => {
        expect(redactSettings(base).anthropicApiKey).toEqual({ configured: false, hint: '' });
    });

    it('marks a secret supplied by the environment', () => {
        const red = redactSettings(base, { openrouterApiKey: true });
        expect(red.openrouterApiKey).toEqual({ configured: true, hint: '', fromEnv: true });
    });

    it('passes non-secret fields through untouched', () => {
        const red = redactSettings({ ...base, defaultProvider: 'local', imageModel: 'x/y' });
        expect(red.defaultProvider).toBe('local');
        expect(red.imageModel).toBe('x/y');
    });
});
