/**
 * ArticleGridEditor — Freeform absolute-positioned canvas for World Bible articles.
 *
 * Sprint 57: Full rewrite from flex-wrap grid to freeform canvas.
 * Sprint 64: Active zone drag moves widgets. Dynamic zone height. Width presets.
 * Sprint 65: Liquid ripple dot background. Removed diagonal scratch overlay.
 *            Active zone gets surface background matching theme.
 *            Fixed frozen dots bug — energy floor snaps near-zero values to 0.
 */
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import styles from './ArticleGridEditor.module.css';
import { sanitizeHtml } from '@/lib/sanitize';

// ============================================================
// DATA MODEL
// ============================================================

export type WidgetType = 'text' | 'heading' | 'image' | 'divider' | 'quote' | 'statblock' | 'table' | 'gallery' | 'untyped' | 'timeline' | 'relationship' | 'familytree' | 'characterarc' | 'orgchart' | 'pronunciation' | 'syllable' | 'lyric' | 'scenecard';

export interface GridWidget {
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  width: number;
  height: number;
  content: Record<string, any>;
  pinnedToSheet?: boolean;
}

export interface ArticleTab {
  id: string;
  name: string;
  widgets: GridWidget[];
}

export function parseArticleTabs(raw: string | undefined): ArticleTab[] {
  const defaultMain = (): ArticleTab[] => [{
    id: crypto.randomUUID(),
    name: 'Main',
    widgets: [],
  }];

  if (!raw) return defaultMain();

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultMain();
    if (typeof parsed[0].name === 'string' && Array.isArray(parsed[0].widgets)) return parsed as ArticleTab[];
    if (typeof parsed[0].x === 'number' && typeof parsed[0].y === 'number') {
      return [{ id: crypto.randomUUID(), name: 'Main', widgets: parsed as GridWidget[] }];
    }
    return defaultMain();
  } catch {
    return defaultMain();
  }
}

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
type GuideAxis = 'x' | 'y';

interface AlignGuide {
  axis: GuideAxis;   // 'x' = vertical line, 'y' = horizontal line
  pos: number;       // canvas coordinate (px) where the line sits
}

const CANVAS_WIDTH = 3000;
const CANVAS_HEIGHT = 2000;
const MIN_WIDTH = 120;
const MIN_HEIGHT = 60;
const MIN_ZONE_HEIGHT = 800;
const ZONE_BOTTOM_PADDING = 120;

const DEFAULT_DIMS: Record<WidgetType, { width: number; height: number }> = {
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

const WIDTH_PRESETS: { label: string; width: number }[] = [
  { label: 'Narrow',   width: 520  },
  { label: 'Standard', width: 680  },
  { label: 'Wide',     width: 860  },
  { label: 'Full',     width: 1060 },
];

const PALETTE_ITEMS: { type: WidgetType; icon: string; label: string }[] = [
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
// GRID CANVAS — Static dot background
// ============================================================

const DOT_SPACING = 28;
const DOT_RADIUS = 1.5;
const DOT_COLOR = 'rgba(255, 255, 255, 0.15)';

export function StaticGridCanvas({ containerRef, opacity = 1 }: { containerRef: React.RefObject<HTMLDivElement | null>, opacity?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = container.clientWidth;
    const h = container.clientHeight;
    canvas.width = w;
    canvas.height = h;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.15 * opacity})`;

    const cols = Math.ceil(w / DOT_SPACING) + 1;
    const rows = Math.ceil(h / DOT_SPACING) + 1;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * DOT_SPACING;
        const y = r * DOT_SPACING;
        ctx.beginPath();
        ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver(draw);
    ro.observe(container);

    draw();
    return () => ro.disconnect();
  }, [containerRef, draw]);

  return (
    <canvas
      ref={canvasRef}
      className={styles.gridCanvas}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}

// ============================================================
// HELPERS
// ============================================================

function getDefaultContent(type: WidgetType): Record<string, any> {
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

function updateWidgetContent(widgets: GridWidget[], id: string, content: Record<string, any>): GridWidget[] {
  return widgets.map(w => w.id === id ? { ...w, content: { ...w.content, ...content } } : w);
}

function deleteWidgetById(widgets: GridWidget[], id: string): GridWidget[] {
  return widgets.filter(w => w.id !== id);
}

const SNAP_THRESHOLD = 6; // px — distance within which a guide fires

function computeGuides(
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

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function ArticleGridEditor({ entityId, hideGrid = false }: { entityId: string, hideGrid?: boolean }) {
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);
  const articleZoneWidth = useWorkspaceStore(state => state.articleZoneWidth);
  const setArticleZoneWidth = useWorkspaceStore(state => state.setArticleZoneWidth);
  const entities = useWorkspaceStore(state => state.entities);
  const updateEntityDoc = useWorkspaceStore(state => state.updateEntityDoc);
  const entity = entities.find(e => e.id === entityId);

  const [tabs, setTabs] = useState<ArticleTab[]>(() => parseArticleTabs(entity?.articleDoc));
  const [activeTabId, setActiveTabId] = useState<string>(() => parseArticleTabs(entity?.articleDoc)[0].id);
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);

  const widgetsRef = useRef<GridWidget[]>([]);
  const activeTab = tabs.find(t => t.id === activeTabId) ?? tabs[0];
  const widgets = activeTab.widgets;
  widgetsRef.current = widgets;

  const contentBottom = widgets.length > 0
    ? Math.max(...widgets.map(w => w.y + w.height))
    : 0;
  const activeZoneHeight = Math.max(MIN_ZONE_HEIGHT, contentBottom) + ZONE_BOTTOM_PADDING;

  const [saveLabel, setSaveLabel] = useState<'idle' | 'saved'>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragCleanup = useRef<(() => void) | null>(null);
  const resizeCleanup = useRef<(() => void) | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const clipboardWidgets = useRef<GridWidget[]>([]);
  const historyStack = useRef<ArticleTab[][]>([]);

  const [zoom, setZoom] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeZonePos, setActiveZonePos] = useState<{ x: number; y: number }>({ x: 40, y: 40 });

  // Initial center only once
  useEffect(() => {
    if (!viewportRef.current) return;
    // Only center if it's the initial default state or width change requested a reset
    if (activeZonePos.x === 40 && activeZonePos.y === 40) {
      const vw = viewportRef.current.clientWidth;
      const newX = (vw - articleZoneWidth) / 2;
      setActiveZonePos({ x: newX, y: 0 });
    }
  }, [articleZoneWidth]);

  // Currently opening the type picker for a specific 'untyped' widget
  const [typePickerWidgetId, setTypePickerWidgetId] = useState<string | null>(null);

  const [guides, setGuides] = useState<AlignGuide[]>([]);

  // Draw ghost ref (use DOM ref for performance)
  const drawGhostRef = useRef<HTMLDivElement>(null);

  const save = useCallback((nextTabs: ArticleTab[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      updateEntityDoc(entityId, JSON.stringify(nextTabs));
      setSaveLabel('saved');
      setTimeout(() => setSaveLabel('idle'), 2000);
    }, 400);
  }, [entityId, updateEntityDoc]);

  const applyTabChange = useCallback((nextWidgets: GridWidget[]) => {
    const nextTabs = tabs.map(t =>
      t.id === activeTabId ? { ...t, widgets: nextWidgets } : t
    );
    setTabs(nextTabs);
    save(nextTabs);
  }, [tabs, activeTabId, save]);

  const applyTabChangeWithHistory = useCallback((nextWidgets: GridWidget[]) => {
    historyStack.current = [
      ...historyStack.current.slice(-19),
      tabs.map(t => ({ ...t, widgets: [...t.widgets] })),
    ];
    applyTabChange(nextWidgets);
  }, [tabs, applyTabChange]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      dragCleanup.current?.();
      resizeCleanup.current?.();
    };
  }, []);

  useEffect(() => {
    const parsed = parseArticleTabs(entity?.articleDoc);
    setTabs(parsed);
    setActiveTabId(parsed[0].id);
  }, [entityId]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      const rect = el.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top  && e.clientY <= rect.bottom;
      if (!inside) return;
      e.preventDefault();
      e.stopPropagation();
      setZoom(prev => {
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        return Math.min(2, Math.max(0.25, parseFloat((prev + delta).toFixed(2))));
      });
    };
    document.addEventListener('wheel', handleWheel, { passive: false });
    return () => document.removeEventListener('wheel', handleWheel);
  }, []);

  const handleFitToView = useCallback(() => {
    if (!viewportRef.current) return;
    const viewportWidth = viewportRef.current.clientWidth;
    setZoom(Math.min(2, Math.max(0.25, parseFloat((viewportWidth / articleZoneWidth).toFixed(2)))));
  }, [articleZoneWidth]);

  useEffect(() => {
    const isInputFocused = () => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement).isContentEditable;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.shiftKey && e.key === '0') { e.preventDefault(); handleFitToView(); return; }
      if (ctrl && e.key === '0') { e.preventDefault(); setZoom(1); return; }
      if (ctrl && (e.key === '=' || e.key === '+')) { e.preventDefault(); setZoom(prev => Math.min(2, parseFloat((prev + 0.1).toFixed(2)))); return; }
      if (ctrl && e.key === '-') { e.preventDefault(); setZoom(prev => Math.max(0.25, parseFloat((prev - 0.1).toFixed(2)))); return; }
      if (isInputFocused()) return;
      if (ctrl && e.key === 'a') { e.preventDefault(); setSelectedIds(new Set(widgets.map(w => w.id))); return; }
      if (ctrl && e.key === 'c') {
        e.preventDefault();
        clipboardWidgets.current = widgets.filter(w => selectedIds.has(w.id)).map(w => ({ ...w, content: JSON.parse(JSON.stringify(w.content)) }));
        return;
      }
      if (ctrl && e.key === 'v') {
        e.preventDefault();
        if (clipboardWidgets.current.length === 0) return;
        const pasted = clipboardWidgets.current.map(w => ({ ...w, id: crypto.randomUUID(), x: w.x + 20, y: w.y + 20, content: JSON.parse(JSON.stringify(w.content)) }));
        applyTabChangeWithHistory([...widgets, ...pasted]);
        setSelectedIds(new Set(pasted.map(p => p.id)));
        return;
      }
      if (ctrl && e.key === 'z') {
        e.preventDefault();
        if (historyStack.current.length === 0) return;
        const prevTabs = historyStack.current.pop()!;
        setTabs(prevTabs);
        save(prevTabs);
        setSelectedIds(new Set());
        return;
      }
      if (e.key === 'Escape') {
        if (typePickerWidgetId) {
          setTypePickerWidgetId(null);
        } else {
          setSelectedIds(new Set());
        }
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.size > 0) {
        e.preventDefault();
        applyTabChangeWithHistory(widgets.filter(w => !selectedIds.has(w.id)));
        setSelectedIds(new Set());
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [widgets, selectedIds, tabs, activeTabId, save, applyTabChangeWithHistory, handleFitToView]);

  const addTab = () => {
    const newTab: ArticleTab = { id: crypto.randomUUID(), name: `Tab ${tabs.length + 1}`, widgets: [] };
    const nextTabs = [...tabs, newTab];
    setTabs(nextTabs);
    setActiveTabId(newTab.id);
    save(nextTabs);
  };

  const deleteTab = (tabId: string) => {
    if (tabs.length === 1 || tabId === tabs[0].id) return;
    const nextTabs = tabs.filter(t => t.id !== tabId);
    setTabs(nextTabs);
    if (activeTabId === tabId) setActiveTabId(nextTabs[nextTabs.length - 1].id);
    save(nextTabs);
  };

  const renameTab = (tabId: string, newName: string) => {
    const trimmed = newName.trim() || 'Tab';
    const nextTabs = tabs.map(t => t.id === tabId ? { ...t, name: trimmed } : t);
    setTabs(nextTabs);
    setRenamingTabId(null);
    save(nextTabs);
  };

  const handleActiveZoneDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startMouseX = e.clientX;
    const startX = activeZonePos.x;
    
    // Identify which widgets are pinned to the sheet at the start of the drag
    const startWidgets = widgetsRef.current.map(w => ({ ...w }));
    const insideIds = new Set(startWidgets
      .filter(sw => sw.pinnedToSheet === true)
      .map(sw => sw.id)
    );

    const onMouseMove = (mv: MouseEvent) => {
      const vw = viewportRef.current?.clientWidth || 0;
      const deltaX = (mv.clientX - startMouseX) / zoom;
      let newX = startX + deltaX;
      
      // Clamp sheet to screen boundaries
      newX = Math.max(0, Math.min(vw - articleZoneWidth, newX));
      const actualDelta = newX - startX;
      
      const zone = canvasRef.current?.querySelector('[data-active-zone]') as HTMLElement;
      if (zone) zone.style.left = newX + 'px';
      
      // Only move widgets that were identified as "inside"
      startWidgets.forEach(sw => {
        if (!insideIds.has(sw.id)) return;
        const el = canvasRef.current?.querySelector(`[data-widget-id="${sw.id}"]`) as HTMLElement;
        if (el) el.style.left = (sw.x + actualDelta) + 'px';
      });
    };

    const onMouseUp = (up: MouseEvent) => {
      const vw = viewportRef.current?.clientWidth || 0;
      const deltaX = (up.clientX - startMouseX) / zoom;
      let newX = Math.max(0, Math.min(vw - articleZoneWidth, startX + deltaX));
      const actualDelta = newX - startX;

      setActiveZonePos(prev => ({ ...prev, x: newX }));
      
      if (actualDelta !== 0) {
        // Only update the store for widgets that were part of the sheet movement
        applyTabChange(widgetsRef.current.map(w => {
          if (insideIds.has(w.id)) {
            return { ...w, x: w.x + actualDelta };
          }
          return w;
        }));
      }
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleSheetResizeStart = (e: React.MouseEvent, side: 'left' | 'right') => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const initialWidth = articleZoneWidth;
    const initialPos = activeZonePos.x;

    const onMouseMove = (mv: MouseEvent) => {
      const vw = viewportRef.current?.clientWidth || 0;
      const deltaX = (mv.clientX - startX) / zoom;

      if (side === 'right') {
        // Expand right, clamp to vw
        const maxWidth = vw - initialPos;
        const nextWidth = Math.max(500, Math.min(maxWidth, initialWidth + deltaX));
        setArticleZoneWidth(Math.round(nextWidth));
      } else {
        // Expand left, clamp to 0
        const maxExpandedWidth = initialWidth + initialPos;
        const nextWidth = Math.max(500, Math.min(maxExpandedWidth, initialWidth - deltaX));
        const actualDelta = initialWidth - nextWidth;
        setArticleZoneWidth(Math.round(nextWidth));
        setActiveZonePos(prev => ({ ...prev, x: initialPos + actualDelta }));
      }
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const isWidgetOnSheet = (x: number, width: number) => {
    return x >= activeZonePos.x && (x + width) <= activeZonePos.x + articleZoneWidth;
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return; // only fire on empty surface
    setSelectedIds(new Set());

    // Begin draw gesture
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    const startX = (e.clientX - canvasRect.left) / zoom;
    const startY = (e.clientY - canvasRect.top) / zoom;

    const pinned = startX >= activeZonePos.x && startX <= activeZonePos.x + articleZoneWidth;

    const ghost = drawGhostRef.current;
    if (ghost) {
      ghost.style.display = 'block';
      ghost.style.left = startX + 'px';
      ghost.style.top = startY + 'px';
      ghost.style.width = '0px';
      ghost.style.height = '0px';
    }

    const onMouseMove = (mv: MouseEvent) => {
      const x = (mv.clientX - canvasRect.left) / zoom;
      const y = (mv.clientY - canvasRect.top) / zoom;
      const w = x - startX;
      const h = y - startY;
      if (ghost) {
        ghost.style.left   = (w >= 0 ? startX : startX + w) + 'px';
        ghost.style.top    = (h >= 0 ? startY : startY + h) + 'px';
        ghost.style.width  = Math.abs(w) + 'px';
        ghost.style.height = Math.abs(h) + 'px';
      }

      const bx = w >= 0 ? startX : startX + w;
      const by = h >= 0 ? startY : startY + h;
      const bw = Math.abs(w);
      const bh = Math.abs(h);

      setGuides(computeGuides({ x: bx, y: by, width: bw, height: bh }, widgetsRef.current));
    };

    const onMouseUp = (up: MouseEvent) => {
      if (ghost) ghost.style.display = 'none';
      setGuides([]);

      const x = (up.clientX - canvasRect.left) / zoom;
      const y = (up.clientY - canvasRect.top) / zoom;
      const rawW = x - startX;
      const rawH = y - startY;
      const bx = rawW >= 0 ? startX : startX + rawW;
      const by = rawH >= 0 ? startY : startY + rawH;
      const bw = Math.abs(rawW);
      const bh = Math.abs(rawH);

      if (bw >= MIN_WIDTH && bh >= MIN_HEIGHT) {
        const newId = crypto.randomUUID();
        applyTabChangeWithHistory([...widgetsRef.current, {
          id: newId,
          type: 'untyped' as WidgetType,
          x: bx,
          y: by,
          width: bw,
          height: bh,
          content: {},
          pinnedToSheet: pinned,
        }]);
        
        // Instantly trigger type picker for the new widget
        setTypePickerWidgetId(newId);
      }

      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const isFit = viewportRef.current
    ? Math.abs(zoom - viewportRef.current.clientWidth / articleZoneWidth) < 0.02
    : false;

  if (!entity || !hasMounted) return null;

  const handleCanvasDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('widget-type') as WidgetType;
    if (!type) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dims = DEFAULT_DIMS[type];
    // Position dropped widget relative to the active zone if dropped inside it, or just drop at mouse
    const x = (e.clientX - rect.left) / zoom - dims.width / 2;
    const y = (e.clientY - rect.top) / zoom - dims.height / 2;
    applyTabChangeWithHistory([...widgets, {
      id: crypto.randomUUID(), type, x, y,
      width: dims.width, height: dims.height,
      content: getDefaultContent(type),
    }]);
  };

  const handleDragStart = (e: React.MouseEvent, widget: GridWidget) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedIds(prev => prev.has(widget.id) ? prev : new Set([widget.id]));
    const el = document.querySelector(`[data-widget-id="${widget.id}"]`) as HTMLElement;
    if (!el) return;
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startX = widget.x;
    const startY = widget.y;
    el.style.zIndex = '100';
    el.style.boxShadow = '0 16px 48px rgba(0,0,0,0.6)';
    const onMouseMove = (mv: MouseEvent) => {
      const newX = startX + (mv.clientX - startMouseX) / zoom;
      const newY = startY + (mv.clientY - startMouseY) / zoom;
      el.style.left = newX + 'px';
      el.style.top  = newY + 'px';

      // Compute guides against all other widgets
      const others = widgetsRef.current.filter(w => w.id !== widget.id);
      setGuides(computeGuides({ x: newX, y: newY, width: widget.width, height: widget.height }, others));
    };
    const onMouseUp = (up: MouseEvent) => {
      const newX = startX + (up.clientX - startMouseX) / zoom;
      const newY = startY + (up.clientY - startMouseY) / zoom;
      el.style.zIndex = '';
      el.style.boxShadow = '';
      setGuides([]);

      // Determine if widget is now pinned to the sheet
      const isNowOnSheet = isWidgetOnSheet(newX, widget.width);
      
      applyTabChangeWithHistory(widgetsRef.current.map(w => w.id === widget.id ? { ...w, x: newX, y: newY, pinnedToSheet: isNowOnSheet } : w));
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      dragCleanup.current = null;
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    dragCleanup.current = () => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); };
  };

  const handleResizeStart = (e: React.MouseEvent, widget: GridWidget, dir: ResizeDirection) => {
    e.preventDefault();
    e.stopPropagation();
    const el = document.querySelector(`[data-widget-id="${widget.id}"]`) as HTMLElement;
    if (!el) return;
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const { x: startX, y: startY, width: startW, height: startH } = widget;
    const compute = (mx: number, my: number) => {
      const dx = (mx - startMouseX) / zoom;
      const dy = (my - startMouseY) / zoom;
      let x = startX, y = startY, w = startW, h = startH;
      if (dir.includes('e')) w = Math.max(MIN_WIDTH, startW + dx);
      if (dir.includes('s')) h = Math.max(MIN_HEIGHT, startH + dy);
      if (dir.includes('w')) { const nw = Math.max(MIN_WIDTH, startW - dx); x = startX + startW - nw; w = nw; }
      if (dir.includes('n')) { const nh = Math.max(MIN_HEIGHT, startH - dy); y = startY + startH - nh; h = nh; }
      return { x, y, width: w, height: h };
    };
    const onMouseMove = (mv: MouseEvent) => {
      const n = compute(mv.clientX, mv.clientY);
      el.style.left = n.x + 'px';
      el.style.top = n.y + 'px';
      el.style.width = n.width + 'px';
      el.style.height = n.height + 'px';

      const others = widgetsRef.current.filter(w => w.id !== widget.id);
      setGuides(computeGuides(n, others));
    };
    const onMouseUp = (up: MouseEvent) => {
      setGuides([]);
      applyTabChangeWithHistory(widgetsRef.current.map(w => w.id === widget.id ? { ...w, ...compute(up.clientX, up.clientY) } : w));
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    resizeCleanup.current = () => { 
      document.removeEventListener('mousemove', onMouseMove); 
      document.removeEventListener('mouseup', onMouseUp); 
    };
  };

  return (
    <div className={styles.editorRoot}>
      <div className={styles.canvasColumn}>
        <div ref={viewportRef} className={styles.canvasViewport}>
          {!hideGrid && <StaticGridCanvas containerRef={viewportRef} />}
          <div className={styles.saveIndicator}>{saveLabel === 'saved' ? '✓ Saved' : ''}</div>

            <div
              ref={canvasRef}
              className={styles.canvasInner}
              onMouseDown={handleCanvasMouseDown}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleCanvasDrop}
              style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' } as React.CSSProperties}
            >
              {/* Draw ghost — shown while user is drawing a new box */}
              <div ref={drawGhostRef} className={styles.drawGhost} />
              
              {/* Alignment guides */}
              {guides.map((g, i) => (
                <div
                  key={i}
                  className={g.axis === 'x' ? styles.guideX : styles.guideY}
                  style={g.axis === 'x'
                    ? { left: g.pos }
                    : { top: g.pos }
                  }
                />
              ))}

            <div
              data-active-zone
              className={styles.activeZoneSheet}
              style={{ left: activeZonePos.x, width: articleZoneWidth }}
              onMouseDown={handleCanvasMouseDown}
            >
              <div className={styles.edgeHandleLeft} onMouseDown={(e) => handleSheetResizeStart(e, 'left')} />
              <div className={styles.edgeHandleRight} onMouseDown={(e) => handleSheetResizeStart(e, 'right')} />
              
              <div className={styles.sheetHeader} onMouseDown={handleActiveZoneDragStart}>
                <div className={styles.widthDisplayCompact}>
                  {articleZoneWidth}px
                </div>

                <div className={styles.tabBarSmall}>
                  {tabs.map((tab, idx) => (
                    <div
                      key={tab.id}
                      className={`${styles.tabSmall} ${tab.id === activeTabId ? styles.tabActiveSmall : ''}`}
                      onClick={(e) => { e.stopPropagation(); setActiveTabId(tab.id); }}
                      onDoubleClick={(e) => { e.stopPropagation(); setRenamingTabId(tab.id); }}
                    >
                      {renamingTabId === tab.id ? (
                        <input
                          className={styles.tabRenameInputSmall}
                          defaultValue={tab.name}
                          autoFocus
                          onBlur={(e) => renameTab(tab.id, e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') renameTab(tab.id, e.currentTarget.value); if (e.key === 'Escape') setRenamingTabId(null); }}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className={styles.tabNameSmall}>{tab.name}</span>
                      )}
                    </div>
                  ))}
                  <button className={styles.tabAddSmall} onClick={(e) => { e.stopPropagation(); addTab(); }}>＋</button>
                </div>
              </div>
            </div>

            {widgets.map(widget => (
              <div
                key={widget.id}
                data-widget-id={widget.id}
                className={`${styles.widgetWrapper} ${selectedIds.has(widget.id) ? styles.widgetSelected : ''}`}
                style={{ 
                  left: widget.x, 
                  top: widget.y, 
                  width: widget.width, 
                  height: widget.height,
                  zIndex: widget.pinnedToSheet ? 10 : 4 
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (e.shiftKey) {
                    setSelectedIds(prev => { const next = new Set(prev); if (next.has(widget.id)) next.delete(widget.id); else next.add(widget.id); return next; });
                  } else {
                    setSelectedIds(new Set([widget.id]));
                  }
                }}
              >
                <div className={styles.widgetDragBar} onMouseDown={(e) => handleDragStart(e, widget)}>
                  <div className={styles.widgetDragBarLeft}>
                    <span className={styles.widgetIcon}>{PALETTE_ITEMS.find(p => p.type === widget.type)?.icon} {widget.type}</span>
                  </div>
                  <div className={styles.widgetDragBarRight}>
                    {widget.type === 'untyped' && (
                      <button
                        className={styles.chooseTypeBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          setTypePickerWidgetId(widget.id);
                        }}
                      >
                        Choose type
                      </button>
                    )}
                    <button className={styles.widgetDelete} onClick={() => applyTabChangeWithHistory(deleteWidgetById(widgets, widget.id))} title="Delete widget">×</button>
                  </div>
                </div>
                <div className={styles.widgetContent}>
                  <WidgetRenderer widget={widget} onChange={(content) => applyTabChange(updateWidgetContent(widgets, widget.id, content))} />
                </div>
                {(['n','s','e','w','ne','nw','se','sw'] as ResizeDirection[]).map(dir => (
                  <div key={dir} className={`${styles.resizeHandle} ${styles['resize_' + dir]}`} onMouseDown={(e) => handleResizeStart(e, widget, dir)} />
                ))}
              </div>
            ))}
          </div>

          <div className={styles.zoomControls}>
            <div className={styles.zoomIndicator} onClick={() => setZoom(1)} title="Click to reset zoom to 100%">
              {Math.round(zoom * 100)}%{isFit ? ' · FIT' : ''}
            </div>
            <div className={`${styles.fitButton} ${isFit ? styles.fitButtonActive : ''}`} onClick={handleFitToView} title="Fit active zone to viewport (Ctrl+Shift+0)">
              FIT
            </div>
          </div>

          {typePickerWidgetId && (() => {
            const tw = widgets.find(w => w.id === typePickerWidgetId);
            if (!tw) return null;
            const canvas = canvasRef.current;
            if (!canvas) return null;
            const cRect = canvas.getBoundingClientRect();
            
            // Picker dimensions for clamping
            const pickerWidth = 260;
            const pickerHeight = 320;
            const padding = 20;

            let sx = cRect.left + (tw.x + tw.width / 2) * zoom;
            let sy = cRect.top + (tw.y + tw.height / 2) * zoom;

            // Clamp to viewport
            sx = Math.max(padding + pickerWidth / 2, Math.min(window.innerWidth - padding - pickerWidth / 2, sx));
            sy = Math.max(padding + pickerHeight / 2, Math.min(window.innerHeight - padding - pickerHeight / 2, sy));

            return (
              <div
                className={styles.typePicker}
                style={{ left: sx, top: sy }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className={styles.typePickerTitle}>Choose widget type</div>
                <div className={styles.typePickerGrid}>
                  {PALETTE_ITEMS.filter(item => item.type !== 'untyped').map(item => (
                    <button
                      key={item.type}
                      className={styles.typePickerBtn}
                      onClick={() => {
                        applyTabChangeWithHistory(widgets.map(w =>
                          w.id === typePickerWidgetId
                            ? { ...w, type: item.type, content: getDefaultContent(item.type) }
                            : w
                        ));
                        setTypePickerWidgetId(null);
                      }}
                    >
                      <span className={styles.typePickerIcon}>{item.icon}</span>
                      <span className={styles.typePickerLabel}>{item.label}</span>
                    </button>
                  ))}
                </div>
                <button
                  className={styles.typePickerCancel}
                  onClick={() => setTypePickerWidgetId(null)}
                >
                  Cancel
                </button>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// WIDGET RENDERERS
// ============================================================

function WidgetRenderer({ widget, onChange }: { widget: GridWidget; onChange: (c: Record<string, any>) => void }) {
  switch (widget.type) {
    case 'text':      return <TextWidget content={widget.content} onChange={onChange} />;
    case 'heading':   return <HeadingWidget content={widget.content} onChange={onChange} />;
    case 'image':     return <ImageWidget content={widget.content} onChange={onChange} />;
    case 'divider':   return <DividerWidget />;
    case 'quote':     return <QuoteWidget content={widget.content} onChange={onChange} />;
    case 'statblock': return <StatBlockWidget content={widget.content} onChange={onChange} />;
    case 'table':     return <TableWidget content={widget.content} onChange={onChange} />;
    case 'gallery':   return <GalleryWidget content={widget.content} onChange={onChange} />;
    case 'timeline':  return <TimelineWidget content={widget.content} onChange={onChange} />;
    case 'relationship': return <RelationshipWidget content={widget.content} onChange={onChange} />;
    case 'familytree': return <FamilyTreeWidget content={widget.content} onChange={onChange} />;
    case 'characterarc': return <CharacterArcWidget content={widget.content} onChange={onChange} />;
    case 'orgchart': return <OrgChartWidget content={widget.content} onChange={onChange} />;
    case 'pronunciation': return <PronunciationWidget content={widget.content} onChange={onChange} />;
    case 'syllable': return <SyllableWidget content={widget.content} onChange={onChange} />;
    case 'lyric': return <LyricWidget content={widget.content} onChange={onChange} />;
    case 'scenecard': return <SceneCardWidget content={widget.content} onChange={onChange} />;
    case 'untyped':   return <UntypedWidget />;
    default:          return null;
  }
}

function UntypedWidget() {
  return (
    <div className={styles.untypedWidget}>
      <span className={styles.untypedHint}>Click "Choose type" above to set widget type</span>
    </div>
  );
}

function TextWidget({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) { const clean = sanitizeHtml(content.html || ''); if (ref.current.innerHTML !== clean) ref.current.innerHTML = clean; } }, []);
  return <div ref={ref} className={styles.textWidget} contentEditable suppressContentEditableWarning onBlur={() => { if (ref.current) onChange({ html: ref.current.innerHTML }); }} data-placeholder="Start writing..." />;
}

function HeadingWidget({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  return (
    <div className={styles.headingWidget}>
      <select className={styles.headingLevel} value={content.level || 2} onChange={(e) => onChange({ ...content, level: parseInt(e.target.value) })}>
        <option value={1}>H1</option><option value={2}>H2</option><option value={3}>H3</option>
      </select>
      <input className={styles.headingText} type="text" placeholder="Heading text..." value={content.text || ''} onChange={(e) => onChange({ ...content, text: e.target.value })} onBlur={(e) => onChange({ ...content, text: e.target.value })} />
    </div>
  );
}

function ImageWidget({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === 'string') onChange({ ...content, src: reader.result }); };
    reader.readAsDataURL(file);
  };
  return (
    <div className={styles.imageWidget}>
      {content.src ? (
        <><img src={content.src} alt={content.caption || ''} className={styles.imagePreview} /><input className={styles.captionInput} type="text" placeholder="Caption..." value={content.caption || ''} onChange={(e) => onChange({ ...content, caption: e.target.value })} /></>
      ) : (
        <div className={styles.imageUpload} onClick={() => fileRef.current?.click()}><span>🖼️</span><span>Click to upload image</span></div>
      )}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
    </div>
  );
}

function DividerWidget() { return <hr className={styles.dividerWidget} />; }

function QuoteWidget({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  return (
    <div className={styles.quoteWidget}>
      <textarea className={styles.quoteText} placeholder="Quote text..." value={content.text || ''} onChange={(e) => onChange({ ...content, text: e.target.value })} />
      <div className={styles.quoteAttribution}>
        <span>—</span>
        <input className={styles.quoteSource} type="text" placeholder="Attribution" value={content.attribution || ''} onChange={(e) => onChange({ ...content, attribution: e.target.value })} />
      </div>
    </div>
  );
}

function StatBlockWidget({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const rows: { label: string; value: string }[] = content.rows || [{ label: '', value: '' }];
  const updateRow = (i: number, field: 'label' | 'value', val: string) => {
    const next = [...rows]; next[i] = { ...next[i], [field]: val }; onChange({ ...content, rows: next });
  };
  return (
    <div className={styles.statBlock}>
      {rows.map((row, i) => (
        <div key={i} className={styles.statRow}>
          <input className={styles.statLabel} type="text" placeholder="Label" value={row.label} onChange={(e) => updateRow(i, 'label', e.target.value)} />
          <input className={styles.statValue} type="text" placeholder="Value" value={row.value} onChange={(e) => updateRow(i, 'value', e.target.value)} />
          <button className={styles.statDelete} onClick={() => onChange({ ...content, rows: rows.filter((_, j) => j !== i) })}>×</button>
        </div>
      ))}
      <button className={styles.statAdd} onClick={() => onChange({ ...content, rows: [...rows, { label: '', value: '' }] })}>+ Add Row</button>
    </div>
  );
}

function TableWidget({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const headers: string[] = content.headers || ['Column 1', 'Column 2'];
  const rows: string[][] = content.rows || [['', '']];
  return (
    <div className={styles.tableWidget}>
      <table className={styles.table}>
        <thead><tr>{headers.map((h, i) => (<th key={i}><input className={styles.tableCell} value={h} onChange={(e) => { const next = [...headers]; next[i] = e.target.value; onChange({ ...content, headers: next }); }} /></th>))}</tr></thead>
        <tbody>{rows.map((row, ri) => (<tr key={ri}>{row.map((cell, ci) => (<td key={ci}><input className={styles.tableCell} value={cell} onChange={(e) => { const next = rows.map(r => [...r]); next[ri][ci] = e.target.value; onChange({ ...content, rows: next }); }} /></td>))}</tr>))}</tbody>
      </table>
      <button className={styles.tableAddRow} onClick={() => onChange({ ...content, rows: [...rows, headers.map(() => '')] })}>+ Add Row</button>
    </div>
  );
}

function GalleryWidget({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const images: { id: string; src: string; caption: string }[] = content.images || [];
  const fileRef = useRef<HTMLInputElement>(null);
  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newImages: { id: string; src: string; caption: string }[] = [];
    let loaded = 0;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        newImages.push({ id: crypto.randomUUID(), src: typeof reader.result === 'string' ? reader.result : '', caption: '' });
        loaded++;
        if (loaded === files.length) onChange({ ...content, images: [...images, ...newImages] });
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };
  return (
    <div className={styles.galleryWidget}>
      <div className={styles.galleryGrid}>
        {images.map(img => (
          <div key={img.id} className={styles.galleryCell}>
            <div className={styles.galleryCellImageWrap}>
              <img src={img.src} alt={img.caption} className={styles.galleryCellImage} />
              <button className={styles.galleryCellRemove} onClick={() => onChange({ ...content, images: images.filter(i => i.id !== img.id) })} title="Remove">×</button>
            </div>
            <input className={styles.galleryCellCaption} type="text" placeholder="Caption..." value={img.caption} onChange={e => onChange({ ...content, images: images.map(i => i.id === img.id ? { ...i, caption: e.target.value } : i) })} />
          </div>
        ))}
      </div>
      <button className={styles.galleryAddBtn} onClick={() => fileRef.current?.click()}>+ Add Images</button>
      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFiles} />
    </div>
  );
}

interface TimelineEvent {
  id: string;
  date: string;        // free-form text e.g. "Year 312", "Day 5", "After the Fall"
  label: string;       // event title
  description: string; // optional detail text
  entityId: string;    // optional linked entity ID (empty string = no link)
}

interface TimelineContent {
  events: TimelineEvent[];
  orientation: 'horizontal' | 'vertical';
}

function TimelineWidget({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const entities = useWorkspaceStore(s => s.entities);
  const activeProjectId = useWorkspaceStore(s => s.activeProjectId);

  const events: TimelineEvent[] = content.events || [];
  const orientation: 'horizontal' | 'vertical' = content.orientation || 'horizontal';

  const projectEntities = entities.filter(e => e.projectId === activeProjectId);

  const addEvent = () => {
    const newEvent: TimelineEvent = {
      id: crypto.randomUUID(),
      date: '',
      label: '',
      description: '',
      entityId: '',
    };
    onChange({ ...content, events: [...events, newEvent] });
  };

  const updateEvent = (id: string, field: keyof TimelineEvent, value: string) => {
    onChange({
      ...content,
      events: events.map(e => e.id === id ? { ...e, [field]: value } : e),
    });
  };

  const removeEvent = (id: string) => {
    onChange({ ...content, events: events.filter(e => e.id !== id) });
  };

  const toggleOrientation = () => {
    onChange({ ...content, orientation: orientation === 'horizontal' ? 'vertical' : 'horizontal' });
  };

  return (
    <div className={styles.timelineWidget}>
      {/* Controls row */}
      <div className={styles.timelineControls}>
        <button
          className={styles.timelineOrientBtn}
          onClick={toggleOrientation}
          title={orientation === 'horizontal' ? 'Switch to vertical' : 'Switch to horizontal'}
        >
          {orientation === 'horizontal' ? '⇅ Vertical' : '⇄ Horizontal'}
        </button>
        <button className={styles.timelineAddBtn} onClick={addEvent}>
          + Add Event
        </button>
      </div>

      {/* Timeline display */}
      {events.length === 0 ? (
        <div className={styles.timelineEmpty}>
          <span>No events yet — click + Add Event</span>
        </div>
      ) : orientation === 'horizontal' ? (
        /* ── HORIZONTAL MODE ── */
        <div className={styles.timelineHoriz}>
          {/* Spine line */}
          <div className={styles.timelineSpine} />
          <div className={styles.timelineHorizTrack}>
            {events.map((ev, i) => (
              <div key={ev.id} className={styles.timelineHorizEvent}>
                {/* Dot on spine */}
                <div className={styles.timelineDot} />
                {/* Card — alternate above/below */}
                <div className={`${styles.timelineHorizCard} ${i % 2 === 0 ? styles.timelineCardAbove : styles.timelineCardBelow}`}>
                  <input
                    className={styles.timelineDateInput}
                    value={ev.date}
                    placeholder="Date / Era"
                    onChange={e => updateEvent(ev.id, 'date', e.target.value)}
                  />
                  <input
                    className={styles.timelineLabelInput}
                    value={ev.label}
                    placeholder="Event title"
                    onChange={e => updateEvent(ev.id, 'label', e.target.value)}
                  />
                  <textarea
                    className={styles.timelineDescInput}
                    value={ev.description}
                    placeholder="Description (optional)"
                    onChange={e => updateEvent(ev.id, 'description', e.target.value)}
                    rows={2}
                  />
                  <select
                    className={styles.timelineEntitySelect}
                    value={ev.entityId}
                    onChange={e => updateEvent(ev.id, 'entityId', e.target.value)}
                  >
                    <option value="">No linked entity</option>
                    {projectEntities.map(entity => (
                      <option key={entity.id} value={entity.id}>{entity.name}</option>
                    ))}
                  </select>
                  <button
                    className={styles.timelineEventDelete}
                    onClick={() => removeEvent(ev.id)}
                    title="Remove event"
                  >×</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* ── VERTICAL MODE ── */
        <div className={styles.timelineVert}>
          {events.map((ev, i) => (
            <div key={ev.id} className={styles.timelineVertEvent}>
              {/* Left column: date + dot + spine */}
              <div className={styles.timelineVertLeft}>
                <span className={styles.timelineVertDate}>{ev.date || '—'}</span>
                <div className={styles.timelineVertDot} />
                {i < events.length - 1 && <div className={styles.timelineVertSpine} />}
              </div>
              {/* Right column: card */}
              <div className={styles.timelineVertCard}>
                <div className={styles.timelineVertCardHeader}>
                  <input
                    className={styles.timelineLabelInput}
                    value={ev.label}
                    placeholder="Event title"
                    onChange={e => updateEvent(ev.id, 'label', e.target.value)}
                  />
                  <button
                    className={styles.timelineEventDelete}
                    onClick={() => removeEvent(ev.id)}
                    title="Remove event"
                  >×</button>
                </div>
                <input
                  className={styles.timelineDateInput}
                  value={ev.date}
                  placeholder="Date / Era"
                  onChange={e => updateEvent(ev.id, 'date', e.target.value)}
                />
                <textarea
                  className={styles.timelineDescInput}
                  value={ev.description}
                  placeholder="Description (optional)"
                  onChange={e => updateEvent(ev.id, 'description', e.target.value)}
                  rows={2}
                />
                <select
                  className={styles.timelineEntitySelect}
                  value={ev.entityId}
                  onChange={e => updateEvent(ev.id, 'entityId', e.target.value)}
                >
                  <option value="">No linked entity</option>
                  {projectEntities.map(entity => (
                    <option key={entity.id} value={entity.id}>{entity.name}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface RelEdge {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  auto: boolean; // true = inferred, false = manual
}

interface RelNode {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

function RelationshipWidget({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const entities = useWorkspaceStore(s => s.entities);
  const scenes = useWorkspaceStore(s => s.scenes);
  const activeProjectId = useWorkspaceStore(s => s.activeProjectId);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<RelNode[]>([]);
  const frameRef = useRef<number>(0);
  const dragRef = useRef<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [showAddEdge, setShowAddEdge] = useState(false);
  const [newEdge, setNewEdge] = useState({ sourceId: '', targetId: '', label: '' });

  const autoDetect: boolean = content.autoDetect ?? true;
  const manualEdges: RelEdge[] = content.manualEdges || [];
  const includedEntityIds: string[] = content.includedEntityIds || [];

  // Compute the full entity set for this widget
  const projectEntities = entities.filter(e =>
    e.projectId === activeProjectId &&
    (includedEntityIds.length === 0 || includedEntityIds.includes(e.id))
  );

  // Compute auto edges from scene co-mentions
  const autoEdges = React.useMemo((): RelEdge[] => {
    if (!autoDetect) return [];
    const projectScenes = scenes.filter(s => s.projectId === activeProjectId);
    const edgeMap = new Map<string, RelEdge>();

    for (const scene of projectScenes) {
      if (!scene.content) continue;
      // Find which project entities appear in this scene's content
      const presentIds = projectEntities
        .filter(e => scene.content.includes(e.id) || scene.content.toLowerCase().includes(e.name.toLowerCase()))
        .map(e => e.id);

      // Every pair of co-present entities gets an edge
      for (let i = 0; i < presentIds.length; i++) {
        for (let j = i + 1; j < presentIds.length; j++) {
          const key = [presentIds[i], presentIds[j]].sort().join('|');
          if (!edgeMap.has(key)) {
            edgeMap.set(key, {
              id: key,
              sourceId: presentIds[i],
              targetId: presentIds[j],
              label: '',
              auto: true,
            });
          }
        }
      }
    }
    return Array.from(edgeMap.values());
  }, [autoDetect, scenes, projectEntities, activeProjectId]);

  // All edges combined
  const allEdges: RelEdge[] = React.useMemo(() => {
    const combined = [...autoEdges];
    for (const me of manualEdges) {
      // Manual edges override auto edges for the same pair
      const key = [me.sourceId, me.targetId].sort().join('|');
      const autoIdx = combined.findIndex(e => e.id === key);
      if (autoIdx !== -1) combined.splice(autoIdx, 1);
      combined.push({ ...me, auto: false });
    }
    return combined;
  }, [autoEdges, manualEdges]);

  // Initialize/update nodes when entity set changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width || canvas.offsetWidth;
    const H = canvas.height || canvas.offsetHeight;
    const cx = W / 2;
    const cy = H / 2;

    const existing = new Map(nodesRef.current.map(n => [n.id, n]));
    nodesRef.current = projectEntities.map((e, i) => {
      if (existing.has(e.id)) return existing.get(e.id)!;
      // Place new nodes in a circle around center
      const angle = (i / Math.max(projectEntities.length, 1)) * Math.PI * 2;
      const r = Math.min(W, H) * 0.3;
      return {
        id: e.id,
        label: e.name,
        type: e.type,
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        vx: 0,
        vy: 0,
      };
    });
  }, [projectEntities.map(e => e.id).join(',')]);

  // Force simulation + render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const NODE_COLORS: Record<string, string> = {
      character: '#4A6FA5',
      location: '#2E8B57',
      faction: '#6B4C9A',
      artifact: '#C0392B',
      lore: '#D46A1A',
      magic: '#9B59B6',
      religion: '#F1C40F',
      species: '#27AE60',
    };

    const tick = () => {
      const W = canvas.width;
      const H = canvas.height;
      const nodes = nodesRef.current;
      if (nodes.length === 0) {
        ctx.clearRect(0, 0, W, H);
        frameRef.current = requestAnimationFrame(tick);
        return;
      }

      // --- SPRING SIMULATION ---
      const REPULSION = 4000;
      const SPRING_LEN = 120;
      const SPRING_K = 0.05;
      const DAMPING = 0.85;
      const CENTER_PULL = 0.005;

      // Repulsion between all node pairs
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = REPULSION / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          nodes[i].vx -= fx;
          nodes[i].vy -= fy;
          nodes[j].vx += fx;
          nodes[j].vy += fy;
        }
      }

      // Spring attraction along edges
      const nodeMap = new Map(nodes.map(n => [n.id, n]));
      for (const edge of allEdges) {
        const a = nodeMap.get(edge.sourceId);
        const b = nodeMap.get(edge.targetId);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - SPRING_LEN) * SPRING_K;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }

      // Pull toward center + apply damping + integrate
      for (const node of nodes) {
        if (dragRef.current?.nodeId === node.id) continue;
        node.vx += (W / 2 - node.x) * CENTER_PULL;
        node.vy += (H / 2 - node.y) * CENTER_PULL;
        node.vx *= DAMPING;
        node.vy *= DAMPING;
        node.x += node.vx;
        node.y += node.vy;
        // Clamp to canvas bounds with padding
        node.x = Math.max(24, Math.min(W - 24, node.x));
        node.y = Math.max(24, Math.min(H - 24, node.y));
      }

      // --- RENDER ---
      ctx.clearRect(0, 0, W, H);

      // Draw edges
      for (const edge of allEdges) {
        const a = nodeMap.get(edge.sourceId);
        const b = nodeMap.get(edge.targetId);
        if (!a || !b) continue;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = edge.auto
          ? 'rgba(255,255,255,0.12)'
          : 'rgba(208,188,255,0.45)';
        ctx.lineWidth = edge.auto ? 1 : 1.5;
        ctx.stroke();

        // Edge label for manual edges
        if (edge.label) {
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          ctx.font = '10px system-ui';
          ctx.fillStyle = 'rgba(208,188,255,0.7)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(edge.label, mx, my - 6);
        }
      }

      // Draw nodes
      const NODE_RADIUS = 18;
      for (const node of nodes) {
        const isHovered = node.id === hoveredNodeId;
        const color = NODE_COLORS[node.type] || '#888';

        ctx.beginPath();
        ctx.arc(node.x, node.y, isHovered ? NODE_RADIUS + 3 : NODE_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        if (isHovered) {
          ctx.strokeStyle = 'rgba(208,188,255,0.9)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Node label
        ctx.font = `${isHovered ? 'bold ' : ''}11px system-ui`;
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Truncate long names
        const label = node.label.length > 12 ? node.label.slice(0, 11) + '…' : node.label;
        ctx.fillText(label, node.x, node.y);
      }

      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [allEdges, hoveredNodeId]);

  // Resize canvas to match DOM size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    });
    ro.observe(canvas);
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    return () => ro.disconnect();
  }, []);

  // Mouse interaction
  const getNodeAtPoint = (x: number, y: number): RelNode | null => {
    for (const node of nodesRef.current) {
      const dx = x - node.x;
      const dy = y - node.y;
      if (dx * dx + dy * dy <= 20 * 20) return node;
    }
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const node = getNodeAtPoint(x, y);
    if (node) {
      dragRef.current = { nodeId: node.id, offsetX: x - node.x, offsetY: y - node.y };
      e.stopPropagation(); // prevent canvas widget drag
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (dragRef.current) {
      const node = nodesRef.current.find(n => n.id === dragRef.current!.nodeId);
      if (node) {
        node.x = x - dragRef.current.offsetX;
        node.y = y - dragRef.current.offsetY;
        node.vx = 0;
        node.vy = 0;
      }
      return;
    }

    const hovered = getNodeAtPoint(x, y);
    setHoveredNodeId(hovered?.id ?? null);
  };

  const handleMouseUp = () => {
    dragRef.current = null;
  };

  const addManualEdge = () => {
    if (!newEdge.sourceId || !newEdge.targetId || newEdge.sourceId === newEdge.targetId) return;
    const edge: RelEdge = {
      id: crypto.randomUUID(),
      sourceId: newEdge.sourceId,
      targetId: newEdge.targetId,
      label: newEdge.label,
      auto: false,
    };
    onChange({ ...content, manualEdges: [...manualEdges, edge] });
    setNewEdge({ sourceId: '', targetId: '', label: '' });
    setShowAddEdge(false);
  };

  const removeManualEdge = (id: string) => {
    onChange({ ...content, manualEdges: manualEdges.filter(e => e.id !== id) });
  };

  return (
    <div className={styles.relationshipWidget}>
      {/* Toolbar */}
      <div className={styles.relationshipToolbar}>
        <label className={styles.relationshipToggle}>
          <input
            type="checkbox"
            checked={autoDetect}
            onChange={e => onChange({ ...content, autoDetect: e.target.checked })}
          />
          <span>Auto-detect</span>
        </label>
        <span className={styles.relationshipStats}>
          {projectEntities.length} entities · {allEdges.length} connections
        </span>
        <button
          className={styles.relationshipAddBtn}
          onClick={() => setShowAddEdge(v => !v)}
        >
          + Link
        </button>
      </div>

      {/* Add edge form */}
      {showAddEdge && (
        <div className={styles.relationshipAddForm}>
          <select
            className={styles.relationshipSelect}
            value={newEdge.sourceId}
            onChange={e => setNewEdge(v => ({ ...v, sourceId: e.target.value }))}
          >
            <option value="">From entity…</option>
            {projectEntities.map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
          <select
            className={styles.relationshipSelect}
            value={newEdge.targetId}
            onChange={e => setNewEdge(v => ({ ...v, targetId: e.target.value }))}
          >
            <option value="">To entity…</option>
            {projectEntities.map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
          <input
            className={styles.relationshipLabelInput}
            placeholder="Relationship label (e.g. ally, enemy, parent)"
            value={newEdge.label}
            onChange={e => setNewEdge(v => ({ ...v, label: e.target.value }))}
          />
          <div className={styles.relationshipAddFormBtns}>
            <button className={styles.relationshipConfirmBtn} onClick={addManualEdge}>Add</button>
            <button className={styles.relationshipCancelBtn} onClick={() => setShowAddEdge(false)}>Cancel</button>
          </div>
          {/* Manual edge list */}
          {manualEdges.length > 0 && (
            <div className={styles.manualEdgeList}>
              {manualEdges.map(me => {
                const src = projectEntities.find(e => e.id === me.sourceId)?.name ?? me.sourceId;
                const tgt = projectEntities.find(e => e.id === me.targetId)?.name ?? me.targetId;
                return (
                  <div key={me.id} className={styles.manualEdgeItem}>
                    <span>{src} → {me.label ? `${me.label} → ` : ''}{tgt}</span>
                    <button className={styles.manualEdgeDelete} onClick={() => removeManualEdge(me.id)}>×</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Graph canvas */}
      {projectEntities.length === 0 ? (
        <div className={styles.relationshipEmpty}>
          <span>No entities in this project yet.</span>
          <span>Add entities to the World Bible to see them here.</span>
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          className={styles.relationshipCanvas}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      )}
    </div>
  );
}

interface FamilyMember {
  id: string;
  name: string;          // display name
  entityId: string;      // linked entity ID — empty string = manual name only
  gender: 'male' | 'female' | 'other' | '';
  notes: string;         // optional short note (e.g. "deceased", "adopted")
}

interface FamilyEdge {
  id: string;
  parentId: string;
  childId: string;
  relation: 'biological' | 'adopted' | 'step';
}

function FamilyTreeWidget({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const entities = useWorkspaceStore(s => s.entities);
  const activeProjectId = useWorkspaceStore(s => s.activeProjectId);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddEdge, setShowAddEdge] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', entityId: '', gender: '' as FamilyMember['gender'], notes: '' });
  const [newEdge, setNewEdge] = useState({ parentId: '', childId: '', relation: 'biological' as FamilyEdge['relation'] });

  const members: FamilyMember[] = content.members || [];
  const edges: FamilyEdge[] = content.edges || [];
  const projectEntities = entities.filter(e => e.projectId === activeProjectId);

  // ── Layout computation ──
  const layout = React.useMemo(() => {
    if (members.length === 0) return new Map<string, { x: number; y: number }>();

    // Build child→parents map
    const childToParents = new Map<string, string[]>();
    const parentToChildren = new Map<string, string[]>();
    members.forEach(m => {
      childToParents.set(m.id, []);
      parentToChildren.set(m.id, []);
    });
    edges.forEach(e => {
      childToParents.get(e.childId)?.push(e.parentId);
      parentToChildren.get(e.parentId)?.push(e.childId);
    });

    // Assign generations via BFS from roots
    const roots = members.filter(m => (childToParents.get(m.id) ?? []).length === 0);
    const gen = new Map<string, number>();
    const queue = roots.map(r => ({ id: r.id, g: 0 }));
    while (queue.length > 0) {
      const { id, g } = queue.shift()!;
      if (gen.has(id) && gen.get(id)! >= g) continue;
      gen.set(id, g);
      for (const childId of parentToChildren.get(id) ?? []) {
        queue.push({ id: childId, g: g + 1 });
      }
    }
    // Assign generation 0 to any unreachable members
    members.forEach(m => { if (!gen.has(m.id)) gen.set(m.id, 0); });

    // Group by generation
    const byGen = new Map<number, string[]>();
    gen.forEach((g, id) => {
      if (!byGen.has(g)) byGen.set(g, []);
      byGen.get(g)!.push(id);
    });

    const maxGen = Math.max(...Array.from(byGen.keys()), 0);
    const VERT_GAP = 100;
    const NODE_W = 120;
    const positions = new Map<string, { x: number; y: number }>();

    byGen.forEach((ids, g) => {
      const totalW = ids.length * NODE_W + (ids.length - 1) * 40;
      const startX = Math.max(10, 340 - totalW / 2); // center around 340px
      ids.forEach((id, i) => {
        positions.set(id, {
          x: startX + i * (NODE_W + 40) + NODE_W / 2,
          y: 40 + g * VERT_GAP,
        });
      });
    });

    return positions;
  }, [members, edges]);

  // ── Canvas render ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const GENDER_COLORS = {
      male: '#4A6FA5',
      female: '#9B59B6',
      other: '#2E8B57',
      '': '#555',
    };
    const NODE_W = 120;
    const NODE_H = 44;

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      if (members.length === 0) {
        ctx.font = '13px system-ui';
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Add members to build the family tree', W / 2, H / 2);
        return;
      }

      // Draw edges
      for (const edge of edges) {
        const p = layout.get(edge.parentId);
        const c = layout.get(edge.childId);
        if (!p || !c) continue;

        ctx.beginPath();
        const midY = (p.y + NODE_H / 2 + c.y - NODE_H / 2) / 2;
        ctx.moveTo(p.x, p.y + NODE_H / 2);
        ctx.lineTo(p.x, midY);
        ctx.lineTo(c.x, midY);
        ctx.lineTo(c.x, c.y - NODE_H / 2);
        ctx.strokeStyle = edge.relation === 'biological'
          ? 'rgba(255,255,255,0.2)'
          : 'rgba(208,188,255,0.35)';
        ctx.lineWidth = edge.relation === 'biological' ? 1.5 : 1;
        ctx.setLineDash(edge.relation === 'adopted' ? [4, 3] : []);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw nodes
      for (const member of members) {
        const pos = layout.get(member.id);
        if (!pos) continue;
        const x = pos.x - NODE_W / 2;
        const y = pos.y - NODE_H / 2;
        const isSelected = member.id === selectedId;
        const color = GENDER_COLORS[member.gender || ''];

        // Card background
        ctx.beginPath();
        ctx.roundRect(x, y, NODE_W, NODE_H, 6);
        ctx.fillStyle = color + '33'; // 20% opacity fill
        ctx.fill();
        ctx.strokeStyle = isSelected ? 'rgba(208,188,255,0.9)' : color + '88';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.stroke();

        // Name
        ctx.font = 'bold 11px system-ui';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const displayName = member.name.length > 14 ? member.name.slice(0, 13) + '…' : member.name;
        ctx.fillText(displayName, pos.x, pos.y - (member.notes ? 6 : 0));

        // Notes
        if (member.notes) {
          ctx.font = '10px system-ui';
          ctx.fillStyle = 'rgba(255,255,255,0.45)';
          ctx.fillText(member.notes, pos.x, pos.y + 8);
        }
      }

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [members, edges, layout, selectedId]);

  // Canvas click → select node
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const NODE_W = 120;
    const NODE_H = 44;

    for (const member of members) {
      const pos = layout.get(member.id);
      if (!pos) continue;
      if (
        x >= pos.x - NODE_W / 2 && x <= pos.x + NODE_W / 2 &&
        y >= pos.y - NODE_H / 2 && y <= pos.y + NODE_H / 2
      ) {
        setSelectedId(prev => prev === member.id ? null : member.id);
        return;
      }
    }
    setSelectedId(null);
  };

  // Resize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    });
    ro.observe(canvas);
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    return () => ro.disconnect();
  }, []);

  const addMember = () => {
    const name = newMember.entityId
      ? (entities.find(e => e.id === newMember.entityId)?.name ?? newMember.name)
      : newMember.name;
    if (!name.trim()) return;
    const member: FamilyMember = {
      id: crypto.randomUUID(),
      name,
      entityId: newMember.entityId,
      gender: newMember.gender,
      notes: newMember.notes,
    };
    onChange({ ...content, members: [...members, member] });
    setNewMember({ name: '', entityId: '', gender: '', notes: '' });
    setShowAddMember(false);
  };

  const removeMember = (id: string) => {
    onChange({
      ...content,
      members: members.filter(m => m.id !== id),
      edges: edges.filter(e => e.parentId !== id && e.childId !== id),
    });
    if (selectedId === id) setSelectedId(null);
  };

  const addEdge = () => {
    if (!newEdge.parentId || !newEdge.childId || newEdge.parentId === newEdge.childId) return;
    // Prevent duplicate
    const exists = edges.some(e => e.parentId === newEdge.parentId && e.childId === newEdge.childId);
    if (exists) return;
    const edge: FamilyEdge = {
      id: crypto.randomUUID(),
      parentId: newEdge.parentId,
      childId: newEdge.childId,
      relation: newEdge.relation,
    };
    onChange({ ...content, edges: [...edges, edge] });
    setNewEdge({ parentId: '', childId: '', relation: 'biological' });
    setShowAddEdge(false);
  };

  const selectedMember = members.find(m => m.id === selectedId);

  return (
    <div className={styles.familyTreeWidget}>
      {/* Toolbar */}
      <div className={styles.familyTreeToolbar}>
        <button className={styles.familyTreeBtn} onClick={() => { setShowAddMember(v => !v); setShowAddEdge(false); }}>
          + Person
        </button>
        <button
          className={styles.familyTreeBtn}
          onClick={() => { setShowAddEdge(v => !v); setShowAddMember(false); }}
          disabled={members.length < 2}
        >
          + Relationship
        </button>
        {selectedMember && (
          <button className={styles.familyTreeDeleteBtn} onClick={() => removeMember(selectedMember.id)}>
            Remove "{selectedMember.name}"
          </button>
        )}
        <span className={styles.familyTreeStats}>
          {members.length} member{members.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Add member form */}
      {showAddMember && (
        <div className={styles.familyTreeForm}>
          <select
            className={styles.familyTreeSelect}
            value={newMember.entityId}
            onChange={e => setNewMember(v => ({
              ...v,
              entityId: e.target.value,
              name: e.target.value
                ? (entities.find(en => en.id === e.target.value)?.name ?? '')
                : v.name,
            }))}
          >
            <option value="">Link to entity (optional)</option>
            {projectEntities
              .filter(e => !members.some(m => m.entityId === e.id))
              .map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <input
            className={styles.familyTreeInput}
            placeholder="Name (required if no entity)"
            value={newMember.name}
            onChange={e => setNewMember(v => ({ ...v, name: e.target.value }))}
          />
          <select
            className={styles.familyTreeSelect}
            value={newMember.gender}
            onChange={e => setNewMember(v => ({ ...v, gender: e.target.value as FamilyMember['gender'] }))}
          >
            <option value="">Gender (optional)</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
          <input
            className={styles.familyTreeInput}
            placeholder="Note e.g. 'deceased', 'adopted' (optional)"
            value={newMember.notes}
            onChange={e => setNewMember(v => ({ ...v, notes: e.target.value }))}
          />
          <div className={styles.familyTreeFormBtns}>
            <button className={styles.familyTreeConfirmBtn} onClick={addMember}>Add</button>
            <button className={styles.familyTreeCancelBtn} onClick={() => setShowAddMember(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Add relationship form */}
      {showAddEdge && (
        <div className={styles.familyTreeForm}>
          <select
            className={styles.familyTreeSelect}
            value={newEdge.parentId}
            onChange={e => setNewEdge(v => ({ ...v, parentId: e.target.value }))}
          >
            <option value="">Parent…</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select
            className={styles.familyTreeSelect}
            value={newEdge.childId}
            onChange={e => setNewEdge(v => ({ ...v, childId: e.target.value }))}
          >
            <option value="">Child…</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select
            className={styles.familyTreeSelect}
            value={newEdge.relation}
            onChange={e => setNewEdge(v => ({ ...v, relation: e.target.value as FamilyEdge['relation'] }))}
          >
            <option value="biological">Biological</option>
            <option value="adopted">Adopted (dashed)</option>
            <option value="step">Step</option>
          </select>
          <div className={styles.familyTreeFormBtns}>
            <button className={styles.familyTreeConfirmBtn} onClick={addEdge}>Add</button>
            <button className={styles.familyTreeCancelBtn} onClick={() => setShowAddEdge(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className={styles.familyTreeCanvas}
        onClick={handleCanvasClick}
      />
    </div>
  );
}

interface ArcBeat {
  id: string;
  label: string;        // scene/chapter label e.g. "Ch 1", "The Betrayal"
  value: number;        // emotional: -5 to 5 | goal: 0 to (stages.length - 1)
  notes: string;        // optional tooltip/note
}

function CharacterArcWidget({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const entities = useWorkspaceStore(s => s.entities);
  const activeProjectId = useWorkspaceStore(s => s.activeProjectId);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showAddBeat, setShowAddBeat] = useState(false);
  const [editingBeatId, setEditingBeatId] = useState<string | null>(null);
  const [newBeat, setNewBeat] = useState({ label: '', value: 0, notes: '' });
  const [hoveredBeatIdx, setHoveredBeatIdx] = useState<number | null>(null);

  const mode: 'emotional' | 'goal' = content.mode || 'emotional';
  const entityId: string = content.entityId || '';
  const beats: ArcBeat[] = content.beats || [];
  const goalStages: string[] = content.goalStages || ['Unaware', 'Aware', 'Pursuing', 'Achieved'];

  const projectCharacters = entities.filter(e =>
    e.projectId === activeProjectId && e.type === 'character'
  );

  const linkedEntity = entities.find(e => e.id === entityId);

  // Value range based on mode
  const minVal = mode === 'emotional' ? -5 : 0;
  const maxVal = mode === 'emotional' ? 5 : goalStages.length - 1;

  // ── Canvas render ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrame: number;

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      const PAD = { top: 24, right: 20, bottom: 40, left: 48 };
      const chartW = W - PAD.left - PAD.right;
      const chartH = H - PAD.top - PAD.bottom;

      ctx.clearRect(0, 0, W, H);

      // ── Background grid ──
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;

      // Horizontal grid lines
      const range = maxVal - minVal;
      const steps = mode === 'emotional' ? 10 : goalStages.length - 1;
      for (let i = 0; i <= steps; i++) {
        const y = PAD.top + chartH - (i / steps) * chartH;
        ctx.beginPath();
        ctx.moveTo(PAD.left, y);
        ctx.lineTo(PAD.left + chartW, y);
        ctx.stroke();
      }

      // ── Y-axis labels ──
      ctx.font = '10px system-ui';
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      if (mode === 'emotional') {
        // Labels: -5, 0, +5 and midpoints
        for (let v = minVal; v <= maxVal; v++) {
          const y = PAD.top + chartH - ((v - minVal) / range) * chartH;
          if (v === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.fillText('0', PAD.left - 6, y);
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
          } else if (v % 5 === 0 || v === minVal || v === maxVal) {
            ctx.fillText(v > 0 ? `+${v}` : `${v}`, PAD.left - 6, y);
          }
        }
        // Zero line highlight
        const zeroY = PAD.top + chartH - ((0 - minVal) / range) * chartH;
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(PAD.left, zeroY);
        ctx.lineTo(PAD.left + chartW, zeroY);
        ctx.stroke();
      } else {
        // Goal mode — label each stage
        goalStages.forEach((stage, i) => {
          const y = PAD.top + chartH - (i / (goalStages.length - 1)) * chartH;
          ctx.fillText(stage.length > 8 ? stage.slice(0, 7) + '…' : stage, PAD.left - 6, y);
        });
      }

      // ── X-axis line ──
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD.left, PAD.top + chartH);
      ctx.lineTo(PAD.left + chartW, PAD.top + chartH);
      ctx.stroke();

      if (beats.length === 0) {
        ctx.font = '12px system-ui';
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Add beats to plot the arc', W / 2, H / 2);
        animFrame = requestAnimationFrame(draw);
        return;
      }

      // ── Beat positions ──
      const beatX = (i: number) => PAD.left + (beats.length === 1 ? chartW / 2 : (i / (beats.length - 1)) * chartW);
      const beatY = (v: number) => PAD.top + chartH - ((v - minVal) / range) * chartH;

      // ── Line + fill ──
      if (beats.length > 1) {
        // Gradient fill under the line
        const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + chartH);
        grad.addColorStop(0, 'rgba(208,188,255,0.18)');
        grad.addColorStop(1, 'rgba(208,188,255,0)');

        ctx.beginPath();
        ctx.moveTo(beatX(0), beatY(beats[0].value));
        // Smooth curve using cardinal spline
        for (let i = 1; i < beats.length; i++) {
          const x0 = beatX(i - 1), y0 = beatY(beats[i - 1].value);
          const x1 = beatX(i), y1 = beatY(beats[i].value);
          const cpX = (x0 + x1) / 2;
          ctx.bezierCurveTo(cpX, y0, cpX, y1, x1, y1);
        }
        // Fill down to baseline
        ctx.lineTo(beatX(beats.length - 1), PAD.top + chartH);
        ctx.lineTo(beatX(0), PAD.top + chartH);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // Stroke line
        ctx.beginPath();
        ctx.moveTo(beatX(0), beatY(beats[0].value));
        for (let i = 1; i < beats.length; i++) {
          const x0 = beatX(i - 1), y0 = beatY(beats[i - 1].value);
          const x1 = beatX(i), y1 = beatY(beats[i].value);
          const cpX = (x0 + x1) / 2;
          ctx.bezierCurveTo(cpX, y0, cpX, y1, x1, y1);
        }
        ctx.strokeStyle = 'rgba(208,188,255,0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // ── Beat dots + labels ──
      beats.forEach((beat, i) => {
        const x = beatX(i);
        const y = beatY(beat.value);
        const isHovered = i === hoveredBeatIdx;

        ctx.beginPath();
        ctx.arc(x, y, isHovered ? 7 : 5, 0, Math.PI * 2);
        ctx.fillStyle = isHovered ? '#d0bcff' : 'rgba(208,188,255,0.9)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(14,14,14,0.6)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // X-axis label
        ctx.font = isHovered ? 'bold 10px system-ui' : '10px system-ui';
        ctx.fillStyle = isHovered ? 'rgba(208,188,255,1)' : 'rgba(255,255,255,0.45)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const shortLabel = beat.label.length > 8 ? beat.label.slice(0, 7) + '…' : beat.label;
        ctx.fillText(shortLabel, x, PAD.top + chartH + 6);

        // Hover tooltip
        if (isHovered && beat.notes) {
          const tipW = Math.min(160, beat.notes.length * 6 + 20);
          const tipX = Math.min(x - tipW / 2, W - tipW - 4);
          const tipY = y - 36;
          ctx.fillStyle = 'rgba(30,28,30,0.92)';
          ctx.beginPath();
          ctx.roundRect(tipX, tipY, tipW, 24, 4);
          ctx.fill();
          ctx.font = '10px system-ui';
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(
            beat.notes.length > 22 ? beat.notes.slice(0, 21) + '…' : beat.notes,
            tipX + 8, tipY + 12
          );
        }
      });

      animFrame = requestAnimationFrame(draw);
    };

    animFrame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrame);
  }, [beats, mode, goalStages, hoveredBeatIdx, minVal, maxVal]);

  // Canvas mouse → hover nearest beat
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || beats.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const PAD_LEFT = 48;
    const chartW = canvas.width - PAD_LEFT - 20;

    let closest: number | null = null;
    let closestDist = Infinity;
    beats.forEach((_, i) => {
      const x = PAD_LEFT + (beats.length === 1 ? chartW / 2 : (i / (beats.length - 1)) * chartW);
      const dist = Math.abs(mx - x);
      if (dist < closestDist && dist < 24) { closestDist = dist; closest = i; }
    });
    setHoveredBeatIdx(closest);
  };

  // Resize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    });
    ro.observe(canvas);
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    return () => ro.disconnect();
  }, []);

  const addBeat = () => {
    if (!newBeat.label.trim()) return;
    const beat: ArcBeat = {
      id: crypto.randomUUID(),
      label: newBeat.label,
      value: newBeat.value,
      notes: newBeat.notes,
    };
    onChange({ ...content, beats: [...beats, beat] });
    setNewBeat({ label: '', value: mode === 'emotional' ? 0 : 0, notes: '' });
    setShowAddBeat(false);
  };

  const removeBeat = (id: string) => {
    onChange({ ...content, beats: beats.filter(b => b.id !== id) });
  };

  const updateGoalStages = (raw: string) => {
    const stages = raw.split(',').map(s => s.trim()).filter(Boolean);
    if (stages.length >= 2) onChange({ ...content, goalStages: stages });
  };

  return (
    <div className={styles.arcWidget}>
      {/* Toolbar */}
      <div className={styles.arcToolbar}>
        {/* Character selector */}
        <select
          className={styles.arcSelect}
          value={entityId}
          onChange={e => onChange({ ...content, entityId: e.target.value })}
        >
          <option value="">No character linked</option>
          {projectCharacters.map(e => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>

        {/* Mode toggle */}
        <div className={styles.arcModeToggle}>
          <button
            className={`${styles.arcModeBtn} ${mode === 'emotional' ? styles.arcModeBtnActive : ''}`}
            onClick={() => onChange({ ...content, mode: 'emotional' })}
          >
            😮 Emotional
          </button>
          <button
            className={`${styles.arcModeBtn} ${mode === 'goal' ? styles.arcModeBtnActive : ''}`}
            onClick={() => onChange({ ...content, mode: 'goal' })}
          >
            🎯 Goal
          </button>
        </div>

        <button className={styles.arcAddBtn} onClick={() => setShowAddBeat(v => !v)}>
          + Beat
        </button>
      </div>

      {/* Goal stages editor */}
      {mode === 'goal' && (
        <div className={styles.arcStagesRow}>
          <span className={styles.arcStagesLabel}>Stages:</span>
          <input
            className={styles.arcStagesInput}
            defaultValue={goalStages.join(', ')}
            placeholder="Unaware, Aware, Pursuing, Achieved"
            onBlur={e => updateGoalStages(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') updateGoalStages(e.currentTarget.value); }}
          />
        </div>
      )}

      {/* Add beat form */}
      {showAddBeat && (
        <div className={styles.arcBeatForm}>
          <input
            className={styles.arcInput}
            placeholder="Beat label (e.g. Ch 1, The Betrayal)"
            value={newBeat.label}
            onChange={e => setNewBeat(v => ({ ...v, label: e.target.value }))}
          />
          {mode === 'emotional' ? (
            <div className={styles.arcSliderRow}>
              <span className={styles.arcSliderLabel}>
                {newBeat.value > 0 ? '+' : ''}{newBeat.value}
              </span>
              <input
                type="range"
                min={-5} max={5} step={1}
                className={styles.arcSlider}
                value={newBeat.value}
                onChange={e => setNewBeat(v => ({ ...v, value: parseInt(e.target.value) }))}
              />
              <span className={styles.arcSliderTick}>
                {newBeat.value <= -3 ? '😢' : newBeat.value <= -1 ? '😟' : newBeat.value === 0 ? '😐' : newBeat.value <= 2 ? '🙂' : '😄'}
              </span>
            </div>
          ) : (
            <select
              className={styles.arcSelect}
              value={newBeat.value}
              onChange={e => setNewBeat(v => ({ ...v, value: parseInt(e.target.value) }))}
            >
              {goalStages.map((stage, i) => (
                <option key={i} value={i}>{stage}</option>
              ))}
            </select>
          )}
          <input
            className={styles.arcInput}
            placeholder="Notes (optional, shown on hover)"
            value={newBeat.notes}
            onChange={e => setNewBeat(v => ({ ...v, notes: e.target.value }))}
          />
          <div className={styles.arcBeatFormBtns}>
            <button className={styles.arcConfirmBtn} onClick={addBeat}>Add Beat</button>
            <button className={styles.arcCancelBtn} onClick={() => setShowAddBeat(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Beat list (compact, below canvas) */}
      {beats.length > 0 && (
        <div className={styles.arcBeatList}>
          {beats.map((beat, i) => (
            <span
              key={beat.id}
              className={`${styles.arcBeatChip} ${i === hoveredBeatIdx ? styles.arcBeatChipHovered : ''}`}
            >
              {beat.label}
              {mode === 'emotional'
                ? ` (${beat.value > 0 ? '+' : ''}${beat.value})`
                : ` (${goalStages[beat.value] ?? beat.value})`}
              <button
                className={styles.arcBeatChipDelete}
                onClick={() => removeBeat(beat.id)}
              >×</button>
            </span>
          ))}
        </div>
      )}

      {/* Chart canvas */}
      <canvas
        ref={canvasRef}
        className={styles.arcCanvas}
        onMouseMove={handleCanvasMouseMove}
        onMouseLeave={() => setHoveredBeatIdx(null)}
      />
    </div>
  );
}

interface OrgNode {
  id: string;
  label: string;       // person/group name
  role: string;        // title/role e.g. "King", "Captain", "Elder"
  entityId: string;    // optional linked entity (empty = manual)
  color: string;       // node accent color (user pick or auto)
}

interface OrgEdge {
  id: string;
  parentId: string;
  childId: string;
}

function OrgChartWidget({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const entities = useWorkspaceStore(s => s.entities);
  const activeProjectId = useWorkspaceStore(s => s.activeProjectId);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAddNode, setShowAddNode] = useState(false);
  const [showAddEdge, setShowAddEdge] = useState(false);
  const [newNode, setNewNode] = useState({ label: '', role: '', entityId: '', color: '#4A6FA5' });
  const [newEdge, setNewEdge] = useState({ parentId: '', childId: '' });

  const nodes: OrgNode[] = content.nodes || [];
  const edges: OrgEdge[] = content.edges || [];
  const projectEntities = entities.filter(e => e.projectId === activeProjectId);

  // Layout: BFS from roots, assign generation + horizontal position
  const layout = React.useMemo(() => {
    if (nodes.length === 0) return new Map<string, { x: number; y: number }>();

    const childToParents = new Map<string, string[]>();
    const parentToChildren = new Map<string, string[]>();
    nodes.forEach(n => { childToParents.set(n.id, []); parentToChildren.set(n.id, []); });
    edges.forEach(e => {
      childToParents.get(e.childId)?.push(e.parentId);
      parentToChildren.get(e.parentId)?.push(e.childId);
    });

    const roots = nodes.filter(n => (childToParents.get(n.id) ?? []).length === 0);
    const gen = new Map<string, number>();
    const queue = roots.map(r => ({ id: r.id, g: 0 }));
    while (queue.length > 0) {
      const { id, g } = queue.shift()!;
      if (!gen.has(id) || gen.get(id)! < g) {
        gen.set(id, g);
        (parentToChildren.get(id) ?? []).forEach(cid => queue.push({ id: cid, g: g + 1 }));
      }
    }
    nodes.forEach(n => { if (!gen.has(n.id)) gen.set(n.id, 0); });

    const byGen = new Map<number, string[]>();
    gen.forEach((g, id) => {
      if (!byGen.has(g)) byGen.set(g, []);
      byGen.get(g)!.push(id);
    });

    const NODE_W = 130;
    const H_GAP = 20;
    const V_GAP = 90;
    const positions = new Map<string, { x: number; y: number }>();

    byGen.forEach((ids, g) => {
      const totalW = ids.length * NODE_W + (ids.length - 1) * H_GAP;
      const startX = Math.max(10, 340 - totalW / 2);
      ids.forEach((id, i) => {
        positions.set(id, {
          x: startX + i * (NODE_W + H_GAP) + NODE_W / 2,
          y: 36 + g * V_GAP,
        });
      });
    });

    return positions;
  }, [nodes, edges]);

  // Canvas render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const NODE_W = 130;
    const NODE_H = 48;

    let af: number;
    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      if (nodes.length === 0) {
        ctx.font = '12px system-ui';
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Add nodes to build the org chart', W / 2, H / 2);
        af = requestAnimationFrame(draw);
        return;
      }

      // Draw edges
      for (const edge of edges) {
        const p = layout.get(edge.parentId);
        const c = layout.get(edge.childId);
        if (!p || !c) continue;
        const midY = (p.y + NODE_H / 2 + c.y - NODE_H / 2) / 2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y + NODE_H / 2);
        ctx.lineTo(p.x, midY);
        ctx.lineTo(c.x, midY);
        ctx.lineTo(c.x, c.y - NODE_H / 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Draw nodes
      for (const node of nodes) {
        const pos = layout.get(node.id);
        if (!pos) continue;
        const x = pos.x - NODE_W / 2;
        const y = pos.y - NODE_H / 2;
        const isSelected = node.id === selectedId;
        const color = node.color || '#4A6FA5';

        ctx.beginPath();
        ctx.roundRect(x, y, NODE_W, NODE_H, 6);
        ctx.fillStyle = color + '33';
        ctx.fill();
        ctx.strokeStyle = isSelected ? 'rgba(208,188,255,0.9)' : color + 'aa';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.stroke();

        // Label (name)
        ctx.font = 'bold 11px system-ui';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const name = node.label.length > 16 ? node.label.slice(0, 15) + '…' : node.label;
        ctx.fillText(name, pos.x, pos.y - 8);

        // Role subtitle
        if (node.role) {
          ctx.font = '10px system-ui';
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          const role = node.role.length > 18 ? node.role.slice(0, 17) + '…' : node.role;
          ctx.fillText(role, pos.x, pos.y + 8);
        }
      }

      af = requestAnimationFrame(draw);
    };

    af = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(af);
  }, [nodes, edges, layout, selectedId]);

  // Resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; });
    ro.observe(canvas);
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    return () => ro.disconnect();
  }, []);

  // Click to select
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const NODE_W = 130;
    const NODE_H = 48;
    for (const node of nodes) {
      const pos = layout.get(node.id);
      if (!pos) continue;
      if (mx >= pos.x - NODE_W / 2 && mx <= pos.x + NODE_W / 2 &&
          my >= pos.y - NODE_H / 2 && my <= pos.y + NODE_H / 2) {
        setSelectedId(prev => prev === node.id ? null : node.id);
        return;
      }
    }
    setSelectedId(null);
  };

  const NODE_COLORS = ['#4A6FA5', '#6B4C9A', '#2E8B57', '#C0392B', '#D46A1A', '#1A7A8A', '#7A4A2E'];

  const addNode = () => {
    if (!newNode.label.trim()) return;
    const label = newNode.entityId
      ? (entities.find(e => e.id === newNode.entityId)?.name ?? newNode.label)
      : newNode.label;
    const node: OrgNode = {
      id: crypto.randomUUID(),
      label,
      role: newNode.role,
      entityId: newNode.entityId,
      color: newNode.color || NODE_COLORS[nodes.length % NODE_COLORS.length],
    };
    onChange({ ...content, nodes: [...nodes, node] });
    setNewNode({ label: '', role: '', entityId: '', color: NODE_COLORS[(nodes.length + 1) % NODE_COLORS.length] });
    setShowAddNode(false);
  };

  const removeNode = (id: string) => {
    onChange({
      ...content,
      nodes: nodes.filter(n => n.id !== id),
      edges: edges.filter(e => e.parentId !== id && e.childId !== id),
    });
    if (selectedId === id) setSelectedId(null);
  };

  const addEdge = () => {
    if (!newEdge.parentId || !newEdge.childId || newEdge.parentId === newEdge.childId) return;
    if (edges.some(e => e.parentId === newEdge.parentId && e.childId === newEdge.childId)) return;
    const edge: OrgEdge = { id: crypto.randomUUID(), parentId: newEdge.parentId, childId: newEdge.childId };
    onChange({ ...content, edges: [...edges, edge] });
    setNewEdge({ parentId: '', childId: '' });
    setShowAddEdge(false);
  };

  const selectedNode = nodes.find(n => n.id === selectedId);

  return (
    <div className={styles.orgChartWidget}>
      <div className={styles.orgChartToolbar}>
        <button className={styles.orgChartBtn} onClick={() => { setShowAddNode(v => !v); setShowAddEdge(false); }}>+ Node</button>
        <button className={styles.orgChartBtn} disabled={nodes.length < 2} onClick={() => { setShowAddEdge(v => !v); setShowAddNode(false); }}>+ Link</button>
        {selectedNode && (
          <button className={styles.orgChartDeleteBtn} onClick={() => removeNode(selectedNode.id)}>
            Remove "{selectedNode.label}"
          </button>
        )}
        <span className={styles.orgChartStats}>{nodes.length} nodes</span>
      </div>

      {showAddNode && (
        <div className={styles.orgChartForm}>
          <select className={styles.orgChartSelect} value={newNode.entityId}
            onChange={e => setNewNode(v => ({ ...v, entityId: e.target.value, label: e.target.value ? (entities.find(en => en.id === e.target.value)?.name ?? '') : v.label }))}>
            <option value="">Link entity (optional)</option>
            {projectEntities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <input className={styles.orgChartInput} placeholder="Name *" value={newNode.label} onChange={e => setNewNode(v => ({ ...v, label: e.target.value }))} />
          <input className={styles.orgChartInput} placeholder="Role / Title (e.g. Commander)" value={newNode.role} onChange={e => setNewNode(v => ({ ...v, role: e.target.value }))} />
          <div className={styles.orgChartColorRow}>
            <span className={styles.orgChartColorLabel}>Color:</span>
            {NODE_COLORS.map(c => (
              <button key={c} className={`${styles.orgChartColorSwatch} ${newNode.color === c ? styles.orgChartColorSwatchActive : ''}`}
                style={{ background: c }} onClick={() => setNewNode(v => ({ ...v, color: c }))} />
            ))}
          </div>
          <div className={styles.orgChartFormBtns}>
            <button className={styles.orgChartConfirmBtn} onClick={addNode}>Add</button>
            <button className={styles.orgChartCancelBtn} onClick={() => setShowAddNode(false)}>Cancel</button>
          </div>
        </div>
      )}

      {showAddEdge && (
        <div className={styles.orgChartForm}>
          <select className={styles.orgChartSelect} value={newEdge.parentId} onChange={e => setNewEdge(v => ({ ...v, parentId: e.target.value }))}>
            <option value="">Parent node…</option>
            {nodes.map(n => <option key={n.id} value={n.id}>{n.label}{n.role ? ` (${n.role})` : ''}</option>)}
          </select>
          <select className={styles.orgChartSelect} value={newEdge.childId} onChange={e => setNewEdge(v => ({ ...v, childId: e.target.value }))}>
            <option value="">Child node…</option>
            {nodes.map(n => <option key={n.id} value={n.id}>{n.label}{n.role ? ` (${n.role})` : ''}</option>)}
          </select>
          <div className={styles.orgChartFormBtns}>
            <button className={styles.orgChartConfirmBtn} onClick={addEdge}>Link</button>
            <button className={styles.orgChartCancelBtn} onClick={() => setShowAddEdge(false)}>Cancel</button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className={styles.orgChartCanvas} onClick={handleClick} />
    </div>
  );
}

interface PronunciationEntry {
  id: string;
  name: string;           // the word/name e.g. "Aerindel"
  phonetic: string;       // IPA or custom notation e.g. "ay-RIN-del"
  syllables: string;      // syllable breakdown e.g. "Ae·rin·del"
  notes: string;          // optional e.g. "stress the second syllable"
  entityId: string;       // optional linked entity
}

function PronunciationWidget({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const entities = useWorkspaceStore(s => s.entities);
  const activeProjectId = useWorkspaceStore(s => s.activeProjectId);

  const entries: PronunciationEntry[] = content.entries || [];
  const [showAdd, setShowAdd] = useState(false);
  const [newEntry, setNewEntry] = useState({ name: '', phonetic: '', syllables: '', notes: '', entityId: '' });
  const [editingId, setEditingId] = useState<string | null>(null);

  const projectEntities = entities.filter(e => e.projectId === activeProjectId);

  const addEntry = () => {
    if (!newEntry.name.trim()) return;
    const entry: PronunciationEntry = {
      id: crypto.randomUUID(),
      name: newEntry.name,
      phonetic: newEntry.phonetic,
      syllables: newEntry.syllables,
      notes: newEntry.notes,
      entityId: newEntry.entityId,
    };
    onChange({ ...content, entries: [...entries, entry] });
    setNewEntry({ name: '', phonetic: '', syllables: '', notes: '', entityId: '' });
    setShowAdd(false);
  };

  const removeEntry = (id: string) => {
    onChange({ ...content, entries: entries.filter(e => e.id !== id) });
  };

  const updateEntry = (id: string, field: keyof PronunciationEntry, value: string) => {
    onChange({
      ...content,
      entries: entries.map(e => e.id === id ? { ...e, [field]: value } : e),
    });
  };

  return (
    <div className={styles.pronWidget}>
      <div className={styles.pronToolbar}>
        <span className={styles.pronTitle}>Pronunciation Guide</span>
        <button className={styles.pronAddBtn} onClick={() => setShowAdd(v => !v)}>+ Add</button>
      </div>

      {showAdd && (
        <div className={styles.pronForm}>
          <select className={styles.pronSelect} value={newEntry.entityId}
            onChange={e => setNewEntry(v => ({
              ...v, entityId: e.target.value,
              name: e.target.value ? (entities.find(en => en.id === e.target.value)?.name ?? '') : v.name,
            }))}>
            <option value="">Link entity (optional)</option>
            {projectEntities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <input className={styles.pronInput} placeholder="Name *  (e.g. Aerindel)" value={newEntry.name} onChange={e => setNewEntry(v => ({ ...v, name: e.target.value }))} />
          <input className={styles.pronInput} placeholder="Phonetic  (e.g. ay-RIN-del)" value={newEntry.phonetic} onChange={e => setNewEntry(v => ({ ...v, phonetic: e.target.value }))} />
          <input className={styles.pronInput} placeholder="Syllables  (e.g. Ae·rin·del)" value={newEntry.syllables} onChange={e => setNewEntry(v => ({ ...v, syllables: e.target.value }))} />
          <input className={styles.pronInput} placeholder="Notes  (e.g. stress second syllable)" value={newEntry.notes} onChange={e => setNewEntry(v => ({ ...v, notes: e.target.value }))} />
          <div className={styles.pronFormBtns}>
            <button className={styles.pronConfirmBtn} onClick={addEntry}>Add</button>
            <button className={styles.pronCancelBtn} onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      )}

      {entries.length === 0 && !showAdd ? (
        <div className={styles.pronEmpty}>
          <span>🗣️</span>
          <span>Add entries to build your pronunciation guide</span>
        </div>
      ) : (
        <div className={styles.pronList}>
          {entries.map(entry => (
            <div key={entry.id} className={styles.pronEntry}>
              <div className={styles.pronEntryHeader}>
                {editingId === entry.id ? (
                  <input
                    className={styles.pronEntryNameInput}
                    value={entry.name}
                    onChange={e => updateEntry(entry.id, 'name', e.target.value)}
                    onBlur={() => setEditingId(null)}
                    autoFocus
                  />
                ) : (
                  <span className={styles.pronEntryName} onDoubleClick={() => setEditingId(entry.id)}>
                    {entry.name}
                  </span>
                )}
                <button className={styles.pronEntryDelete} onClick={() => removeEntry(entry.id)}>×</button>
              </div>
              {entry.phonetic && (
                <div className={styles.pronEntryPhonetic}>/{entry.phonetic}/</div>
              )}
              {entry.syllables && (
                <div className={styles.pronEntrySyllables}>{entry.syllables}</div>
              )}
              {entry.notes && (
                <div className={styles.pronEntryNotes}>{entry.notes}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Count syllables in an English word using a heuristic approach.
 * Accurate enough for poetry/song writing purposes.
 */
function countSyllablesInWord(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length === 0) return 0;
  if (word.length <= 3) return 1;

  // Remove trailing silent e
  word = word.replace(/e$/, '');
  // Count vowel groups
  const vowelGroups = word.match(/[aeiouy]+/g);
  let count = vowelGroups ? vowelGroups.length : 1;

  // Subtract for common patterns that reduce syllable count
  if (word.endsWith('le') && word.length > 2 && !/[aeiouy]/.test(word[word.length - 3])) count++;
  if (word.endsWith('ed') && !word.endsWith('ted') && !word.endsWith('ded')) count = Math.max(1, count - 1);

  return Math.max(1, count);
}

function analyzeText(text: string): { word: string; syllables: number }[] {
  if (!text.trim()) return [];
  return text.trim().split(/\s+/).map(raw => ({
    word: raw,
    syllables: countSyllablesInWord(raw),
  }));
}

/**
 * Get the ending sound of a word for rhyme detection.
 * Returns the last vowel + everything after it.
 */
function getEndSound(word: string): string {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  const match = word.match(/[aeiouy][^aeiouy]*$/);
  return match ? match[0] : word.slice(-2);
}

/**
 * Assign rhyme scheme labels (A, B, C...) to an array of line-ending words.
 */
function getRhymeScheme(lines: string[]): string[] {
  const soundMap = new Map<string, string>();
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let nextIdx = 0;

  return lines.map(line => {
    const words = line.trim().split(/\s+/);
    const lastWord = words[words.length - 1] || '';
    if (!lastWord) return '';
    const sound = getEndSound(lastWord);
    if (!soundMap.has(sound)) {
      soundMap.set(sound, letters[nextIdx % 26]);
      nextIdx++;
    }
    return soundMap.get(sound)!;
  });
}

function SyllableWidget({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const text: string = content.text || '';
  const showBreakdown: boolean = content.showBreakdown ?? true;

  const analysis = React.useMemo(() => analyzeText(text), [text]);
  const totalSyllables = analysis.reduce((sum, w) => sum + w.syllables, 0);
  const wordCount = analysis.length;

  return (
    <div className={styles.syllableWidget}>
      <div className={styles.syllableToolbar}>
        <span className={styles.syllableStats}>
          {totalSyllables} syllable{totalSyllables !== 1 ? 's' : ''} · {wordCount} word{wordCount !== 1 ? 's' : ''}
        </span>
        <label className={styles.syllableToggle}>
          <input
            type="checkbox"
            checked={showBreakdown}
            onChange={e => onChange({ ...content, showBreakdown: e.target.checked })}
          />
          <span>Breakdown</span>
        </label>
      </div>

      <textarea
        className={styles.syllableTextarea}
        placeholder="Type or paste text to count syllables..."
        value={text}
        onChange={e => onChange({ ...content, text: e.target.value })}
      />

      {showBreakdown && analysis.length > 0 && (
        <div className={styles.syllableBreakdown}>
          {analysis.map((item, i) => (
            <span key={i} className={styles.syllableWord}>
              <span className={styles.syllableWordText}>{item.word}</span>
              <span className={styles.syllableWordCount}>{item.syllables}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

interface LyricLine { id: string; text: string; }
interface LyricStanza { id: string; lines: LyricLine[]; }

function LyricWidget({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const stanzas: LyricStanza[] = content.stanzas || [{ id: crypto.randomUUID(), lines: [{ id: crypto.randomUUID(), text: '' }] }];
  const showSyllables: boolean = content.showSyllables ?? true;
  const showRhyme: boolean = content.showRhyme ?? true;

  const updateLine = (stanzaId: string, lineId: string, text: string) => {
    onChange({
      ...content,
      stanzas: stanzas.map(s => s.id === stanzaId
        ? { ...s, lines: s.lines.map(l => l.id === lineId ? { ...l, text } : l) }
        : s
      ),
    });
  };

  const addLine = (stanzaId: string) => {
    onChange({
      ...content,
      stanzas: stanzas.map(s => s.id === stanzaId
        ? { ...s, lines: [...s.lines, { id: crypto.randomUUID(), text: '' }] }
        : s
      ),
    });
  };

  const removeLine = (stanzaId: string, lineId: string) => {
    onChange({
      ...content,
      stanzas: stanzas.map(s => s.id === stanzaId
        ? { ...s, lines: s.lines.filter(l => l.id !== lineId) }
        : s
      ).filter(s => s.lines.length > 0),
    });
  };

  const addStanza = () => {
    onChange({
      ...content,
      stanzas: [...stanzas, { id: crypto.randomUUID(), lines: [{ id: crypto.randomUUID(), text: '' }] }],
    });
  };

  // Compute rhyme scheme across all lines flattened
  const allLines = stanzas.flatMap(s => s.lines.map(l => l.text));
  const rhymeScheme = showRhyme ? getRhymeScheme(allLines) : [];
  let lineIndex = 0;

  return (
    <div className={styles.lyricWidget}>
      <div className={styles.lyricToolbar}>
        <label className={styles.lyricToggle}>
          <input type="checkbox" checked={showSyllables} onChange={e => onChange({ ...content, showSyllables: e.target.checked })} />
          <span>Syllables</span>
        </label>
        <label className={styles.lyricToggle}>
          <input type="checkbox" checked={showRhyme} onChange={e => onChange({ ...content, showRhyme: e.target.checked })} />
          <span>Rhyme</span>
        </label>
        <button className={styles.lyricAddStanzaBtn} onClick={addStanza}>+ Stanza</button>
      </div>

      <div className={styles.lyricBody}>
        {stanzas.map((stanza, si) => (
          <div key={stanza.id} className={styles.lyricStanza}>
            {si > 0 && <div className={styles.lyricStanzaDivider} />}
            {stanza.lines.map(line => {
              const syllableCount = showSyllables
                ? analyzeText(line.text).reduce((s, w) => s + w.syllables, 0)
                : null;
              const rhyme = showRhyme ? rhymeScheme[lineIndex] : '';
              lineIndex++;

              return (
                <div key={line.id} className={styles.lyricLine}>
                  {showRhyme && (
                    <span className={styles.lyricRhymeLabel}>{rhyme}</span>
                  )}
                  <input
                    className={styles.lyricLineInput}
                    value={line.text}
                    placeholder="Write a line..."
                    onChange={e => updateLine(stanza.id, line.id, e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); addLine(stanza.id); }
                      if (e.key === 'Backspace' && line.text === '' && stanza.lines.length > 1) {
                        e.preventDefault(); removeLine(stanza.id, line.id);
                      }
                    }}
                  />
                  {showSyllables && (
                    <span className={styles.lyricSylCount}>{syllableCount ?? 0}</span>
                  )}
                </div>
              );
            })}
            <button className={styles.lyricAddLineBtn} onClick={() => addLine(stanza.id)}>+ line</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SceneCardWidget({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const CARD_COLORS = ['#4A6FA5', '#6B4C9A', '#2E8B57', '#C0392B', '#D46A1A', '#1A7A8A', '#555'];
  const color: string = content.color || '#4A6FA5';

  const field = (key: string, placeholder: string, multiline = false) => {
    if (multiline) {
      return (
        <textarea
          className={styles.sceneCardTextarea}
          placeholder={placeholder}
          value={content[key] || ''}
          onChange={e => onChange({ ...content, [key]: e.target.value })}
          rows={2}
        />
      );
    }
    return (
      <input
        className={styles.sceneCardInput}
        placeholder={placeholder}
        value={content[key] || ''}
        onChange={e => onChange({ ...content, [key]: e.target.value })}
      />
    );
  };

  return (
    <div className={styles.sceneCardWidget} style={{ borderTopColor: color }}>
      {/* Color strip + title */}
      <div className={styles.sceneCardHeader} style={{ background: color + '22' }}>
        <input
          className={styles.sceneCardTitle}
          placeholder="Scene title..."
          value={content.title || ''}
          onChange={e => onChange({ ...content, title: e.target.value })}
        />
        <div className={styles.sceneCardColorRow}>
          {CARD_COLORS.map(c => (
            <button
              key={c}
              className={`${styles.sceneCardColorDot} ${color === c ? styles.sceneCardColorDotActive : ''}`}
              style={{ background: c }}
              onClick={() => onChange({ ...content, color: c })}
            />
          ))}
        </div>
      </div>

      <div className={styles.sceneCardBody}>
        <div className={styles.sceneCardRow}>
          <div className={styles.sceneCardField}>
            <label className={styles.sceneCardLabel}>Chapter</label>
            {field('chapter', 'Ch. 1')}
          </div>
          <div className={styles.sceneCardField}>
            <label className={styles.sceneCardLabel}>POV</label>
            {field('pov', 'Character name')}
          </div>
        </div>

        <div className={styles.sceneCardField}>
          <label className={styles.sceneCardLabel}>Setting</label>
          {field('setting', 'Where & when')}
        </div>

        <div className={styles.sceneCardField}>
          <label className={styles.sceneCardLabel}>Goal</label>
          {field('goal', "What does the POV character want?", true)}
        </div>

        <div className={styles.sceneCardField}>
          <label className={styles.sceneCardLabel}>Conflict</label>
          {field('conflict', "What stands in the way?", true)}
        </div>

        <div className={styles.sceneCardField}>
          <label className={styles.sceneCardLabel}>Outcome</label>
          {field('outcome', "Yes/No/Yes-but/No-and...")}
        </div>

        <div className={styles.sceneCardField}>
          <label className={styles.sceneCardLabel}>Notes</label>
          {field('notes', 'Additional notes...', true)}
        </div>
      </div>
    </div>
  );
}
