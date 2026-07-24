import { describe, it, expect } from 'vitest';
import type { DeskWidget } from '@/store/workspaceStore';
import {
    makeSuggestionsWidget,
    addSuggestionToWidgets,
    serializeSuggestions,
    type ArticleSuggestion,
} from './articleSuggestions';

function suggestion(name: string, type = 'faction', extra: Partial<ArticleSuggestion> = {}): ArticleSuggestion {
    return { id: name, name, type, ...extra };
}

describe('addSuggestionToWidgets', () => {
    it('creates the widget on the first suggestion', () => {
        const next = addSuggestionToWidgets([], suggestion('The Crimson King'));
        const widget = next.find(w => w.type === 'articleSuggestions');
        expect(widget).toBeTruthy();
        expect(widget!.content.suggestions).toHaveLength(1);
    });

    it('appends to the existing widget without adding a second one', () => {
        const first = addSuggestionToWidgets([], suggestion('Veldrath', 'location'));
        const second = addSuggestionToWidgets(first, suggestion('The Salt Guild', 'faction'));
        const widgets = second.filter(w => w.type === 'articleSuggestions');
        expect(widgets).toHaveLength(1);
        expect(widgets[0].content.suggestions.map((s: ArticleSuggestion) => s.name)).toEqual([
            'Veldrath', 'The Salt Guild',
        ]);
    });

    it('ignores a duplicate name (case-insensitive) and returns the same array', () => {
        const first = addSuggestionToWidgets([], suggestion('Veldrath'));
        const again = addSuggestionToWidgets(first, suggestion('  veldrath '));
        expect(again).toBe(first);
        const widget = again.find(w => w.type === 'articleSuggestions')!;
        expect(widget.content.suggestions).toHaveLength(1);
    });

    it('preserves other widgets on the board', () => {
        const sticky: DeskWidget = { id: 's1', type: 'sticky', x: 0, y: 0, width: 200, height: 200, content: { text: 'hi' } };
        const next = addSuggestionToWidgets([sticky], suggestion('Veldrath'));
        expect(next.find(w => w.id === 's1')).toBe(sticky);
        expect(next.some(w => w.type === 'articleSuggestions')).toBe(true);
    });
});

describe('serializeSuggestions', () => {
    it('lists pending suggestions with type and target category', () => {
        const w = makeSuggestionsWidget([
            suggestion('The Salt Guild', 'faction', { category: 'Factions' }),
            suggestion('Kael', 'character'),
        ]);
        const text = serializeSuggestions([w]);
        expect(text).toContain('- The Salt Guild (faction) → Factions');
        expect(text).toContain('- Kael (character)');
    });

    it('is empty when there is no widget or no suggestions', () => {
        expect(serializeSuggestions([])).toBe('');
        expect(serializeSuggestions([makeSuggestionsWidget([])])).toBe('');
    });
});
