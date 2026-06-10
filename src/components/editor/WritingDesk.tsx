"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useWorkspaceStore, DeskWidget, DeskWidgetType } from '@/store/workspaceStore';
import styles from './WritingDesk.module.css';

import { BinderMode, ResizeDir, MIN_W, MIN_H, DEFAULT_DIMS, PALETTE_ITEMS, PALETTE_MAP } from './desk/deskConstants';
import { SurfaceCanvas } from './desk/SurfaceCanvas';
import { EmptyDeskWelcome } from './desk/EmptyDeskWelcome';
import { WidgetRenderer } from './desk/widgets/WidgetRenderer';

// ============================================================
// MAIN COMPONENT
// ============================================================


export default function WritingDesk() {
  const activeProjectId = useWorkspaceStore(s => s.activeProjectId);
  const activeDocumentId = useWorkspaceStore(s => s.activeDocumentId);
  const activeSceneId = useWorkspaceStore(s => s.activeSceneId);
  const deskState = useWorkspaceStore(s => activeProjectId ? s.deskStates[activeProjectId] : null);
  const updateDeskState = useWorkspaceStore(s => s.updateDeskState);
  const globalWidgets = useWorkspaceStore(s => s.globalWidgets);
  const updateGlobalWidgets = useWorkspaceStore(s => s.updateGlobalWidgets);

  // Derived state from store
  const widgets = useMemo(() => deskState?.widgets || [], [deskState]);
  const zoom = deskState?.zoom ?? 1;
  const canvasOffset = useMemo(() => deskState?.canvasOffset || { x: 0, y: 0 }, [deskState]);

  const widgetsRef = useRef<DeskWidget[]>(widgets);
  const zoomRef = useRef(zoom);
  const canvasOffsetRef = useRef(canvasOffset);
  const offsetRef = useRef(canvasOffset);
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => { setHasMounted(true); }, []);

  // Synchronize refs when store changes (e.g. from World Bible Pin)
  useEffect(() => {
    widgetsRef.current = widgets;
    zoomRef.current = zoom;
    canvasOffsetRef.current = canvasOffset;
    offsetRef.current = canvasOffset;
  }, [widgets, zoom, canvasOffset]);

  // Always ensure a Writing Zone widget is present when a project is active.
  // Fires for new projects (no deskState yet) and existing projects that have
  // no writingZone widget (e.g. user deleted it or it was never seeded).

  const liveContentRef = useRef<Record<string, Record<string, any>>>(
    Object.fromEntries(widgets.map(w => [w.id, w.content]))
  );
  const contentSaveTimers = useRef<Record<string, any>>({});
  const [isPanning, setIsPanning] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [typePickerWidgetId, setTypePickerWidgetId] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isEditingZoom, setIsEditingZoom] = useState(false);
  const [zoomInputValue, setZoomInputValue] = useState("");


  const viewportRef = useRef<HTMLDivElement>(null);

  const updateWidgets = useCallback((next: DeskWidget[], silentUI: boolean = true) => {
    if (!activeProjectId) return;
    widgetsRef.current = next;
    updateDeskState(activeProjectId, { widgets: next });
    if (!silentUI) {
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    }
  }, [activeProjectId, updateDeskState]);

  const updateDock = useCallback((id: string, dock: DeskWidget['dock']) => {
    const all = [...widgetsRef.current, ...globalWidgets];
    const w = all.find(x => x.id === id);
    if (!w) return;

    let nx = w.x;
    let ny = w.y;

    if (dock && viewportRef.current) {
      const vw = viewportRef.current.clientWidth;
      if (dock === 'center') nx = (vw - w.width) / 2;
      else if (dock === 'left') nx = 0;
      else if (dock === 'right') nx = vw - w.width;
      // When docking to center, we usually anchor to top 0 in CSS, 
      // but let's keep ny sane.
      ny = 0;
    }

    const updated = { ...w, dock, x: nx, y: ny };
    const nextArr = widgetsRef.current.map(x => x.id === id ? updated : x);
    
    // Use the primary updateWidgets flow for consistency and re-render triggers
    updateWidgets(nextArr);
  }, [activeProjectId, globalWidgets, updateWidgets]);

  const activeWidgets = useMemo(() => {
    const all = [...widgets, ...globalWidgets];
    return all.filter(w => {
      const scope = w.scope || 'project';
      if (scope === 'global') return true;
      if (scope === 'project') {
         // Project widgets are already project-specific in 'widgets'
         return widgets.some(pw => pw.id === w.id);
      }
      if (scope === 'chapter') return w.scopeId === activeDocumentId;
      if (scope === 'scene') return w.scopeId === activeSceneId;
      return false;
    });
  }, [widgets, globalWidgets, activeDocumentId, activeSceneId]);

  const canvasWidgets = useMemo(() => activeWidgets.filter(w => !w.dock), [activeWidgets]);
  const dockedWidgets = useMemo(() => activeWidgets.filter(w => !!w.dock), [activeWidgets]);

  // New state for creation flow
  const [pendingWidget, setPendingWidget] = useState<{ x: number, y: number, width: number, height: number } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const drawGhostRef = useRef<HTMLDivElement>(null);

  const surfaceCanvasRef = useRef<{ redraw: (off: { x: number; y: number }, z: number) => void }>(null);
  const zoomRafRef = useRef<number | null>(null);

  const setOffset = useCallback((off: { x: number; y: number }) => {
    if (!activeProjectId) return;
    canvasOffsetRef.current = off;
    offsetRef.current = off;
    updateDeskState(activeProjectId, { canvasOffset: off });
  }, [activeProjectId, updateDeskState]);

  const setZoomValue = useCallback((z: number) => {
    if (!activeProjectId) return;
    zoomRef.current = z;
    updateDeskState(activeProjectId, { zoom: z });
  }, [activeProjectId, updateDeskState]);

  // Initial liveContent sync when widgets are added externally
  useEffect(() => {
    widgets.forEach(w => {
      if (!liveContentRef.current[w.id]) {
        liveContentRef.current[w.id] = w.content;
      }
    });
  }, [widgets]);

  const triggerSave = useCallback(() => {
    // Persistence is handled by the store
  }, []);


  useEffect(() => {
    if (!activeProjectId) return;
    const projectWidgets = deskState?.widgets || [];
    const wz = projectWidgets.find(w => w.type === 'writingZone');

    // Seeding: Always ensure a Writing Zone widget is present when a project is active.
    if (wz) return;

    const dw = DEFAULT_DIMS.writingZone.w;
    const nw: DeskWidget = {
      id: crypto.randomUUID(),
      type: 'writingZone',
      x: 0,
      y: 0,
      width: dw,
      height: DEFAULT_DIMS.writingZone.h,
      content: {},
      dock: 'center',
      scope: 'project',
    };

    const current = deskState || { widgets: [], zoom: 1, canvasOffset: { x: 0, y: 0 } };
    updateDeskState(activeProjectId, {
      ...current,
      widgets: [nw, ...current.widgets],
    });
  }, [activeProjectId, deskState, updateDeskState, updateWidgets]);

  const updateContentSilent = useCallback((id: string, content: any) => {
    liveContentRef.current[id] = content;
    if (contentSaveTimers.current[id]) clearTimeout(contentSaveTimers.current[id]);
    contentSaveTimers.current[id] = setTimeout(() => {
      updateWidgets(widgetsRef.current.map(w => w.id === id ? { ...w, content } : w));
    }, 800);
  }, [updateWidgets]);


  const updateContentImmediate = useCallback((id: string, content: any) => {
    liveContentRef.current[id] = content;
    updateWidgets(widgetsRef.current.map(w => w.id === id ? { ...w, content } : w));
  }, [updateWidgets]);

  const deleteWidget = useCallback((id: string) => {
    const next = widgetsRef.current.filter(w => w.id !== id);
    updateWidgets(next);
    setSelectedId(prev => prev === id ? null : prev);
  }, [updateWidgets]);

  const handleDragStart = useCallback((e: React.MouseEvent, widget: DeskWidget) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault(); e.stopPropagation();
    setSelectedId(widget.id);
    const startX = e.clientX, startY = e.clientY, origX = widget.x, origY = widget.y;
    const localZoom = widget.dock ? 1 : zoomRef.current;
    let moved = false;
    const onMove = (mv: MouseEvent) => {
      const dx = (mv.clientX - startX) / localZoom;
      const dy = (mv.clientY - startY) / localZoom;
      if (!moved && Math.abs(mv.clientX - startX) < 4 && Math.abs(mv.clientY - startY) < 4) return;
      moved = true;
      const el = document.getElementById(`widget-${widget.id}`);
      if (el) {
        if (widget.dock) {
          const vw = viewportRef.current?.clientWidth || window.innerWidth;
          const nx = Math.max(0, Math.min(vw - widget.width, origX + (mv.clientX - startX)));
          el.style.left = nx + 'px';
        } else {
          el.style.left = (origX + dx) + 'px';
          el.style.top = (origY + dy) + 'px';
        }
      }
    };
    const onUp = (up: MouseEvent) => {
      document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp);
      if (!moved) return;
      if (widget.dock) {
        const vw = viewportRef.current?.clientWidth || window.innerWidth;
        const nx = Math.max(0, Math.min(vw - widget.width, origX + (up.clientX - startX)));
        updateWidgets(widgetsRef.current.map(w => w.id === widget.id ? { ...w, x: nx } : w));
      } else {
        const nx = origX + (up.clientX - startX) / localZoom, ny = origY + (up.clientY - startY) / localZoom;
        updateWidgets(widgetsRef.current.map(w => w.id === widget.id ? { ...w, x: nx, y: ny } : w));
      }
    };
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
  }, [updateWidgets]);

  const handleResizeStart = useCallback((e: React.MouseEvent, widget: DeskWidget, dir: ResizeDir) => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX, startY = e.clientY, { x: oX, y: oY, width: oW, height: oH } = widget;
    const localZoom = widget.dock ? 1 : zoomRef.current;
    const onMove = (mv: MouseEvent) => {
      const dx = (mv.clientX - startX) / localZoom, dy = (mv.clientY - startY) / localZoom;
      let nx = oX, ny = oY, nw = oW, nh = oH;
      if (dir.includes('e')) nw = Math.max(MIN_W, oW + dx);
      if (dir.includes('s')) nh = Math.max(MIN_H, oH + dy);
      if (dir.includes('w')) { nw = Math.max(MIN_W, oW - dx); nx = oX + (oW - nw); }
      if (dir.includes('n')) { nh = Math.max(MIN_H, oH - dy); ny = oY + (oH - nh); }
      const el = document.getElementById(`widget-${widget.id}`);
      if (el) { 
        el.style.left=nx+'px'; 
        el.style.top=ny+'px';
        el.style.width=nw+'px'; 
        el.style.height=nh+'px'; 
      }
    };
    const onUp = (up: MouseEvent) => {
      document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp);
      const dx = (up.clientX - startX) / localZoom, dy = (up.clientY - startY) / localZoom;
      let nx = oX, ny = oY, nw = oW, nh = oH;
      if (dir.includes('e')) nw = Math.max(MIN_W, oW + dx);
      if (dir.includes('s')) nh = Math.max(MIN_H, oH + dy);
      if (dir.includes('w')) { nw = Math.max(MIN_W, oW - dx); nx = oX + (oW - nw); }
      if (dir.includes('n')) { nh = Math.max(MIN_H, oH - dy); ny = oY + (oH - nh); }
      updateWidgets(widgetsRef.current.map(w => w.id === widget.id ? { ...w, x: nx, y: ny, width: nw, height: nh } : w));
    };
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
  }, [updateWidgets]);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const isMiddle = e.button === 1, isShiftLeft = e.button === 0 && e.shiftKey, isLeft = e.button === 0 && !e.shiftKey;
    if (isMiddle || isShiftLeft) {
      if (isShiftLeft && e.target !== e.currentTarget && (e.target as HTMLElement).className !== styles.rippleCanvas) return;
      e.preventDefault(); setIsPanning(true);
      const startX = e.clientX, startY = e.clientY, origX = canvasOffset.x, origY = canvasOffset.y;
      const onMove = (mv: MouseEvent) => {
        const nx = origX + (mv.clientX - startX);
        const ny = origY + (mv.clientY - startY);
        canvasOffsetRef.current = { x: nx, y: ny };
        if (canvasRef.current) {
          canvasRef.current.style.transform = `translate(${nx}px, ${ny}px) scale(${zoomRef.current})`;
        }
        surfaceCanvasRef.current?.redraw({ x: nx, y: ny }, zoomRef.current);
      };
      const onUp = (up: MouseEvent) => {
        document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp);
        setIsPanning(false);
        const nx = origX + (up.clientX - startX), ny = origY + (up.clientY - startY);
        setOffset({ x: nx, y: ny });
      };
      document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
      return;
    }
    if (isLeft && (e.target === e.currentTarget || (e.target as HTMLElement).className === styles.rippleCanvas)) {
      setSelectedId(null); setPendingWidget(null); // Clear previous if click background
      
      const rect = viewportRef.current?.getBoundingClientRect(); if (!rect) return;
      // World coordinates for the ghost
      const startX = (e.clientX - rect.left - canvasOffsetRef.current.x) / zoomRef.current;
      const startY = (e.clientY - rect.top - canvasOffsetRef.current.y) / zoomRef.current;
      
      const ghost = drawGhostRef.current;
      if (ghost) { 
        ghost.style.display = 'block'; 
        ghost.style.left = startX + 'px'; 
        ghost.style.top = startY + 'px'; 
        ghost.style.width = '0px'; 
        ghost.style.height = '0px'; 
      }

      const onMove = (mv: MouseEvent) => {
        const x = (mv.clientX - rect.left - canvasOffsetRef.current.x) / zoomRef.current;
        const y = (mv.clientY - rect.top - canvasOffsetRef.current.y) / zoomRef.current;
        const w = x - startX, h = y - startY;
        if (ghost) { 
          ghost.style.left = (w >= 0 ? startX : startX + w) + 'px'; 
          ghost.style.top = (h >= 0 ? startY : startY + h) + 'px'; 
          ghost.style.width = Math.abs(w) + 'px'; 
          ghost.style.height = Math.abs(h) + 'px'; 
        }
      };

      const onUp = (up: MouseEvent) => {
        const x = (up.clientX - rect.left - canvasOffsetRef.current.x) / zoomRef.current;
        const y = (up.clientY - rect.top - canvasOffsetRef.current.y) / zoomRef.current;
        const rw = x - startX, rh = y - startY, bw = Math.abs(rw), bh = Math.abs(rh);
        
        if (bw >= 40 && bh >= 30) {
          setPendingWidget({
            x: rw >= 0 ? startX : startX + rw,
            y: rh >= 0 ? startY : startY + rh,
            width: bw,
            height: bh
          });
        } else {
          if (ghost) ghost.style.display = 'none';
        }
        document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const dropX = (e.clientX - rect.left) / zoomRef.current;
    const dropY = (e.clientY - rect.top) / zoomRef.current;

    // Internal widget drag from palette/library
    const type = e.dataTransfer.getData('desk-widget-type') as DeskWidgetType;
    if (type) {
      const dims = DEFAULT_DIMS[type];
      const nw: DeskWidget = { 
        id: crypto.randomUUID(), 
        type, 
        x: dropX - dims.w / 2, 
        y: (e.clientY - rect.top) / zoomRef.current - dims.h / 2, 
        width: dims.w, 
        height: dims.h, 
        content: {}, 
        dock: type === 'writingZone' ? 'center' : null 
      };
      updateWidgets([...widgetsRef.current, nw]);
      setSelectedId(nw.id);
      return;
    }

    // External Files (Local Drop)
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const imageFiles = files.filter(f => f.type.startsWith('image/'));
      let offset = 0;
      
      for (const file of imageFiles) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const src = event.target?.result as string;
          const dims = DEFAULT_DIMS.image;
          const nw: DeskWidget = {
            id: crypto.randomUUID(),
            type: 'image',
            x: dropX - dims.w / 2 + offset,
            y: (e.clientY - rect.top) / zoomRef.current - dims.h / 2 + offset,
            width: dims.w,
            height: dims.h,
            content: { src, label: file.name },
            dock: null
          };
          updateWidgets([...widgetsRef.current, nw]);
          setSelectedId(nw.id);
          offset += 20; // Stagger multiple drops
        };
        reader.readAsDataURL(file);
      }
      if (imageFiles.length > 0) return;
    }

    // External Browser Images (URL/HTML Drop)
    const html = e.dataTransfer.getData('text/html');
    const uriList = e.dataTransfer.getData('text/uri-list');
    let imgSrc = '';

    if (html) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const img = doc.querySelector('img');
      if (img && img.src) imgSrc = img.src;
    }

    if (!imgSrc && uriList) {
      const lines = uriList.split('\n').filter(l => l && !l.startsWith('#'));
      if (lines[0]) imgSrc = lines[0];
    }

    if (imgSrc) {
      const dims = DEFAULT_DIMS.image;
      const nw: DeskWidget = {
        id: crypto.randomUUID(),
        type: 'image',
        x: dropX - dims.w / 2,
        y: (e.clientY - rect.top) / zoomRef.current - dims.h / 2,
        width: dims.w,
        height: dims.h,
        content: { src: imgSrc },
        dock: null
      };
      updateWidgets([...widgetsRef.current, nw]);
      setSelectedId(nw.id);
    }
  };

  const addAtCenter = (type: DeskWidgetType) => {
    if (!viewportRef.current) return;
    const vW = viewportRef.current.clientWidth, vH = viewportRef.current.clientHeight, dims = DEFAULT_DIMS[type];
    const wx = (vW / 2 - canvasOffsetRef.current.x) / zoomRef.current - dims.w / 2, wy = (vH / 2 - canvasOffsetRef.current.y) / zoomRef.current - dims.h / 2;
    const nw: DeskWidget = { id: crypto.randomUUID(), type, x: wx, y: wy, width: dims.w, height: dims.h, content: {}, dock: type === 'writingZone' ? 'center' : null };
    updateWidgets([...widgetsRef.current, nw]); setSelectedId(nw.id);
  };

  const handleFit = () => {
    if (!viewportRef.current || widgetsRef.current.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    widgetsRef.current.forEach(w => { minX = Math.min(minX, w.x); minY = Math.min(minY, w.y); maxX = Math.max(maxX, w.x + w.width); maxY = Math.max(maxY, w.y + w.height); });
    const cw = maxX - minX, ch = maxY - minY, vW = viewportRef.current.clientWidth, vH = viewportRef.current.clientHeight;
    const nextZoom = Math.min(Math.max(0.2, Math.min((vW-100)/cw, (vH-100)/ch)), 1.2);
    const nextOffset = { x: (vW/2) - (minX + cw/2)*nextZoom, y: (vH/2) - (minY + ch/2)*nextZoom };
    if (activeProjectId) {
      updateDeskState(activeProjectId, { zoom: nextZoom, canvasOffset: nextOffset });
    }
  };

  const commitZoomInput = () => {
    const val = parseFloat(zoomInputValue);
    if (!isNaN(val)) {
      const nextZoom = Math.min(2, Math.max(0.2, val / 100));
      setZoomValue(nextZoom);
      if (surfaceCanvasRef.current) surfaceCanvasRef.current.redraw(canvasOffsetRef.current, nextZoom);
    }
    setIsEditingZoom(false);
  };

  useEffect(() => {
    const onKD = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pendingWidget) setPendingWidget(null);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        const t = e.target as HTMLElement;
        if (t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA' && !t.isContentEditable) deleteWidget(selectedId);
      }
    };
    window.addEventListener('keydown', onKD); return () => window.removeEventListener('keydown', onKD);
  }, [selectedId, pendingWidget]);

  // Sync ghost visibility with pendingWidget
  useEffect(() => {
    if (!pendingWidget && drawGhostRef.current) {
      drawGhostRef.current.style.display = 'none';
    }
  }, [pendingWidget]);



  if (!hasMounted) return null;

  if (!activeProjectId) {
    return (
      <div className={styles.deskRoot}>
        <div className={styles.deskViewport}>
          <SurfaceCanvas ref={surfaceCanvasRef} containerRef={viewportRef} zoom={zoom} offset={canvasOffset} />
          <EmptyDeskWelcome />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.deskRoot} onWheel={(e) => {
      if (!e.ctrlKey && !e.shiftKey) return;
      e.preventDefault();
      if (zoomRafRef.current) return;
      zoomRafRef.current = requestAnimationFrame(() => {
        zoomRafRef.current = null;
        const nextZoom = Math.min(2, Math.max(0.2, zoomRef.current - e.deltaY * 0.001));
        setZoomValue(nextZoom);
        if (canvasRef.current) {
          canvasRef.current.style.transform = `translate(${canvasOffsetRef.current.x}px, ${canvasOffsetRef.current.y}px) scale(${nextZoom})`;
        }
        surfaceCanvasRef.current?.redraw(canvasOffsetRef.current, nextZoom);
      });
    }}>
      <div ref={viewportRef} className={`${styles.deskViewport} ${isPanning ? styles.deskViewportPanning : ''}`} onDragOver={e => e.preventDefault()} onDrop={handleDrop} onClick={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).className === styles.rippleCanvas) { setSelectedId(null); } }} onMouseDown={handleCanvasMouseDown}>
        <SurfaceCanvas ref={surfaceCanvasRef} containerRef={viewportRef} zoom={zoom} offset={canvasOffset} />
        
        <div className={`${styles.saveIndicator} ${isSaved ? styles.saveIndicatorActive : ''}`}>✓ Saved</div>
        
        <div ref={canvasRef} className={styles.deskCanvasInner} style={{ transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${zoom})` }}>
          {/* Ghost Box (Now inside scaled layer) */}
          <div ref={drawGhostRef} className={styles.deskDrawGhost} style={{ display: 'none', position: 'absolute', pointerEvents: 'none', zIndex: 9999 }} />
          
          {canvasWidgets.map(w => (
            <div key={w.id} id={`widget-${w.id}`} className={`${styles.deskWidget} ${selectedId === w.id ? styles.deskWidgetSelected : ''}`} style={{ left: w.x, top: w.y, width: w.width, height: w.height, zIndex: selectedId === w.id ? 50 : 1 }} onMouseDown={e => { e.stopPropagation(); setSelectedId(w.id); }}>
                <div className={styles.deskTitleBar} onMouseDown={e => handleDragStart(e, w)}>
                  <div className={styles.deskTitleBarIcon}>{PALETTE_MAP[w.type]?.icon || '❓'}</div>
                  <div className={styles.deskTitleBarLabel}>
                    {w.type === 'writingZone' ? (
                      <div className={styles.headerToolbar}>
                        <button 
                          className={`${styles.headerToolBtn} ${w.content.saveStatus === 'saved' ? styles.headerToolBtnActive : ''}`}
                          onMouseDown={e => e.stopPropagation()}
                          onClick={() => {
                            updateContentImmediate(w.id, { ...w.content, saveStatus: 'saving' });
                            triggerSave();
                            setTimeout(() => {
                              updateContentImmediate(w.id, { ...w.content, saveStatus: 'saved' });
                              setTimeout(() => updateContentImmediate(w.id, { ...w.content, saveStatus: null }), 2000);
                            }, 500);
                          }}
                          title="Save Draft (Ctrl+S)"
                          data-status={w.content.saveStatus}
                        >
                          <span className={styles.headerToolBtnSave} data-status={w.content.saveStatus}>
                            {w.content.saveStatus === 'saved' ? '✔️' : '💾'}
                          </span>
                          Save
                        </button>

                        <button 
                          className={styles.headerToolBtn}
                          onMouseDown={e => e.stopPropagation()}
                          onClick={() => updateContentImmediate(w.id, { ...w.content, showSettings: true })}
                          title="Project Settings"
                        >
                          ⚙️ Settings
                        </button>

                        <button 
                          className={`${styles.headerToolBtn} ${w.content.binderMode !== 'shown' ? styles.headerToolBtnActive : ''}`}
                          onMouseDown={e => e.stopPropagation()}
                          onClick={() => {
                            const modes: BinderMode[] = ['shown', 'smart'];
                            const next = modes[(modes.indexOf(w.content.binderMode || 'shown') + 1) % modes.length];
                            updateContentImmediate(w.id, { ...w.content, binderMode: next });
                          }}
                          title="Cycle Binder Mode"
                        >
                          <span className={styles.headerToolModeLabel}>
                            { (w.content.binderMode || 'shown').charAt(0).toUpperCase() + (w.content.binderMode || 'shown').slice(1) }
                          </span>
                        </button>
                      </div>
                    ) : (
                      <>
                        {PALETTE_MAP[w.type]?.label || 'Untyped'}
                        {w.content.isCollapsed && <span className={styles.headerStateBadge}>Min</span>}
                      </>
                    )}
                  </div>
                  
                  <div className={styles.dockedHandleDots}><span/><span/><span/></div>

                  <div className={styles.deskHeaderControls}>
                    {w.type === 'untyped' && (
                      <button className={styles.deskTypePickerTrigger} onClick={() => setTypePickerWidgetId(w.id)}>Choose</button>
                    )}

                    <button 
                      className={`${styles.deskHeaderBtn} ${w.dock ? styles.deskHeaderBtnActive : ''}`} 
                      title={w.dock ? "Unlock & Move Freely" : "Dock to Center"} 
                      onMouseDown={e => e.stopPropagation()}
                      onClick={() => updateDock(w.id, w.dock ? null : 'center')}
                    >
                      ⚓
                    </button>
                    <button 
                      className={styles.deskHeaderBtn} 
                      title={w.content.isCollapsed ? "Expand" : "Minimize"} 
                      onMouseDown={e => e.stopPropagation()}
                      onClick={() => updateContentImmediate(w.id, { ...w.content, isCollapsed: !w.content.isCollapsed })}
                    >
                      {w.content.isCollapsed ? '□' : '−'}
                    </button>
                    <button 
                      className={`${styles.deskHeaderBtn} ${styles.deskHeaderBtnClose}`} 
                      onMouseDown={e => e.stopPropagation()} 
                      onClick={() => deleteWidget(w.id)}
                      title="Close Widget"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              {!w.content.isCollapsed && (
              <div className={`${styles.deskWidgetContent} ${w.type === 'writingZone' ? styles.deskWidgetContentFull : ''}`}>
                <WidgetRenderer
                  widget={w}
                  updateContentImmediate={updateContentImmediate}
                  updateContentSilent={updateContentSilent}
                  handleDragStart={handleDragStart}
                  deleteWidget={deleteWidget}
                  updateWidgets={updateWidgets}
                  widgetsRef={widgetsRef}
                  triggerSave={triggerSave}
                  viewportRef={viewportRef}
                  onAddAtCenter={addAtCenter}
                  onDockChange={(dock) => updateDock(w.id, dock)}
                />
              </div>
              )}
              {(['n','s','e','w','ne','nw','se','sw'] as ResizeDir[]).map(dir => <div key={dir} className={`${styles.deskResizeHandle} ${styles[`deskResize${dir.toUpperCase()}` as keyof typeof styles]}`} onMouseDown={e => handleResizeStart(e, w, dir)} />)}
            </div>
          ))}
        </div>

        <div className={styles.dockedLayer}>
          <div className={styles.dockedTrack} />
          {dockedWidgets.map(w => (
            <div
              key={w.id}
              id={`widget-${w.id}`}
              className={`${styles.deskWidget} ${styles.dockedWidget} ${styles[`docked${w.dock?.charAt(0).toUpperCase()}${w.dock?.slice(1)}` as keyof typeof styles]} ${selectedId === w.id ? styles.deskWidgetSelected : ''} ${w.content.isCollapsed ? styles.dockedWidgetCollapsed : ''}`}
              style={{ width: w.width, left: w.x, zIndex: selectedId === w.id ? 50 : 5 }}
              onMouseDown={e => { e.stopPropagation(); setSelectedId(w.id); }}
            >
              <div className={styles.dockedWidgetHandle} onMouseDown={e => handleDragStart(e, w)}>
                <div className={styles.dockedHandleLabel}>
                  <span style={{ marginRight: '6px' }}>
                    {w.type !== 'writingZone' && PALETTE_MAP[w.type]?.icon}
                  </span>
                  {w.type === 'writingZone' ? (
                      <div className={styles.headerToolbar}>
                        {/* Cleanup: Settings, Visibility, and Focus icons removed for a cleaner experience */}
                      </div>
                  ) : (

                    <>
                      {PALETTE_MAP[w.type]?.label}
                      {w.content.isCollapsed && <span className={styles.headerStateBadge}>Min</span>}
                    </>
                  )}
                </div>

                <div className={styles.dockedHandleDots}><span/><span/><span/></div>

                <div className={styles.deskHeaderControls}>
                  <button 
                    className={`${styles.deskHeaderBtn} ${w.dock ? styles.deskHeaderBtnActive : ''}`} 
                    title={w.dock ? "Unlock & Move Freely" : "Dock to Center"} 
                    onMouseDown={e => e.stopPropagation()}
                    onClick={() => updateDock(w.id, w.dock ? null : 'center')}
                  >
                    ⚓
                  </button>
                  <button 
                    className={styles.deskHeaderBtn} 
                    title={w.content.isCollapsed ? "Expand" : "Minimize"} 
                    onMouseDown={e => e.stopPropagation()}
                    onClick={() => updateContentImmediate(w.id, { ...w.content, isCollapsed: !w.content.isCollapsed })}
                  >
                    {w.content.isCollapsed ? '□' : '−'}
                  </button>
                  <button 
                    className={`${styles.deskHeaderBtn} ${styles.deskHeaderBtnClose}`} 
                    onMouseDown={e => e.stopPropagation()} 
                    onClick={() => deleteWidget(w.id)}
                    title="Close Widget"
                  >
                    ✕
                  </button>
                </div>
              </div>
              {!w.content.isCollapsed && (
              <div className={`${styles.deskWidgetContent} ${w.type === 'writingZone' ? styles.deskWidgetContentFull : ''}`}>
                <WidgetRenderer
                  widget={w}
                  updateContentImmediate={updateContentImmediate}
                  updateContentSilent={updateContentSilent}
                  handleDragStart={handleDragStart}
                  deleteWidget={deleteWidget}
                  updateWidgets={updateWidgets}
                  widgetsRef={widgetsRef}
                  triggerSave={triggerSave}
                  viewportRef={viewportRef}
                  onAddAtCenter={addAtCenter}
                  onDockChange={(dock) => updateDock(w.id, dock)}
                />
              </div>
              )}
              <div className={`${styles.deskResizeHandle} ${styles.deskResizeE}`} onMouseDown={e => handleResizeStart(e, w, 'e')} />
              <div className={`${styles.deskResizeHandle} ${styles.deskResizeW}`} onMouseDown={e => handleResizeStart(e, w, 'w')} />
            </div>
          ))}
        </div>
        
        <div className={styles.deskZoomControls}>
          <button className={styles.zoomBtn} onClick={() => { setZoomValue(Math.max(0.2, zoom - 0.1)); }}>−</button>
          
          <input 
            type="range" 
            className={styles.zoomSlider} 
            min="0.2" 
            max="2" 
            step="0.01" 
            value={zoom} 
            onChange={(e) => {
              setZoomValue(parseFloat(e.target.value));
            }}
          />

          {isEditingZoom ? (
            <input
              autoFocus
              className={styles.zoomInput}
              value={zoomInputValue}
              onChange={(e) => setZoomInputValue(e.target.value)}
              onBlur={commitZoomInput}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitZoomInput();
                if (e.key === 'Escape') setIsEditingZoom(false);
              }}
            />
          ) : (
            <span 
              className={styles.zoomValue} 
              onClick={() => {
                setZoomInputValue(Math.round(zoom * 100).toString());
                setIsEditingZoom(true);
              }}
              title="Click to type zoom %"
            >
              {Math.round(zoom * 100)}%
            </span>
          )}

          <button className={styles.zoomBtn} onClick={() => { setZoomValue(Math.min(2, zoom + 0.1)); }}>+</button>
          <div className={styles.deskFmtSep} style={{ height: '16px', margin: '0 4px' }} />
          <button className={styles.fitBtn} style={{ background: 'transparent', color: 'var(--muted)', fontSize: '0.65rem' }} onClick={() => { setZoomValue(1); }}>100%</button>
          <button className={styles.fitBtn} onClick={handleFit}>Fit</button>
        </div>
      </div>

      {/* Select-Before-Create (or Upgrade) Picker */}
      {(pendingWidget || typePickerWidgetId) && (() => {
        const pickerWidth = 280;
        const pickerHeight = 240;
        const padding = 20;

        let sx = 0, sy = 0, targetId: string | null = null;

        if (pendingWidget && viewportRef.current) {
          const rect = viewportRef.current.getBoundingClientRect();
          sx = rect.left + canvasOffsetRef.current.x + (pendingWidget.x + pendingWidget.width / 2) * zoomRef.current;
          sy = rect.top + canvasOffsetRef.current.y + (pendingWidget.y + pendingWidget.height / 2) * zoomRef.current;
        } else if (typePickerWidgetId) {
          const el = document.getElementById(`widget-${typePickerWidgetId}`);
          if (el) {
            const rect = el.getBoundingClientRect();
            sx = rect.left + rect.width / 2;
            sy = rect.top + rect.height / 2;
            targetId = typePickerWidgetId;
          }
        }

        if (!sx || !sy) return null;

        // Clamp to screen
        sx = Math.max(padding + pickerWidth / 2, Math.min(window.innerWidth - padding - pickerWidth / 2, sx));
        sy = Math.max(padding + pickerHeight / 2, Math.min(window.innerHeight - padding - pickerHeight / 2, sy));

        const picker = (
          <div className={styles.typePicker} style={{ left: sx, top: sy }} onMouseDown={e => e.stopPropagation()}>
            <div className={styles.typePickerTitle}>Select widget type</div>
            <div className={styles.typePickerGrid}>{PALETTE_ITEMS.map(item => (
              <button key={item.type} className={styles.typePickerBtn} onClick={() => { 
                if (targetId) {
                  updateWidgets(widgetsRef.current.map(w => w.id === targetId ? { ...w, type: item.type } : w));
                } else if (pendingWidget) {
                  const nw: DeskWidget = {
                    id: crypto.randomUUID(),
                    type: item.type,
                    x: pendingWidget.x,
                    y: pendingWidget.y,
                    width: pendingWidget.width,
                    height: pendingWidget.height,
                    content: {},
                  };
                  updateWidgets([...widgetsRef.current, nw]);
                  setSelectedId(nw.id);
                }
                setPendingWidget(null);
                setTypePickerWidgetId(null);
              }}>
                <span className={styles.typePickerIcon}>{item.icon}</span><span className={styles.typePickerLabel}>{item.label}</span>
              </button>
            ))}</div>
            <button className={styles.typePickerCancel} onClick={() => { setPendingWidget(null); setTypePickerWidgetId(null); }}>Cancel</button>
          </div>
        );

        return createPortal(picker, document.body);
      })()}
    </div>
  );
}
