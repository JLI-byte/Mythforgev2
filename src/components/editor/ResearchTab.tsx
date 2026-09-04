"use client";

import React, { useEffect, useState } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { researchScopeKey, type ResearchScope } from '@/lib/researchScope';
import WritingDesk from './WritingDesk';
import { ResearchEmptyState } from './ResearchEmptyState';
import { ResearchBoardBar } from './research/ResearchBoardBar';
import { ResearchRail } from './research/ResearchRail';
import styles from './WritingDesk.module.css';

/**
 * Research Tab — a spatial board of notes, clippings and links, scoped to the
 * active project or its world.
 *
 * This used to be an AI chat panel beside the board, and the chat was the only
 * thing that could put a card on it. Phase 2 removed the chat; the board is
 * unchanged, and its cards are ordinary desk widgets added from the toolbar.
 */
export default function ResearchTab() {
  const [scope, setScope] = useState<ResearchScope>('project');
  const activeProject = useWorkspaceStore(s =>
    s.projects.find(p => p.id === s.activeProjectId) ?? null
  );
  // Each scope (project / world) is its own base key; within it the user can
  // pick a board. null = the scope's default "Main" board (reuses the base key).
  const baseScopeKey = researchScopeKey(scope, activeProject);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  useEffect(() => { setActiveBoardId(null); }, [baseScopeKey]);
  const scopeKey = activeBoardId && baseScopeKey ? `${baseScopeKey}::${activeBoardId}` : baseScopeKey;

  return (
    <div className={styles.researchLayout}>
      <ResearchRail scopeKey={scopeKey} />
      <div className={styles.researchMain}>
        {scopeKey ? (
          <>
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
            {baseScopeKey && (
              <ResearchBoardBar
                baseScopeKey={baseScopeKey}
                activeBoardId={activeBoardId}
                onSelect={setActiveBoardId}
              />
            )}
            <div className={styles.researchCanvasHost}>
              <WritingDesk variant="research" scopeKey={scopeKey} />
            </div>
          </>
        ) : (
          <ResearchEmptyState />
        )}
      </div>
    </div>
  );
}
