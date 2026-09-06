import { describe, it, expect } from 'vitest';
import {
    makeConnection, resolveEndpoint, pruneOrphans, connectionsFor, removeConnection,
    type Connection,
} from './connections';
import type { DeskWidget } from '@/store/workspaceStore';

const w = (id: string, over: Partial<DeskWidget> = {}): DeskWidget => ({
    id, type: 'sticky', x: 100, y: 200, width: 200, height: 100, content: {}, ...over,
});

describe('resolveEndpoint', () => {
    it('resolves a widget endpoint to the card’s centre', () => {
        expect(resolveEndpoint({ widgetId: 'a' }, [w('a')])).toEqual({ x: 200, y: 250 });
    });

    it('passes a free point straight through', () => {
        expect(resolveEndpoint({ x: 12, y: 34 }, [])).toEqual({ x: 12, y: 34 });
    });

    it('is null when the widget is gone', () => {
        expect(resolveEndpoint({ widgetId: 'ghost' }, [w('a')])).toBeNull();
    });
});

describe('makeConnection', () => {
    it('defaults to a single arrow at the end', () => {
        const c = makeConnection({ widgetId: 'a' }, { widgetId: 'b' }, 'c1');
        expect(c).toMatchObject({ id: 'c1', arrow: 'end', curve: 0 });
    });
});

describe('connectionsFor', () => {
    it('finds every line touching a card, at either end', () => {
        const cs: Connection[] = [
            makeConnection({ widgetId: 'a' }, { widgetId: 'b' }, 'c1'),
            makeConnection({ widgetId: 'b' }, { widgetId: 'c' }, 'c2'),
            makeConnection({ x: 0, y: 0 }, { widgetId: 'c' }, 'c3'),
        ];
        expect(connectionsFor(cs, 'b').map(c => c.id)).toEqual(['c1', 'c2']);
    });
});

describe('removeConnection', () => {
    it('drops one line by id', () => {
        const cs = [makeConnection({ x: 0, y: 0 }, { x: 1, y: 1 }, 'c1')];
        expect(removeConnection(cs, 'c1')).toEqual([]);
    });
});

describe('pruneOrphans', () => {
    it('drops a line whose card was deleted', () => {
        const cs = [
            makeConnection({ widgetId: 'a' }, { widgetId: 'b' }, 'c1'),
            makeConnection({ widgetId: 'a' }, { widgetId: 'gone' }, 'c2'),
        ];
        expect(pruneOrphans(cs, [w('a'), w('b')]).map(c => c.id)).toEqual(['c1']);
    });

    it('keeps a line pinned to free points, which depend on no card', () => {
        const cs = [makeConnection({ x: 0, y: 0 }, { x: 5, y: 5 }, 'c1')];
        expect(pruneOrphans(cs, []).map(c => c.id)).toEqual(['c1']);
    });

    it('returns the same array when nothing is orphaned, so React can skip', () => {
        const cs = [makeConnection({ widgetId: 'a' }, { x: 1, y: 1 }, 'c1')];
        expect(pruneOrphans(cs, [w('a')])).toBe(cs);
    });

    it('handles an empty list', () => {
        expect(pruneOrphans([], [])).toEqual([]);
    });
});
