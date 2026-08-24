import { describe, it, expect } from 'vitest';
import { describeEffect, describeCondition } from './vnBlockView';
import type { VNFlag } from './vnFlags';

const flags: VNFlag[] = [
    { id: 'f1', name: 'told_truth', kind: 'bool', initial: 0 },
    { id: 'f2', name: 'mara_trust', kind: 'counter', initial: 0 },
];

describe('describeEffect', () => {
    it('labels setting a boolean', () => {
        expect(describeEffect({ flagId: 'f1', op: 'set' }, flags)).toBe('+told_truth');
    });

    it('labels clearing a boolean', () => {
        expect(describeEffect({ flagId: 'f1', op: 'clear' }, flags)).toBe('−told_truth');
    });

    it('labels adding to a counter', () => {
        expect(describeEffect({ flagId: 'f2', op: 'add', value: 1 }, flags))
            .toBe('mara_trust +1');
    });

    it('shows a negative add with its sign', () => {
        expect(describeEffect({ flagId: 'f2', op: 'add', value: -2 }, flags))
            .toBe('mara_trust −2');
    });

    it('names a deleted flag rather than rendering undefined', () => {
        expect(describeEffect({ flagId: 'gone', op: 'set' }, flags)).toBe('+(deleted flag)');
    });
});

describe('describeCondition', () => {
    it('labels a boolean test', () => {
        expect(describeCondition({ flagId: 'f1', op: 'is' }, flags)).toBe('needs told_truth');
    });

    it('labels a negated boolean test', () => {
        expect(describeCondition({ flagId: 'f1', op: 'not' }, flags))
            .toBe('needs not told_truth');
    });

    it('labels a counter floor', () => {
        expect(describeCondition({ flagId: 'f2', op: 'atLeast', value: 3 }, flags))
            .toBe('needs mara_trust ≥ 3');
    });

    it('labels a counter ceiling', () => {
        expect(describeCondition({ flagId: 'f2', op: 'atMost', value: 0 }, flags))
            .toBe('needs mara_trust ≤ 0');
    });

    it('names a deleted flag rather than rendering undefined', () => {
        expect(describeCondition({ flagId: 'gone', op: 'is' }, flags))
            .toBe('needs (deleted flag)');
    });
});
