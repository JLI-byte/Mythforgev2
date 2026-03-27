/**
 * ArticleCanvas — Full-screen freeform canvas editor.
 *
 * Sprint 51: 2D canvas with absolute block positioning, dot-grid background,
 * mouse spotlight, drag-to-move blocks, and drop-from-panel placement.
 */
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from './ArticleCanvas.module.css';
import { useWorkspaceStore, ArticleBlock, BlockType } from '@/store/workspaceStore';
import TemplatePanel from './TemplatePanel';
import BlockToolPanel from './BlockToolPanel';

/** Default block dimensions on the canvas */
const DEFAULT_BLOCK_WIDTH = 340;
const CANVAS_WIDTH = 3000;
const CANVAS_HEIGHT = 2000;

interface ArticleCanvasProps {
  entityId: string;
  onClose: () => void;
}

export default function ArticleCanvas({ entityId, onClose }: ArticleCanvasProps) {
  const entities = useWorkspaceStore(state => state.entities);
  const updateEntityArticle = useWorkspaceStore(state => state.updateEntityArticle);

  const entity = entities.find(e => e.id === entityId);
  const blocks: ArticleBlock[] = entity?.articleBlocks || [];

  // UI state
  const [isAddPopoverOpen, setIsAddPopoverOpen] = useState(false);
  const [isTemplatePanelOpen, setIsTemplatePanelOpen] = useState(false);

  // In-flight positions during block drag (not committed to store until mouseup)
  const [livePositions, setLivePositions] = useState<Record<string, { x: number; y: number }>>({});

  // Refs
  const dragCleanup = useRef<(() => void) | null>(null);
  const resizeCleanup = useRef<(() => void) | null>(null);

  /** Initialize empty canvas with one text block */
  useEffect(() => {
    if (entity && (!entity.articleBlocks || entity.articleBlocks.length === 0)) {
      const initialBlock: ArticleBlock = {
        id: crypto.randomUUID(),
        type: 'richtext',
        x: 40,
        y: 40,
        content: { html: '' },
      };
      updateEntityArticle(entityId, [initialBlock]);
    }
  }, [entity, entityId, updateEntityArticle]);

  /** Add a block via the popover button — places in a loose grid pattern */
  const addBlock = (type: BlockType) => {
    const col = blocks.length % 3;
    const row = Math.floor(blocks.length / 3);
    const newBlock: ArticleBlock = {
      id: crypto.randomUUID(),
      type,
      x: 40 + col * (DEFAULT_BLOCK_WIDTH + 20),
      y: 40 + row * 260,
      content: type === 'timeline' ? { events: [] } : {},
    };
    updateEntityArticle(entityId, [...blocks, newBlock]);
    setIsAddPopoverOpen(false);
  };

  /** Delete a block by id */
  const deleteBlock = (id: string) => {
    updateEntityArticle(entityId, blocks.filter(b => b.id !== id));
  };

  /** Update a block's content fields */
  const updateBlockContent = (id: string, content: Record<string, unknown>) => {
    updateEntityArticle(entityId, blocks.map(b =>
      b.id === id ? { ...b, content: { ...b.content, ...content } } : b
    ));
  };

  /**
   * Mouse spotlight — updates --mouse-x and --mouse-y CSS vars on the canvas element.
   * The ::before pseudo-element in CSS reads these to render the radial gradient.
   */
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mouse-x', (e.clientX - rect.left) + 'px');
    e.currentTarget.style.setProperty('--mouse-y', (e.clientY - rect.top) + 'px');
  };

  /**
   * Drop handler for tool panel drags onto the canvas.
   * Reads the block-type from dataTransfer and places the block at drop coordinates.
   */
  const handleCanvasDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const blockType = e.dataTransfer.getData('block-type');
    if (!blockType) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, e.clientX - rect.left - DEFAULT_BLOCK_WIDTH / 2);
    const y = Math.max(0, e.clientY - rect.top - 40);
    const newBlock: ArticleBlock = {
      id: crypto.randomUUID(),
      type: blockType as BlockType,
      x,
      y,
      content: blockType === 'timeline' ? { events: [] } : {},
    };
    updateEntityArticle(entityId, [...blocks, newBlock]);
  };

  /**
   * Begin dragging a block by its drag bar.
   * Uses native mouse events (not HTML5 drag API) for pixel-perfect freeform movement.
   */
  const handleBlockDragStart = (
    e: React.MouseEvent,
    block: ArticleBlock,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startBlockX = block.x;
    const startBlockY = block.y;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startMouseX;
      const dy = moveEvent.clientY - startMouseY;
      const newX = Math.max(0, Math.min(CANVAS_WIDTH - DEFAULT_BLOCK_WIDTH, startBlockX + dx));
      const newY = Math.max(0, Math.min(CANVAS_HEIGHT - 60, startBlockY + dy));
      setLivePositions(prev => ({ ...prev, [block.id]: { x: newX, y: newY } }));
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      const dx = upEvent.clientX - startMouseX;
      const dy = upEvent.clientY - startMouseY;
      const newX = Math.max(0, Math.min(CANVAS_WIDTH - DEFAULT_BLOCK_WIDTH, startBlockX + dx));
      const newY = Math.max(0, Math.min(CANVAS_HEIGHT - 60, startBlockY + dy));
      // Commit to store
      updateEntityArticle(entityId, blocks.map(b =>
        b.id === block.id ? { ...b, x: newX, y: newY } : b
      ));
      // Clear live position
      setLivePositions(prev => {
        const next = { ...prev };
        delete next[block.id];
        return next;
      });
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
   * Begin resizing a block from the bottom-right handle.
   */
  const handleResizeStart = (
    e: React.MouseEvent,
    block: ArticleBlock,
    wrapperEl: HTMLDivElement,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const startW = wrapperEl.offsetWidth;
    const startH = wrapperEl.offsetHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newW = Math.max(200, startW + (moveEvent.clientX - startX));
      const newH = Math.max(60, startH + (moveEvent.clientY - startY));
      wrapperEl.style.width = newW + 'px';
      wrapperEl.style.height = newH + 'px';
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      const newW = Math.max(200, startW + (upEvent.clientX - startX));
      const newH = Math.max(60, startH + (upEvent.clientY - startY));
      updateEntityArticle(entityId, blocks.map(b =>
        b.id === block.id ? { ...b, width: newW, height: newH } : b
      ));
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

  // Cleanup mouse listeners on unmount
  useEffect(() => {
    return () => {
      dragCleanup.current?.();
      resizeCleanup.current?.();
    };
  }, []);

  if (!entity) return null;

  return (
    <div className={styles.overlay}>
      {/* ---- Header ---- */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.entityLabel}>{entity.name}</span>
        </div>

        {/* ArticleCanvas is always Builder mode — the Writer/Document/Builder toggle lives in ArticleReadView */}

        <div className={styles.headerRight}>
          <button
            className={styles.templateBtn}
            onClick={() => setIsTemplatePanelOpen(p => !p)}
          >
            🗂 Templates
          </button>
          <div className={styles.popoverWrapper}>
            <button
              className={styles.addBlockBtn}
              onClick={() => setIsAddPopoverOpen(p => !p)}
            >
              ＋ Add Block
            </button>
            {isAddPopoverOpen && (
              <div className={styles.popover}>
                <button onClick={() => addBlock('richtext')}>📝 Rich Text</button>
                <button onClick={() => addBlock('image')}>🖼️ Image</button>
                <button onClick={() => addBlock('statrow')}>📊 Stat Row</button>
                <button onClick={() => addBlock('divider')}>➖ Divider</button>
                <button onClick={() => addBlock('quote')}>💬 Quote</button>
                <button onClick={() => addBlock('timeline')}>⏳ Timeline</button>
              </div>
            )}
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
      </header>

      {/* ---- Body ---- */}
      <div className={styles.bodyRow}>
        {/* Left tool panel — Builder mode only */}
        <BlockToolPanel />

        {/* Canvas viewport */}
        <div className={styles.canvasViewport}>
          {/* Canvas surface */}
          <div
            className={styles.canvasArea}
            onMouseMove={handleCanvasMouseMove}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleCanvasDrop}
          >
            {blocks.map(block => {
              const pos = livePositions[block.id] ?? { x: block.x, y: block.y };
              const isDragging = !!livePositions[block.id];
              return (
                <div
                  key={block.id}
                  className={styles.blockWrapper}
                  style={{
                    left: pos.x,
                    top: pos.y,
                    width: block.width ?? DEFAULT_BLOCK_WIDTH,
                    height: block.height ?? undefined,
                    boxShadow: isDragging
                      ? '0 16px 48px rgba(0,0,0,0.6)'
                      : undefined,
                    zIndex: isDragging ? 10 : 1,
                  }}
                >
                  {/* Drag bar — Builder mode only */}
                  <div
                      className={styles.blockDragBar}
                      onMouseDown={(e) => handleBlockDragStart(e, block)}
                    >
                      <span className={styles.blockDragBarIcon}>
                        ⠿ {block.type}
                      </span>
                      <button
                        className={styles.blockDragBarDelete}
                        onClick={() => deleteBlock(block.id)}
                        title="Delete block"
                      >
                        ×
                      </button>
                    </div>

                  {/* Block content */}
                  <div className={styles.blockContent}>
                    <BlockRenderer
                      block={block}
                      onChange={(content) => updateBlockContent(block.id, content)}
                    />
                  </div>

                  {/* Resize handle — Builder mode only */}
                  <div
                      className={styles.resizeHandle}
                      onMouseDown={(e) => {
                        const wrapper = e.currentTarget.closest(`.${styles.blockWrapper}`) as HTMLDivElement;
                        if (wrapper) handleResizeStart(e, block, wrapper);
                      }}
                      title="Drag to resize"
                    />
                </div>
              );
            })}
          </div>
        </div>

        {/* Template panel */}
        {isTemplatePanelOpen && (
          <TemplatePanel
            currentBlocks={blocks}
            entityId={entityId}
            onClose={() => setIsTemplatePanelOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Routes block rendering to the correct sub-component by type.
 */
function BlockRenderer({ block, onChange }: {
  block: ArticleBlock;
  onChange: (content: Record<string, unknown>) => void;
}) {
  switch (block.type) {
    case 'richtext': return <RichTextBlock content={block.content} onChange={onChange} />;
    case 'image':    return <ImageBlock content={block.content} onChange={onChange} />;
    case 'statrow':  return <StatRowBlock content={block.content} onChange={onChange} />;
    case 'divider':  return <div className={styles.dividerBlock}><hr /></div>;
    case 'quote':    return <QuoteBlock content={block.content} onChange={onChange} />;
    case 'timeline': return <TimelineBlock content={block.content} onChange={onChange} />;
    default:         return null;
  }
}

/** Rich text block — contentEditable with placeholder */
function RichTextBlock({ content, onChange }: {
  content: Record<string, unknown>;
  onChange: (c: Record<string, unknown>) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = (content.html as string) || '';
  }, []);
  return (
    <div
      ref={ref}
      className={styles.richtextBlock}
      contentEditable
      suppressContentEditableWarning
      onBlur={() => { if (ref.current) onChange({ html: ref.current.innerHTML }); }}
      data-placeholder="Start writing lore..."
    />
  );
}

/** Image block — upload or URL with caption */
function ImageBlock({ content, onChange }: {
  content: Record<string, unknown>;
  onChange: (c: Record<string, unknown>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === 'string') onChange({ src: reader.result }); };
    reader.readAsDataURL(file);
  };
  return (
    <div className={styles.imageBlock}>
      {content.src ? (
        <div className={styles.imagePresenter}>
          <img src={content.src as string} alt="Article visual" />
          <input
            type="text"
            placeholder="Add a caption..."
            value={(content.caption as string) || ''}
            className={styles.captionInput}
            onChange={(e) => onChange({ ...content, caption: e.target.value })}
          />
        </div>
      ) : (
        <div className={styles.uploadPlaceholder} onClick={() => fileRef.current?.click()}>
          📷 Click to upload image
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
    </div>
  );
}

/** Stat row — label | value */
function StatRowBlock({ content, onChange }: {
  content: Record<string, unknown>;
  onChange: (c: Record<string, unknown>) => void;
}) {
  return (
    <div className={styles.statrowBlock}>
      <input type="text" placeholder="Label" value={(content.label as string) || ''}
        className={styles.statLabel}
        onChange={(e) => onChange({ ...content, label: e.target.value })} />
      <div className={styles.statSeparator} />
      <input type="text" placeholder="Value" value={(content.value as string) || ''}
        className={styles.statValue}
        onChange={(e) => onChange({ ...content, value: e.target.value })} />
    </div>
  );
}

/** Quote block — text + attribution */
function QuoteBlock({ content, onChange }: {
  content: Record<string, unknown>;
  onChange: (c: Record<string, unknown>) => void;
}) {
  return (
    <div className={styles.quoteBlock}>
      <textarea placeholder="The spoken or written lore..."
        value={(content.text as string) || ''}
        className={styles.quoteText}
        onChange={(e) => onChange({ ...content, text: e.target.value })} />
      <div className={styles.quoteAttributionLine}>
        <span className={styles.emDash}>—</span>
        <input type="text" placeholder="Attribution"
          value={(content.attribution as string) || ''}
          className={styles.quoteSource}
          onChange={(e) => onChange({ ...content, attribution: e.target.value })} />
      </div>
    </div>
  );
}

/** Timeline block — list of dated events */
function TimelineBlock({ content, onChange }: {
  content: Record<string, unknown>;
  onChange: (c: Record<string, unknown>) => void;
}) {
  const events = (content.events as { date: string; label: string; detail: string }[]) || [];
  const updateEvent = (idx: number, updates: Partial<typeof events[0]>) => {
    const next = [...events];
    next[idx] = { ...next[idx], ...updates };
    onChange({ ...content, events: next });
  };
  return (
    <div className={styles.timelineBlock}>
      {events.map((ev, idx) => (
        <div key={idx} className={styles.timelineEvent}>
          <div className={styles.timelineSidebar}>
            <div className={styles.timelineDot} />
            <div className={styles.timelineLine} />
          </div>
          <div className={styles.eventContent}>
            <div className={styles.eventPrimary}>
              <input type="text" placeholder="Date" value={ev.date}
                className={styles.eventDate}
                onChange={(e) => updateEvent(idx, { date: e.target.value })} />
              <input type="text" placeholder="Event Title" value={ev.label}
                className={styles.eventLabel}
                onChange={(e) => updateEvent(idx, { label: e.target.value })} />
              <button className={styles.removeEventBtn}
                onClick={() => onChange({ ...content, events: events.filter((_, i) => i !== idx) })}>
                ×
              </button>
            </div>
            <textarea placeholder="Details..." value={ev.detail}
              className={styles.eventDetail}
              onChange={(e) => updateEvent(idx, { detail: e.target.value })} />
          </div>
        </div>
      ))}
      <button className={styles.addEventBtn}
        onClick={() => onChange({ ...content, events: [...events, { date: '', label: '', detail: '' }] })}>
        ＋ Add Event
      </button>
    </div>
  );
}
