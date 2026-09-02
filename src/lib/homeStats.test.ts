import { describe, it, expect } from 'vitest';
import {
    dateKey,
    wordsOnDate,
    heatLevel,
    buildHeatmap,
    resolveResumeTarget,
    timeAgo,
    attentionCounts,
} from './homeStats';

describe('dateKey', () => {
    it('formats a local date as YYYY-MM-DD with zero padding', () => {
        expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
        expect(dateKey(new Date(2026, 11, 31))).toBe('2026-12-31');
    });
});

describe('wordsOnDate', () => {
    it('sums every entry sharing the date (one per project)', () => {
        const days = [
            { date: '2026-03-01', wordsWritten: 300 },
            { date: '2026-03-01', wordsWritten: 200 },
            { date: '2026-03-02', wordsWritten: 999 },
        ];
        expect(wordsOnDate(days, '2026-03-01')).toBe(500);
    });

    it('returns 0 for a day with no entries', () => {
        expect(wordsOnDate([{ date: '2026-03-01', wordsWritten: 300 }], '2026-03-09')).toBe(0);
    });
});

describe('heatLevel', () => {
    it('returns 0 when nothing was written', () => {
        expect(heatLevel(0, 500)).toBe(0);
    });

    it('returns 4 once the daily target is met or beaten', () => {
        expect(heatLevel(500, 500)).toBe(4);
        expect(heatLevel(1200, 500)).toBe(4);
    });

    it('scales partial days between 1 and 3', () => {
        expect(heatLevel(50, 500)).toBe(1);   // 10%
        expect(heatLevel(150, 500)).toBe(2);  // 30%
        expect(heatLevel(350, 500)).toBe(3);  // 70%
    });

    it('falls back to a sane target when none is configured', () => {
        expect(heatLevel(500, 0)).toBe(4);
    });
});

describe('buildHeatmap', () => {
    it('returns the requested number of Sunday-started week columns', () => {
        const grid = buildHeatmap([], new Date(2026, 2, 18), 4, 500);
        expect(grid).toHaveLength(4);
        expect(grid.every(col => col.length === 7)).toBe(true);
        // Every column starts on a Sunday
        expect(grid.every(col => new Date(`${col[0].date}T00:00:00`).getDay() === 0)).toBe(true);
    });

    it('places a day’s words in the matching cell', () => {
        const target = new Date(2026, 2, 18); // Wed 18 Mar 2026
        const grid = buildHeatmap(
            [{ date: '2026-03-18', wordsWritten: 800 }],
            target,
            4,
            500,
        );
        const cell = grid.flat().find(c => c.date === '2026-03-18');
        expect(cell).toBeDefined();
        expect(cell!.words).toBe(800);
        expect(cell!.level).toBe(4);
    });

    it('combines multiple entries for the same date', () => {
        const grid = buildHeatmap(
            [
                { date: '2026-03-18', wordsWritten: 300 },
                { date: '2026-03-18', wordsWritten: 300 },
            ],
            new Date(2026, 2, 18),
            2,
            500,
        );
        expect(grid.flat().find(c => c.date === '2026-03-18')!.words).toBe(600);
    });
});

describe('resolveResumeTarget', () => {
    const projects = [{ id: 'p1', name: 'Veldrath' }];
    const documents = [
        { id: 'd1', projectId: 'p1', title: 'Chapter 1', createdAt: new Date(2026, 0, 1), updatedAt: new Date(2026, 0, 2) },
    ];

    it('returns null when there is nothing written', () => {
        expect(resolveResumeTarget({ projects, documents: [], scenes: [] })).toBeNull();
    });

    it('prefers the most recently updated scene and labels it with its document', () => {
        const scenes = [
            { id: 's1', documentId: 'd1', projectId: 'p1', title: 'The Sinks', createdAt: new Date(2026, 0, 1), updatedAt: new Date(2026, 0, 9), wordCount: 1240 },
            { id: 's2', documentId: 'd1', projectId: 'p1', title: 'Older', createdAt: new Date(2026, 0, 1), updatedAt: new Date(2026, 0, 3) },
        ];
        const r = resolveResumeTarget({ projects, documents, scenes })!;
        expect(r.sceneId).toBe('s1');
        expect(r.label).toBe('Chapter 1 — The Sinks');
        expect(r.projectName).toBe('Veldrath');
        expect(r.wordCount).toBe(1240);
    });

    it('falls back to a document when it is newer than every scene', () => {
        const scenes = [
            { id: 's1', documentId: 'd1', projectId: 'p1', title: 'Old scene', createdAt: new Date(2026, 0, 1), updatedAt: new Date(2026, 0, 3) },
        ];
        const docs = [
            { id: 'd1', projectId: 'p1', title: 'Chapter 1', createdAt: new Date(2026, 0, 1), updatedAt: new Date(2026, 5, 1) },
        ];
        const r = resolveResumeTarget({ projects, documents: docs, scenes })!;
        expect(r.sceneId).toBeUndefined();
        expect(r.documentId).toBe('d1');
    });

    it('ignores scenes whose document is missing', () => {
        const scenes = [
            { id: 's9', documentId: 'gone', projectId: 'p1', title: 'Orphan', createdAt: new Date(2026, 9, 1), updatedAt: new Date(2026, 9, 1) },
        ];
        const r = resolveResumeTarget({ projects, documents, scenes })!;
        expect(r.sceneId).toBeUndefined();
        expect(r.documentId).toBe('d1');
    });

    it('accepts ISO date strings from rehydrated storage', () => {
        const scenes = [
            { id: 's1', documentId: 'd1', projectId: 'p1', title: 'Rehydrated', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-04-01T00:00:00.000Z' },
        ];
        const r = resolveResumeTarget({ projects, documents, scenes })!;
        expect(r.sceneId).toBe('s1');
    });
});

describe('timeAgo', () => {
    const now = new Date(2026, 5, 10, 12, 0, 0);

    it('describes recent, hourly, and daily gaps', () => {
        expect(timeAgo(new Date(2026, 5, 10, 11, 59, 30), now)).toBe('just now');
        expect(timeAgo(new Date(2026, 5, 10, 11, 30, 0), now)).toBe('30 minutes ago');
        expect(timeAgo(new Date(2026, 5, 10, 10, 0, 0), now)).toBe('2 hours ago');
        expect(timeAgo(new Date(2026, 5, 9, 12, 0, 0), now)).toBe('1 day ago');
    });

    it('singularises a one-unit gap', () => {
        expect(timeAgo(new Date(2026, 5, 10, 11, 0, 0), now)).toBe('1 hour ago');
    });
});

describe('attentionCounts', () => {
    it('totals flags and suggestions across every board', () => {
        const states = {
            'project:a': {
                widgets: [
                    { type: 'consistencyFlags', content: { flags: [{ id: '1' }, { id: '2' }] } },
                    { type: 'articleSuggestions', content: { suggestions: [{ id: 's' }] } },
                    { type: 'sticky', content: { text: 'ignored' } },
                ],
            },
            'project:a::board2': {
                widgets: [{ type: 'consistencyFlags', content: { flags: [{ id: '3' }] } }],
            },
        };
        expect(attentionCounts(states)).toEqual({ flags: 3, suggestions: 1 });
    });

    it('tolerates empty and malformed states', () => {
        expect(attentionCounts({})).toEqual({ flags: 0, suggestions: 0 });
        expect(attentionCounts({ x: {} })).toEqual({ flags: 0, suggestions: 0 });
        expect(attentionCounts({ x: { widgets: [{ type: 'consistencyFlags' }] } })).toEqual({ flags: 0, suggestions: 0 });
    });
});
