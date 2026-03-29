"use client";

import React, { useEffect, useState } from 'react';
import styles from './page.module.css';
import WritingEditor from '@/components/editor/WritingEditor';
import ArticleGridEditor from '@/components/world/ArticleGridEditor';
import { NavigationPanel } from '@/components/editor/NavigationPanel';
import { WorldBiblePanel } from '@/components/layout/WorldBiblePanel';
import { ConsistencyPanel } from '@/components/layout/ConsistencyPanel';
import { WritingGoalsPanel } from '@/components/layout/WritingGoalsPanel';
import { WritingStatsPanel } from '@/components/layout/WritingStatsPanel';
import { AIChatbotPanel } from '@/components/layout/AIChatbotPanel';
import { MusicPlayerPanel } from '@/components/layout/MusicPlayerPanel';
import InlineEntryCreator from '@/components/world/InlineEntryCreator';
import HoverPreview from '@/components/world/HoverPreview';
import { EntityDetailPanel } from '@/components/world/EntityDetailPanel';
import { BetaFeedbackPanel } from '@/components/layout/BetaFeedbackPanel';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { CommandPalette } from '@/components/navigation/CommandPalette';
import ModeBar from '@/components/navigation/ModeBar';
import WorldBibleCenter from '@/components/world/WorldBibleCenter';
import WorldLandingScreen from '@/components/navigation/WorldLandingScreen';
import { ATMOSPHERE_PRESETS } from '@/lib/atmospherePresets';
import { ResizeDivider } from '@/components/ui/ResizeDivider';

/**
 * Main Workspace View
 *
 * Houses the primary editor and conditionally the World Bible interface.
 * "Creation happens at the point of inspiration. The tool never pulls the writer out of their flow."
 */
// Note: Configured as a Client Component to dynamically bind Zustand layout state natively.
export default function Home() {
  // One active panel at a time — null means all closed
  const [activePanel, setActivePanel] = useState<'worldBible' | 'consistency' | 'writingGoals' | 'writingStats' | 'aiChatbot' | 'music' | 'beta' | null>(null);

  const handlePanelToggle = (id: 'worldBible' | 'consistency' | 'writingGoals' | 'writingStats' | 'aiChatbot' | 'music' | 'beta') => {
    setActivePanel(prev => prev === id ? null : id);
  };

  const setCommandPaletteOpen = useWorkspaceStore((state) => state.setCommandPaletteOpen);
  const isFullscreen = useWorkspaceStore((state) => state.isFullscreen);
  const toggleFullscreen = useWorkspaceStore((state) => state.toggleFullscreen);
  const isFocusMode = useWorkspaceStore((state) => state.isFocusMode);
  const toggleFocusMode = useWorkspaceStore((state) => state.toggleFocusMode);
  const activeProjectId = useWorkspaceStore((state) => state.activeProjectId);
  const activeDocumentId = useWorkspaceStore((state) => state.activeDocumentId);
  const activeSceneId = useWorkspaceStore((state) => state.activeSceneId);
  const scenes = useWorkspaceStore((state) => state.scenes);
  const customAtmospheres = useWorkspaceStore((state) => state.customAtmospheres);
  const atmospheresEnabled = useWorkspaceStore((state) => state.atmospheresEnabled);
  const atmosphereGlobalOverlay = useWorkspaceStore((state) => state.atmosphereGlobalOverlay);
  const theme = useWorkspaceStore((state) => state.theme);
  const tabRailWidth = useWorkspaceStore((state) => state.tabRailWidth);
  const setTabRailWidth = useWorkspaceStore((state) => state.setTabRailWidth);
  const panelWidth = useWorkspaceStore((state) => state.panelWidth);
  const setPanelWidth = useWorkspaceStore((state) => state.setPanelWidth);
  const focusedArticleEntityId = useWorkspaceStore((state) => state.focusedArticleEntityId);

  const editorRef = React.useRef<HTMLDivElement>(null);

  const navPanelWidth = useWorkspaceStore((state) => state.navPanelWidth);
  const setNavPanelWidth = useWorkspaceStore((state) => state.setNavPanelWidth);
  const editorMaxWidth = useWorkspaceStore((state) => state.editorMaxWidth);
  const setEditorMaxWidth = useWorkspaceStore((state) => state.setEditorMaxWidth);
  const isStandardFormat = useWorkspaceStore((state) => state.isStandardFormat);
  const workspaceMode = useWorkspaceStore((state) => state.workspaceMode);

  const [isResizing, setIsResizing] = useState(false);

  const handleNavResize = (deltaX: number) => {
    const newWidth = Math.min(Math.max(navPanelWidth + deltaX, 160), 400);
    setNavPanelWidth(newWidth);
  };

  const handleEditorResize = (deltaX: number) => {
    // Capture actual width if state is currently null (pure flex)
    const currentMax = editorMaxWidth || (editorRef.current?.offsetWidth || 800);
    const upperBound = typeof window !== 'undefined' ? window.innerWidth - navPanelWidth - tabRailWidth - 60 : 2000;
    const newWidth = Math.min(Math.max(currentMax + deltaX, 400), upperBound);
    setEditorMaxWidth(newWidth);
  };
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
      } else if (e.key === 'Escape' && isFocusMode) {
        // Esc exits focus mode
        e.preventDefault();
        toggleFocusMode();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [setCommandPaletteOpen, isFullscreen, toggleFullscreen, isFocusMode, toggleFocusMode]);

  // Sync Zustand theme preference to DOM data-theme attribute — drives CSS variable switching in globals.css
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');

      // Also listen for OS theme changes at runtime
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => {
        if (useWorkspaceStore.getState().theme === 'system') {
          root.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        }
      };
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    } else {
      root.setAttribute('data-theme', theme);
    }
  }, [theme]);

  // Auto-close the right panel when an article is opened in the center column — prevents the panel from obscuring ArticleReadView
  useEffect(() => {
    if (focusedArticleEntityId) {
      setActivePanel(null);
    }
  }, [focusedArticleEntityId]);

  const activeScene = scenes.find((s) => s.id === activeSceneId);
  const currentAtmosphere = atmospheresEnabled && activeScene?.atmosphereId
    ? ATMOSPHERE_PRESETS.find(a => a.id === activeScene.atmosphereId) || customAtmospheres.find(a => a.id === activeScene.atmosphereId)
    : undefined;

  const atmosphereStyleVars = currentAtmosphere ? {
    '--background': isDark ? currentAtmosphere.darkBackground : currentAtmosphere.lightBackground,
    '--surface': isDark ? currentAtmosphere.darkBackground : currentAtmosphere.lightBackground,
    transition: 'background-color 500ms ease'
  } as React.CSSProperties : undefined;

  // Sprint 60: Show landing screen when no project is active
  if (!activeProjectId) {
    return <WorldLandingScreen />;
  }

  return (
    <main
      className={`${styles.workspace} ${isFullscreen ? styles.fullscreenMode : ''} ${isFocusMode ? styles.focusMode : ''}`}
      style={{
        ...(atmosphereGlobalOverlay ? atmosphereStyleVars : undefined),
        paddingRight: activePanel ? panelWidth + tabRailWidth + 8 : tabRailWidth + 8,
        transition: 'padding-right 280ms ease-in-out',
      }}
    >
      {workspaceMode !== 'document' && (
        <div 
          className={styles.navigationPanelContainer}
          style={{ 
            width: navPanelWidth,
            transition: isResizing ? 'none' : undefined
          }}
        >
          <NavigationPanel />
        </div>
      )}

      {workspaceMode !== 'document' && !isFocusMode && !isFullscreen && (
        <ResizeDivider 
          onResize={handleNavResize} 
          onResizeStart={() => setIsResizing(true)}
          onResizeEnd={() => setIsResizing(false)}
          onDoubleClick={() => setNavPanelWidth(220)}
        />
      )}

      <div
        ref={editorRef}
        className={styles.editorContainer}
        style={{
          ...(!atmosphereGlobalOverlay ? atmosphereStyleVars : undefined),
          transition: isResizing ? 'none' : undefined,
          width: workspaceMode === 'document' ? undefined : (isStandardFormat ? 720 : (editorMaxWidth || undefined)),
          flex: workspaceMode === 'document' ? 1 : ((!isStandardFormat && !editorMaxWidth) ? 1 : '0 0 auto')
        }}
      >
        <ModeBar />
        <div
          className={styles.editorScrollContainer}
          data-scroll="main"
          style={{ writingMode: 'horizontal-tb' }}
        >
          {workspaceMode === 'document' && focusedArticleEntityId ? (
            <ArticleGridEditor entityId={focusedArticleEntityId} />
          ) : workspaceMode === 'document' ? (
            <WorldBibleCenter />
          ) : (
            <WritingEditor key={activeDocumentId} />
          )}
        </div>
      </div>

      {!isFocusMode && !isFullscreen && (
        <ResizeDivider 
          onResize={handleEditorResize}
          onResizeStart={() => setIsResizing(true)}
          onResizeEnd={() => setIsResizing(false)}
          onDoubleClick={() => setEditorMaxWidth(null)}
        />
      )}

      {/* 
        Right-edge panels & filing cabinet tabs
        Fixed to the right edge. Does not shift the editor.
      */}
      <WorldBiblePanel
        isOpen={activePanel === 'worldBible'}
        onClose={() => setActivePanel(null)}
        onTabClick={() => handlePanelToggle('worldBible')}
        tabWidth={tabRailWidth}
        onTabWidthChange={setTabRailWidth}
        panelWidth={panelWidth}
        onPanelWidthChange={setPanelWidth}
      />
      <ConsistencyPanel
        isOpen={activePanel === 'consistency'}
        onClose={() => setActivePanel(null)}
        onTabClick={() => handlePanelToggle('consistency')}
        tabWidth={tabRailWidth}
        onTabWidthChange={setTabRailWidth}
        panelWidth={panelWidth}
        onPanelWidthChange={setPanelWidth}
      />
      <WritingGoalsPanel
        isOpen={activePanel === 'writingGoals'}
        onClose={() => setActivePanel(null)}
        onTabClick={() => handlePanelToggle('writingGoals')}
        tabWidth={tabRailWidth}
        onTabWidthChange={setTabRailWidth}
        panelWidth={panelWidth}
        onPanelWidthChange={setPanelWidth}
      />
      <WritingStatsPanel
        isOpen={activePanel === 'writingStats'}
        onClose={() => setActivePanel(null)}
        onTabClick={() => handlePanelToggle('writingStats')}
        tabWidth={tabRailWidth}
        onTabWidthChange={setTabRailWidth}
        panelWidth={panelWidth}
        onPanelWidthChange={setPanelWidth}
      />
      <AIChatbotPanel
        isOpen={activePanel === 'aiChatbot'}
        onClose={() => setActivePanel(null)}
        onTabClick={() => handlePanelToggle('aiChatbot')}
        tabWidth={tabRailWidth}
        onTabWidthChange={setTabRailWidth}
        panelWidth={panelWidth}
        onPanelWidthChange={setPanelWidth}
      />
      <MusicPlayerPanel
        isOpen={activePanel === 'music'}
        onClose={() => setActivePanel(null)}
        onTabClick={() => handlePanelToggle('music')}
        tabWidth={tabRailWidth}
        onTabWidthChange={setTabRailWidth}
        panelWidth={panelWidth}
        onPanelWidthChange={setPanelWidth}
      />
      <BetaFeedbackPanel
        isOpen={activePanel === 'beta'}
        onClose={() => setActivePanel(null)}
        onTabClick={() => handlePanelToggle('beta')}
        tabWidth={tabRailWidth}
        onTabWidthChange={setTabRailWidth}
        panelWidth={panelWidth}
        onPanelWidthChange={setPanelWidth}
      />

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
