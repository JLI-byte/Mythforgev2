import { describe, it, expect } from 'vitest';
import { tierForZoom, layoutTimeline, UNSORTED_SEASON_ID } from './vnTimeline';
import type { VNSeason, VNEpisode, VNBox } from './vnTimeline';

describe('tierForZoom', () => {
    it('shows the whole story when zoomed right out', () => {
        expect(tierForZoom(0.2)).toBe('story');
        expect(tierForZoom(0.34)).toBe('story');
    });

    it('shows seasons in the next band', () => {
        expect(tierForZoom(0.35)).toBe('season');
        expect(tierForZoom(0.64)).toBe('season');
    });

    it('shows episode detail in the next band', () => {
        expect(tierForZoom(0.65)).toBe('episode');
        expect(tierForZoom(1.09)).toBe('episode');
    });

    it('shows full decision editors when zoomed in', () => {
        expect(tierForZoom(1.1)).toBe('decision');
        expect(tierForZoom(2)).toBe('decision');
    });

    it('clamps below and above the canvas range rather than returning undefined', () => {
        expect(tierForZoom(0)).toBe('story');
        expect(tierForZoom(99)).toBe('decision');
    });
});

const season = (id: string, order: number): VNSeason =>
    ({ id, title: id, order });

const episode = (id: string, seasonId: string | undefined, order: number, decisions = 0): VNEpisode => ({
    id, title: id, seasonId, order,
    decisions: Array.from({ length: decisions }, (_, i) => ({
        id: `${id}-d${i}`, kind: 'minor' as const, prompt: `d${i}`, order: i, options: [],
    })),
});

const byId = (boxes: VNBox[], id: string) => boxes.find(b => b.id === id);
const kinds = (boxes: VNBox[], kind: string) => boxes.filter(b => b.kind === kind);

describe('layoutTimeline', () => {
    it('wraps everything in one story box', () => {
        const boxes = layoutTimeline([season('s1', 0)], [episode('e1', 's1', 0)]);
        const story = kinds(boxes, 'story');
        expect(story).toHaveLength(1);
        expect(story[0].x).toBe(0);
        expect(story[0].y).toBe(0);
    });

    it('orders seasons by their order field, not array position', () => {
        const boxes = layoutTimeline(
            [season('late', 5), season('early', 1)],
            [],
        );
        const seasons = kinds(boxes, 'season');
        expect(seasons.map(b => b.id)).toEqual(['early', 'late']);
        expect(seasons[0].y).toBeLessThan(seasons[1].y);
    });

    it('puts a parent before its children so a parent cannot paint over them', () => {
        const boxes = layoutTimeline([season('s1', 0)], [episode('e1', 's1', 0)]);
        expect(boxes.findIndex(b => b.id === 's1'))
            .toBeLessThan(boxes.findIndex(b => b.id === 'e1'));
    });

    it('flows episodes left to right while scanning', () => {
        const boxes = layoutTimeline(
            [season('s1', 0)],
            [episode('e1', 's1', 0), episode('e2', 's1', 1)],
        );
        expect(byId(boxes, 'e2')!.x).toBeGreaterThan(byId(boxes, 'e1')!.x);
        expect(byId(boxes, 'e2')!.y).toBe(byId(boxes, 'e1')!.y);
    });

    it('wraps to a second row when a season has many episodes', () => {
        const eps = Array.from({ length: 12 }, (_, i) => episode(`e${i}`, 's1', i));
        const boxes = layoutTimeline([season('s1', 0)], eps);
        const rows = new Set(kinds(boxes, 'episode').map(b => b.y));
        expect(rows.size).toBeGreaterThan(1);
    });

    it('stacks episodes vertically once a season is focused', () => {
        const boxes = layoutTimeline(
            [season('s1', 0)],
            [episode('e1', 's1', 0), episode('e2', 's1', 1)],
            { kind: 'season', id: 's1' },
        );
        expect(byId(boxes, 'e2')!.y).toBeGreaterThan(byId(boxes, 'e1')!.y);
        expect(byId(boxes, 'e2')!.x).toBe(byId(boxes, 'e1')!.x);
    });

    it('gives a focused season wider episodes than a scanned one', () => {
        const scan = layoutTimeline([season('s1', 0)], [episode('e1', 's1', 0)]);
        const focused = layoutTimeline([season('s1', 0)], [episode('e1', 's1', 0)],
            { kind: 'season', id: 's1' });
        expect(byId(focused, 'e1')!.width).toBeGreaterThan(byId(scan, 'e1')!.width);
    });

    it('collapses the seasons that are not focused', () => {
        const boxes = layoutTimeline(
            [season('s1', 0), season('s2', 1)],
            [episode('e1', 's1', 0), episode('e2', 's2', 0)],
            { kind: 'season', id: 's1' },
        );
        expect(byId(boxes, 's1')!.collapsed).toBe(false);
        expect(byId(boxes, 's2')!.collapsed).toBe(true);
        expect(byId(boxes, 's2')!.height).toBeLessThan(byId(boxes, 's1')!.height);
    });

    it('draws no episodes inside a collapsed season', () => {
        const boxes = layoutTimeline(
            [season('s1', 0), season('s2', 1)],
            [episode('e1', 's1', 0), episode('e2', 's2', 0)],
            { kind: 'season', id: 's1' },
        );
        expect(byId(boxes, 'e2')).toBeUndefined();
    });

    it('expands only the focused episode and collapses its siblings', () => {
        const boxes = layoutTimeline(
            [season('s1', 0)],
            [episode('e1', 's1', 0, 3), episode('e2', 's1', 1, 3)],
            { kind: 'episode', id: 'e1' },
        );
        expect(byId(boxes, 'e1')!.collapsed).toBe(false);
        expect(byId(boxes, 'e2')!.collapsed).toBe(true);
        expect(byId(boxes, 'e1')!.height).toBeGreaterThan(byId(boxes, 'e2')!.height);
    });

    it('emits decision boxes only for the focused episode', () => {
        const boxes = layoutTimeline(
            [season('s1', 0)],
            [episode('e1', 's1', 0, 2), episode('e2', 's1', 1, 2)],
            { kind: 'episode', id: 'e1' },
        );
        const decisions = kinds(boxes, 'decision');
        expect(decisions).toHaveLength(2);
        expect(decisions.every(d => d.parentId === 'e1')).toBe(true);
    });

    it('emits no decision boxes when nothing is focused', () => {
        const boxes = layoutTimeline(
            [season('s1', 0)], [episode('e1', 's1', 0, 4)]);
        expect(kinds(boxes, 'decision')).toHaveLength(0);
    });

    it('focusing an episode expands the season holding it', () => {
        const boxes = layoutTimeline(
            [season('s1', 0), season('s2', 1)],
            [episode('e1', 's2', 0)],
            { kind: 'episode', id: 'e1' },
        );
        expect(byId(boxes, 's2')!.collapsed).toBe(false);
        expect(byId(boxes, 's1')!.collapsed).toBe(true);
    });

    it('gathers episodes with no season into an Unsorted lane, listed last', () => {
        // Last, not first: the exporter plays unsorted episodes after every
        // season, and the map must not disagree with the script.
        const boxes = layoutTimeline(
            [season('s1', 0)],
            [episode('orphan', undefined, 0), episode('e1', 's1', 0)],
        );
        const unsorted = byId(boxes, UNSORTED_SEASON_ID);
        expect(unsorted).toBeDefined();
        expect(unsorted!.y).toBeGreaterThan(byId(boxes, 's1')!.y);
        expect(byId(boxes, 'orphan')!.parentId).toBe(UNSORTED_SEASON_ID);
    });

    it('treats an episode whose season was deleted as unsorted', () => {
        const boxes = layoutTimeline([season('s1', 0)], [episode('e1', 'gone', 0)]);
        expect(byId(boxes, 'e1')!.parentId).toBe(UNSORTED_SEASON_ID);
    });

    it('adds no Unsorted lane when every episode has a season', () => {
        const boxes = layoutTimeline([season('s1', 0)], [episode('e1', 's1', 0)]);
        expect(byId(boxes, UNSORTED_SEASON_ID)).toBeUndefined();
    });

    it('keeps every box inside its parent', () => {
        const boxes = layoutTimeline(
            [season('s1', 0)],
            [episode('e1', 's1', 0, 2)],
            { kind: 'episode', id: 'e1' },
        );
        for (const box of boxes) {
            if (!box.parentId) continue;
            const parent = byId(boxes, box.parentId)!;
            expect(box.x).toBeGreaterThanOrEqual(parent.x);
            expect(box.y).toBeGreaterThanOrEqual(parent.y);
            expect(box.x + box.width).toBeLessThanOrEqual(parent.x + parent.width);
        }
    });

    it('handles a project with no seasons and no episodes', () => {
        const boxes = layoutTimeline([], []);
        expect(kinds(boxes, 'story')).toHaveLength(1);
        expect(kinds(boxes, 'season')).toHaveLength(0);
    });
});
