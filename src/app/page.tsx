"use client";

import React, { useEffect, useState } from 'react';
import styles from './page.module.css';
import WritingEditor from '@/components/editor/WritingEditor';
import TemplateDesigner from '@/components/world/TemplateDesigner';
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

  // Clamp panelWidth to a safe maximum based on current viewport.
  // Prevents persisted wide-screen values from overflowing on narrow screens.
  // MIN_EDITOR_WIDTH = 280px ensures the editor is never fully obscured.
  const MIN_EDITOR_WIDTH = 280;
  const effectivePanelWidth = typeof window !== 'undefined'
    ? Math.min(panelWidth, window.innerWidth - tabRailWidth - MIN_EDITOR_WIDTH)
    : panelWidth;

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

  // Auto-close the right panel when an article is opened
  useEffect(() => {
    if (focusedArticleEntityId) {
      setActivePanel(null);
    }
  }, [focusedArticleEntityId]);

  // Sprint 60: Show landing screen when no project is active
  if (!activeProjectId) {
    return <WorldLandingScreen />;
  }

  return (
    <main
      className={`${styles.workspace} ${isFullscreen ? styles.fullscreenMode : ''} ${isFocusMode ? styles.focusMode : ''}`}
      style={{
        paddingRight: activePanel ? effectivePanelWidth + tabRailWidth + 8 : tabRailWidth + 8,
        transition: 'padding-right 280ms ease-in-out',
      }}
    >
      {workspaceMode === 'writing' && (
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

      {workspaceMode === 'writing' && !isFocusMode && !isFullscreen && (
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
          transition: isResizing ? 'none' : undefined,
          width: workspaceMode !== 'writing' ? undefined : (isStandardFormat ? 720 : (editorMaxWidth || undefined)),
          flex: workspaceMode !== 'writing' ? 1 : ((!isStandardFormat && !editorMaxWidth) ? 1 : '0 0 auto')
        }}
      >
        <ModeBar />
        <div
          className={styles.editorScrollContainer}
          data-scroll="main"
          style={{ writingMode: 'horizontal-tb' }}
        >
          {workspaceMode === 'worldBible' ? (
            <WorldBibleCenter />
          ) : workspaceMode === 'template' ? (
            <TemplateDesigner />
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
        panelWidth={effectivePanelWidth}
        onPanelWidthChange={(w) => setPanelWidth(Math.min(w, window.innerWidth - tabRailWidth - MIN_EDITOR_WIDTH))}
      />
      <ConsistencyPanel
        isOpen={activePanel === 'consistency'}
        onClose={() => setActivePanel(null)}
        onTabClick={() => handlePanelToggle('consistency')}
        tabWidth={tabRailWidth}
        onTabWidthChange={setTabRailWidth}
        panelWidth={effectivePanelWidth}
        onPanelWidthChange={(w) => setPanelWidth(Math.min(w, window.innerWidth - tabRailWidth - MIN_EDITOR_WIDTH))}
      />
      <WritingGoalsPanel
        isOpen={activePanel === 'writingGoals'}
        onClose={() => setActivePanel(null)}
        onTabClick={() => handlePanelToggle('writingGoals')}
        tabWidth={tabRailWidth}
        onTabWidthChange={setTabRailWidth}
        panelWidth={effectivePanelWidth}
        onPanelWidthChange={(w) => setPanelWidth(Math.min(w, window.innerWidth - tabRailWidth - MIN_EDITOR_WIDTH))}
      />
      <WritingStatsPanel
        isOpen={activePanel === 'writingStats'}
        onClose={() => setActivePanel(null)}
        onTabClick={() => handlePanelToggle('writingStats')}
        tabWidth={tabRailWidth}
        onTabWidthChange={setTabRailWidth}
        panelWidth={effectivePanelWidth}
        onPanelWidthChange={(w) => setPanelWidth(Math.min(w, window.innerWidth - tabRailWidth - MIN_EDITOR_WIDTH))}
      />
      <AIChatbotPanel
        isOpen={activePanel === 'aiChatbot'}
        onClose={() => setActivePanel(null)}
        onTabClick={() => handlePanelToggle('aiChatbot')}
        tabWidth={tabRailWidth}
        onTabWidthChange={setTabRailWidth}
        panelWidth={effectivePanelWidth}
        onPanelWidthChange={(w) => setPanelWidth(Math.min(w, window.innerWidth - tabRailWidth - MIN_EDITOR_WIDTH))}
      />
      <MusicPlayerPanel
        isOpen={activePanel === 'music'}
        onClose={() => setActivePanel(null)}
        onTabClick={() => handlePanelToggle('music')}
        tabWidth={tabRailWidth}
        onTabWidthChange={setTabRailWidth}
        panelWidth={effectivePanelWidth}
        onPanelWidthChange={(w) => setPanelWidth(Math.min(w, window.innerWidth - tabRailWidth - MIN_EDITOR_WIDTH))}
      />
      <BetaFeedbackPanel
        isOpen={activePanel === 'beta'}
        onClose={() => setActivePanel(null)}
        onTabClick={() => handlePanelToggle('beta')}
        tabWidth={tabRailWidth}
        onTabWidthChange={setTabRailWidth}
        panelWidth={effectivePanelWidth}
        onPanelWidthChange={(w) => setPanelWidth(Math.min(w, window.innerWidth - tabRailWidth - MIN_EDITOR_WIDTH))}
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

