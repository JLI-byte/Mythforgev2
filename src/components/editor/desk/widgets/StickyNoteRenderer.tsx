"use client";

import { useState, useRef, useEffect } from 'react';
import { STICKY_COLORS } from '../deskConstants';
import styles from '../../WritingDesk.module.css';

export function StickyNoteRenderer({ content, onChange, onChangeImmediate }: { content: any; onChange: (c: any) => void; onChangeImmediate?: (c: any) => void; }) {
  const [localContent, setLocalContent] = useState(content);
  const lastPropContent = useRef(content);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (content !== lastPropContent.current) {
      setLocalContent(content);
      lastPropContent.current = content;
    }
  }, [content]);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const handleChange = (updates: Record<string, any>) => {
    const next = { ...localContent, ...updates };
    setLocalContent(next);
    lastPropContent.current = next;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(next), 600);
  };

  const handleImmediate = (updates: Record<string, any>) => {
    const next = { ...localContent, ...updates };
    setLocalContent(next);
    lastPropContent.current = next;
    onChange(next);
  };

  const color = localContent.color || 'yellow';
  return (
    <div className={styles.stickyNote} style={{ background: STICKY_COLORS[color] }}>
      <div className={styles.stickyColorBar}>
        {Object.entries(STICKY_COLORS).map(([name, hex]) => (
          <button key={name} className={`${styles.stickyColorDot} ${color === name ? styles.stickyColorDotActive : ''}`} style={{ background: hex }} onClick={() => handleImmediate({ color: name })} />
        ))}
      </div>
      <textarea className={styles.stickyTextarea} placeholder="Write a note..." value={localContent.text || ''} onChange={e => handleChange({ text: e.target.value })} />
    </div>
  );
}
