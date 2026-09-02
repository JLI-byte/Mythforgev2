"use client";

import { useState, useRef, useEffect, useId, useMemo } from 'react';
import { Maximize2, Minimize2, X } from 'lucide-react';
import { useWorkspaceStore, selectProjectWorldKey } from '@/store/workspaceStore';
import { worldKeyForEntity } from '@/lib/worldKey';
import styles from '../../WritingDesk.module.css';

export function CharacterStateRenderer({ content, onChange }: { content: any; onChange: (c: any) => void; }) {
  const projectWorldKey = useWorkspaceStore(selectProjectWorldKey);
  const entities = useWorkspaceStore(s => s.entities);
  const characters = useMemo(() =>
    entities.filter(e => worldKeyForEntity(e) === projectWorldKey && e.type === 'character'),
    [entities, projectWorldKey]
  );

  // --- Local state for debounced text inputs ---
  const fieldId = useId();
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

  const selectedChar = characters.find(c => c.id === content.characterId);

  const relationships = localContent.relationships || [];
  const addRel = (targetId: string) => {
    if (relationships.find((r: any) => r.targetId === targetId)) return;
    updateImmediate({ relationships: [...(content.relationships || []), { id: crypto.randomUUID(), targetId, status: '' }] });
  };
  const updateRel = (id: string, status: string) => {
    // Free-text: debounced
    handleChange({ relationships: relationships.map((r: any) => r.id === id ? { ...r, status } : r) });
  };
  const removeRel = (id: string) => {
    updateImmediate({ relationships: (content.relationships || []).filter((r: any) => r.id !== id) });
  };

  const isCompact = content.isCompact || false;

  if (isCompact) {
    return (
      <div className={styles.charStateCompact}>
        <div className={styles.charStateAvatarSmall}>
          {selectedChar?.imageUrl ? <img src={selectedChar.imageUrl} alt="" /> : <span>👤</span>}
        </div>
        <div className={styles.charStateMetaSmall}>
          <div className={styles.charStateNameSmall}>{selectedChar?.name || '(Unknown)'}</div>
          <div className={styles.charStateEmotionSmall}>{localContent.emotionalState || 'Calm'}</div>
        </div>
        <button className={styles.sceneControlCompactToggle} onClick={() => updateImmediate({ isCompact: false })} aria-label="Expand widget"><Maximize2 size={13} /></button>
      </div>
    );
  }

  return (
    <div className={styles.charState}>
      <div className={styles.charStateHeader}>
        <select 
          aria-label="Point-of-view character"
          className={styles.charStateSelect} 
          value={content.characterId || ''} 
          onChange={e => updateImmediate({ characterId: e.target.value })}
        >
          <option value="">(POV Character)</option>
          {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className={styles.sceneControlCompactToggle} onClick={() => updateImmediate({ isCompact: true })} aria-label="Collapse widget"><Minimize2 size={13} /></button>
      </div>

      <div className={styles.charStateScroll}>
        <div className={styles.charStateHero}>
          <div className={styles.charStateAvatar}>
            {selectedChar?.imageUrl ? <img src={selectedChar.imageUrl} alt="" /> : <span>👤</span>}
          </div>
          <div className={styles.charStateIdentity}>
            <div className={styles.charStateName}>{selectedChar?.name || 'POV Character'}</div>
            <input 
              aria-label="Emotional state"
              className={styles.charStateEmotionInput} 
              value={localContent.emotionalState || ''} 
              onChange={e => handleChange({ emotionalState: e.target.value })}
              placeholder="Emotional State (Anxious, Excited...)" 
            />
          </div>
        </div>

        <div className={styles.sceneControlSection}>
          <label className={styles.sceneControlLabel} htmlFor={`${fieldId}-goal`}>Current Goal</label>
          <textarea id={`${fieldId}-goal`} className={styles.sceneControlInput} value={localContent.goal || ''} onChange={e => handleChange({ goal: e.target.value })} placeholder="What is their target right now?" />
        </div>

        <div className={styles.sceneControlSection}>
          <label className={styles.sceneControlLabel}>Knowledge (Known / Unknown)</label>
          <div className={styles.charKnowledgeGrid}>
            <div className={styles.charKnowledgeCol}>
              <div className={styles.charKnowledgeLabel} id={`${fieldId}-knows-label`}>Knows</div>
              <textarea aria-labelledby={`${fieldId}-knows-label`} className={styles.charKnowledgeText} value={localContent.knows || ''} onChange={e => handleChange({ knows: e.target.value })} placeholder="Key facts..." />
            </div>
            <div className={styles.charKnowledgeCol}>
              <div className={styles.charKnowledgeLabel} id={`${fieldId}-unknowns-label`}>Unknown</div>
              <textarea aria-labelledby={`${fieldId}-unknowns-label`} className={styles.charKnowledgeText} value={localContent.unknowns || ''} onChange={e => handleChange({ unknowns: e.target.value })} placeholder="Blind spots..." />
            </div>
          </div>
        </div>

        <div className={styles.sceneControlSection}>
          <label className={styles.sceneControlLabel}>Relationships in Scene</label>
          <div className={styles.charRelList}>
            {relationships.map((r: any) => {
              const target = characters.find(c => c.id === r.targetId);
              return (
                <div key={r.id} className={styles.charRelItem}>
                  <div className={styles.charRelName} id={`${fieldId}-rel-${r.id}`}>{target?.name || '(Unknown)'}</div>
                  <input aria-labelledby={`${fieldId}-rel-${r.id}`} className={styles.charRelStatus} value={r.status} onChange={e => updateRel(r.id, e.target.value)} placeholder="Tension / Status" />
                  <button className={styles.sceneCheckRemove} onClick={() => removeRel(r.id)} aria-label="Remove relationship"><X size={13} /></button>
                </div>
              );
            })}
            <select aria-label="Add a relationship" className={styles.charRelAddSelect} value="" onChange={e => addRel(e.target.value)}>
              <option value="">+ Add Relationship Context</option>
              {characters.filter(c => c.id !== content.characterId).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.sceneControlSection}>
          <label className={styles.sceneControlLabel} htmlFor={`${fieldId}-arc-notes`}>Active Arc Notes</label>
          <textarea id={`${fieldId}-arc-notes`} className={styles.sceneControlInput} value={localContent.arcNotes || ''} onChange={e => handleChange({ arcNotes: e.target.value })} placeholder="Internal journey context..." />
        </div>
      </div>
    </div>
  );
}
