"use client";

import React, { useEffect } from 'react';
import styles from './page.module.css';
import WritingEditor from '@/components/editor/WritingEditor';
import { NavigationPanel } from '@/components/editor/NavigationPanel';
import WorldBible from '@/components/world/WorldBible';
import InlineEntryCreator from '@/components/world/InlineEntryCreator';
import HoverPreview from '@/components/world/HoverPreview';
import { Toolbar } from '@/components/ui/Toolbar';
import { EntityDetailPanel } from '@/components/world/EntityDetailPanel';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { CommandPalette } from '@/components/navigation/CommandPalette';
import { ATMOSPHERE_PRESETS } from '@/lib/atmospherePresets';

/**
 * Main Workspace View
 *
 * Houses the primary editor and conditionally the World Bible interface.
 * "Creation happens at the point of inspiration. The tool never pulls the writer out of their flow."
 */
// Note: Configured as a Client Component to dynamically bind Zustand layout state natively.
export default function Home() {
  const isSidebarOpen = useWorkspaceStore((state) => state.isSidebarOpen);
  const setCommandPaletteOpen = useWorkspaceStore((state) => state.setCommandPaletteOpen);
  const isFullscreen = useWorkspaceStore((state) => state.isFullscreen);
  const toggleFullscreen = useWorkspaceStore((state) => state.toggleFullscreen);
  const activeSceneId = useWorkspaceStore((state) => state.activeSceneId);
  const scenes = useWorkspaceStore((state) => state.scenes);
  const customAtmospheres = useWorkspaceStore((state) => state.customAtmospheres);
  const atmospheresEnabled = useWorkspaceStore((state) => state.atmospheresEnabled);
  const theme = useWorkspaceStore((state) => state.theme);
  const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K on Mac, Ctrl+K on Windows
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      } else if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'Escape' && isFullscreen) {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [setCommandPaletteOpen, isFullscreen, toggleFullscreen]);

  const activeScene = scenes.find((s) => s.id === activeSceneId);
  const currentAtmosphere = atmospheresEnabled && activeScene?.atmosphereId
    ? ATMOSPHERE_PRESETS.find(a => a.id === activeScene.atmosphereId) || customAtmospheres.find(a => a.id === activeScene.atmosphereId)
    : undefined;

  return (
    <main className={`${styles.workspace} ${isFullscreen ? styles.fullscreenMode : ''}`}>
      {currentAtmosphere && (
        <div
          className={styles.globalAtmosphereTint}
          style={{ backgroundColor: isDark ? currentAtmosphere.darkBackground : currentAtmosphere.lightBackground }}
        />
      )}
      <div className={styles.toolbarContainer}>
        <Toolbar />
      </div>
      <div className={styles.navigationPanelContainer}>
        <NavigationPanel />
      </div>
      <div className={styles.editorContainer}>
        <WritingEditor key={activeSceneId} />
      </div>

      {/* 
        The World Bible layer lives exactly where the writer needs it 
      */}
      <div className={`${styles.sidebarContainer} ${!isSidebarOpen ? styles.sidebarCollapsed : ''}`}>
        <WorldBible />
      </div>

      {/* Global modal overlays */}
      <InlineEntryCreator />
      <EntityDetailPanel />
      <CommandPalette />

      {/* 
        TEMPORARY POSITIONING:
        HoverPreview is currently mounted at the root and statically styled to float 
        left of the sidebar. When Editor-level hover support is added, this component 
        will need its positioning coordinates driven dynamically by the anchor element 
        rect bounding boxes.
      */}
      <HoverPreview />
    </main>
  );
}
