"use client";

import React, { useRef, useEffect } from 'react';
import styles from '../../ArticleGridEditor.module.css';
import { sanitizeHtml } from '@/lib/sanitize';

export function UntypedWidget() {
  return (
    <div className={styles.untypedWidget}>
      <span className={styles.untypedHint}>Click "Choose type" above to set widget type</span>
    </div>
  );
}

export function TextWidget({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) { const clean = sanitizeHtml(content.html || ''); if (ref.current.innerHTML !== clean) ref.current.innerHTML = clean; } }, []);
  return <div ref={ref} className={styles.textWidget} contentEditable suppressContentEditableWarning onBlur={() => { if (ref.current) onChange({ html: ref.current.innerHTML }); }} data-placeholder="Start writing..." />;
}

export function HeadingWidget({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  return (
    <div className={styles.headingWidget}>
      <select className={styles.headingLevel} value={content.level || 2} onChange={(e) => onChange({ ...content, level: parseInt(e.target.value) })}>
        <option value={1}>H1</option><option value={2}>H2</option><option value={3}>H3</option>
      </select>
      <input className={styles.headingText} type="text" placeholder="Heading text..." value={content.text || ''} onChange={(e) => onChange({ ...content, text: e.target.value })} onBlur={(e) => onChange({ ...content, text: e.target.value })} />
    </div>
  );
}

export function ImageWidget({ content, onChange }: { content: any; onChange: (c: any) => void }) {
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

export function DividerWidget() { return <hr className={styles.dividerWidget} />; }

export function QuoteWidget({ content, onChange }: { content: any; onChange: (c: any) => void }) {
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
