"use client";

import { useState, useRef, useEffect, useMemo } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import styles from '../../WritingDesk.module.css';

export function SceneControlRenderer({ content, onChange }: { content: any; onChange: (c: any) => void; }) {
  const activeProjectId = useWorkspaceStore(s => s.activeProjectId);
  const scenes = useWorkspaceStore(s => s.scenes);
  const projectScenes = useMemo(() => scenes.filter(sc => sc.projectId === activeProjectId), [scenes, activeProjectId]);

  // --- Local state for debounced text inputs ---
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

  // Structural fields flush immediately
  const updateImmediate = (updates: any) => onChange({ ...content, ...updates });
  // --- End local state ---

  const statusOptions = ['Draft', 'Needs Revision', 'Locked', 'Continuity Issue'];

  const checklist = content.checklist || [];
  const toggleCheck = (id: string) => {
    updateImmediate({ checklist: checklist.map((item: any) => item.id === id ? { ...item, checked: !item.checked } : item) });
  };
  const addCheck = () => {
    const text = window.prompt("Checklist item:");
    if (text) {
      updateImmediate({ checklist: [...checklist, { id: crypto.randomUUID(), text, checked: false }] });
    }
  };
  const removeCheck = (id: string) => {
    updateImmediate({ checklist: checklist.filter((item: any) => item.id !== id) });
  };

  const isCompact = content.isCompact || false;

  if (isCompact) {
    return (
      <div className={styles.sceneControlCompact}>
        <div className={styles.sceneControlStatusPill} style={{
          backgroundColor: 
            content.status === 'Locked' ? 'rgba(74, 222, 128, 0.2)' :
            content.status === 'Needs Revision' ? 'rgba(248, 113, 113, 0.2)' :
            content.status === 'Continuity Issue' ? 'rgba(251, 191, 36, 0.2)' : 'rgba(255, 255, 255, 0.1)'
        }}>{content.status || 'Draft'}</div>
        <div className={styles.sceneControlTensionBar} title={`Tension: ${localContent.tension || 0}%`}>
          <div className={styles.sceneControlTensionFill} style={{ width: `${localContent.tension || 0}%` }} />
        </div>
        <button className={styles.sceneControlCompactToggle} onClick={() => updateImmediate({ isCompact: false })}>↙️</button>
      </div>
    );
  }

  return (
    <div className={styles.sceneControl}>
      <div className={styles.sceneControlHeader}>
        <select 
          className={styles.sceneControlStatus} 
          value={content.status || 'Draft'} 
          onChange={e => updateImmediate({ status: e.target.value })}
        >
          {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <button className={styles.sceneControlCompactToggle} onClick={() => updateImmediate({ isCompact: true })}>↗️</button>
      </div>

      <div className={styles.sceneControlScroll}>
        <div className={styles.sceneControlSection}>
          <label className={styles.sceneControlLabel}>Link to Scene</label>
          <select 
            className={styles.sceneControlSelect} 
            value={content.linkedSceneId || ''} 
            onChange={e => updateImmediate({ linkedSceneId: e.target.value })}
          >
            <option value="">(None)</option>
            {projectScenes.map((sc: any) => <option key={sc.id} value={sc.id}>{sc.title}</option>)}
          </select>
        </div>

        <div className={styles.sceneControlSection}>
          <label className={styles.sceneControlLabel}>Purpose / Objective</label>
          <textarea className={styles.sceneControlInput} value={localContent.purpose || ''} onChange={e => handleChange({ purpose: e.target.value })} placeholder="What must happen?" />
        </div>

        <div className={styles.sceneControlSection}>
          <label className={styles.sceneControlLabel}>Conflict / obstacle</label>
          <textarea className={styles.sceneControlInput} value={localContent.conflict || ''} onChange={e => handleChange({ conflict: e.target.value })} placeholder="What stands in the way?" />
        </div>

        <div className={styles.sceneControlSection}>
          <label className={styles.sceneControlLabel}>Stakes</label>
          <textarea className={styles.sceneControlInput} value={localContent.stakes || ''} onChange={e => handleChange({ stakes: e.target.value })} placeholder="Result of failure?" />
        </div>

        <div className={styles.sceneControlSection}>
          <label className={styles.sceneControlLabel}>Outcome / Change</label>
          <textarea className={styles.sceneControlInput} value={localContent.outcome || ''} onChange={e => handleChange({ outcome: e.target.value })} placeholder="Valence shift..." />
        </div>

        <div className={styles.sceneControlSection}>
          <label className={styles.sceneControlLabel}>Checklist</label>
          <div className={styles.sceneChecklist}>
            {checklist.map((item: any) => (
              <div key={item.id} className={styles.sceneCheckItem}>
                <input type="checkbox" checked={item.checked} onChange={() => toggleCheck(item.id)} />
                <span className={item.checked ? styles.sceneCheckDone : ''}>{item.text}</span>
                <button className={styles.sceneCheckRemove} onClick={() => removeCheck(item.id)}>×</button>
              </div>
            ))}
            <button className={styles.sceneCheckAdd} onClick={addCheck}>+ Add Item</button>
          </div>
        </div>

        <div className={styles.sceneControlSection}>
          <label className={styles.sceneControlLabel}>Emotional Arc</label>
          <div className={styles.sceneArcRow}>
            <input className={styles.sceneArcInput} value={localContent.emotionalArc?.start || ''} onChange={e => handleChange({ emotionalArc: { ...localContent.emotionalArc, start: e.target.value } })} placeholder="Start" />
            <span className={styles.sceneArcArrow}>→</span>
            <input className={styles.sceneArcInput} value={localContent.emotionalArc?.turn || ''} onChange={e => handleChange({ emotionalArc: { ...localContent.emotionalArc, turn: e.target.value } })} placeholder="Turn" />
            <span className={styles.sceneArcArrow}>→</span>
            <input className={styles.sceneArcInput} value={localContent.emotionalArc?.end || ''} onChange={e => handleChange({ emotionalArc: { ...localContent.emotionalArc, end: e.target.value } })} placeholder="End" />
          </div>
        </div>

        <div className={styles.sceneControlSection}>
          <div className={styles.sceneControlLabelRow}>
            <label className={styles.sceneControlLabel}>Tension</label>
            <span className={styles.sceneControlValue}>{localContent.tension || 0}%</span>
          </div>
          <input type="range" className={styles.sceneTensionSlider} min="0" max="100" value={localContent.tension || 0} onChange={e => handleChange({ tension: parseInt(e.target.value) })} />
        </div>
      </div>
    </div>
  );
}
