"use client";

import React, { useCallback, useState } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { researchScopeKey, type ResearchScope } from '@/lib/researchScope';
import { serializeBoard, makeNoteCard } from '@/lib/researchBoard';
import WritingDesk from './WritingDesk';
import { ResearchEmptyState } from './ResearchEmptyState';
import { ResearchChatPanel } from './research/ResearchChatPanel';
import styles from './WritingDesk.module.css';

/**
 * Research Tab — an AI chat panel (left) beside a blank spatial board (right).
 * Owns the project/world scope switcher, feeds the active board to the chat as
 * context, and appends assistant replies to the board as Note cards on request.
 */
export default function ResearchTab() {
  const [scope, setScope] = useState<ResearchScope>('project');
  const activeProject = useWorkspaceStore(s =>
    s.projects.find(p => p.id === s.activeProjectId) ?? null
  );
  const scopeKey = researchScopeKey(scope, activeProject);

  // Read the board imperatively at call time so the chat panel doesn't
  // re-render on every board edit.
  const getBoardContext = useCallback(() => {
    if (!scopeKey) return '';
    const board = useWorkspaceStore.getState().researchStates[scopeKey];
    return serializeBoard(board?.widgets ?? []);
  }, [scopeKey]);

  const handleAddCard = useCallback((text: string) => {
    if (!scopeKey) return;
    const store = useWorkspaceStore.getState();
    const current = store.researchStates[scopeKey]?.widgets ?? [];
    store.updateResearchState(scopeKey, {
      widgets: [...current, makeNoteCard(text, current.length)],
    });
  }, [scopeKey]);

  return (
    <div className={styles.researchLayout}>
      <ResearchChatPanel
        scopeKey={scopeKey}
        getBoardContext={getBoardContext}
        onAddCard={handleAddCard}
      />
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
