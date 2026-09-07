import { describe, it, expect } from 'vitest';
import {
    ABSENCE_THRESHOLD_MS,
    MAX_DIGEST_ITEMS,
    summarizeSinceLastVisit,
} from './sinceLastVisit';

const NOW = new Date('2026-09-03T12:00:00.000Z');
const LAST_WEEK = '2026-08-27T12:00:00.000Z';

function input(over: Partial<Parameters<typeof summarizeSinceLastVisit>[0]> = {}) {
    return {
        projects: [{ id: 'p1', name: 'The Long Winter' }],
        documents: [],
        scenes: [],
        entities: [],
        writingDays: [],
        ...over,
    };
}

describe('summarizeSinceLastVisit', () => {
    it('returns null on a first ever visit', () => {
        expect(summarizeSinceLastVisit(input(), null, NOW)).toBeNull();
    });

    it('returns null for an unparseable stamp', () => {
        expect(summarizeSinceLastVisit(input(), 'yesterday', NOW)).toBeNull();
    });

    it('returns null when the writer has barely been away', () => {
        const anHourAgo = new Date(NOW.getTime() - 60 * 60 * 1000).toISOString();
        expect(summarizeSinceLastVisit(input(), anHourAgo, NOW)).toBeNull();
    });

    it('returns a digest once the absence passes the threshold', () => {
        const justOver = new Date(NOW.getTime() - ABSENCE_THRESHOLD_MS - 1000).toISOString();
        const digest = summarizeSinceLastVisit(input(), justOver, NOW);
        expect(digest).not.toBeNull();
        expect(digest!.awayMs).toBeGreaterThan(ABSENCE_THRESHOLD_MS);
    });

    it('lists scenes, chapters and articles touched during the absence', () => {
        const digest = summarizeSinceLastVisit(input({
            documents: [{
                id: 'd1', projectId: 'p1', title: 'Chapter 4',
                createdAt: '2026-08-01T00:00:00.000Z',
                updatedAt: '2026-09-01T09:00:00.000Z',
            }],
            scenes: [{
                id: 's1', projectId: 'p1', title: 'The Sinks',
                createdAt: '2026-08-01T00:00:00.000Z',
                updatedAt: '2026-09-02T09:00:00.000Z',
            }],
            entities: [{
                id: 'e1', name: 'Veldrath',
                createdAt: '2026-08-01T00:00:00.000Z',
                updatedAt: '2026-08-30T09:00:00.000Z',
            }],
        }), LAST_WEEK, NOW);

        expect(digest!.sceneCount).toBe(1);
        expect(digest!.chapterCount).toBe(1);
        expect(digest!.articleCount).toBe(1);
        expect(digest!.items.map(i => i.title))
            .toEqual(['The Sinks', 'Chapter 4', 'Veldrath']);
    });

    it('names the project each item belongs to', () => {
        const digest = summarizeSinceLastVisit(input({
            scenes: [{
                id: 's1', projectId: 'p1', title: 'The Sinks',
                createdAt: '2026-08-01T00:00:00.000Z',
                updatedAt: '2026-09-02T09:00:00.000Z',
            }],
        }), LAST_WEEK, NOW);
        expect(digest!.items[0].projectName).toBe('The Long Winter');
    });

    it('ignores anything untouched since the last visit', () => {
        const digest = summarizeSinceLastVisit(input({
            scenes: [{
                id: 's1', projectId: 'p1', title: 'Old Scene',
                createdAt: '2026-08-01T00:00:00.000Z',
                updatedAt: '2026-08-02T00:00:00.000Z',
            }],
        }), LAST_WEEK, NOW);
        expect(digest!.items).toEqual([]);
        expect(digest!.sceneCount).toBe(0);
    });

    it('falls back to createdAt for a record never updated', () => {
        const digest = summarizeSinceLastVisit(input({
            scenes: [{
                id: 's1', projectId: 'p1', title: 'Brand New',
                createdAt: '2026-09-02T09:00:00.000Z',
            }],
        }), LAST_WEEK, NOW);
        expect(digest!.items.map(i => i.title)).toEqual(['Brand New']);
    });

    it('caps the list but not the counts', () => {
        const scenes = Array.from({ length: 9 }, (_, i) => ({
            id: `s${i}`, projectId: 'p1', title: `Scene ${i}`,
            createdAt: '2026-08-01T00:00:00.000Z',
            updatedAt: new Date(Date.UTC(2026, 8, 1, i)).toISOString(),
        }));
        const digest = summarizeSinceLastVisit(input({ scenes }), LAST_WEEK, NOW)!;
        expect(digest.items).toHaveLength(MAX_DIGEST_ITEMS);
        expect(digest.sceneCount).toBe(9);
    });

    it('totals the words written on days after the last visit', () => {
        const digest = summarizeSinceLastVisit(input({
            writingDays: [
                { date: '2026-08-27', wordsWritten: 999 }, // the day they left
                { date: '2026-08-28', wordsWritten: 400 },
                { date: '2026-09-01', wordsWritten: 250 },
            ],
        }), LAST_WEEK, NOW)!;
        expect(digest.wordsWritten).toBe(650);
    });
});
