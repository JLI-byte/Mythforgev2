import { describe, it, expect } from 'vitest';
import {
    formatDefault, formatEffect, formatCondition, type VNFlag,
} from './vnFlags';

const bool = (name: string, initial = 0): VNFlag =>
    ({ id: `f-${name}`, name, kind: 'bool', initial });
const counter = (name: string, initial = 0): VNFlag =>
    ({ id: `f-${name}`, name, kind: 'counter', initial });

describe('formatDefault', () => {
    it('declares a boolean as False when it starts off', () => {
        expect(formatDefault(bool('told_truth'), 'told_truth'))
            .toBe('default told_truth = False');
    });

    it('declares a boolean as True when it starts on', () => {
        expect(formatDefault(bool('has_key', 1), 'has_key'))
            .toBe('default has_key = True');
    });

    it('declares a counter with its numeric start', () => {
        expect(formatDefault(counter('mara_trust'), 'mara_trust'))
            .toBe('default mara_trust = 0');
    });

    it('declares a counter that does not start at zero', () => {
        expect(formatDefault(counter('hp', 10), 'hp')).toBe('default hp = 10');
    });

    it('uses the identifier it is given, not the flag name', () => {
        // The caller has already slugified 'met bob' into 'met_bob'.
        expect(formatDefault(bool('met bob'), 'met_bob'))
            .toBe('default met_bob = False');
    });
});

describe('formatEffect', () => {
    it('sets a boolean', () => {
        expect(formatEffect({ flagId: 'x', op: 'set' }, 'told_truth'))
            .toBe('$ told_truth = True');
    });

    it('clears a boolean', () => {
        expect(formatEffect({ flagId: 'x', op: 'clear' }, 'told_truth'))
            .toBe('$ told_truth = False');
    });

    it('adds to a counter', () => {
        expect(formatEffect({ flagId: 'x', op: 'add', value: 2 }, 'mara_trust'))
            .toBe('$ mara_trust += 2');
    });

    it('subtracts by adding a negative', () => {
        expect(formatEffect({ flagId: 'x', op: 'add', value: -1 }, 'mara_trust'))
            .toBe('$ mara_trust += -1');
    });

    it('defaults an add with no value to 1', () => {
        expect(formatEffect({ flagId: 'x', op: 'add' }, 'mara_trust'))
            .toBe('$ mara_trust += 1');
    });
});

describe('formatCondition', () => {
    it('tests a boolean is set', () => {
        expect(formatCondition({ flagId: 'x', op: 'is' }, 'told_truth'))
            .toBe('told_truth');
    });

    it('tests a boolean is not set', () => {
        expect(formatCondition({ flagId: 'x', op: 'not' }, 'told_truth'))
            .toBe('not told_truth');
    });

    it('tests a counter floor', () => {
        expect(formatCondition({ flagId: 'x', op: 'atLeast', value: 3 }, 'mara_trust'))
            .toBe('mara_trust >= 3');
    });

    it('tests a counter ceiling', () => {
        expect(formatCondition({ flagId: 'x', op: 'atMost', value: 0 }, 'mara_trust'))
            .toBe('mara_trust <= 0');
    });

    it('defaults a missing comparison value rather than emitting undefined', () => {
        expect(formatCondition({ flagId: 'x', op: 'atLeast' }, 'n')).toBe('n >= 1');
        expect(formatCondition({ flagId: 'x', op: 'atMost' }, 'n')).toBe('n <= 0');
    });
});
