/**
 * Research board helpers: turn a board's widgets into plain-text context for the
 * AI chat, and build a Note card from an assistant reply. Pure, leaf-level.
 */
import type { DeskWidget } from '@/store/workspaceStore';
import { DEFAULT_DIMS } from '@/components/editor/desk/deskConstants';

/** One line per card, labeled by type. Cards with no text are skipped. */
export function serializeBoard(widgets: DeskWidget[]): string {
    const lines: string[] = [];
    for (const w of widgets) {
        if (w.type === 'sticky') {
            const t = String(w.content?.text ?? '').trim();
            if (t) lines.push(`Note: ${t}`);
        } else if (w.type === 'reference') {
            const title = String(w.content?.title ?? '').trim();
            const bodyText = String(w.content?.body ?? '').trim();
            const joined = [title, bodyText].filter(Boolean).join(' — ');
            if (joined) lines.push(`Link: ${joined}`);
        } else if (w.type === 'image') {
            const label = String(w.content?.label ?? '').trim();
            if (label) lines.push(`Clipping: ${label}`);
        }
    }
    return lines.join('\n');
}

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
