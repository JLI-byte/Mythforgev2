"use client";

import React, { useState } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { researchScopeKey, type ResearchScope } from '@/lib/researchScope';
import WritingDesk from './WritingDesk';
import styles from './WritingDesk.module.css';

/**
 * Research Tab — a blank spatial board for research cards. Owns the
 * project/world scope switcher and hands the resolved scope key to the shared
 * canvas, which reads/writes the matching researchStates slice.
 */
export default function ResearchTab() {
  const [scope, setScope] = useState<ResearchScope>('project');
  const activeProject = useWorkspaceStore(s =>
    s.projects.find(p => p.id === s.activeProjectId) ?? null
  );
  const scopeKey = researchScopeKey(scope, activeProject);

  return (
    <div className={styles.researchRoot}>
      <div className={styles.researchScopeBar}>
        <button
          className={`${styles.researchScopeBtn} ${scope === 'project' ? styles.researchScopeBtnActive : ''}`}
          onClick={() => setScope('project')}
        >
          This Project
        </button>
        <button
          className={`${styles.researchScopeBtn} ${scope === 'world' ? styles.researchScopeBtnActive : ''}`}
          onClick={() => setScope('world')}
        >
          This World
        </button>
      </div>
      <div className={styles.researchCanvasHost}>
        <WritingDesk variant="research" scopeKey={scopeKey} />
      </div>
    </div>
  );
}
