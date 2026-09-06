import { describe, it, expect } from 'vitest';
import {
    DESK_STAGES,
    STAGE_LABELS,
    variantForStage,
    resolveLegacyMode,
    isDeskStage,
    coerceStage,
} from './deskStages';

describe('DESK_STAGES', () => {
    it('runs Research, Drafting, Writing in that order', () => {
        expect(DESK_STAGES).toEqual(['research', 'draft', 'write']);
    });

    it('labels every stage', () => {
        expect(DESK_STAGES.map(s => STAGE_LABELS[s])).toEqual(['Research', 'Drafting', 'Writing']);
    });
});

describe('variantForStage', () => {
    it('maps each stage onto the WritingDesk variant that already implements it', () => {
        expect(variantForStage('research')).toBe('research');
        expect(variantForStage('draft')).toBe('draft');
        expect(variantForStage('write')).toBe('desk');
    });
});

describe('isDeskStage', () => {
    it('accepts the three stages', () => {
        expect(isDeskStage('research')).toBe(true);
        expect(isDeskStage('draft')).toBe(true);
        expect(isDeskStage('write')).toBe(true);
    });

    it('rejects anything else', () => {
        expect(isDeskStage('desk')).toBe(false);
        expect(isDeskStage('template')).toBe(false);
        expect(isDeskStage('')).toBe(false);
        expect(isDeskStage(undefined)).toBe(false);
        expect(isDeskStage(null)).toBe(false);
        expect(isDeskStage(3)).toBe(false);
    });
});

describe('coerceStage', () => {
    it('passes a valid stage through', () => {
        expect(coerceStage('research')).toBe('research');
    });

    it('falls back to Writing for anything unknown', () => {
        // Mirrors how an unknown workspaceMode falls back to 'home'.
        expect(coerceStage('nonsense')).toBe('write');
        expect(coerceStage(undefined)).toBe('write');
        expect(coerceStage(null)).toBe('write');
    });
});

describe('resolveLegacyMode', () => {
    it('sends the old Draft Table to the Drafting stage', () => {
        expect(resolveLegacyMode('template')).toEqual({ mode: 'desk', stage: 'draft' });
    });

    it('sends the old Research tab to the Research stage', () => {
        expect(resolveLegacyMode('research')).toEqual({ mode: 'desk', stage: 'research' });
    });

    it('sends the old Writing Desk to the Writing stage', () => {
        // 'desk' is still a live mode, but it must still pin a stage — otherwise
        // opening the Workshop would keep whatever stage was last persisted.
        expect(resolveLegacyMode('desk')).toEqual({ mode: 'desk', stage: 'write' });
    });

    it('leaves every other mode alone, with no stage opinion', () => {
        for (const mode of ['home', 'worldBible', 'worldBibleEdit', 'hierarchy', 'bookshelf']) {
            expect(resolveLegacyMode(mode)).toEqual({ mode, stage: null });
        }
    });

    it('passes an unknown mode straight through for the caller to reject', () => {
        // Validating against WORKSPACE_MODES stays with the caller, so this
        // module never has to import the store's mode list and drift from it.
        expect(resolveLegacyMode('garbage')).toEqual({ mode: 'garbage', stage: null });
        expect(resolveLegacyMode(undefined)).toEqual({ mode: undefined, stage: null });
    });
});
