"use client";

import React, { useEffect, useState } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { researchScopeKey } from '@/lib/researchScope';
import WritingDesk from './WritingDesk';
import { ResearchEmptyState } from './ResearchEmptyState';
import { ResearchBoardBar } from './research/ResearchBoardBar';
import { ResearchRail } from './research/ResearchRail';
import styles from './WritingDesk.module.css';

/**
 * Research Tab — the Workshop's first stage. A spatial board of notes,
 * clippings and links for the active project.
 *
 * The board is keyed by scope, and world-scoped boards still exist in the
 * store, but the scope is pinned to the project here: the This Project / This
 * World switcher was removed, and reaching a world's research will be built a
 * different way.
 *
 * This used to be an AI chat panel beside the board, and the chat was the only
 * thing that could put a card on it. Phase 2 removed the chat; the board is
 * unchanged, and its cards are ordinary desk widgets added from the toolbar.
 */
export default function ResearchTab() {
  const activeProject = useWorkspaceStore(s =>
    s.projects.find(p => p.id === s.activeProjectId) ?? null
  );
  // Within the project's base key the writer can pick a board.
  // null = the default "Main" board, which reuses the base key.
  const baseScopeKey = researchScopeKey('project', activeProject);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  useEffect(() => { setActiveBoardId(null); }, [baseScopeKey]);
  const scopeKey = activeBoardId && baseScopeKey ? `${baseScopeKey}::${activeBoardId}` : baseScopeKey;

  return (
    <div className={styles.researchLayout}>
      <ResearchRail scopeKey={scopeKey} />
      <div className={styles.researchMain}>
        {scopeKey ? (
          <>
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
