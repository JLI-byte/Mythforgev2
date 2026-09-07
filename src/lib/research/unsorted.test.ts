import { describe, it, expect } from 'vitest';
import { toTray, fromTray, trayCount } from './unsorted';
import type { DeskWidget } from '@/store/workspaceStore';

const card = (id: string): DeskWidget => ({
    id, type: 'sticky', x: 40, y: 40, width: 200, height: 160, content: { text: id },
});

describe('toTray', () => {
    it('moves a card off the canvas and onto the end of the tray', () => {
        const r = toTray({ widgets: [card('a'), card('b')], unsorted: [card('z')] }, 'a');
        expect(r.widgets.map(w => w.id)).toEqual(['b']);
        expect(r.unsorted.map(w => w.id)).toEqual(['z', 'a']);
    });

    it('leaves everything alone when the id is not on the canvas', () => {
        const before = { widgets: [card('a')], unsorted: [] };
        expect(toTray(before, 'nope')).toEqual(before);
    });

    it('treats a missing tray as empty', () => {
        const r = toTray({ widgets: [card('a')], unsorted: undefined }, 'a');
        expect(r.unsorted.map(w => w.id)).toEqual(['a']);
    });
});

describe('fromTray', () => {
    it('places the card at the drop point and takes it out of the tray', () => {
        const r = fromTray({ widgets: [], unsorted: [card('a'), card('b')] }, 'a', { x: 320, y: 96 });
        expect(r.unsorted.map(w => w.id)).toEqual(['b']);
        expect(r.widgets).toHaveLength(1);
        expect(r.widgets[0]).toMatchObject({ id: 'a', x: 320, y: 96 });
    });

    it('leaves everything alone when the id is not in the tray', () => {
        const before = { widgets: [], unsorted: [card('a')] };
        expect(fromTray(before, 'nope', { x: 10, y: 10 })).toEqual(before);
    });

    it('keeps the card size and content intact across the move', () => {
        const r = fromTray({ widgets: [], unsorted: [card('a')] }, 'a', { x: 5, y: 5 });
        expect(r.widgets[0].width).toBe(200);
        expect(r.widgets[0].content).toEqual({ text: 'a' });
    });
});

describe('trayCount', () => {
    it('counts the tray', () => {
        expect(trayCount({ unsorted: [card('a'), card('b')] })).toBe(2);
    });

    it('is 0 when the tray is missing', () => {
        expect(trayCount({})).toBe(0);
    });
});
