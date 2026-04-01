"use client";

import React from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import styles from './ModeBar.module.css';

/**
 * ModeBar — Global workspace mode switcher.
 * Sprint 53: Three modes — Writing, Document (TipTap article editor), World Bible (canvas builder).
 * Always visible above the center column.
 */
export default function ModeBar() {
  const workspaceMode = useWorkspaceStore(state => state.workspaceMode);
  const setWorkspaceMode = useWorkspaceStore(state => state.setWorkspaceMode);

  return (
    <nav className={styles.modeBar}>
      <button
        className={`${styles.modeBtn} ${workspaceMode === 'writing' ? styles.modeBtnActive : ''}`}
        onClick={() => setWorkspaceMode('writing')}
      >
        ✍️ Writing
      </button>
      <button
        className={`${styles.modeBtn} ${workspaceMode === 'worldBible' ? styles.modeBtnActive : ''}`}
        onClick={() => setWorkspaceMode('worldBible')}
      >
        📖 World Bible
      </button>
      <button
        className={`${styles.modeBtn} ${workspaceMode === 'template' ? styles.modeBtnActive : ''}`}
        onClick={() => setWorkspaceMode('template')}
      >
        🎨 Template Designer
      </button>
    </nav>
  );
}
