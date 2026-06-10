"use client";

import React, { useState, useRef, useEffect } from 'react';
import styles from '../../WritingDesk.module.css';

export function ImagePinRenderer({ content, onChange, onChangeImmediate }: { content: any; onChange: (c: any) => void; onChangeImmediate?: (c: any) => void; }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const labelDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [localLabel, setLocalLabel] = useState(content.label || '');
  const [localRotation, setLocalRotation] = useState(content.rotation ?? 0);
  const lastPropLabel = useRef(content.label);
  const lastPropRotation = useRef(content.rotation);

  useEffect(() => {
    if (content.label !== lastPropLabel.current) {
      setLocalLabel(content.label || '');
      lastPropLabel.current = content.label;
    }
    if (content.rotation !== lastPropRotation.current) {
      setLocalRotation(content.rotation ?? 0);
      lastPropRotation.current = content.rotation;
    }
  }, [content.label, content.rotation]);

  useEffect(() => () => { if (labelDebounceRef.current) clearTimeout(labelDebounceRef.current); }, []);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => (onChangeImmediate ?? onChange)({ ...content, src: reader.result });
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className={styles.imagePin} style={{ transform: `rotate(${localRotation}deg)` }}>
      {content.src ? (
        <>
          <div className={styles.imagePinImgWrap} onMouseDown={e => e.stopPropagation()}>
            <img src={content.src} className={styles.imagePinImg} />
          </div>
          <div className={styles.imagePinControls} onMouseDown={e => e.stopPropagation()}>
            <input
              className={styles.imagePinLabel}
              placeholder="Caption..."
              value={localLabel}
              onChange={e => {
                const val = e.target.value;
                setLocalLabel(val);
                lastPropLabel.current = val;
                if (labelDebounceRef.current) clearTimeout(labelDebounceRef.current);
                labelDebounceRef.current = setTimeout(() => onChange({ ...content, label: val }), 600);
              }}
            />
            <div className={styles.imagePinRotateRow}>
              <input
                type="range" min={-15} max={15} step={1}
                value={localRotation}
                className={styles.imagePinRotateSlider}
                onChange={e => {
                  const val = parseInt(e.target.value);
                  setLocalRotation(val);
                  lastPropRotation.current = val;
                  if (labelDebounceRef.current) clearTimeout(labelDebounceRef.current);
                  labelDebounceRef.current = setTimeout(() => onChange({ ...content, rotation: val }), 300);
                }}
              />
            </div>
          </div>
        </>
      ) : <div className={styles.imagePinUpload} onClick={() => fileRef.current?.click()}><span>🖼️</span><span>Click to pin image</span></div>}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
    </div>
  );
}
