"use client";

import React, { useRef } from 'react';
import { X } from 'lucide-react';
import styles from '../../ArticleGridEditor.module.css';

export function StatBlockWidget({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const rows: { label: string; value: string }[] = content.rows || [{ label: '', value: '' }];
  const updateRow = (i: number, field: 'label' | 'value', val: string) => {
    const next = [...rows]; next[i] = { ...next[i], [field]: val }; onChange({ ...content, rows: next });
  };
  return (
    <div className={styles.statBlock}>
      {rows.map((row, i) => (
        <div key={i} className={styles.statRow}>
          <input className={styles.statLabel} type="text" placeholder="Label" value={row.label} onChange={(e) => updateRow(i, 'label', e.target.value)} />
          <input className={styles.statValue} type="text" placeholder="Value" value={row.value} onChange={(e) => updateRow(i, 'value', e.target.value)} />
          <button className={styles.statDelete} onClick={() => onChange({ ...content, rows: rows.filter((_, j) => j !== i) })} aria-label="Remove row"><X size={14} /></button>
        </div>
      ))}
      <button className={styles.statAdd} onClick={() => onChange({ ...content, rows: [...rows, { label: '', value: '' }] })}>+ Add Row</button>
    </div>
  );
}

export function TableWidget({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const headers: string[] = content.headers || ['Column 1', 'Column 2'];
  const rows: string[][] = content.rows || [['', '']];
  return (
    <div className={styles.tableWidget}>
      <table className={styles.table}>
        <thead><tr>{headers.map((h, i) => (<th key={i}><input className={styles.tableCell} value={h} onChange={(e) => { const next = [...headers]; next[i] = e.target.value; onChange({ ...content, headers: next }); }} /></th>))}</tr></thead>
        <tbody>{rows.map((row, ri) => (<tr key={ri}>{row.map((cell, ci) => (<td key={ci}><input className={styles.tableCell} value={cell} onChange={(e) => { const next = rows.map(r => [...r]); next[ri][ci] = e.target.value; onChange({ ...content, rows: next }); }} /></td>))}</tr>))}</tbody>
      </table>
      <button className={styles.tableAddRow} onClick={() => onChange({ ...content, rows: [...rows, headers.map(() => '')] })}>+ Add Row</button>
    </div>
  );
}

export function GalleryWidget({ content, onChange }: { content: any; onChange: (c: any) => void }) {
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
        newImages.push({ id: crypto.randomUUID(), src: typeof reader.result === 'string' ? reader.result : '', caption: '' });
        loaded++;
        if (loaded === files.length) onChange({ ...content, images: [...images, ...newImages] });
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };
  return (
    <div className={styles.galleryWidget}>
      <div className={styles.galleryGrid}>
        {images.map(img => (
          <div key={img.id} className={styles.galleryCell}>
            <div className={styles.galleryCellImageWrap}>
              <img src={img.src} alt={img.caption} className={styles.galleryCellImage} />
              <button className={styles.galleryCellRemove} onClick={() => onChange({ ...content, images: images.filter(i => i.id !== img.id) })} title="Remove" aria-label="Remove image"><X size={12} /></button>
            </div>
            <input className={styles.galleryCellCaption} type="text" placeholder="Caption..." value={img.caption} onChange={e => onChange({ ...content, images: images.map(i => i.id === img.id ? { ...i, caption: e.target.value } : i) })} />
          </div>
        ))}
      </div>
      <button className={styles.galleryAddBtn} onClick={() => fileRef.current?.click()}>+ Add Images</button>
      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFiles} />
    </div>
  );
}
