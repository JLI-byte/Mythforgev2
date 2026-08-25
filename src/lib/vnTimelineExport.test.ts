import { describe, it, expect } from 'vitest';
import { buildTimelineScript, episodeLabels } from './vnTimelineExport';
import type { VNSeason, VNEpisode } from './vnTimeline';
import type { VNFlag } from './vnFlags';

const S1: VNSeason = { id: 's1', title: 'Season One', order: 0 };
const S2: VNSeason = { id: 's2', title: 'Season Two', order: 1 };

describe('episodeLabels', () => {
    it('names a label from its season and episode numbers', () => {
        const labels = episodeLabels([S1], [
            { id: 'e1', title: 'The Bar', seasonId: 's1', order: 0 },
        ]);
        expect(labels.get('e1')).toBe('s1e1_the_bar');
    });

    it('numbers episodes from one within each season', () => {
        const labels = episodeLabels([S1, S2], [
            { id: 'a', title: 'A', seasonId: 's1', order: 0 },
            { id: 'b', title: 'B', seasonId: 's1', order: 1 },
            { id: 'c', title: 'C', seasonId: 's2', order: 0 },
        ]);
        expect([labels.get('a'), labels.get('b'), labels.get('c')])
            .toEqual(['s1e1_a', 's1e2_b', 's2e1_c']);
    });

    it('never emits a hyphen, which is a syntax error in a label', () => {
        const labels = episodeLabels([S1], [
            { id: 'e1', title: 'Act One — The Long Goodbye', seasonId: 's1', order: 0 },
        ]);
        expect(labels.get('e1')).not.toContain('-');
    });

    it('falls back when a title has no usable characters', () => {
        const labels = episodeLabels([S1], [
            { id: 'e1', title: '???', seasonId: 's1', order: 0 },
        ]);
        expect(labels.get('e1')).toBe('s1e1_untitled');
    });
});

describe('episodeLabels — episodes with no season', () => {
    it('drops the season prefix rather than numbering a season zero', () => {
        const labels = episodeLabels([], [
            { id: 'e1', title: 'Chapter 1', order: 0 },
            { id: 'e2', title: 'Chapter 2', order: 1 },
        ]);
        expect(labels.get('e1')).toBe('e1_chapter_1');
        expect(labels.get('e2')).toBe('e2_chapter_2');
    });

    it('still prefixes episodes that do have a season', () => {
        const labels = episodeLabels([S1], [
            { id: 'e1', title: 'Bar', seasonId: 's1', order: 0 },
            { id: 'orphan', title: 'Stray', order: 0 },
        ]);
        expect(labels.get('e1')).toBe('s1e1_bar');
        expect(labels.get('orphan')).toBe('e1_stray');
    });
});

describe('buildTimelineScript', () => {
    const flags: VNFlag[] = [
        { id: 'f-bold', name: 'bold', kind: 'bool', initial: 0 },
        { id: 'f-trust', name: 'mara_trust', kind: 'counter', initial: 0 },
    ];

    it('emits a minor decision as a menu with no jumps', () => {
        const script = buildTimelineScript([S1], [
            { id: 'e1', title: 'Bar', seasonId: 's1', order: 0, decisions: [
                { id: 'd1', kind: 'minor', prompt: 'A drink?', order: 0, options: [
                    { id: 'o1', text: 'Order one', effects: [{ flagId: 'f-bold', op: 'set' }] },
                    { id: 'o2', text: 'Say nothing' },
                ] },
            ] },
        ], [], 'X', flags);

        expect(script).toContain('    menu:\n        "Order one":\n            $ bold = True\n');
        expect(script).toContain('        "Say nothing":\n            pass\n');
        // Exactly one jump in the whole script — the entry point. Neither
        // option emits one, because rejoining is what Ren'Py does on its own
        // once an option's block ends.
        expect(script.match(/jump /g)).toHaveLength(1);
    });

    it('emits pass for an option that does nothing, since a block cannot be empty', () => {
        const script = buildTimelineScript([S1], [
            { id: 'e1', title: 'Bar', seasonId: 's1', order: 0, decisions: [
                { id: 'd1', kind: 'minor', prompt: 'p', order: 0, options: [
                    { id: 'o1', text: 'Shrug' },
                ] },
            ] },
        ], [], 'X', []);
        expect(script).toContain('        "Shrug":\n            pass');
    });

    it('emits a jump only for an option that routes to another episode', () => {
        const script = buildTimelineScript([S1], [
            { id: 'e1', title: 'Bar', seasonId: 's1', order: 0, decisions: [
                { id: 'd1', kind: 'major', prompt: 'p', order: 0, options: [
                    { id: 'o1', text: 'Leave', routeToEpisodeId: 'e3' },
                    { id: 'o2', text: 'Stay' },
                ] },
            ] },
            { id: 'e2', title: 'Morning', seasonId: 's1', order: 1 },
            { id: 'e3', title: 'Night Walk', seasonId: 's1', order: 2 },
        ], [], 'X', []);

        expect(script).toContain('            jump s1e3_night_walk');
        expect(script).toContain('        "Stay":\n            pass');
    });

    it('falls through to the next episode by order', () => {
        const script = buildTimelineScript([S1], [
            { id: 'e1', title: 'One', seasonId: 's1', order: 0 },
            { id: 'e2', title: 'Two', seasonId: 's1', order: 1 },
        ], [], 'X', []);
        expect(script).toContain('label s1e1_one:\n    jump s1e2_two');
    });

    it('carries on into the next season', () => {
        const script = buildTimelineScript([S1, S2], [
            { id: 'e1', title: 'Last', seasonId: 's1', order: 0 },
            { id: 'e2', title: 'First', seasonId: 's2', order: 0 },
        ], [], 'X', []);
        expect(script).toContain('label s1e1_last:\n    jump s2e1_first');
    });

    it('ends the final episode with return', () => {
        const script = buildTimelineScript([S1], [
            { id: 'e1', title: 'Only', seasonId: 's1', order: 0 },
        ], [], 'X', []);
        expect(script.trimEnd().endsWith('return')).toBe(true);
    });

    it('guards an option with its condition', () => {
        const script = buildTimelineScript([S1], [
            { id: 'e1', title: 'Bar', seasonId: 's1', order: 0, decisions: [
                { id: 'd1', kind: 'major', prompt: 'p', order: 0, options: [
                    { id: 'o1', text: 'Kiss her',
                      condition: { flagId: 'f-trust', op: 'atLeast', value: 3 } },
                ] },
            ] },
        ], [], 'X', flags);
        expect(script).toContain('        "Kiss her" if mara_trust >= 3:');
    });

    it('declares every flag in the registry', () => {
        const script = buildTimelineScript([S1], [], [], 'X', flags);
        expect(script).toContain('default bold = False');
        expect(script).toContain('default mara_trust = 0');
    });

    it('emits decisions in order', () => {
        const script = buildTimelineScript([S1], [
            { id: 'e1', title: 'Bar', seasonId: 's1', order: 0, decisions: [
                { id: 'd2', kind: 'minor', prompt: 'second', order: 1, options: [{ id: 'b', text: 'B' }] },
                { id: 'd1', kind: 'minor', prompt: 'first', order: 0, options: [{ id: 'a', text: 'A' }] },
            ] },
        ], [], 'X', []);
        expect(script.indexOf('"A"')).toBeLessThan(script.indexOf('"B"'));
    });

    it('skips a decision with no options rather than emitting an empty menu', () => {
        const script = buildTimelineScript([S1], [
            { id: 'e1', title: 'Bar', seasonId: 's1', order: 0, decisions: [
                { id: 'd1', kind: 'minor', prompt: 'p', order: 0, options: [] },
            ] },
        ], [], 'X', []);
        expect(script).not.toContain('menu:');
    });

    it('gives an untitled option a visible placeholder rather than an empty button', () => {
        const script = buildTimelineScript([S1], [
            { id: 'e1', title: 'Bar', seasonId: 's1', order: 0, decisions: [
                { id: 'd1', kind: 'minor', prompt: 'p', order: 0, options: [
                    { id: 'o1', text: '   ' },
                ] },
            ] },
        ], [], 'X', []);
        expect(script).toContain('"(unnamed option)":');
        expect(script).not.toContain('""');
    });

    it('emits a complete, paste-able two-season script', () => {
        const episodes: VNEpisode[] = [
            { id: 'e1', title: 'The Bar', seasonId: 's1', order: 0, decisions: [
                { id: 'd1', kind: 'minor', prompt: 'A drink?', order: 0, options: [
                    { id: 'o1', text: 'Order one', effects: [{ flagId: 'f-bold', op: 'set' }] },
                    { id: 'o2', text: 'Say nothing' },
                ] },
                { id: 'd2', kind: 'major', prompt: 'Ask her name?', order: 1, options: [
                    { id: 'o3', text: 'Ask', effects: [{ flagId: 'f-trust', op: 'add', value: 1 }] },
                    { id: 'o4', text: 'Leave', routeToEpisodeId: 'e3' },
                ] },
            ] },
            { id: 'e2', title: 'Morning', seasonId: 's1', order: 1 },
            { id: 'e3', title: 'Alone', seasonId: 's2', order: 0, decisions: [
                { id: 'd3', kind: 'major', prompt: 'Go back?', order: 0, options: [
                    { id: 'o5', text: 'Go back', condition: { flagId: 'f-trust', op: 'atLeast', value: 1 } },
                ] },
            ] },
        ];

        expect(buildTimelineScript([S1, S2], episodes, ['Mara'], 'Lighthouse', flags)).toBe(
`# Generated by LoreCanvas — Lighthouse
# Drop this file into your Ren'Py project's game/ folder.

define m = Character("Mara")

default bold = False
default mara_trust = 0

label start:
    jump s1e1_the_bar

label s1e1_the_bar:
    menu:
        "Order one":
            $ bold = True

        "Say nothing":
            pass

    menu:
        "Ask":
            $ mara_trust += 1

        "Leave":
            jump s2e1_alone

    jump s1e2_morning

label s1e2_morning:
    jump s2e1_alone

label s2e1_alone:
    menu:
        "Go back" if mara_trust >= 1:
            pass

    return
`);
    });
});
