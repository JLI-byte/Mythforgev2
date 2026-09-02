"use client";

import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import styles from '../../WritingDesk.module.css';

export function StructureRenderer({ content, onChange }: { content: any; onChange: (c: any) => void; }) {
  const activeProjectId = useWorkspaceStore(s => s.activeProjectId);
  const activeSceneId = useWorkspaceStore(s => s.activeSceneId);
  const scenes = useWorkspaceStore(s => s.scenes);
  const projectScenes = useMemo(() => 
    scenes.filter(sc => sc.projectId === activeProjectId).sort((a, b) => a.order - b.order),
    [scenes, activeProjectId]
  );
  
  const [localBeats, setLocalBeats] = useState(content.beats || []);
  const lastPropBeats = useRef(content.beats);
  const beatDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (content.beats !== lastPropBeats.current) {
      setLocalBeats(content.beats || []);
      lastPropBeats.current = content.beats;
    }
  }, [content.beats]);

  useEffect(() => () => { if (beatDebounceRef.current) clearTimeout(beatDebounceRef.current); }, []);

  // Immediate flush — structural changes (add, remove, reorder, color, scene link)
  const updateBeatsImmediate = (nextBeats: any) => {
    setLocalBeats(nextBeats);
    lastPropBeats.current = nextBeats;
    onChange({ ...content, beats: nextBeats });
  };

  // Debounced flush — text inputs only (beat title)
  const updateBeatsDebounced = (nextBeats: any) => {
    setLocalBeats(nextBeats);
    lastPropBeats.current = nextBeats;
    if (beatDebounceRef.current) clearTimeout(beatDebounceRef.current);
    beatDebounceRef.current = setTimeout(() => onChange({ ...content, beats: nextBeats }), 600);
  };

  const addItem = (type: 'beat' | 'act') => {
    const newItem = { 
      id: crypto.randomUUID(), 
      type, 
      title: type === 'act' ? 'New Act' : 'New Beat', 
      color: type === 'act' ? '#6B4C9A' : '#4A6FA5',
      sceneId: ''
    };
    updateBeatsImmediate([...localBeats, newItem]);
  };

  const removeItem = (id: string) => {
    updateBeatsImmediate(localBeats.filter((b: any) => b.id !== id));
  };

  const updateItemImmediate = (id: string, updates: any) => {
    updateBeatsImmediate(localBeats.map((b: any) => b.id === id ? { ...b, ...updates } : b));
  };

  const updateItemDebounced = (id: string, updates: any) => {
    updateBeatsDebounced(localBeats.map((b: any) => b.id === id ? { ...b, ...updates } : b));
  };

  const reorderItem = (index: number, direction: 'up' | 'down') => {
    const nextBeats = [...localBeats];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= nextBeats.length) return;
    [nextBeats[index], nextBeats[target]] = [nextBeats[target], nextBeats[index]];
    updateBeatsImmediate(nextBeats);
  };

  const isCompact = content.isCompact || false;

  if (isCompact) {
    return (
      <div className={styles.structureCompact}>
        <div className={styles.actSparkline}>
          {localBeats.length === 0 ? <span className={styles.paletteHint} style={{ fontSize: '0.6875rem' }}>No structure defined</span> : 
            localBeats.map((b: any) => (
              <div 
                key={b.id} 
                className={`${styles.actSparkSeg} ${b.type === 'act' ? styles.actSparkSegActive : ''}`}
                style={b.type === 'beat' ? { height: '30%', backgroundColor: b.color } : { backgroundColor: b.color }}
                title={b.title}
              />
            ))
          }
        </div>
        <button className={styles.sceneControlCompactToggle} onClick={() => onChange({ ...content, isCompact: false })}>↙️</button>
      </div>
    );
  }

  return (
    <div className={styles.structure}>
      <div className={styles.structureHeader}>
        <div className={styles.structureControls}>
          <button className={styles.structureBtn} onClick={() => addItem('act')}>+ Act</button>
          <button className={styles.structureBtn} onClick={() => addItem('beat')}>+ Beat</button>
        </div>
        <button className={styles.sceneControlCompactToggle} onClick={() => onChange({ ...content, isCompact: true })}>↗️</button>
      </div>

      <div className={styles.structureScroll}>
        <div className={styles.beatList}>
          {localBeats.map((beat: any, idx: number) => {
            const linkedScene = projectScenes.find(s => s.id === beat.sceneId);
            const wordCount = linkedScene?.wordCount || 0;
            const target = 2000; // Default target
            const progress = Math.min(100, (wordCount / target) * 100);

            return (
              <div key={beat.id} className={`${styles.beatCard} ${beat.type === 'act' ? styles.beatCardAct : ''}`} style={beat.type === 'act' ? { borderColor: beat.color } : { borderLeft: `3px solid ${beat.color}` }}>
                <button className={styles.beatRemove} onClick={() => removeItem(beat.id)} aria-label="Remove beat"><X size={12} /></button>
                
                <div className={styles.beatCardHeader}>
                  <div className={styles.structureControls} style={{ gap: '2px', flexDirection: 'column' }}>
                    <button className={styles.beatDragHandle} style={{ fontSize: '0.6875rem', border: 'none', background: 'transparent', padding: 0 }} onClick={() => reorderItem(idx, 'up')} disabled={idx === 0} aria-label="Move beat up"><ChevronUp size={12} /></button>
                    <button className={styles.beatDragHandle} style={{ fontSize: '0.6875rem', border: 'none', background: 'transparent', padding: 0 }} onClick={() => reorderItem(idx, 'down')} disabled={idx === localBeats.length - 1} aria-label="Move beat down"><ChevronDown size={12} /></button>
                  </div>
                  <span className={styles.beatTypeIcon}>{beat.type === 'act' ? '🏛️' : '🎬'}</span>
                  <input 
                    className={styles.beatTitleInput} 
                    value={beat.title} 
                    onChange={e => updateItemDebounced(beat.id, { title: e.target.value })} 
                    placeholder="Beat Title..." 
                  />
                  <div className={styles.beatColorPicker} style={{ backgroundColor: beat.color }}>
                    <input type="color" value={beat.color} onChange={e => updateItemImmediate(beat.id, { color: e.target.value })} />
                  </div>
                </div>

                {beat.type === 'beat' && (
                  <div className={styles.beatCardBody}>
                    <div className={styles.beatDetails}>
                      <select 
                        className={styles.beatSceneSelect} 
                        value={beat.sceneId} 
                        onChange={e => updateItemImmediate(beat.id, { sceneId: e.target.value })}
                      >
                        <option value="">(Not Linked to Scene)</option>
                        {projectScenes.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                      </select>
                      {beat.sceneId && (
                        <div className={styles.pacingBarContainer} title={`${wordCount} / ${target} words`}>
                          <div className={styles.pacingBarFill} style={{ width: `${progress}%`, backgroundColor: beat.color + 'aa' }} />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
