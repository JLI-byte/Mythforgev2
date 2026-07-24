import { describe, it, expect } from 'vitest';
import type { DeskWidget } from '@/store/workspaceStore';
import {
    makeFlagsWidget,
    addFlagToWidgets,
    serializeFlags,
    type ConsistencyFlag,
} from './consistencyFlags';

function flag(summary: string, kind: ConsistencyFlag['kind'] = 'gap', detail?: string): ConsistencyFlag {
    return { id: summary, kind, summary, detail };
}

describe('addFlagToWidgets', () => {
    it('creates the widget on the first flag', () => {
        const next = addFlagToWidgets([], flag('The Salt Guild has no leader article', 'gap'));
        const widget = next.find(w => w.type === 'consistencyFlags');
        expect(widget).toBeTruthy();
        expect(widget!.content.flags).toHaveLength(1);
    });

    it('appends without adding a second widget', () => {
        const first = addFlagToWidgets([], flag('Gap A'));
        const second = addFlagToWidgets(first, flag('Veldrath is both sunless and sunlit', 'contradiction'));
        const widgets = second.filter(w => w.type === 'consistencyFlags');
        expect(widgets).toHaveLength(1);
        expect(widgets[0].content.flags.map((f: ConsistencyFlag) => f.kind)).toEqual(['gap', 'contradiction']);
    });

    it('ignores a duplicate summary (case-insensitive)', () => {
        const first = addFlagToWidgets([], flag('Missing map'));
        const again = addFlagToWidgets(first, flag('  missing map '));
        expect(again).toBe(first);
    });

    it('preserves other widgets', () => {
        const sticky: DeskWidget = { id: 's1', type: 'sticky', x: 0, y: 0, width: 200, height: 200, content: { text: 'hi' } };
        const next = addFlagToWidgets([sticky], flag('A gap'));
        expect(next.find(w => w.id === 's1')).toBe(sticky);
    });
});

describe('serializeFlags', () => {
    it('lists pending flags with their kind', () => {
        const w = makeFlagsWidget([
            flag('Two dates given for the founding', 'contradiction'),
            flag('No article for the harbor', 'gap'),
        ]);
        const text = serializeFlags([w]);
        expect(text).toContain('- [contradiction] Two dates given for the founding');
        expect(text).toContain('- [gap] No article for the harbor');
    });

    it('is empty with no widget or no flags', () => {
        expect(serializeFlags([])).toBe('');
        expect(serializeFlags([makeFlagsWidget([])])).toBe('');
    });
});
