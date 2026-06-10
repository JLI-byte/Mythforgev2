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
import { GridWidget, WidgetType, ResizeDirection, AlignGuide } from './article-grid/gridTypes';
import { ArticleTab, parseArticleTabs } from './article-grid/articleTabs';
import {
  MIN_WIDTH,
  MIN_HEIGHT,
  MIN_ZONE_HEIGHT,
  ZONE_BOTTOM_PADDING,
  DEFAULT_DIMS,
  PALETTE_ITEMS,
  getDefaultContent,
  updateWidgetContent,
  deleteWidgetById,
  computeGuides,
} from './article-grid/gridGeometry';
import { StaticGridCanvas } from './article-grid/StaticGridCanvas';
import { WidgetRenderer } from './article-grid/widgets/WidgetRenderer';

// Re-exports — other modules import these symbols from this file.
export type { WidgetType, GridWidget } from './article-grid/gridTypes';
export type { ArticleTab } from './article-grid/articleTabs';
export { parseArticleTabs } from './article-grid/articleTabs';
export { StaticGridCanvas } from './article-grid/StaticGridCanvas';

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
