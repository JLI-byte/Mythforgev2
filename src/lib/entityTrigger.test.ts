import { describe, it, expect } from 'vitest';
import { matchEntityTrigger, MAX_QUERY_LENGTH } from './entityTrigger';

describe('matchEntityTrigger', () => {
    it('recognises a bare trigger with nothing typed yet', () => {
        expect(matchEntityTrigger('She walked into [[')).toEqual({ trigger: '[[', query: '', length: 2 });
        expect(matchEntityTrigger('She met @')).toEqual({ trigger: '@', query: '', length: 1 });
    });

    it('captures the name being typed after each trigger', () => {
        expect(matchEntityTrigger('in [[The Iron Gate')).toEqual({ trigger: '[[', query: 'The Iron Gate', length: 15 });
        expect(matchEntityTrigger('met @Kell')).toEqual({ trigger: '@', query: 'Kell', length: 5 });
    });

    it('allows the punctuation real names carry', () => {
        expect(matchEntityTrigger('[[Anne-Marie O')).toEqual({ trigger: '[[', query: 'Anne-Marie O', length: 14 });
    });

    it('returns null when the cursor is not inside a trigger', () => {
        expect(matchEntityTrigger('just ordinary prose')).toBeNull();
        expect(matchEntityTrigger('')).toBeNull();
    });

    it('gives up after a double space — the writer moved on', () => {
        expect(matchEntityTrigger('@Kell  ')).toBeNull();
        expect(matchEntityTrigger('[[Kell  ')).toBeNull();
    });

    it('gives up once the name is implausibly long', () => {
        expect(matchEntityTrigger(`@${'a'.repeat(MAX_QUERY_LENGTH + 1)}`)).toBeNull();
    });

    it('lets the later trigger win when the writer changes their mind', () => {
        expect(matchEntityTrigger('@Kell went to [[Iron')).toEqual({ trigger: '[[', query: 'Iron', length: 6 });
        expect(matchEntityTrigger('[[Iron and then @Kell')).toEqual({ trigger: '@', query: 'Kell', length: 5 });
    });

    it('measures length back from the cursor, trigger included', () => {
        const text = 'x [[Gate';
        const m = matchEntityTrigger(text)!;
        expect(text.length - m.length).toBe(2);
    });
});
