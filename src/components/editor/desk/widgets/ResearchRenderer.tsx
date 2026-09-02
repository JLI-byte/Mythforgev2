"use client";

import { useState, useRef, useEffect } from 'react';
import { LayoutGrid, List, Minimize2 } from 'lucide-react';
import styles from '../../WritingDesk.module.css';

export function ResearchRenderer({ content, onChange }: { content: any; onChange: (c: any) => void; }) {
  const [localItems, setLocalItems] = useState(content.items || []);
  const lastPropItems = useRef(content.items);

  // Sync local state when external content changes (e.g. from refresh or other widgets)
  useEffect(() => {
    if (content.items !== lastPropItems.current) {
      setLocalItems(content.items || []);
      lastPropItems.current = content.items;
    }
  }, [content.items]);

  // Debounce ref for free-text field flushes
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const updateContentItems = (nextItems: any) => {
    setLocalItems(nextItems);
    lastPropItems.current = nextItems;
    onChange({ ...content, items: nextItems });
  };

  const addItem = (type: 'image' | 'text' | 'link' | 'sensory') => {
    const defaultContent = type === 'sensory' ? { sight: '', sound: '', smell: '', touch: '', taste: '' } : '';
    const newItem = {
      id: crypto.randomUUID(),
      type,
      content: defaultContent,
      tags: [],
      title: type === 'image' ? 'Image Pin' : type === 'sensory' ? 'Sensory Moment' : 'Research Snippet'
    };
    updateContentItems([newItem, ...localItems]);
  };

  const removeItem = (id: string) => {
    updateContentItems(localItems.filter((i: any) => i.id !== id));
  };

  // Structural changes (tag add/remove) — immediate flush
  const updateItemImmediate = (id: string, updates: any) => {
    updateContentItems(localItems.map((i: any) => i.id === id ? { ...i, ...updates } : i));
  };

  // Free-text changes — debounced flush (updates localItems instantly, defers onChange)
  const updateItemDebounced = (id: string, updates: any) => {
    const next = localItems.map((i: any) => i.id === id ? { ...i, ...updates } : i);
    setLocalItems(next);
    lastPropItems.current = next;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange({ ...content, items: next }), 600);
  };

  const viewMode = content.viewMode || 'gallery'; 
  const isCompact = content.isCompact || false;

  if (isCompact) {
    const randomItem = localItems.length > 0 ? localItems[Math.floor(Math.random() * localItems.length)] : null;
    let sparkText = randomItem?.type === 'text' ? randomItem.content : randomItem?.type === 'sensory' ? (randomItem.content.sight || randomItem.content.sound || 'A sensory spark...') : 'A pinned inspiration';
    
    return (
      <div className={styles.researchCompact}>
        <span className={styles.researchSparkIcon}>✨</span>
        <span className={styles.researchSpark}>{sparkText || 'No inspirations found...'}</span>
        <button className={styles.sceneControlCompactToggle} onClick={() => onChange({ ...content, isCompact: false })}>↙️</button>
      </div>
    );
  }

  return (
    <div className={styles.research}>
      <div className={styles.structureHeader}>
        <div className={styles.structureControls}>
          <button className={styles.structureBtn} onClick={() => addItem('image')}>+ Image</button>
          <button className={styles.structureBtn} onClick={() => addItem('text')}>+ Text</button>
          <button className={styles.structureBtn} onClick={() => addItem('sensory')}>+ Sensory</button>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            className={styles.paletteControlBtn}
            onClick={() => onChange({ ...content, viewMode: viewMode === 'gallery' ? 'list' : 'gallery' })}
            title="Toggle Layout"
            aria-label={viewMode === 'gallery' ? 'Switch to list view' : 'Switch to gallery view'}
          >
            {viewMode === 'gallery' ? <List size={14} /> : <LayoutGrid size={14} />}
          </button>
          <button
            className={styles.sceneControlCompactToggle}
            onClick={() => onChange({ ...content, isCompact: true })}
            title="Collapse"
            aria-label="Collapse"
          >
            <Minimize2 size={14} />
          </button>
        </div>
      </div>

      <div className={styles.researchScroll}>
        <div className={viewMode === 'gallery' ? styles.moodboardGrid : styles.beatList}>
          {localItems.map((item: any) => (
            <div key={item.id} className={styles.researchCard}>
              <button className={styles.researchRemove} onClick={() => removeItem(item.id)}>×</button>
              
              {item.type === 'image' && (
                <>
                  {item.content ? (
                    <img className={styles.researchImage} src={item.content} alt="Mood" />
                  ) : (
                    <div className={styles.researchImage} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '0.6rem' }}>No URL provided</div>
                  )}
                  <input 
                    className={styles.beatTitleInput} 
                    style={{ padding: '4px 8px', fontSize: '0.65rem' }}
                    placeholder="Image URL..."
                    value={item.content}
                    onChange={e => updateItemDebounced(item.id, { content: e.target.value })}
                  />
                </>
              )}

              {item.type === 'text' && (
                <textarea 
                  className={styles.researchTextItem}
                  placeholder="Paste snippet or sensory note here..."
                  value={item.content}
                  onChange={e => updateItemDebounced(item.id, { content: e.target.value })}
                  rows={4}
                />
              )}

              {item.type === 'sensory' && (
                <div className={styles.researchSensoryGrid}>
                  {[
                    { key: 'sight', icon: '👁️', label: 'Sight' },
                    { key: 'sound', icon: '👂', label: 'Sound' },
                    { key: 'smell', icon: '👃', label: 'Smell' },
                    { key: 'touch', icon: '✋', label: 'Touch' },
                    { key: 'taste', icon: '👅', label: 'Taste' }
                  ].map(s => (
                    <div key={s.key} className={styles.researchSensoryItem}>
                      <span className={styles.researchSensoryIcon} title={s.label}>{s.icon}</span>
                      <input 
                        className={styles.beatTitleInput} 
                        style={{ fontSize: '0.65rem', padding: 0 }}
                        placeholder={`${s.label}...`}
                        value={item.content[s.key] || ''}
                        onChange={e => updateItemDebounced(item.id, { content: { ...item.content, [s.key]: e.target.value } })}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className={styles.researchTags}>
                <input 
                  className={styles.beatTitleInput}
                  style={{ fontSize: '0.55rem', opacity: 0.5 }}
                  placeholder="+ Tag"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const target = e.target as HTMLInputElement;
                      const val = target.value.trim();
                      if (val && !item.tags.includes(val)) {
                        updateItemImmediate(item.id, { tags: [...item.tags, val] });
                        target.value = '';
                      }
                    }
                  }}
                />
                {item.tags.map((tag: string) => (
                  <span key={tag} className={styles.researchTagPill} onClick={() => updateItemImmediate(item.id, { tags: item.tags.filter((t: string) => t !== tag) })}>
                    {tag} ×
                  </span>
                ))}
              </div>
            </div>
          ))}

          {localItems.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)', fontSize: '0.8rem' }}>
              Your creative vault is empty. Pin an image or capture a sensory moment to begin.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
