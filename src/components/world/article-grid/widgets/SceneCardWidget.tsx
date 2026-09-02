"use client";

import { useId } from 'react';
import styles from '../../ArticleGridEditor.module.css';

export function SceneCardWidget({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const fieldId = useId();
  const CARD_COLORS = ['#4A6FA5', '#6B4C9A', '#2E8B57', '#C0392B', '#D46A1A', '#1A7A8A', '#555'];
  const color: string = content.color || '#4A6FA5';

  const field = (key: string, placeholder: string, multiline = false) => {
    if (multiline) {
      return (
        <textarea
          id={`${fieldId}-${key}`}
          className={styles.sceneCardTextarea}
          placeholder={placeholder}
          value={content[key] || ''}
          onChange={e => onChange({ ...content, [key]: e.target.value })}
          rows={2}
        />
      );
    }
    return (
      <input
        id={`${fieldId}-${key}`}
        className={styles.sceneCardInput}
        placeholder={placeholder}
        value={content[key] || ''}
        onChange={e => onChange({ ...content, [key]: e.target.value })}
      />
    );
  };

  return (
    <div className={styles.sceneCardWidget} style={{ borderTopColor: color }}>
      {/* Color strip + title */}
      <div className={styles.sceneCardHeader} style={{ background: color + '22' }}>
        <input
          className={styles.sceneCardTitle}
          aria-label="Scene title"
          placeholder="Scene title..."
          value={content.title || ''}
          onChange={e => onChange({ ...content, title: e.target.value })}
        />
        <div className={styles.sceneCardColorRow}>
          {CARD_COLORS.map(c => (
            <button
              key={c}
              className={`${styles.sceneCardColorDot} ${color === c ? styles.sceneCardColorDotActive : ''}`}
              style={{ background: c }}
              onClick={() => onChange({ ...content, color: c })}
            />
          ))}
        </div>
      </div>

      <div className={styles.sceneCardBody}>
        <div className={styles.sceneCardRow}>
          <div className={styles.sceneCardField}>
            <label className={styles.sceneCardLabel} htmlFor={`${fieldId}-chapter`}>Chapter</label>
            {field('chapter', 'Ch. 1')}
          </div>
          <div className={styles.sceneCardField}>
            <label className={styles.sceneCardLabel} htmlFor={`${fieldId}-pov`}>POV</label>
            {field('pov', 'Character name')}
          </div>
        </div>

        <div className={styles.sceneCardField}>
          <label className={styles.sceneCardLabel} htmlFor={`${fieldId}-setting`}>Setting</label>
          {field('setting', 'Where & when')}
        </div>

        <div className={styles.sceneCardField}>
          <label className={styles.sceneCardLabel} htmlFor={`${fieldId}-goal`}>Goal</label>
          {field('goal', "What does the POV character want?", true)}
        </div>

        <div className={styles.sceneCardField}>
          <label className={styles.sceneCardLabel} htmlFor={`${fieldId}-conflict`}>Conflict</label>
          {field('conflict', "What stands in the way?", true)}
        </div>

        <div className={styles.sceneCardField}>
          <label className={styles.sceneCardLabel} htmlFor={`${fieldId}-outcome`}>Outcome</label>
          {field('outcome', "Yes/No/Yes-but/No-and...")}
        </div>

        <div className={styles.sceneCardField}>
          <label className={styles.sceneCardLabel} htmlFor={`${fieldId}-notes`}>Notes</label>
          {field('notes', 'Additional notes...', true)}
        </div>
      </div>
    </div>
  );
}
