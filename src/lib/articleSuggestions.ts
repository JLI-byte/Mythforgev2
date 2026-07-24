/**
 * Article-suggestions board widget helpers.
 *
 * As the research assistant talks it can surface entities that deserve a World
 * Bible article but don't have one yet. Those land in a single "Article
 * Suggestions" widget on the board — a non-destructive list the user can
 * re-file by drag-and-drop, then create for real. These are the pure pieces:
 * the suggestion shape, the find-or-create/append logic, and the serializer
 * that tells the assistant what's already pending so it won't repeat itself.
 */

import type { DeskWidget } from '@/store/workspaceStore';
import { DEFAULT_DIMS } from '@/components/editor/desk/deskConstants';

export interface ArticleSuggestion {
    id: string;
    /** Proposed article name, e.g. "The Crimson King". */
    name: string;
    /** World Bible entity type string, e.g. "faction". */
    type: string;
    /** Assigned folder label — an existing folder or a proposed new one. */
    category?: string;
    /** True when `category` names a folder that doesn't exist yet. */
    isNewCategory?: boolean;
    /** One line on why it was suggested / what it is. */
    reason?: string;
}

function sameName(a: string, b: string): boolean {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** A fresh Article Suggestions widget holding the given suggestions. */
export function makeSuggestionsWidget(suggestions: ArticleSuggestion[]): DeskWidget {
    const dims = DEFAULT_DIMS.articleSuggestions;
    return {
        id: crypto.randomUUID(),
        type: 'articleSuggestions',
        x: 80,
        y: 80,
        width: dims.w,
        height: dims.h,
        content: { suggestions },
    };
}

/**
 * Append a suggestion to the board's single suggestions widget, creating that
 * widget if none exists yet. Duplicates already in the widget (same name) are
 * ignored. Returns the next widgets array (unchanged on a duplicate).
 */
export function addSuggestionToWidgets(
    widgets: DeskWidget[],
    suggestion: ArticleSuggestion,
): DeskWidget[] {
    const widget = widgets.find(w => w.type === 'articleSuggestions');
    if (!widget) return [...widgets, makeSuggestionsWidget([suggestion])];

    const current: ArticleSuggestion[] = widget.content?.suggestions ?? [];
    if (current.some(s => sameName(s.name, suggestion.name))) return widgets;

    const next: DeskWidget = { ...widget, content: { ...widget.content, suggestions: [...current, suggestion] } };
    return widgets.map(w => (w.id === widget.id ? next : w));
}

/** Names of the pending suggestions, for the assistant's context. */
export function serializeSuggestions(widgets: DeskWidget[]): string {
    const widget = widgets.find(w => w.type === 'articleSuggestions');
    const list: ArticleSuggestion[] = widget?.content?.suggestions ?? [];
    if (!list.length) return '';
    return list
        .map(s => `- ${s.name} (${s.type})${s.category ? ` → ${s.category}` : ''}`)
        .join('\n');
}
