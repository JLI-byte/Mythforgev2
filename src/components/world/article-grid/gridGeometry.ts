import { GridWidget, WidgetType, AlignGuide, GuideAxis } from './gridTypes';

export const CANVAS_WIDTH = 3000;
export const CANVAS_HEIGHT = 2000;
export const MIN_WIDTH = 120;
export const MIN_HEIGHT = 60;
export const MIN_ZONE_HEIGHT = 800;
export const ZONE_BOTTOM_PADDING = 120;

export const DEFAULT_DIMS: Record<WidgetType, { width: number; height: number }> = {
  text:      { width: 360, height: 180 },
  heading:   { width: 600, height: 80  },
  image:     { width: 300, height: 300 },
  divider:   { width: 500, height: 40  },
  quote:     { width: 380, height: 160 },
  statblock: { width: 260, height: 200 },
  table:     { width: 520, height: 220 },
  gallery:   { width: 580, height: 340 },
  untyped:   { width: 300, height: 200 },
  timeline:  { width: 680, height: 280 },
  relationship: { width: 600, height: 400 },
  familytree: { width: 680, height: 420 },
  characterarc: { width: 620, height: 320 },
  orgchart: { width: 680, height: 400 },
  pronunciation: { width: 400, height: 280 },
  syllable: { width: 360, height: 260 },
  lyric: { width: 460, height: 340 },
  scenecard: { width: 340, height: 380 },
};

export const WIDTH_PRESETS: { label: string; width: number }[] = [
  { label: 'Narrow',   width: 520  },
  { label: 'Standard', width: 680  },
  { label: 'Wide',     width: 860  },
  { label: 'Full',     width: 1060 },
];

export const PALETTE_ITEMS: { type: WidgetType; icon: string; label: string }[] = [
  { type: 'untyped',   icon: '⬜', label: 'Blank' },
  { type: 'text',      icon: '📝', label: 'Text' },
  { type: 'heading',   icon: '📰', label: 'Heading' },
  { type: 'image',     icon: '🖼️', label: 'Image' },
  { type: 'quote',     icon: '💬', label: 'Quote' },
  { type: 'divider',   icon: '➖', label: 'Divider' },
  { type: 'statblock', icon: '📊', label: 'Stat Block' },
  { type: 'table',     icon: '📋', label: 'Table' },
  { type: 'gallery',   icon: '🖼️', label: 'Gallery' },
  { type: 'timeline',  icon: '📅', label: 'Timeline' },
  { type: 'relationship', icon: '🕸️', label: 'Relations' },
  { type: 'familytree', icon: '🌳', label: 'Family Tree' },
  { type: 'characterarc', icon: '📈', label: 'Char Arc' },
  { type: 'orgchart', icon: '🏛️', label: 'Org Chart' },
  { type: 'pronunciation', icon: '🗣️', label: 'Pronunciation' },
  { type: 'syllable', icon: '🔢', label: 'Syllables' },
  { type: 'lyric', icon: '🎵', label: 'Verse/Lyric' },
  { type: 'scenecard', icon: '🃏', label: 'Scene Card' },
];

// ============================================================
// HELPERS
// ============================================================

export function getDefaultContent(type: WidgetType): Record<string, any> {
  switch (type) {
    case 'text':      return { html: '' };
    case 'heading':   return { text: '', level: 2 };
    case 'image':     return { src: '', caption: '' };
    case 'divider':   return {};
    case 'quote':     return { text: '', attribution: '' };
    case 'statblock': return { rows: [{ label: '', value: '' }] };
    case 'table':     return { headers: ['Column 1', 'Column 2'], rows: [['', ''], ['', '']] };
    case 'gallery':   return { images: [] };
    case 'timeline':  return { events: [], orientation: 'horizontal' };
    case 'relationship': return {
      manualEdges: [],      // { id, sourceId, targetId, label }[]
      autoDetect: true,     // whether to include auto-inferred edges
      includedEntityIds: [], // [] means "all project entities"
    };
    case 'familytree': return { members: [], edges: [] };
    case 'characterarc': return {
      mode: 'emotional',        // 'emotional' | 'goal'
      entityId: '',             // linked character entity
      beats: [],                // ArcBeat[]
      goalStages: ['Unaware', 'Aware', 'Pursuing', 'Achieved'], // goal mode stage labels
    };
    case 'orgchart': return { nodes: [], edges: [] };
    case 'pronunciation': return { entries: [] };
    case 'syllable': return { text: '', showBreakdown: true };
    case 'lyric': return { stanzas: [{ id: crypto.randomUUID(), lines: [{ id: crypto.randomUUID(), text: '' }] }], showSyllables: true, showRhyme: true };
    case 'scenecard': return {
      title: '', chapter: '', pov: '', setting: '',
      goal: '', conflict: '', outcome: '', notes: '',
      color: '#4A6FA5',
    };
    case 'untyped':   return {};
    default:          return {};
  }
}

export function updateWidgetContent(widgets: GridWidget[], id: string, content: Record<string, any>): GridWidget[] {
  return widgets.map(w => w.id === id ? { ...w, content: { ...w.content, ...content } } : w);
}

export function deleteWidgetById(widgets: GridWidget[], id: string): GridWidget[] {
  return widgets.filter(w => w.id !== id);
}

export const SNAP_THRESHOLD = 6; // px — distance within which a guide fires

export function computeGuides(
  moving: { x: number; y: number; width: number; height: number },
  others: GridWidget[]
): AlignGuide[] {
  const found: AlignGuide[] = [];
  const seen = new Set<string>();

  const addGuide = (axis: GuideAxis, pos: number) => {
    const key = axis + ':' + Math.round(pos);
    if (!seen.has(key)) { seen.add(key); found.push({ axis, pos }); }
  };

  // Moving element's key edges and center
  const mLeft   = moving.x;
  const mRight  = moving.x + moving.width;
  const mCenterX = moving.x + moving.width / 2;
  const mTop    = moving.y;
  const mBottom = moving.y + moving.height;
  const mCenterY = moving.y + moving.height / 2;

  for (const other of others) {
    const oLeft   = other.x;
    const oRight  = other.x + other.width;
    const oCenterX = other.x + other.width / 2;
    const oTop    = other.y;
    const oBottom = other.y + other.height;
    const oCenterY = other.y + other.height / 2;

    // Vertical guides (x-axis alignment — left, center, right edges)
    const xPoints = [
      [mLeft,    oLeft],   [mLeft,    oRight],  [mLeft,    oCenterX],
      [mRight,   oLeft],   [mRight,   oRight],  [mRight,   oCenterX],
      [mCenterX, oLeft],   [mCenterX, oRight],  [mCenterX, oCenterX],
    ];
    for (const [a, b] of xPoints) {
      if (Math.abs(a - b) < SNAP_THRESHOLD) addGuide('x', b);
    }

    // Horizontal guides (y-axis alignment — top, center, bottom edges)
    const yPoints = [
      [mTop,     oTop],    [mTop,     oBottom],  [mTop,     oCenterY],
      [mBottom,  oTop],    [mBottom,  oBottom],  [mBottom,  oCenterY],
      [mCenterY, oTop],    [mCenterY, oBottom],  [mCenterY, oCenterY],
    ];
    for (const [a, b] of yPoints) {
      if (Math.abs(a - b) < SNAP_THRESHOLD) addGuide('y', b);
    }
  }

  return found;
}
