/**
 * Book binding art — LEAF MODULE (no store or React import).
 *
 * Spines and covers are painted assets rather than flat colour fills. Each
 * binding is a matched pair: a tall narrow spine and a 2:3 front cover, both
 * generated deliberately blank where a title would sit, so the app draws the
 * text over the top instead of baking it in.
 *
 * A world or book is assigned a binding from the cover colour it already
 * carries, so nothing needs migrating and a shelf that exists today gets art
 * immediately. Anything with an unrecognised colour falls back by hashing the
 * id, which keeps the choice stable across reloads rather than flickering.
 */

/** The eight bindings, in the same order as COVER_COLORS. */
export const BINDINGS = [
    'slate-blue-cloth',
    'violet-morocco',
    'forest-buckram',
    'oxblood-leather',
    'amber-midcentury',
    'teal-matte',
    'tan-calf',
    'indigo-foil',
] as const;

export type Binding = typeof BINDINGS[number];

/**
 * Cover colour to binding. Keyed on the palette in workspaceStore's
 * COVER_COLORS; kept here as literals so this module stays store-free.
 */
const BY_COLOR: Record<string, Binding> = {
    '#4a6fa5': 'slate-blue-cloth',
    '#6b4c9a': 'violet-morocco',
    '#2e8b57': 'forest-buckram',
    '#c0392b': 'oxblood-leather',
    '#d46a1a': 'amber-midcentury',
    '#1a7a8a': 'teal-matte',
    '#7a4a2e': 'tan-calf',
    '#4a4a8a': 'indigo-foil',
};

/** Stable, well-spread index for an arbitrary string. */
function hashIndex(seed: string, buckets: number): number {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
        h ^= seed.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return Math.abs(h) % buckets;
}

/**
 * Which binding to draw. Prefers the record's own cover colour so the art
 * matches the colour the writer already picked; falls back to a hash of the
 * id so an off-palette colour still gets a consistent binding rather than
 * always landing on the first one.
 */
export function bindingFor(coverColor: string | undefined, id: string): Binding {
    const known = coverColor ? BY_COLOR[coverColor.trim().toLowerCase()] : undefined;
    return known ?? BINDINGS[hashIndex(id, BINDINGS.length)];
}

export function spineArt(binding: Binding): string {
    return `/textures/books/spines/${binding}.webp`;
}

export function coverArt(binding: Binding): string {
    return `/textures/books/covers/${binding}.webp`;
}
