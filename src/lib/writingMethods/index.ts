import { DeskWidget } from '@/store/workspaceStore';
import { WritingMethod, MethodFamily, DraftFormat, FAMILY_LABELS } from './types';
import { DraftType as DraftTypeRecord } from './draftTypes';
import { STRUCTURE_METHODS } from './methods/structures';
import { CHARACTER_METHODS } from './methods/character';
import { CRAFT_METHODS } from './methods/craft';
import { VISUAL_METHODS } from './methods/visual';
import { MEDIUM_METHODS } from './methods/mediums';

export type { WritingMethod, MethodBeat, MethodFamily, DraftFormat } from './types';
export { FAMILY_LABELS } from './types';
export type { DraftType } from './draftTypes';
export { DRAFT_TYPES, getDraftType } from './draftTypes';

/** The full method registry, in library display order. */
export const WRITING_METHODS: WritingMethod[] = [
    ...STRUCTURE_METHODS,
    ...CHARACTER_METHODS,
    ...CRAFT_METHODS,
    ...VISUAL_METHODS,
    ...MEDIUM_METHODS,
];

/** The six flagship methods shown before "browse all". */
export const STARTER_METHODS: WritingMethod[] = WRITING_METHODS.filter(m => m.starter);

export function getMethod(id: string): WritingMethod | undefined {
    return WRITING_METHODS.find(m => m.id === id);
}

/**
 * The method pool for a draft type: everything matching its format engine,
 * plus its recommended methods even when tagged for other formats (e.g. the
 * Fichtean Curve is a story method that YouTube scripts borrow).
 */
export function methodsForType(type: DraftTypeRecord): WritingMethod[] {
    return WRITING_METHODS.filter(m =>
        m.formats.includes(type.format) || type.recommended.includes(m.id)
    );
}

/** Methods that suit a draft format, grouped by family in registry order. */
export function methodsByFamily(format?: DraftFormat): { family: MethodFamily; label: string; methods: WritingMethod[] }[] {
    const pool = format ? WRITING_METHODS.filter(m => m.formats.includes(format)) : WRITING_METHODS;
    const groups: { family: MethodFamily; label: string; methods: WritingMethod[] }[] = [];
    pool.forEach(m => {
        let group = groups.find(g => g.family === m.family);
        if (!group) {
            group = { family: m.family, label: FAMILY_LABELS[m.family], methods: [] };
            groups.push(group);
        }
        group.methods.push(m);
    });
    return groups;
}

// ── Canvas layout ────────────────────────────────────────────

const CARD_W = 320;
const CARD_H = 240;
const CARD_GAP = 28;
const CARDS_PER_ROW = 5;

/**
 * Build the beat-card widgets for a method, laid out in reading order
 * (left→right, wrapping every CARDS_PER_ROW). Beat text lives in content so
 * cards stay self-contained even if the registry changes later.
 */
export function buildMethodWidgets(method: WritingMethod, startX = 60, startY = 60): DeskWidget[] {
    return method.beats.map((beat, i) => ({
        id: crypto.randomUUID(),
        type: 'beatCard',
        x: startX + (i % CARDS_PER_ROW) * (CARD_W + CARD_GAP),
        y: startY + Math.floor(i / CARDS_PER_ROW) * (CARD_H + CARD_GAP),
        width: CARD_W,
        height: CARD_H,
        content: {
            methodId: method.id,
            methodName: method.name,
            beatIndex: i,
            beatCount: method.beats.length,
            beatLabel: beat.label,
            beatGroup: beat.group,
            guidance: beat.guidance,
            placeholder: beat.placeholder,
            text: '',
        },
        dock: null,
    }));
}
