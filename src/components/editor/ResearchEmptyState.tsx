"use client";

import { useWorkspaceStore } from '@/store/workspaceStore';
import styles from './WritingDesk.module.css';

/**
 * Empty state for the Research tab when no project is active. Unlike the desk's
 * EmptyDeskWelcome, selecting a project here keeps the writer on the Research
 * tab instead of bouncing them into the Writing Desk.
 */
export function ResearchEmptyState() {
  const projects = useWorkspaceStore(s => s.projects);
  const setActiveProject = useWorkspaceStore(s => s.setActiveProject);
  const setWorkspaceMode = useWorkspaceStore(s => s.setWorkspaceMode);

  const resumeMostRecent = () => {
    if (projects.length === 0) return;
    const newest = [...projects].sort((a, b) =>
      new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime()
    )[0];
    setActiveProject(newest.id);
  };

  return (
    <div className={styles.emptyWelcomeContainer}>
      <div className={styles.emptyWelcomeContent}>
        <div className={styles.emptyWelcomeHeader}>
          <div className={styles.emptyWelcomeIcon}>🔭</div>
          <div>
            <div className={styles.emptyWelcomeTitle}>Research</div>
            <div className={styles.emptyWelcomeSub}>PICK A PROJECT TO OPEN ITS BOARD</div>
          </div>
        </div>

        {projects.length > 0 ? (
          <>
            <div className={styles.emptyWelcomeActions}>
              <button className={styles.welcomeActionBtn} onClick={resumeMostRecent}>
                <span className={styles.welcomeActionIcon}>↺</span>
                <span className={styles.welcomeActionLabel}>Resume Recent</span>
              </button>
            </div>
            <div className={styles.welcomeProjectList}>
              {[...projects].sort((a, b) => a.name.localeCompare(b.name)).map(p => (
                <button key={p.id} className={styles.welcomeProjectItem} onClick={() => setActiveProject(p.id)}>
                  <span className={styles.welcomeProjectColor} style={{ background: p.coverColor }} />
                  <span className={styles.welcomeProjectName}>{p.name}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className={styles.emptyWelcomeActions}>
            <button className={styles.welcomeActionBtn} onClick={() => setWorkspaceMode('bookshelf')}>
              <span className={styles.welcomeActionIcon}>📚</span>
              <span className={styles.welcomeActionLabel}>Go to Bookshelf</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
