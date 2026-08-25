"use client";

import React, { useEffect, useState, lazy, Suspense } from 'react';
import styles from './page.module.css';
import { WorldBiblePanel } from '@/components/layout/WorldBiblePanel';
import { WritingGoalsPanel } from '@/components/layout/WritingGoalsPanel';
import { SocialMediaPanel } from '@/components/layout/SocialMediaPanel';
import { MusicPlayerPanel } from '@/components/layout/MusicPlayerPanel';
import InlineEntryCreator from '@/components/world/InlineEntryCreator';
import HoverPreview from '@/components/world/HoverPreview';
import { EntityDetailPanel } from '@/components/world/EntityDetailPanel';
import { BetaFeedbackPanel } from '@/components/layout/BetaFeedbackPanel';
import { VersionHistoryPanel } from '@/components/layout/VersionHistoryPanel';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import ExportModal from '@/components/ui/ExportModal';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { CommandPalette } from '@/components/navigation/CommandPalette';
import ModeBar from '@/components/navigation/ModeBar';
import DeskLighting from '@/components/theme/DeskLighting';
import { DraftSurface } from '@/components/editor/vn/DraftSurface';

// Center-column modes are code-split: only the active one is downloaded/parsed,
// instead of bundling all five (WritingDesk, ArticleGrid, etc.) into first paint.
const WorldBibleFolderTree = lazy(() => import('@/components/world/WorldBibleFolderTree'));
const WorldBibleCenter = lazy(() => import('@/components/world/WorldBibleCenter'));
const WorldBibleEdit = lazy(() => import('@/components/world/WorldBibleEdit'));
const WritingDesk = lazy(() => import('@/components/editor/WritingDesk'));
const Bookshelf = lazy(() => import('@/components/management/Bookshelf').then(m => ({ default: m.Bookshelf })));
const HomePage = lazy(() => import('@/components/home/HomePage'));
const ResearchTab = lazy(() => import('@/components/editor/ResearchTab'));

/**
 * Main Workspace View
 *
 * Houses the primary editor and conditionally the World Bible interface.
 * "Creation happens at the point of inspiration. The tool never pulls the writer out of their flow."
 */
// Note: Configured as a Client Component to dynamically bind Zustand layout state natively.
export default function Home() {
  // One active panel at a time — null means all closed
  const [activePanel, setActivePanel] = useState<'worldBible' | 'writingGoals' | 'socialMedia' | 'music' | 'beta' | 'versionHistory' | null>(null);


  const handlePanelToggle = (id: 'worldBible' | 'writingGoals' | 'socialMedia' | 'music' | 'beta' | 'versionHistory') => {
    setActivePanel(prev => prev === id ? null : id);
  };

  const setCommandPaletteOpen = useWorkspaceStore((state) => state.setCommandPaletteOpen);
  const isExportOpen = useWorkspaceStore((state) => state.isExportOpen);
  const setExportOpen = useWorkspaceStore((state) => state.setExportOpen);
  const isFullscreen = useWorkspaceStore((state) => state.isFullscreen);
  const toggleFullscreen = useWorkspaceStore((state) => state.toggleFullscreen);
  const isFocusMode = useWorkspaceStore((state) => state.isFocusMode);
  const toggleFocusMode = useWorkspaceStore((state) => state.toggleFocusMode);
  const theme = useWorkspaceStore((state) => state.theme);
  const themeFamily = useWorkspaceStore((state) => state.themeFamily);
  const tabRailWidth = useWorkspaceStore((state) => state.tabRailWidth);
  const setTabRailWidth = useWorkspaceStore((state) => state.setTabRailWidth);
  const panelWidth = useWorkspaceStore((state) => state.panelWidth);
  const setPanelWidth = useWorkspaceStore((state) => state.setPanelWidth);
  const focusedArticleEntityId = useWorkspaceStore((state) => state.focusedArticleEntityId);

  const workspaceMode = useWorkspaceStore((state) => state.workspaceMode);


  // Clamp panelWidth to a safe maximum based on current viewport.
  // Prevents persisted wide-screen values from overflowing on narrow screens.
  // MIN_EDITOR_WIDTH = 280px ensures the editor is never fully obscured.
  // Clamping happens AFTER mount: reading window during render makes the
  // first client render differ from the server HTML (hydration mismatch).
  const MIN_EDITOR_WIDTH = 280;
  const [maxPanelWidth, setMaxPanelWidth] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setMaxPanelWidth(window.innerWidth - tabRailWidth - MIN_EDITOR_WIDTH);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [tabRailWidth]);
  const effectivePanelWidth = maxPanelWidth !== null
    ? Math.min(panelWidth, maxPanelWidth)
    : panelWidth;


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K on Mac, Ctrl+K on Windows
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault();
        setExportOpen(true);
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
  }, [setCommandPaletteOpen, setExportOpen, isFullscreen, toggleFullscreen, isFocusMode, toggleFocusMode]);

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

  // Sync theme family to the DOM — globals.css selects the active palette by
  // [data-theme-family] × [data-theme].
  useEffect(() => {
    document.documentElement.setAttribute('data-theme-family', themeFamily);
  }, [themeFamily]);

  // Reflect the active workspace mode so the fantasy wood desk + candle light
  // can be scoped to the Writing Desk ('desk') only.
  useEffect(() => {
    document.documentElement.setAttribute('data-workspace-mode', workspaceMode);
  }, [workspaceMode]);

  // Auto-close the right panel when an article is opened
  useEffect(() => {
    if (focusedArticleEntityId) {
      setActivePanel(null);
    }
  }, [focusedArticleEntityId]);


  return (
    <main
      className={`${styles.workspace} ${isFullscreen ? styles.fullscreenMode : ''} ${isFocusMode ? styles.focusMode : ''}`}
    >
      <DeskLighting />
      <ModeBar />
      <div className={styles.workspaceRow}>
        <div
          className={styles.editorContainer}
          style={{
            paddingRight: tabRailWidth + 8,
            transition: 'padding-right 280ms ease-in-out',
          }}
        >
          <div
            className={styles.editorScrollContainer}
            data-scroll="main"
            style={{ writingMode: 'horizontal-tb' }}
          >
            <ErrorBoundary label="this workspace">
              <Suspense fallback={<div style={{ flex: 1, minHeight: '60vh' }} />}>
                {workspaceMode === 'home' ? (
                  <HomePage />
                ) : workspaceMode === 'worldBible' ? (
                  <WorldBibleCenter />
                ) : workspaceMode === 'worldBibleEdit' ? (
                  <WorldBibleEdit />
                ) : workspaceMode === 'template' ? (
                  <DraftSurface />
                ) : workspaceMode === 'hierarchy' ? (
                  <WorldBibleFolderTree />
                ) : workspaceMode === 'bookshelf' ? (
                  <Bookshelf />
                ) : workspaceMode === 'research' ? (
                  <ResearchTab />
                ) : (
                  <WritingDesk />
                )}
              </Suspense>
            </ErrorBoundary>
          </div>
        </div>

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
        <WritingGoalsPanel
          isOpen={activePanel === 'writingGoals'}
          onClose={() => setActivePanel(null)}
          onTabClick={() => handlePanelToggle('writingGoals')}
          tabWidth={tabRailWidth}
          onTabWidthChange={setTabRailWidth}
          panelWidth={effectivePanelWidth}
          onPanelWidthChange={(w) => setPanelWidth(Math.min(w, window.innerWidth - tabRailWidth - MIN_EDITOR_WIDTH))}
        />
        <SocialMediaPanel
          isOpen={activePanel === 'socialMedia'}
          onClose={() => setActivePanel(null)}
          onTabClick={() => handlePanelToggle('socialMedia')}
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
        <VersionHistoryPanel
          isOpen={activePanel === 'versionHistory'}
          onClose={() => setActivePanel(null)}
          onTabClick={() => handlePanelToggle('versionHistory')}
          tabWidth={tabRailWidth}
          onTabWidthChange={setTabRailWidth}
          panelWidth={effectivePanelWidth}
          onPanelWidthChange={(w) => setPanelWidth(Math.min(w, window.innerWidth - tabRailWidth - MIN_EDITOR_WIDTH))}
        />

        {/* Global modal overlays */}
        {isExportOpen && <ExportModal onClose={() => setExportOpen(false)} />}
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
      </div>
    </main>
  );
}

