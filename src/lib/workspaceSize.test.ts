import { describe, it, expect } from 'vitest';
import {
    HARD_LIMIT_BYTES,
    SOFT_LIMIT_BYTES,
    byteLength,
    contributorLabel,
    describeWorkspaceSize,
    formatBytes,
    measureWorkspace,
    verdictFor,
} from './workspaceSize';

describe('byteLength', () => {
    it('measures the serialised UTF-8 length, not the character count', () => {
        // "—" is one JS character but three UTF-8 bytes, plus two quotes.
        expect(byteLength('—')).toBe(5);
    });

    it('measures a whole object including its punctuation', () => {
        expect(byteLength({ a: 'hi', b: 1 })).toBe('{"a":"hi","b":1}'.length);
    });

    it('returns 0 for a value JSON cannot represent', () => {
        expect(byteLength(undefined)).toBe(0);
    });
});

describe('verdictFor', () => {
    it('is ok below the soft limit', () => {
        expect(verdictFor(SOFT_LIMIT_BYTES - 1)).toBe('ok');
    });

    it('warns at the soft limit', () => {
        expect(verdictFor(SOFT_LIMIT_BYTES)).toBe('warn');
    });

    it('still warns just below the hard limit', () => {
        expect(verdictFor(HARD_LIMIT_BYTES - 1)).toBe('warn');
    });

    it('blocks at the hard limit', () => {
        expect(verdictFor(HARD_LIMIT_BYTES)).toBe('blocked');
    });
});

describe('measureWorkspace', () => {
    it('totals the whole blob', () => {
        expect(measureWorkspace({ a: 'hi', b: 1 }).totalBytes)
            .toBe('{"a":"hi","b":1}'.length);
    });

    it('ranks contributors largest first and names the largest', () => {
        const result = measureWorkspace({
            small: 'a',
            large: 'aaaaaaaaaaaaaaaaaaaa',
            middle: 'aaaaa',
        });
        expect(result.contributors.map(c => c.key)).toEqual(['large', 'middle', 'small']);
        expect(result.largest).toEqual({ key: 'large', bytes: 22 });
    });

    it('skips keys JSON would drop', () => {
        const result = measureWorkspace({ kept: 1, dropped: undefined });
        expect(result.contributors.map(c => c.key)).toEqual(['kept']);
    });

    it('reports nothing to blame for an empty workspace', () => {
        const result = measureWorkspace({});
        expect(result.totalBytes).toBe(2);
        expect(result.contributors).toEqual([]);
        expect(result.largest).toBeNull();
    });

    it('carries the verdict through from the measured total', () => {
        const result = measureWorkspace({ images: 'a'.repeat(SOFT_LIMIT_BYTES) });
        expect(result.verdict).toBe('warn');
        expect(result.largest?.key).toBe('images');
    });
});

describe('formatBytes', () => {
    it('leaves small numbers in bytes', () => {
        expect(formatBytes(0)).toBe('0 B');
        expect(formatBytes(512)).toBe('512 B');
    });

    it('steps up a unit at a time with one decimal', () => {
        expect(formatBytes(1024)).toBe('1.0 KB');
        expect(formatBytes(1536)).toBe('1.5 KB');
        expect(formatBytes(4 * 1024 * 1024)).toBe('4.0 MB');
    });
});

describe('contributorLabel', () => {
    it('translates a persisted store key into the writer’s words', () => {
        expect(contributorLabel('entities')).toBe('your World Bible articles');
    });

    it('falls back to the raw key it does not recognise', () => {
        expect(contributorLabel('someNewSlice')).toBe('someNewSlice');
    });

    it('has something to say when there is nothing to blame', () => {
        expect(contributorLabel(undefined)).toBe('your workspace');
    });
});

describe('describeWorkspaceSize', () => {
    it('says nothing when there is nothing to say', () => {
        expect(describeWorkspaceSize(null)).toBeNull();
        expect(describeWorkspaceSize(measureWorkspace({ a: 1 }))).toBeNull();
    });

    it('names the total and the largest contributor past the soft limit', () => {
        const notice = describeWorkspaceSize(
            measureWorkspace({ entities: 'a'.repeat(SOFT_LIMIT_BYTES) }),
        );
        expect(notice?.tone).toBe('warn');
        expect(notice?.headline).toContain('4.0 MB');
        expect(notice?.headline).toContain(formatBytes(HARD_LIMIT_BYTES));
        expect(notice?.detail).toContain('your World Bible articles');
    });

    it('promises the work is still saved locally past the hard limit', () => {
        const notice = describeWorkspaceSize(
            measureWorkspace({ scenes: 'a'.repeat(HARD_LIMIT_BYTES) }),
        );
        expect(notice?.tone).toBe('blocked');
        expect(notice?.headline).toContain('stopped copying it to the cloud');
        expect(notice?.detail).toContain('still saving everything in this browser');
        expect(notice?.detail).toContain('your scenes');
    });
});
