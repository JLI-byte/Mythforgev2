import { describe, it, expect } from 'vitest';
import { flattenBlocksToScenes, type VNBlock } from './vnBlocks';
import type { VNScene } from './visualNovel';
import { buildRenpyScript } from './renpyExport';
import type { VNFlag } from './vnFlags';

const block = (id: string, order: number, choices: VNBlock['choices'] = []): VNBlock =>
    ({ id, title: id, order, choices });

const scene = (id: string, order: number): VNScene =>
    ({ id, title: id, content: `${id} text`, order });

describe('flattenBlocksToScenes', () => {
    it('puts a block\'s choices on its last scene', () => {
        const blocks = [
            block('b1', 0, [{ id: 'c1', text: 'Go', targetBlockId: 'b2' }]),
            block('b2', 1),
        ];
        const scenes = new Map([
            ['b1', [scene('s1', 0), scene('s2', 1)]],
            ['b2', [scene('s3', 0)]],
        ]);
        const out = flattenBlocksToScenes(blocks, scenes);

        expect(out.find(s => s.id === 's1')!.choices ?? []).toEqual([]);
        expect(out.find(s => s.id === 's2')!.choices).toHaveLength(1);
    });

    it('resolves a target block to that block\'s first scene', () => {
        const blocks = [
            block('b1', 0, [{ id: 'c1', text: 'Go', targetBlockId: 'b2' }]),
            block('b2', 1),
        ];
        const scenes = new Map([
            ['b1', [scene('s1', 0)]],
            ['b2', [scene('s2', 0), scene('s3', 1)]],
        ]);
        const out = flattenBlocksToScenes(blocks, scenes);

        expect(out.find(s => s.id === 's1')!.choices![0].targetSceneId).toBe('s2');
    });

    it('renumbers scene order contiguously across blocks', () => {
        const blocks = [block('b1', 0), block('b2', 1)];
        const scenes = new Map([
            ['b1', [scene('s1', 7), scene('s2', 9)]],
            ['b2', [scene('s3', 2)]],
        ]);
        expect(flattenBlocksToScenes(blocks, scenes).map(s => s.order))
            .toEqual([0, 1, 2]);
    });

    it('orders blocks by their own order, not map insertion', () => {
        const blocks = [block('late', 5), block('early', 1)];
        const scenes = new Map([
            ['late', [scene('s2', 0)]],
            ['early', [scene('s1', 0)]],
        ]);
        expect(flattenBlocksToScenes(blocks, scenes).map(s => s.id))
            .toEqual(['s1', 's2']);
    });

    it('carries effects and conditions through unchanged', () => {
        const blocks = [
            block('b1', 0, [{
                id: 'c1', text: 'Go', targetBlockId: 'b2',
                effects: [{ flagId: 'f1', op: 'add', value: 2 }],
                condition: { flagId: 'f2', op: 'atLeast', value: 3 },
            }]),
            block('b2', 1),
        ];
        const scenes = new Map([['b1', [scene('s1', 0)]], ['b2', [scene('s2', 0)]]]);
        const choice = flattenBlocksToScenes(blocks, scenes)
            .find(s => s.id === 's1')!.choices![0];

        expect(choice.effects).toEqual([{ flagId: 'f1', op: 'add', value: 2 }]);
        expect(choice.condition).toEqual({ flagId: 'f2', op: 'atLeast', value: 3 });
    });

    it('handles a single-scene block, where last is also first', () => {
        const blocks = [
            block('b1', 0, [{ id: 'c1', text: 'Go', targetBlockId: 'b1' }]),
        ];
        const scenes = new Map([['b1', [scene('s1', 0)]]]);
        const out = flattenBlocksToScenes(blocks, scenes);

        expect(out).toHaveLength(1);
        expect(out[0].choices![0].targetSceneId).toBe('s1');
    });

    it('skips an empty block and re-points choices past it', () => {
        const blocks = [
            block('b1', 0, [{ id: 'c1', text: 'Go', targetBlockId: 'empty' }]),
            block('empty', 1),
            block('b3', 2),
        ];
        const scenes = new Map([
            ['b1', [scene('s1', 0)]],
            ['empty', []],
            ['b3', [scene('s3', 0)]],
        ]);
        const out = flattenBlocksToScenes(blocks, scenes);

        expect(out.map(s => s.id)).toEqual(['s1', 's3']);
        expect(out[0].choices![0].targetSceneId).toBe('s3');
    });

    it('leaves the target empty when nothing follows an empty block', () => {
        const blocks = [
            block('b1', 0, [{ id: 'c1', text: 'Go', targetBlockId: 'empty' }]),
            block('empty', 1),
        ];
        const scenes = new Map([['b1', [scene('s1', 0)]], ['empty', []]]);
        const out = flattenBlocksToScenes(blocks, scenes);

        expect(out[0].choices![0].targetSceneId).toBe('');
    });

    it('returns nothing when every block is empty', () => {
        const blocks = [block('b1', 0), block('b2', 1)];
        const scenes = new Map([['b1', []], ['b2', []]]);
        expect(flattenBlocksToScenes(blocks, scenes)).toEqual([]);
    });

    it('supports convergence — two blocks targeting the same third', () => {
        const blocks = [
            block('b1', 0, [{ id: 'c1', text: 'Left', targetBlockId: 'b3' }]),
            block('b2', 1, [{ id: 'c2', text: 'Right', targetBlockId: 'b3' }]),
            block('b3', 2),
        ];
        const scenes = new Map([
            ['b1', [scene('s1', 0)]],
            ['b2', [scene('s2', 0)]],
            ['b3', [scene('s3', 0)]],
        ]);
        const out = flattenBlocksToScenes(blocks, scenes);

        expect(out.find(s => s.id === 's1')!.choices![0].targetSceneId).toBe('s3');
        expect(out.find(s => s.id === 's2')!.choices![0].targetSceneId).toBe('s3');
    });
});

describe('blocks through to Ren\'Py', () => {
    it('turns a two-route map with a counter into a complete script', () => {
        const blocks: VNBlock[] = [
            { id: 'open', title: 'Opening Night', order: 0, choices: [
                { id: 'c1', text: 'Ask her name.', targetBlockId: 'bold',
                  effects: [{ flagId: 'f-trust', op: 'add', value: 1 }] },
                { id: 'c2', text: 'Keep quiet.', targetBlockId: 'shy' },
            ] },
            { id: 'bold', title: 'Bold', order: 1, choices: [
                { id: 'c3', text: 'Kiss her.', targetBlockId: 'end',
                  condition: { flagId: 'f-trust', op: 'atLeast', value: 1 } },
            ] },
            { id: 'shy', title: 'Shy', order: 2, choices: [
                { id: 'c4', text: 'Go home.', targetBlockId: 'end' },
            ] },
            { id: 'end', title: 'Ending', order: 3 },
        ];

        const scenes = new Map<string, VNScene[]>([
            ['open', [
                { id: 's1', title: 'Arrival', content: 'Rain off the water.', order: 0 },
                { id: 's2', title: 'The Bar', content: 'Mara: Evening.', order: 1 },
            ]],
            ['bold', [{ id: 's3', title: 'Bold', content: 'Mara: Bold of you.', order: 0 }]],
            ['shy', [{ id: 's4', title: 'Shy', content: 'The silence held.', order: 0 }]],
            ['end', [{ id: 's5', title: 'End', content: 'Mara: Goodnight.', order: 0 }]],
        ]);

        const flags: VNFlag[] = [
            { id: 'f-trust', name: 'mara_trust', kind: 'counter', initial: 0 },
        ];

        const script = buildRenpyScript(
            flattenBlocksToScenes(blocks, scenes), ['Mara'], 'Lighthouse', flags);

        expect(script).toBe(
`# Generated by LoreCanvas — Lighthouse
# Drop this file into your Ren'Py project's game/ folder.

define m = Character("Mara")

default mara_trust = 0

label start:
    jump arrival

label arrival:
    "Rain off the water."
    jump the_bar

label the_bar:
    m "Evening."

    menu:
        "Ask her name.":
            $ mara_trust += 1
            jump bold

        "Keep quiet.":
            jump shy

label bold:
    m "Bold of you."

    menu:
        "Kiss her." if mara_trust >= 1:
            jump end

label shy:
    "The silence held."

    menu:
        "Go home.":
            jump end

label end:
    m "Goodnight."
    return
`);
    });
});
