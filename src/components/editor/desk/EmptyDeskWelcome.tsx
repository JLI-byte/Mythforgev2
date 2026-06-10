"use client";

import { useState } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { NewProjectModal } from '@/components/ui/NewProjectModal';
import { ImportModal } from '@/components/ui/ImportModal';
import styles from '../WritingDesk.module.css';

// ============================================================
// EMPTY DESK WELCOME
// ============================================================

export function EmptyDeskWelcome() {
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [isLoadOpen, setIsLoadOpen] = useState(false);
  
  const projects = useWorkspaceStore(s => s.projects);
  const setActiveProject = useWorkspaceStore(s => s.setActiveProject);
  const setActiveDocument = useWorkspaceStore(s => s.setActiveDocument);
  const setWorkspaceMode = useWorkspaceStore(s => s.setWorkspaceMode);
  const docs = useWorkspaceStore(s => s.documents);

  const handleSelect = (id: string) => {
    setActiveProject(id);
    const pDocs = docs.filter(d => d.projectId === id).sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    if (pDocs.length > 0) setActiveDocument(pDocs[0].id);
    setWorkspaceMode('desk');
  };

  const handleResume = () => {
    if (projects.length === 0) return;
    const sorted = [...projects].sort((a,b) =>
      new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime()
    );
    handleSelect(sorted[0].id);
  };

  const [isSeeding, setIsSeeding] = useState(false);
  const handleLoadExample = async () => {
    setIsSeeding(true);
    try {
      // Dynamically imported so the 50KB example world stays out of the main bundle.
      const { seedBetaData } = await import('@/lib/betaSeedData');
      seedBetaData(useWorkspaceStore.getState());
      const seeded = useWorkspaceStore.getState().projects;
      if (seeded.length > 0) {
        const newest = [...seeded].sort((a, b) =>
          new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime()
        )[0];
        handleSelect(newest.id);
      }
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className={styles.emptyWelcomeContainer}>
      <div className={styles.emptyWelcomeContent}>
        <div className={styles.emptyWelcomeHeader}>
          <div className={styles.emptyWelcomeIcon}>M</div>
          <div>
            <div className={styles.emptyWelcomeTitle}>MythForge</div>
            <div className={styles.emptyWelcomeSub}>BUILD WORLDS • WRITE STORIES</div>
          </div>
        </div>

        <div className={styles.emptyWelcomeActions}>
          <button className={styles.welcomeActionBtn} onClick={() => setShowNew(true)}>
            <span className={styles.welcomeActionIcon}>✨</span>
            <span className={styles.welcomeActionLabel}>New Writing</span>
          </button>
          
          <button className={styles.welcomeActionBtn} onClick={handleResume} disabled={projects.length === 0}>
            <span className={styles.welcomeActionIcon}>↺</span>
            <span className={styles.welcomeActionLabel}>Resume</span>
          </button>

          <div className={styles.welcomeActionGroup}>
            <button className={styles.welcomeActionBtnSecondary} onClick={() => setIsLoadOpen(!isLoadOpen)}>
              <span className={styles.welcomeActionIcon}>📁</span>
              <span className={styles.welcomeActionLabel}>Load</span>
            </button>
            <button className={styles.welcomeActionBtnSecondary} onClick={() => setShowImport(true)}>
              <span className={styles.welcomeActionIcon}>📥</span>
              <span className={styles.welcomeActionLabel}>Import</span>
            </button>
            <button className={styles.welcomeActionBtnSecondary} onClick={handleLoadExample} disabled={isSeeding}>
              <span className={styles.welcomeActionIcon}>🌍</span>
              <span className={styles.welcomeActionLabel}>{isSeeding ? 'Loading…' : 'Example World'}</span>
            </button>
          </div>
        </div>

        {isLoadOpen && projects.length > 0 && (
          <div className={styles.welcomeProjectList}>
            {projects.sort((a,b) => b.name.localeCompare(a.name)).map(p => (
              <button key={p.id} className={styles.welcomeProjectItem} onClick={() => handleSelect(p.id)}>
                <span className={styles.welcomeProjectColor} style={{ background: p.coverColor }} />
                <span className={styles.welcomeProjectName}>{p.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <NewProjectModal isOpen={showNew} onClose={() => setShowNew(false)} />
      <ImportModal isOpen={showImport} onClose={() => setShowImport(false)} />
    </div>
  );
}
