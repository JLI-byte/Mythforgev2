/**
 * ArticleGridEditor — Freeform absolute-positioned canvas for World Bible articles.
 *
 * Sprint 57: Full rewrite from flex-wrap grid to freeform canvas.
 * Widgets have x, y, width, height. Drag title bar to move.
 * Resize from all 8 edges and corners. Dot grid background.
 * Content stored as JSON in entity.articleDoc.
 */
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import styles from './ArticleGridEditor.module.css';

// ============================================================
// DATA MODEL
// ============================================================

export type WidgetType = 'text' | 'heading' | 'image' | 'divider' | 'quote' | 'statblock' | 'table' | 'gallery';

export interface GridWidget {
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  width: number;
  height: number;
  content: Record<string, any>;
}

export interface ArticleTab {
  id: string;
  name: string;
  widgets: GridWidget[];
}

/**
 * Parse entity.articleDoc into ArticleTab[].
 * Handles three legacy formats:
 *   A) ArticleTab[] — already new format, return as-is
 *   B) GridWidget[] — Sprint 55-58 format, wrap in Main tab
 *   C) Anything else (HTML string, null, invalid) — return empty Main tab
 */
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

    // Detect ArticleTab[] — first element has a 'widgets' array and a 'name' string
    if (
      typeof parsed[0].name === 'string' &&
      Array.isArray(parsed[0].widgets)
    ) {
      return parsed as ArticleTab[];
    }

    // Detect GridWidget[] — first element has x, y, width, height
    if (
      typeof parsed[0].x === 'number' &&
      typeof parsed[0].y === 'number'
    ) {
      return [{
        id: crypto.randomUUID(),
        name: 'Main',
        widgets: parsed as GridWidget[],
      }];
    }

    return defaultMain();
  } catch {
    return defaultMain();
  }
}

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const CANVAS_WIDTH = 3000;
const CANVAS_HEIGHT = 2000;
const MIN_WIDTH = 120;
const MIN_HEIGHT = 60;
const ACTIVE_ZONE_HEIGHT = 1200; // ~1.2x typical panel viewport height at 1080p

/** Default dimensions per widget type */
const DEFAULT_DIMS: Record<WidgetType, { width: number; height: number }> = {
  text:      { width: 360, height: 180 },
  heading:   { width: 600, height: 80  },
  image:     { width: 300, height: 300 },
  divider:   { width: 500, height: 40  },
  quote:     { width: 380, height: 160 },
  statblock: { width: 260, height: 200 },
  table:     { width: 520, height: 220 },
  gallery:   { width: 580, height: 340 },
};

const PALETTE_ITEMS: { type: WidgetType; icon: string; label: string }[] = [
  { type: 'text',      icon: '📝', label: 'Text' },
  { type: 'heading',   icon: '🔤', label: 'Heading' },
  { type: 'image',     icon: '🖼️', label: 'Image' },
  { type: 'quote',     icon: '💬', label: 'Quote' },
  { type: 'divider',   icon: '➖', label: 'Divider' },
  { type: 'statblock', icon: '📊', label: 'Stat Block' },
  { type: 'table',     icon: '📋', label: 'Table' },
  { type: 'gallery',   icon: '🖼️', label: 'Gallery' },
];

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
    default:          return {};
  }
}



function updateWidgetContent(widgets: GridWidget[], id: string, content: Record<string, any>): GridWidget[] {
  return widgets.map(w => w.id === id ? { ...w, content: { ...w.content, ...content } } : w);
}

function deleteWidgetById(widgets: GridWidget[], id: string): GridWidget[] {
  return widgets.filter(w => w.id !== id);
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function ArticleGridEditor({ entityId }: { entityId: string }) {
  const articleZoneWidth = useWorkspaceStore(state => state.articleZoneWidth);
  const entities = useWorkspaceStore(state => state.entities);
  const updateEntityDoc = useWorkspaceStore(state => state.updateEntityDoc);
  const entity = entities.find(e => e.id === entityId);

  const [tabs, setTabs] = useState<ArticleTab[]>(() => parseArticleTabs(entity?.articleDoc));
  const [activeTabId, setActiveTabId] = useState<string>(() => parseArticleTabs(entity?.articleDoc)[0].id);
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  // Always-current reference to active tab widgets — used by drag handlers
  // to avoid stale closure commits on mouseup.
  const widgetsRef = useRef<GridWidget[]>([]);

  const activeTab = tabs.find(t => t.id === activeTabId) ?? tabs[0];
  const widgets = activeTab.widgets;
  widgetsRef.current = widgets;


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

  // Active zone position — user can drag to reposition the entire article area
  const [activeZonePos, setActiveZonePos] = useState<{ x: number; y: number }>({ x: 40, y: 40 });

  const save = useCallback((nextTabs: ArticleTab[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      updateEntityDoc(entityId, JSON.stringify(nextTabs));
      setSaveLabel('saved');
      setTimeout(() => setSaveLabel('idle'), 2000);
    }, 400);
  }, [entityId, updateEntityDoc]);

  /**
   * Apply a widget change to the active tab only, then save all tabs.
   */
  const applyTabChange = useCallback((nextWidgets: GridWidget[]) => {
    const nextTabs = tabs.map(t =>
      t.id === activeTabId ? { ...t, widgets: nextWidgets } : t
    );
    setTabs(nextTabs);
    save(nextTabs);
  }, [tabs, activeTabId, save]);

  /**
   * Push current full tabs snapshot to history, then apply widget change.
   */
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

  /**
   * Ctrl+Scroll to zoom. Must use addEventListener with passive:false
   * because React's onWheel is passive by default and cannot preventDefault.
   */
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;

      // Only act if the mouse is over the canvas viewport
      const rect = el.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

      if (!inside) return;

      // Prevent browser zoom AND page scroll
      e.preventDefault();
      e.stopPropagation();

      setZoom(prev => {
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        return Math.min(2, Math.max(0.25, parseFloat((prev + delta).toFixed(2))));
      });
    };

    // Attach to document (not the element) with passive:false so preventDefault works
    // The bounds check above ensures it only fires when over the canvas
    document.addEventListener('wheel', handleWheel, { passive: false });
    return () => document.removeEventListener('wheel', handleWheel);
  }, []);

  /**
   * Fit to view — zoom canvas so active zone fills the viewport width exactly.
   * Keyboard shortcut: Ctrl+Shift+0
   */
  const handleFitToView = useCallback(() => {
    if (!viewportRef.current) return;
    const viewportWidth = viewportRef.current.clientWidth;
    const nextZoom = Math.min(2, Math.max(0.25,
      parseFloat((viewportWidth / articleZoneWidth).toFixed(2))
    ));
    setZoom(nextZoom);
  }, [articleZoneWidth]);

  /**
   * Global keyboard shortcuts for the canvas.
   * Guard: skip if a text input or contenteditable is focused.
   */
  useEffect(() => {
    const isInputFocused = () => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement).isContentEditable;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;

      // Zoom shortcuts — always active
      if (ctrl && e.shiftKey && e.key === '0') {
        e.preventDefault();
        handleFitToView();
        return;
      }
      if (ctrl && e.key === '0') {
        e.preventDefault();
        setZoom(1);
        return;
      }
      if (ctrl && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        setZoom(prev => Math.min(2, parseFloat((prev + 0.1).toFixed(2))));
        return;
      }
      if (ctrl && e.key === '-') {
        e.preventDefault();
        setZoom(prev => Math.max(0.25, parseFloat((prev - 0.1).toFixed(2))));
        return;
      }

      // All other shortcuts: skip if text input focused
      if (isInputFocused()) return;

      if (ctrl && e.key === 'a') {
        e.preventDefault();
        setSelectedIds(new Set(widgets.map(w => w.id)));
        return;
      }

      if (ctrl && e.key === 'c') {
        e.preventDefault();
        clipboardWidgets.current = widgets
          .filter(w => selectedIds.has(w.id))
          .map(w => ({ ...w, content: JSON.parse(JSON.stringify(w.content)) }));
        return;
      }

      if (ctrl && e.key === 'v') {
        e.preventDefault();
        if (clipboardWidgets.current.length === 0) return;
        const pasted = clipboardWidgets.current.map(w => ({
          ...w,
          id: crypto.randomUUID(),
          x: w.x + 20,
          y: w.y + 20,
          content: JSON.parse(JSON.stringify(w.content)),
        }));
        const next = [...widgets, ...pasted];
        applyTabChangeWithHistory(next);
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
        setSelectedIds(new Set());
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
    const newTab: ArticleTab = {
      id: crypto.randomUUID(),
      name: `Tab ${tabs.length + 1}`,
      widgets: [],
    };
    const nextTabs = [...tabs, newTab];
    setTabs(nextTabs);
    setActiveTabId(newTab.id);
    save(nextTabs);
  };

  const deleteTab = (tabId: string) => {
    // Cannot delete Main tab (always index 0) or the only tab
    if (tabs.length === 1 || tabId === tabs[0].id) return;
    const nextTabs = tabs.filter(t => t.id !== tabId);
    setTabs(nextTabs);
    if (activeTabId === tabId) {
      setActiveTabId(nextTabs[nextTabs.length - 1].id);
    }
    save(nextTabs);
  };

  const renameTab = (tabId: string, newName: string) => {
    const trimmed = newName.trim() || 'Tab';
    const nextTabs = tabs.map(t =>
      t.id === tabId ? { ...t, name: trimmed } : t
    );
    setTabs(nextTabs);
    setRenamingTabId(null);
    save(nextTabs);
  };

  /**
   * Drag the active zone box by its top title bar.
   * Moves the entire fixed-size active zone rectangle freely around the canvas.
   */
  const handleActiveZoneDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startX = activeZonePos.x;
    const startY = activeZonePos.y;

    const onMouseMove = (mv: MouseEvent) => {
      const newX = Math.max(0, Math.min(CANVAS_WIDTH - articleZoneWidth, startX + (mv.clientX - startMouseX) / zoom));
      const newY = Math.max(0, Math.min(CANVAS_HEIGHT - ACTIVE_ZONE_HEIGHT, startY + (mv.clientY - startMouseY) / zoom));
      // Direct DOM update for smooth drag
      const zone = canvasRef.current?.querySelector('[data-active-zone]') as HTMLElement;
      if (zone) {
        zone.style.left = newX + 'px';
        zone.style.top = newY + 'px';
      }
      const overlay = canvasRef.current?.querySelector('[data-scratch-overlay]') as HTMLElement;
      if (overlay) {
        overlay.style.setProperty('--az-x', newX + 'px');
        overlay.style.setProperty('--az-y', newY + 'px');
        overlay.style.setProperty('--az-w', articleZoneWidth + 'px');
        overlay.style.setProperty('--az-h', ACTIVE_ZONE_HEIGHT + 'px');
      }
    };

    const onMouseUp = (up: MouseEvent) => {
      const newX = Math.max(0, Math.min(CANVAS_WIDTH - articleZoneWidth, startX + (up.clientX - startMouseX) / zoom));
      const newY = Math.max(0, Math.min(CANVAS_HEIGHT - ACTIVE_ZONE_HEIGHT, startY + (up.clientY - startMouseY) / zoom));
      setActiveZonePos({ x: newX, y: newY });
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const isFit = viewportRef.current
    ? Math.abs(zoom - viewportRef.current.clientWidth / articleZoneWidth) < 0.02
    : false;

  if (!entity) return null;

  /**
   * Handle mouse spotlight — updates CSS vars for the radial gradient mask.
   */
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    // Account for zoom: the canvas is scaled, so mouse offset must be divided by zoom
    // to get the correct position within the unscaled canvas coordinate space
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    e.currentTarget.style.setProperty('--mouse-x', x + 'px');
    e.currentTarget.style.setProperty('--mouse-y', y + 'px');
  };

  /**
   * Drop palette widget onto canvas at exact mouse coordinates.
   */
  const handleCanvasDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('widget-type') as WidgetType;
    if (!type) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dims = DEFAULT_DIMS[type];
    const x = Math.max(0, Math.min(CANVAS_WIDTH - dims.width, (e.clientX - rect.left) / zoom - dims.width / 2));
    const y = Math.max(0, Math.min(CANVAS_HEIGHT - dims.height, (e.clientY - rect.top) / zoom - dims.height / 2));
    const newWidget: GridWidget = {
      id: crypto.randomUUID(),
      type,
      x,
      y,
      width: dims.width,
      height: dims.height,
      content: getDefaultContent(type),
    };
    applyTabChangeWithHistory([...widgets, newWidget]);
  };

  /**
   * Drag a widget by its title bar — native mouse events for smooth movement.
   */
  const handleDragStart = (e: React.MouseEvent, widget: GridWidget) => {
    e.preventDefault();
    e.stopPropagation();

    setSelectedIds(prev => {
      if (prev.has(widget.id)) return prev;
      return new Set([widget.id]);
    });

    const el = document.querySelector(`[data-widget-id="${widget.id}"]`) as HTMLElement;
    if (!el) return;

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startX = widget.x;
    const startY = widget.y;

    // Lift widget visually
    el.style.zIndex = '100';
    el.style.boxShadow = '0 16px 48px rgba(0,0,0,0.6)';

    const onMouseMove = (mv: MouseEvent) => {
      const newX = Math.max(0, Math.min(CANVAS_WIDTH - widget.width, startX + (mv.clientX - startMouseX) / zoom));
      const newY = Math.max(0, Math.min(CANVAS_HEIGHT - widget.height, startY + (mv.clientY - startMouseY) / zoom));
      el.style.left = newX + 'px';
      el.style.top = newY + 'px';
    };

    const onMouseUp = (up: MouseEvent) => {
      const newX = Math.max(0, Math.min(CANVAS_WIDTH - widget.width, startX + (up.clientX - startMouseX) / zoom));
      const newY = Math.max(0, Math.min(CANVAS_HEIGHT - widget.height, startY + (up.clientY - startMouseY) / zoom));
      // Reset inline styles — React will re-render with committed values
      el.style.zIndex = '';
      el.style.boxShadow = '';
      applyTabChangeWithHistory(widgetsRef.current.map(w => w.id === widget.id ? { ...w, x: newX, y: newY } : w));
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      dragCleanup.current = null;
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    dragCleanup.current = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  };

  /**
   * Resize widget from any of 8 edge/corner handles.
   * Each direction adjusts different combinations of x, y, width, height.
   */
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
      if (dir.includes('w')) {
        const newW = Math.max(MIN_WIDTH, startW - dx);
        x = startX + startW - newW;
        w = newW;
      }
      if (dir.includes('n')) {
        const newH = Math.max(MIN_HEIGHT, startH - dy);
        y = startY + startH - newH;
        h = newH;
      }
      return { x, y, width: w, height: h };
    };

    const onMouseMove = (mv: MouseEvent) => {
      const next = compute(mv.clientX, mv.clientY);
      el.style.left = next.x + 'px';
      el.style.top = next.y + 'px';
      el.style.width = next.width + 'px';
      el.style.height = next.height + 'px';
    };

    const onMouseUp = (up: MouseEvent) => {
      const next = compute(up.clientX, up.clientY);
      // Do NOT clear inline styles here — clearing before React re-renders
      // causes a one-frame snap back to the old position. React will overwrite
      // the inline styles on the next render with committed values.
      applyTabChangeWithHistory(widgetsRef.current.map(w => w.id === widget.id ? { ...w, ...next } : w));
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      resizeCleanup.current = null;
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
      {/* ---- Palette ---- */}
      <aside className={styles.palette}>
        <div className={styles.paletteHeader}>
          <span className={styles.paletteTitle}>Widgets</span>
          <span className={styles.paletteHint}>Drag to canvas</span>
        </div>
        <div className={styles.paletteList}>
          {PALETTE_ITEMS.map(item => (
            <div
              key={item.type}
              className={styles.paletteItem}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('widget-type', item.type);
                e.dataTransfer.effectAllowed = 'copy';
              }}
            >
              <span className={styles.paletteIcon}>{item.icon}</span>
              <span className={styles.paletteLabel}>{item.label}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* ---- Right column: tabs above canvas ---- */}
      <div className={styles.canvasColumn}>
        {/* ---- Tab bar ---- */}
        <div className={styles.tabBar}>
          {tabs.map((tab, idx) => (
            <div
              key={tab.id}
              className={`${styles.tab} ${tab.id === activeTabId ? styles.tabActive : ''}`}
              onClick={() => setActiveTabId(tab.id)}
              onDoubleClick={() => setRenamingTabId(tab.id)}
            >
              {renamingTabId === tab.id ? (
                <input
                  className={styles.tabRenameInput}
                  defaultValue={tab.name}
                  autoFocus
                  onBlur={(e) => renameTab(tab.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') renameTab(tab.id, e.currentTarget.value);
                    if (e.key === 'Escape') setRenamingTabId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  <span className={styles.tabName}>{tab.name}</span>
                  {idx !== 0 && (
                    <button
                      className={styles.tabDelete}
                      onClick={(e) => { e.stopPropagation(); deleteTab(tab.id); }}
                      title="Delete tab"
                    >×</button>
                  )}
                </>
              )}
            </div>
          ))}
          <button className={styles.tabAdd} onClick={addTab} title="Add tab">+ Tab</button>
        </div>

        {/* ---- Canvas viewport (scrollable window) ---- */}
        <div ref={viewportRef} className={styles.canvasViewport}>
          <div className={styles.saveIndicator}>{saveLabel === 'saved' ? '✓ Saved' : ''}</div>

          {/* Canvas surface */}
          <div
            ref={canvasRef}
            className={styles.canvasInner}
            onMouseMove={handleCanvasMouseMove}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setSelectedIds(new Set());
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleCanvasDrop}
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
            } as React.CSSProperties}
          >
            {/* ---- Active zone box (fixed size, draggable) ---- */}
            <div
              data-active-zone
              className={styles.activeZoneBox}
              style={{
                left: activeZonePos.x,
                top: activeZonePos.y,
                width: articleZoneWidth,
                height: ACTIVE_ZONE_HEIGHT,
              }}
            >
              {/* Drag handle — title bar at top */}
              <div
                className={styles.activeZoneTitleBar}
                onMouseDown={handleActiveZoneDragStart}
              >
                <span className={styles.activeZoneTitleText}>
                  ⠿ ACTIVE ZONE · {articleZoneWidth}px wide
                </span>
              </div>
            </div>

            {/* Scratch zone overlay — covers entire canvas EXCEPT the active zone box.
                Uses CSS clip-path with CSS vars to cut out the active zone rectangle. */}
            <div
              data-scratch-overlay
              className={styles.scratchZoneOverlay}
              style={{
                '--az-x': activeZonePos.x + 'px',
                '--az-y': activeZonePos.y + 'px',
                '--az-w': articleZoneWidth + 'px',
                '--az-h': ACTIVE_ZONE_HEIGHT + 'px',
              } as React.CSSProperties}
              aria-hidden="true"
            />
            {widgets.map(widget => {
              return (
                <div
                  key={widget.id}
                  data-widget-id={widget.id}
                  className={`${styles.widgetWrapper} ${selectedIds.has(widget.id) ? styles.widgetSelected : ''}`}
                  style={{
                    left: widget.x,
                    top: widget.y,
                    width: widget.width,
                    height: widget.height,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (e.shiftKey) {
                      setSelectedIds(prev => {
                        const next = new Set(prev);
                        if (next.has(widget.id)) next.delete(widget.id);
                        else next.add(widget.id);
                        return next;
                      });
                    } else {
                      setSelectedIds(new Set([widget.id]));
                    }
                  }}
                >
                  {/* Title / drag bar */}
                  <div
                    className={styles.widgetDragBar}
                    onMouseDown={(e) => handleDragStart(e, widget)}
                  >
                    <span className={styles.widgetIcon}>
                      {PALETTE_ITEMS.find(p => p.type === widget.type)?.icon} {widget.type}
                    </span>
                    <button
                      className={styles.widgetDelete}
                      onClick={() => applyTabChangeWithHistory(deleteWidgetById(widgets, widget.id))}
                      title="Delete widget"
                    >×</button>
                  </div>

                  {/* Widget content */}
                  <div className={styles.widgetContent}>
                    <WidgetRenderer
                      widget={widget}
                      onChange={(content) => applyTabChange(updateWidgetContent(widgets, widget.id, content))}
                    />
                  </div>

                  {/* 8 resize handles */}
                  {(['n','s','e','w','ne','nw','se','sw'] as ResizeDirection[]).map(dir => (
                    <div
                      key={dir}
                      className={`${styles.resizeHandle} ${styles['resize_' + dir]}`}
                      onMouseDown={(e) => handleResizeStart(e, widget, dir)}
                    />
                  ))}
                </div>
              );
            })}
          </div>

          <div className={styles.zoomControls}>
            <div
              className={styles.zoomIndicator}
              onClick={() => setZoom(1)}
              title="Click to reset zoom to 100%"
            >
              {Math.round(zoom * 100)}%{isFit ? ' · FIT' : ''}
            </div>
            <div
              className={`${styles.fitButton} ${isFit ? styles.fitButtonActive : ''}`}
              onClick={handleFitToView}
              title="Fit active zone to viewport (Ctrl+Shift+0)"
            >
              FIT
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// WIDGET RENDERERS — unchanged from Sprint 55
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
    default:          return null;
  }
}

/** Rich text area — contentEditable */
function TextWidget({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (content.html || '')) {
      ref.current.innerHTML = content.html || '';
    }
  }, []);
  return (
    <div
      ref={ref}
      className={styles.textWidget}
      contentEditable
      suppressContentEditableWarning
      onBlur={() => { if (ref.current) onChange({ html: ref.current.innerHTML }); }}
      data-placeholder="Start writing..."
    />
  );
}

/** Heading — level selector + text input */
function HeadingWidget({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  return (
    <div className={styles.headingWidget}>
      <select
        className={styles.headingLevel}
        value={content.level || 2}
        onChange={(e) => onChange({ ...content, level: parseInt(e.target.value) })}
      >
        <option value={1}>H1</option>
        <option value={2}>H2</option>
        <option value={3}>H3</option>
      </select>
      <input
        className={styles.headingText}
        type="text"
        placeholder="Heading text..."
        value={content.text || ''}
        onChange={(e) => onChange({ ...content, text: e.target.value })}
        onBlur={(e) => onChange({ ...content, text: e.target.value })}
      />
    </div>
  );
}

/** Image — upload or URL + caption */
function ImageWidget({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') onChange({ ...content, src: reader.result });
    };
    reader.readAsDataURL(file);
  };
  return (
    <div className={styles.imageWidget}>
      {content.src ? (
        <>
          <img
            src={content.src}
            alt={content.caption || ''}
            className={styles.imagePreview}
          />
          <input
            className={styles.captionInput}
            type="text"
            placeholder="Caption..."
            value={content.caption || ''}
            onChange={(e) => onChange({ ...content, caption: e.target.value })}
          />
        </>
      ) : (
        <div className={styles.imageUpload} onClick={() => fileRef.current?.click()}>
          <span>🖼️</span>
          <span>Click to upload image</span>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
    </div>
  );
}

/** Horizontal rule */
function DividerWidget() {
  return <hr className={styles.dividerWidget} />;
}

/** Blockquote + attribution */
function QuoteWidget({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  return (
    <div className={styles.quoteWidget}>
      <textarea
        className={styles.quoteText}
        placeholder="Quote text..."
        value={content.text || ''}
        onChange={(e) => onChange({ ...content, text: e.target.value })}
      />
      <div className={styles.quoteAttribution}>
        <span>—</span>
        <input
          className={styles.quoteSource}
          type="text"
          placeholder="Attribution"
          value={content.attribution || ''}
          onChange={(e) => onChange({ ...content, attribution: e.target.value })}
        />
      </div>
    </div>
  );
}

/** Key-value stat rows */
function StatBlockWidget({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const rows: { label: string; value: string }[] = content.rows || [{ label: '', value: '' }];
  const updateRow = (i: number, field: 'label' | 'value', val: string) => {
    const next = [...rows];
    next[i] = { ...next[i], [field]: val };
    onChange({ ...content, rows: next });
  };
  return (
    <div className={styles.statBlock}>
      {rows.map((row, i) => (
        <div key={i} className={styles.statRow}>
          <input
            className={styles.statLabel}
            type="text"
            placeholder="Label"
            value={row.label}
            onChange={(e) => updateRow(i, 'label', e.target.value)}
          />
          <input
            className={styles.statValue}
            type="text"
            placeholder="Value"
            value={row.value}
            onChange={(e) => updateRow(i, 'value', e.target.value)}
          />
          <button
            className={styles.statDelete}
            onClick={() => onChange({ ...content, rows: rows.filter((_, j) => j !== i) })}
          >×</button>
        </div>
      ))}
      <button
        className={styles.statAdd}
        onClick={() => onChange({ ...content, rows: [...rows, { label: '', value: '' }] })}
      >+ Add Row</button>
    </div>
  );
}

/** Editable table */
function TableWidget({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const headers: string[] = content.headers || ['Column 1', 'Column 2'];
  const rows: string[][] = content.rows || [['', '']];
  return (
    <div className={styles.tableWidget}>
      <table className={styles.table}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i}>
                <input
                  className={styles.tableCell}
                  value={h}
                  onChange={(e) => {
                    const next = [...headers];
                    next[i] = e.target.value;
                    onChange({ ...content, headers: next });
                  }}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci}>
                  <input
                    className={styles.tableCell}
                    value={cell}
                    onChange={(e) => {
                      const next = rows.map(r => [...r]);
                      next[ri][ci] = e.target.value;
                      onChange({ ...content, rows: next });
                    }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <button
        className={styles.tableAddRow}
        onClick={() => onChange({ ...content, rows: [...rows, headers.map(() => '')] })}
      >+ Add Row</button>
    </div>
  );
}

/**
 * GalleryWidget — multiple images with captions, for reference sheets.
 * content shape: { images: Array<{ id: string; src: string; caption: string }> }
 */
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
        newImages.push({
          id: crypto.randomUUID(),
          src: typeof reader.result === 'string' ? reader.result : '',
          caption: '',
        });
        loaded++;
        if (loaded === files.length) {
          onChange({ ...content, images: [...images, ...newImages] });
        }
      };
      reader.readAsDataURL(file);
    });
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  const updateCaption = (id: string, caption: string) => {
    onChange({ ...content, images: images.map(img => img.id === id ? { ...img, caption } : img) });
  };

  const removeImage = (id: string) => {
    onChange({ ...content, images: images.filter(img => img.id !== id) });
  };

  return (
    <div className={styles.galleryWidget}>
      <div className={styles.galleryGrid}>
        {images.map(img => (
          <div key={img.id} className={styles.galleryCell}>
            <div className={styles.galleryCellImageWrap}>
              <img src={img.src} alt={img.caption} className={styles.galleryCellImage} />
              <button
                className={styles.galleryCellRemove}
                onClick={() => removeImage(img.id)}
                title="Remove image"
              >×</button>
            </div>
            <input
              className={styles.galleryCellCaption}
              type="text"
              placeholder="Caption..."
              value={img.caption}
              onChange={e => updateCaption(img.id, e.target.value)}
            />
          </div>
        ))}
      </div>
      <button className={styles.galleryAddBtn} onClick={() => fileRef.current?.click()}>
        + Add Images
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleFiles}
      />
    </div>
  );
}
