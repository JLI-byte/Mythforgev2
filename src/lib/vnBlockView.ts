/**
 * Short labels for what a choice does to story state, as shown on the branch
 * map. LEAF MODULE (no store, no React).
 *
 * Separate from vnFlags because those emit Ren'Py; these are for a human
 * glancing at a block. A deleted flag reads as "(deleted flag)" rather than
 * rendering `undefined` into the UI.
 */

import type { VNEffect, VNCondition, VNFlag } from './vnFlags';

const MISSING = '(deleted flag)';

function nameOf(flagId: string, flags: VNFlag[]): string {
    return flags.find(f => f.id === flagId)?.name ?? MISSING;
}

/** Chip text for a choice's effect, e.g. `+bold` or `mara_trust +1`. */
export function describeEffect(effect: VNEffect, flags: VNFlag[]): string {
    const name = nameOf(effect.flagId, flags);
    switch (effect.op) {
        case 'set': return `+${name}`;
        case 'clear': return `−${name}`;
        case 'add': {
            const value = effect.value ?? 1;
            return value < 0 ? `${name} −${Math.abs(value)}` : `${name} +${value}`;
        }
    }
}

/** Chip text for a choice's gate, e.g. `needs mara_trust ≥ 3`. */
export function describeCondition(condition: VNCondition, flags: VNFlag[]): string {
    const name = nameOf(condition.flagId, flags);
    switch (condition.op) {
        case 'is': return `needs ${name}`;
        case 'not': return `needs not ${name}`;
        case 'atLeast': return `needs ${name} ≥ ${condition.value ?? 1}`;
        case 'atMost': return `needs ${name} ≤ ${condition.value ?? 0}`;
    }
}
