"use client";

import { useState, useRef, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { safeHref } from '@/lib/safeUrl';
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

  // Whatever the writer typed, judged before it is ever an href. Null means
  // there is nothing safe to link to, and the row renders as plain text.
  const href = safeHref(localContent.url);

  return (
    <div className={styles.referenceCard}>
      <input aria-label="Reference title" className={styles.referenceTitle} placeholder="Title..." value={localContent.title || ''} onChange={e => handleChange({ title: e.target.value })} />
      <div className={styles.referenceUrlRow}>
        <input
          aria-label="Reference URL"
          className={styles.referenceUrl}
          type="url"
          inputMode="url"
          placeholder="https://..."
          value={localContent.url || ''}
          onChange={e => handleChange({ url: e.target.value })}
        />
        {href && (
          <a
            className={styles.referenceOpen}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${localContent.title?.trim() || href} in a new tab`}
            title="Open in a new tab"
            onMouseDown={e => e.stopPropagation()}
          >
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        )}
      </div>
      <textarea aria-label="Reference notes" className={styles.referenceBody} placeholder="Notes..." value={localContent.body || ''} onChange={e => handleChange({ body: e.target.value })} />
    </div>
  );
}
