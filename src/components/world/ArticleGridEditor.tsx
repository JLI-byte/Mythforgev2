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

export type WidgetType = 'text' | 'heading' | 'image' | 'divider' | 'quote' | 'statblock' | 'table';

export interface GridWidget {
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  width: number;
  height: number;
  content: Record<string, any>;
}

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const CANVAS_WIDTH = 3000;
const CANVAS_HEIGHT = 2000;
const MIN_WIDTH = 120;
const MIN_HEIGHT = 60;

/** Default dimensions per widget type */
const DEFAULT_DIMS: Record<WidgetType, { width: number; height: number }> = {
  text:      { width: 360, height: 180 },
  heading:   { width: 600, height: 80  },
  image:     { width: 300, height: 300 },
  divider:   { width: 500, height: 40  },
  quote:     { width: 380, height: 160 },
  statblock: { width: 260, height: 200 },
  table:     { width: 520, height: 220 },
};

const PALETTE_ITEMS: { type: WidgetType; icon: string; label: string }[] = [
  { type: 'text',      icon: '📝', label: 'Text' },
  { type: 'heading',   icon: '🔤', label: 'Heading' },
  { type: 'image',     icon: '🖼️', label: 'Image' },
  { type: 'quote',     icon: '💬', label: 'Quote' },
  { type: 'divider',   icon: '➖', label: 'Divider' },
  { type: 'statblock', icon: '📊', label: 'Stat Block' },
  { type: 'table',     icon: '📋', label: 'Table' },
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
    default:          return {};
  }
}

function parseWidgets(raw: string | undefined): GridWidget[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as GridWidget[];
    return [];
  } catch { return []; }
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
  const entities = useWorkspaceStore(state => state.entities);
  const updateEntityDoc = useWorkspaceStore(state => state.updateEntityDoc);
  const entity = entities.find(e => e.id === entityId);

  const [widgets, setWidgets] = useState<GridWidget[]>(() => parseWidgets(entity?.articleDoc));
  const [livePositions, setLivePositions] = useState<Record<string, { x: number; y: number; width: number; height: number }>>({});
  const [saveLabel, setSaveLabel] = useState<'idle' | 'saved'>('idle');

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragCleanup = useRef<(() => void) | null>(null);
  const resizeCleanup = useRef<(() => void) | null>(null);

  const save = useCallback((ws: GridWidget[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      updateEntityDoc(entityId, JSON.stringify(ws));
      setSaveLabel('saved');
      setTimeout(() => setSaveLabel('idle'), 2000);
    }, 400);
  }, [entityId, updateEntityDoc]);

  const applyChange = useCallback((next: GridWidget[]) => {
    setWidgets(next);
    save(next);
  }, [save]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      dragCleanup.current?.();
      resizeCleanup.current?.();
    };
  }, []);

  useEffect(() => {
    setWidgets(parseWidgets(entity?.articleDoc));
  }, [entityId]);

  if (!entity) return null;

  /**
   * Handle mouse spotlight — updates CSS vars for the radial gradient mask.
   */
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mouse-x', (e.clientX - rect.left) + 'px');
    e.currentTarget.style.setProperty('--mouse-y', (e.clientY - rect.top) + 'px');
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
    const x = Math.max(0, Math.min(CANVAS_WIDTH - dims.width, e.clientX - rect.left - dims.width / 2));
    const y = Math.max(0, Math.min(CANVAS_HEIGHT - dims.height, e.clientY - rect.top - dims.height / 2));
    const newWidget: GridWidget = {
      id: crypto.randomUUID(),
      type,
      x,
      y,
      width: dims.width,
      height: dims.height,
      content: getDefaultContent(type),
    };
    applyChange([...widgets, newWidget]);
  };

  /**
   * Drag a widget by its title bar — native mouse events for smooth movement.
   */
  const handleDragStart = (e: React.MouseEvent, widget: GridWidget) => {
    e.preventDefault();
    e.stopPropagation();

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startX = widget.x;
    const startY = widget.y;

    const onMouseMove = (mv: MouseEvent) => {
      const newX = Math.max(0, Math.min(CANVAS_WIDTH - widget.width, startX + mv.clientX - startMouseX));
      const newY = Math.max(0, Math.min(CANVAS_HEIGHT - widget.height, startY + mv.clientY - startMouseY));
      setLivePositions(prev => ({ ...prev, [widget.id]: { x: newX, y: newY, width: widget.width, height: widget.height } }));
    };

    const onMouseUp = (up: MouseEvent) => {
      const newX = Math.max(0, Math.min(CANVAS_WIDTH - widget.width, startX + up.clientX - startMouseX));
      const newY = Math.max(0, Math.min(CANVAS_HEIGHT - widget.height, startY + up.clientY - startMouseY));
      applyChange(widgets.map(w => w.id === widget.id ? { ...w, x: newX, y: newY } : w));
      setLivePositions(prev => { const n = { ...prev }; delete n[widget.id]; return n; });
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

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const { x: startX, y: startY, width: startW, height: startH } = widget;

    const compute = (mx: number, my: number) => {
      const dx = mx - startMouseX;
      const dy = my - startMouseY;
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
      setLivePositions(prev => ({ ...prev, [widget.id]: next }));
    };

    const onMouseUp = (up: MouseEvent) => {
      const next = compute(up.clientX, up.clientY);
      applyChange(widgets.map(w => w.id === widget.id ? { ...w, ...next } : w));
      setLivePositions(prev => { const n = { ...prev }; delete n[widget.id]; return n; });
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

      {/* ---- Canvas viewport ---- */}
      <div className={styles.canvasViewport}>
        <div className={styles.saveIndicator}>{saveLabel === 'saved' ? '✓ Saved' : ''}</div>

        {/* Canvas surface */}
        <div
          ref={canvasRef}
          className={styles.canvasInner}
          onMouseMove={handleCanvasMouseMove}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleCanvasDrop}
        >
          {widgets.map(widget => {
            const live = livePositions[widget.id];
            const pos = live ?? { x: widget.x, y: widget.y, width: widget.width, height: widget.height };
            const isDragging = !!live;

            return (
              <div
                key={widget.id}
                data-widget-id={widget.id}
                className={styles.widgetWrapper}
                style={{
                  left: pos.x,
                  top: pos.y,
                  width: pos.width,
                  height: pos.height,
                  zIndex: isDragging ? 100 : 1,
                  boxShadow: isDragging ? '0 16px 48px rgba(0,0,0,0.6)' : undefined,
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
                    onClick={() => applyChange(deleteWidgetById(widgets, widget.id))}
                    title="Delete widget"
                  >×</button>
                </div>

                {/* Widget content */}
                <div className={styles.widgetContent}>
                  <WidgetRenderer
                    widget={widget}
                    onChange={(content) => applyChange(updateWidgetContent(widgets, widget.id, content))}
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
