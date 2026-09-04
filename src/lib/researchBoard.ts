/**
 * Research board helpers: build the cards a board is made of. Pure, leaf-level.
 */
import type { DeskWidget } from '@/store/workspaceStore';
import { DEFAULT_DIMS } from '@/components/editor/desk/deskConstants';

/** A Note (sticky) card holding `text`, lightly staggered by `index`. */
export function makeNoteCard(text: string, index = 0): DeskWidget {
    const dims = DEFAULT_DIMS.sticky;
    return {
        id: crypto.randomUUID(),
        type: 'sticky',
        x: 80 + index * 24,
        y: 80 + index * 24,
        width: dims.w,
        height: dims.h,
        content: { text },
    };
}
