import { describe, it, expect } from 'vitest';
import { serializeBoard, makeNoteCard } from './researchBoard';
import type { DeskWidget } from '@/store/workspaceStore';

function widget(type: DeskWidget['type'], content: Record<string, unknown>): DeskWidget {
  return { id: 'x', type, x: 0, y: 0, width: 10, height: 10, content };
}

describe('serializeBoard', () => {
  it('renders sticky, reference, and image cards with type labels', () => {
    const out = serializeBoard([
      widget('sticky', { text: 'a note' }),
      widget('reference', { title: 'Wikipedia', body: 'castles' }),
      widget('image', { label: 'a map' }),
    ]);
    expect(out).toBe('Note: a note\nLink: Wikipedia — castles\nClipping: a map');
  });

  it('skips cards with no text and returns empty string for an empty board', () => {
    expect(serializeBoard([])).toBe('');
    expect(serializeBoard([widget('sticky', {}), widget('image', {})])).toBe('');
  });
});

describe('makeNoteCard', () => {
  it('makes a sticky widget holding the text, staggered by index', () => {
    const card = makeNoteCard('hello', 2);
    expect(card.type).toBe('sticky');
    expect(card.content).toEqual({ text: 'hello' });
    expect(card.width).toBeGreaterThan(0);
    expect(card.height).toBeGreaterThan(0);
    expect(card.x).toBe(80 + 2 * 24);
    expect(card.y).toBe(80 + 2 * 24);
    expect(typeof card.id).toBe('string');
    expect(card.id.length).toBeGreaterThan(0);
  });
});
