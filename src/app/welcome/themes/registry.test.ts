import { describe, it, expect } from 'vitest';
import { LANDING_THEMES, getTheme, DEFAULT_THEME_ID, THEME_STORAGE_KEY } from './registry';

describe('landing theme registry', () => {
    it('has standard as the default and includes fantasy', () => {
        expect(LANDING_THEMES.some((t) => t.id === DEFAULT_THEME_ID)).toBe(true);
        expect(DEFAULT_THEME_ID).toBe('standard');
        expect(LANDING_THEMES.some((t) => t.id === 'fantasy')).toBe(true);
        expect(LANDING_THEMES.some((t) => t.id === 'standard')).toBe(true);
    });

    it('has unique theme ids', () => {
        const ids = LANDING_THEMES.map((t) => t.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('falls back to the default theme for unknown or null ids', () => {
        expect(getTheme('does-not-exist').id).toBe(DEFAULT_THEME_ID);
        expect(getTheme(null).id).toBe(DEFAULT_THEME_ID);
        expect(getTheme('fantasy').id).toBe('fantasy');
        expect(getTheme('standard').id).toBe('standard');
    });

    it('exposes a storage key for persistence', () => {
        expect(THEME_STORAGE_KEY.length).toBeGreaterThan(0);
    });
});
