"use client";

import { useState, useRef, useEffect, useMemo } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import styles from '../../WritingDesk.module.css';

export function ContinuityRenderer({ content, onChange }: { content: any; onChange: (c: any) => void; }) {
  const activeProjectId = useWorkspaceStore(s => s.activeProjectId);
  const activeSceneId = useWorkspaceStore(s => s.activeSceneId);
  const scenes = useWorkspaceStore(s => s.scenes);
  const projectScenes = useMemo(() => 
    scenes.filter(sc => sc.projectId === activeProjectId).sort((a, b) => a.order - b.order),
    [scenes, activeProjectId]
  );

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

  // Structural fields flush immediately (read from content, not localContent)
  const updateImmediate = (updates: any) => onChange({ ...content, ...updates });
  // --- End local state ---

  const looseEnds = content.looseEnds || [];
  const addLooseEnd = () => {
    const text = window.prompt("Unresolved Question / Loose End:");
    if (text) updateImmediate({ looseEnds: [...looseEnds, { id: crypto.randomUUID(), text, checked: false }] });
  };
  const toggleLooseEnd = (id: string) => {
    updateImmediate({ looseEnds: looseEnds.map((l: any) => l.id === id ? { ...l, checked: !l.checked } : l) });
  };

  const researchTasks = content.researchTasks || [];
  const addResearch = () => {
    const text = window.prompt("Research Task:");
    if (text) updateImmediate({ researchTasks: [...researchTasks, { id: crypto.randomUUID(), text, checked: false }] });
  };
  const toggleResearch = (id: string) => {
    updateImmediate({ researchTasks: researchTasks.map((t: any) => t.id === id ? { ...t, checked: !t.checked } : t) });
  };

  const isCompact = content.isCompact || false;

  if (isCompact) {
    const activeIndex = projectScenes.findIndex(s => s.id === activeSceneId);
    const progress = projectScenes.length > 1 ? (activeIndex / (projectScenes.length - 1)) * 100 : 0;
    const pendingResearch = researchTasks.filter((t: any) => !t.checked).length;

    return (
      <div className={styles.continuityCompact}>
        <div className={styles.continuityCompactSummary}>
          <div className={styles.timelineTitleActive} style={{ fontSize: '0.6875rem' }}>
            {projectScenes[activeIndex]?.title || 'Timeline'}
          </div>
          {pendingResearch > 0 && <div className={styles.continuityResearchPill}>{pendingResearch} RESEARCH</div>}
        </div>
        <div className={styles.continuityTimelineMini}>
          <div className={styles.continuityTimelineMiniFill} style={{ width: `${progress}%` }} />
        </div>
        <button className={styles.sceneControlCompactToggle} onClick={() => updateImmediate({ isCompact: false })}>↙️</button>
      </div>
    );
  }

  return (
    <div className={styles.continuity}>
      <div className={styles.sceneControlHeader}>
        <span className={styles.sceneControlLabel} style={{ color: '#fbbf24' }}>Continuity Engine</span>
        <button className={styles.sceneControlCompactToggle} onClick={() => updateImmediate({ isCompact: true })}>↗️</button>
      </div>

      <div className={styles.continuityScroll}>
        <div className={styles.sceneControlSection}>
          <label className={styles.sceneControlLabel}>Story Timeline Strip</label>
          <div className={styles.timelineStrip}>
            {projectScenes.map((sc) => (
              <div key={sc.id} className={styles.timelineItem}>
                <div className={styles.timelineItemLine} />
                <div className={`${styles.timelineDot} ${sc.id === activeSceneId ? styles.timelineDotActive : ''}`} />
                <div className={`${styles.timelineTitle} ${sc.id === activeSceneId ? styles.timelineTitleActive : ''}`}>
                  {sc.title}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.continuityRulesGrid}>
          <div className={styles.continuityRuleBox}>
            <label className={styles.continuityRuleLabel}>Magic & World Rules</label>
            <textarea 
              className={styles.continuityRuleText} 
              value={localContent.worldRules || ''} 
              onChange={e => handleChange({ worldRules: e.target.value })} 
              placeholder="e.g. Gravity is 2x, Magic requires blood..." 
            />
          </div>
          <div className={styles.continuityRuleBox}>
            <label className={styles.continuityRuleLabel}>Canon / Lore Reminders</label>
            <textarea 
              className={styles.continuityRuleText} 
              value={localContent.canonLore || ''} 
              onChange={e => handleChange({ canonLore: e.target.value })} 
              placeholder="Factual constraints for this scene..." 
            />
          </div>
        </div>

        <div className={styles.sceneControlSection}>
          <label className={styles.sceneControlLabel}>Loose Ends</label>
          <div className={styles.sceneChecklist}>
            {looseEnds.map((l: any) => (
              <div key={l.id} className={styles.continuityCheckItem}>
                <input type="checkbox" checked={l.checked} onChange={() => toggleLooseEnd(l.id)} />
                <span className={l.checked ? styles.sceneCheckDone : ''}>{l.text}</span>
              </div>
            ))}
            <button className={styles.continuityResearchAdd} onClick={addLooseEnd}>+ Add Plot Point</button>
          </div>
        </div>

        <div className={styles.sceneControlSection}>
          <label className={styles.sceneControlLabel}>Needs Research / Ref</label>
          <div className={styles.sceneChecklist}>
            {researchTasks.map((t: any) => (
              <div key={t.id} className={styles.continuityCheckItem}>
                <input type="checkbox" checked={t.checked} onChange={() => toggleResearch(t.id)} />
                <span className={t.checked ? styles.sceneCheckDone : ''}>{t.text}</span>
              </div>
            ))}
            <button className={styles.continuityResearchAdd} onClick={addResearch}>+ Add Research Flag</button>
          </div>
        </div>

        <div className={styles.sceneControlSection}>
          <label className={styles.sceneControlLabel}>Continuity Warnings</label>
          <textarea 
            className={styles.continuityRuleText} 
            style={{ minHeight: '60px', borderColor: 'rgba(248, 113, 113, 0.2)' }}
            value={localContent.warnings || ''} 
            onChange={e => handleChange({ warnings: e.target.value })} 
            placeholder="Potential contradictions to fix..." 
          />
        </div>
      </div>
    </div>
  );
}
