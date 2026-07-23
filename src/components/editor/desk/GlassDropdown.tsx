"use client";

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './GlassDropdown.module.css';

/**
 * GlassDropdown — a custom replacement for native <select> whose OPEN list
 * is a frosted glass panel (native option popups are OS-rendered and can't
 * be made translucent). Panel portals to <body> so widget overflow can't
 * clip it. Selection uses onMouseDown+preventDefault so the TipTap editor
 * keeps focus, mirroring the toolbar's format buttons.
 */

export interface GlassDropdownOption {
  value: string;
  label: string;
}

interface GlassDropdownProps {
  options: GlassDropdownOption[];
  value: string;
  onChange: (value: string) => void;
  /** Fixed trigger width in px (otherwise sizes to content) */
  width?: number;
  title?: string;
}

export function GlassDropdown({ options, value, onChange, width, title }: GlassDropdownProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.value === value);

  const openPanel = () => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 130) });
    setHighlight(Math.max(0, options.findIndex(o => o.value === value)));
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      if (triggerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      else if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, options.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const o = options[highlight];
        if (o) { onChange(o.value); setOpen(false); }
      }
    };
    // The panel is fixed-positioned; any scroll/resize invalidates its anchor.
    const onAnchorMove = () => setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onAnchorMove);
    window.addEventListener('scroll', onAnchorMove, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onAnchorMove);
      window.removeEventListener('scroll', onAnchorMove, true);
    };
  }, [open, options, highlight, onChange]);

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={styles.trigger}
        style={width ? { width } : undefined}
        title={title}
        onMouseDown={e => {
          e.preventDefault(); // keep the editor focused
          if (open) setOpen(false); else openPanel();
        }}
      >
        <span className={styles.triggerLabel}>{selected?.label ?? value}</span>
        <span className={styles.chevron}>▾</span>
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          className={styles.panel}
          style={{ top: pos.top, left: pos.left, minWidth: pos.width }}
          role="listbox"
        >
          {options.map((o, i) => (
            <div
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={`${styles.item} ${i === highlight ? styles.itemHighlight : ''} ${o.value === value ? styles.itemSelected : ''}`}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={e => { e.preventDefault(); onChange(o.value); setOpen(false); }}
            >
              {o.label}
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
