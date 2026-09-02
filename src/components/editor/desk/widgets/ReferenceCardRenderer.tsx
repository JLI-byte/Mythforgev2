"use client";

import { useState, useRef, useEffect } from 'react';
import styles from '../../WritingDesk.module.css';

export function ReferenceCardRenderer({ content, onChange }: { content: any; onChange: (c: any) => void; }) {
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

  return (
    <div className={styles.referenceCard}>
      <input aria-label="Reference title" className={styles.referenceTitle} placeholder="Title..." value={localContent.title || ''} onChange={e => handleChange({ title: e.target.value })} />
      <textarea aria-label="Reference notes" className={styles.referenceBody} placeholder="Notes..." value={localContent.body || ''} onChange={e => handleChange({ body: e.target.value })} />
    </div>
  );
}
