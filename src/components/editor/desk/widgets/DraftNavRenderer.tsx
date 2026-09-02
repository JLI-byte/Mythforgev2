"use client";

import { useState, useRef, useMemo, useCallback } from 'react';
import { MapPin, Maximize2, Minimize2 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useWorkspaceStore } from '@/store/workspaceStore';
import styles from '../../WritingDesk.module.css';

export function DraftNavRenderer({ content, onChange }: { content: any; onChange: (c: any) => void; }) {
  const activeProjectId = useWorkspaceStore(s => s.activeProjectId);
  const activeDocumentId = useWorkspaceStore(s => s.activeDocumentId);
  const activeSceneId = useWorkspaceStore(s => s.activeSceneId);
  const setActiveScene = useWorkspaceStore(s => s.setActiveScene);
  const setActiveDocument = useWorkspaceStore(s => s.setActiveDocument);
  const scenes = useWorkspaceStore(s => s.scenes);
  const documents = useWorkspaceStore(s => s.documents);
  const addDocument = useWorkspaceStore(s => s.addDocument);
  const addScene = useWorkspaceStore(s => s.addScene);
  const sceneControlStatuses = useWorkspaceStore(
    useShallow((s: any) => {
      const state = s.deskStates[activeProjectId || ''];
      if (!state) return {} as Record<string, string>;
      return Object.fromEntries(
        state.widgets
          .filter((w: any) => w.type === 'sceneControl' && w.content.linkedSceneId)
          .map((w: any) => [w.content.linkedSceneId, w.content.status || 'Draft'])
      );
    })
  );

  const projectDocuments = useMemo(() => 
    documents.filter(d => d.projectId === activeProjectId),
    [documents, activeProjectId]
  );
  
  const [search, setSearch] = useState('');

  const filteredScenes = useMemo(() => {
    let base = scenes.filter(s => s.projectId === activeProjectId);
    if (search) {
      base = base.filter(s => s.title.toLowerCase().includes(search.toLowerCase()));
    }
    return base.sort((a,b) => a.order - b.order);
  }, [scenes, activeProjectId, search]);

  const activeSceneRef = useRef<HTMLDivElement>(null);

  const scrollToActive = useCallback(() => {
    if (!activeSceneId) return;
    activeSceneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeSceneId]);

  const handleAddChapter = () => {
    if (!activeProjectId) return;
    const nid = crypto.randomUUID();
    const sid = crypto.randomUUID();
    addDocument({ id: nid, projectId: activeProjectId, title: `Chapter ${projectDocuments.length + 1}`, content: '', createdAt: new Date() });
    addScene({ id: sid, documentId: nid, projectId: activeProjectId, title: 'Scene 1', content: '', order: 0, createdAt: new Date() });
    setActiveDocument(nid);
    setActiveScene(sid);
  };

  const handleAddScene = () => {
    if (!activeProjectId || !activeDocumentId) return;
    const nid = crypto.randomUUID();
    const docScenesCount = scenes.filter(s => s.documentId === activeDocumentId).length;
    addScene({ id: nid, documentId: activeDocumentId, projectId: activeProjectId, title: `New Scene`, content: '', order: docScenesCount, createdAt: new Date() });
    setActiveScene(nid);
  };

  const getSceneStatus = (sceneId: string) => sceneControlStatuses[sceneId] || 'Draft';

  const statusColors: Record<string, string> = {
    'Draft': '#6b7280',
    'Needs Revision': '#ef4444',
    'Locked': '#10b981',
    'Continuity Issue': '#f59e0b'
  };

  const isCompact = content.isCompact || false;

  if (isCompact) {
    return (
      <div className={styles.draftNavCompact}>
        <button className={styles.compactToggleBtn} onClick={() => onChange({ ...content, isCompact: false })} aria-label="Expand widget"><Maximize2 size={13} /></button>
        {filteredScenes.filter(s => s.documentId === activeDocumentId).map(s => (
          <div 
            key={s.id} 
            className={`${styles.miniScenePill} ${s.id === activeSceneId ? styles.miniScenePillActive : ''}`} 
            onClick={() => setActiveScene(s.id)}
            title={s.title}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={styles.draftNav}>
      <div className={styles.structureHeader}>
        <div className={styles.progressLabel} style={{ marginTop: 0, opacity: 0.6 }}>Draft Navigator</div>
        <button className={styles.sceneControlCompactToggle} onClick={() => onChange({ ...content, isCompact: true })} aria-label="Collapse widget"><Minimize2 size={13} /></button>
      </div>

      <div className={styles.draftNavSearch}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input 
            aria-label="Search scenes"
            className={styles.relMapInput} 
            placeholder="Search scenes..." 
            style={{ flex: 1 }}
            value={search} 
            onChange={e => setSearch(e.target.value)}
          />
          <button className={styles.addChapterBtn} onClick={handleAddChapter} title="Add Chapter">+</button>
        </div>
      </div>

      <div className={styles.draftNavList}>
        {filteredScenes.filter(s => s.documentId === activeDocumentId).map(scene => (
          <div 
            key={scene.id} 
            ref={scene.id === activeSceneId ? activeSceneRef : null}
            className={`${styles.sceneNavItem} ${scene.id === activeSceneId ? styles.sceneNavItemActive : ''}`}
            onClick={() => setActiveScene(scene.id)}
          >
            <div className={styles.sceneNavTitle}>{scene.title}</div>
            <div className={styles.sceneNavMeta}>
              {scene.wordCount !== undefined && <span className={styles.sceneNavWordCount}>{scene.wordCount}</span>}
              <div className={styles.sceneNavStatus} style={{ backgroundColor: statusColors[getSceneStatus(scene.id)] || '#6b7280' }} />
            </div>
          </div>
        ))}
        <button className={styles.addSceneBtnInline} onClick={handleAddScene}>
          + Add Scene
        </button>
      </div>

      <div className={styles.draftNavFooter}>
         <button className={styles.jumpActiveBtn} onClick={scrollToActive}><MapPin size={12} aria-hidden="true" /> Jump to Active</button>
      </div>
    </div>
  );
}
