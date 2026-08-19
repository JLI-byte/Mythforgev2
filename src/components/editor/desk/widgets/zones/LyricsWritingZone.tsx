"use client";

/**
 * LyricsWritingZone — the writing zone for lyrics — songs, verse and poetry.
 *
 * One of four sibling zones, cloned from the original story-only writing zone
 * so each medium can diverge without disturbing the others. Reached when a
 * project's writingMode is 'poetry'; see WritingZoneRenderer for the
 * dispatch. Identical to its siblings until this medium needs it otherwise.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useShallow } from 'zustand/react/shallow';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { ProjectSettingsModal } from '@/components/ui/ProjectSettingsModal';
import ScreenplayEditor from '@/components/editor/ScreenplayEditor';
import { BinderMode } from '../../deskConstants';
import { DeskTipTapEditor } from '../../DeskTipTapEditor';
import { BookViewEditor } from '../../BookViewEditor';
import { BookCoverEditor } from '../../BookCoverEditor';
import { WidgetLibraryDropdown } from '../../WidgetLibraryDropdown';
import { WritingZoneProps } from './zoneTypes';
import styles from '../../../WritingDesk.module.css';

export function LyricsWritingZone({ content, onChange, onChangeImmediate, widget, onDragStart, onDeleteWidget, onDockChange, onManualSave, onAddAtCenter }: WritingZoneProps) {
  const activeProjectId = useWorkspaceStore(s => s.activeProjectId);
  const updateScene = useWorkspaceStore(s => s.updateScene);
  const addDocument = useWorkspaceStore(s => s.addDocument);
  const addScene = useWorkspaceStore(s => s.addScene);
  const updateDocument = useWorkspaceStore(s => s.updateDocument);
  const [editingNode, setEditingNode] = useState<{ type: 'chapter' | 'scene', id: string, text: string } | null>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingNode && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingNode]);

  useEffect(() => {
    if (!editingNode) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (renameInputRef.current && !renameInputRef.current.contains(e.target as Node)) {
        if (editingNode.type === 'chapter') {
          updateDocument(editingNode.id, { title: editingNode.text });
        } else {
          updateScene(editingNode.id, { title: editingNode.text });
        }
        setEditingNode(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editingNode, updateDocument, updateScene]);

  const handleRenameClick = (type: 'chapter' | 'scene', id: string, text: string) => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      setEditingNode({ type, id, text });
    } else {
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
      }, 300);
    }
  };


  const allDocs = useWorkspaceStore(
    useShallow(s => s.documents.filter(d => d.projectId === activeProjectId))
  );
  const allScenes = useWorkspaceStore(
    useShallow(s => s.scenes.filter(sc => sc.projectId === activeProjectId))
  );

  const activeProject = useWorkspaceStore(s => s.projects.find(p => p.id === activeProjectId));
  const projectDocs = useMemo(() => 
    [...allDocs].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    ),
    [allDocs]
  );
  const projectScenes = allScenes;

  const [isFocusMode, setIsFocusMode] = useState(false);
  const binderMode: BinderMode = content.binderMode || 'shown';
  const [smartExpanded, setSmartExpanded] = useState(false);
  const [isSceneListCollapsed, setIsSceneListCollapsed] = useState(false);
  const noopFocus = useCallback(() => {}, []);

  const showSettings = content.showSettings || false;

  const activeDocId = content.documentId || projectDocs[0]?.id || '';
  const setActiveDocId = (id: string) => {
    const firstScene = projectScenes.filter(s => s.documentId === id).sort((a, b) => a.order - b.order)[0];
    (onChangeImmediate ?? onChange)({ ...content, documentId: id, sceneId: firstScene?.id || '' });
  };

  const isBookMode = content.viewType === 'book';
  const activeSceneId = content.sceneId || 'all';

  const setActiveSceneId = (id: string) => {
    // If book mode is active, clicking a scene scrolls instead of switching view
    if (isBookMode && id !== 'book' && id !== 'cover') {
      (onChangeImmediate ?? onChange)({ ...content, sceneId: id });
    } else {
      (onChangeImmediate ?? onChange)({ ...content, sceneId: id, viewType: id === 'book' ? 'book' : 'standard' });
    }
  };

  const showManuscriptView = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextMode = !isBookMode;
    // Fix: If transitioning from cover to manuscript, ensure we ground on a valid scene
    const targetSceneId = (activeSceneId === 'cover' && nextMode) ? (projectScenes[0]?.id || 'all') : activeSceneId;
    (onChangeImmediate ?? onChange)({ 
      ...content, 
      viewType: nextMode ? 'book' : 'standard',
      sceneId: targetSceneId
    });
  };

  const docScenes = projectScenes.filter(s => s.documentId === activeDocId).sort((a, b) => a.order - b.order);
  const activeScene = activeSceneId === 'all' ? null : (projectScenes.find(s => s.id === activeSceneId) || docScenes[0]);

  useEffect(() => {
    if (!activeDocId && projectDocs.length > 0) setActiveDocId(projectDocs[0].id);
    else if (activeDocId && !activeSceneId && docScenes.length > 0) setActiveSceneId(docScenes[0].id);
  }, [activeProjectId, activeDocId, activeSceneId]);

  useEffect(() => {
    if (!isFocusMode) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsFocusMode(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFocusMode]);

  const smartHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSmartHover = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const target = e.target as HTMLElement;
    const isHoveringNav = !!target.closest(`.${styles.binderChapterCollapsed}, .${styles.binderAddChapter}, .${styles.binderNavArrow}`);
    const isHoveringSpine = !!target.closest(`.${styles.binderSpine}`);
    const expansionZone = (x > rect.width - 80) || isHoveringNav;
    const interactionZone = expansionZone || isHoveringSpine;

    if (smartHoverTimer.current) clearTimeout(smartHoverTimer.current);
    if (expansionZone && !smartExpanded) smartHoverTimer.current = setTimeout(() => setSmartExpanded(true), 200);
    else if (!interactionZone && smartExpanded) smartHoverTimer.current = setTimeout(() => setSmartExpanded(false), 400);
  };

  const handleSmartLeave = () => {
    if (smartHoverTimer.current) clearTimeout(smartHoverTimer.current);
    smartHoverTimer.current = setTimeout(() => setSmartExpanded(false), 300);
  };

  const handleAddChapter = () => {
    if (!activeProjectId) return;
    const nid = crypto.randomUUID();
    addDocument({ id: nid, projectId: activeProjectId, title: `Chapter ${projectDocs.length + 1}`, content: '', createdAt: new Date() });
    const sid = crypto.randomUUID();
    addScene({ id: sid, documentId: nid, projectId: activeProjectId, title: 'Scene 1', content: '', order: 0, createdAt: new Date() });
    onChange({ ...content, documentId: nid, sceneId: sid });
  };

  const handleAddScene = () => {
    if (!activeDocId || !activeProjectId) return;
    const nid = crypto.randomUUID();
    addScene({ id: nid, documentId: activeDocId, projectId: activeProjectId, title: `Scene ${docScenes.length + 1}`, content: '', order: docScenes.length, createdAt: new Date() });
    setActiveSceneId(nid);
  };


  const editorSlot = activeSceneId === 'cover' ? (
    <BookCoverEditor projectId={activeProjectId || ''} />
  ) : isBookMode ? (
    <BookViewEditor activeSceneId={activeSceneId} />
  ) : activeSceneId === 'all' ? (() => {

    const activeDoc = projectDocs.find(d => d.id === activeDocId);
    return (
      <div className={styles.binderAllScenesContainer} onMouseDown={e => e.stopPropagation()}>
        {activeDoc && (
          editingNode?.type === 'chapter' && editingNode.id === activeDoc.id ? (
            <input 
              className={styles.binderFullBookChapterHeaderInput}
              ref={renameInputRef}
              value={editingNode.text}
              onChange={e => setEditingNode({ ...editingNode, text: e.target.value })}
              onKeyDown={e => { 
                if (e.key === 'Enter') { updateDocument(activeDoc.id, { title: editingNode.text }); setEditingNode(null); }
                else if (e.key === 'Escape') setEditingNode(null);
              }}
            />
          ) : (
            <div 
              className={styles.binderFullBookChapterHeader}
              onClick={(e) => { e.stopPropagation(); handleRenameClick('chapter', activeDoc.id, activeDoc.title); }}
              title="Click twice to rename"
            >
              {activeDoc.title}
            </div>
          )
        )}

        {docScenes.map(s => (
        <div key={s.id} className={styles.binderAllScenesItem}>
          {editingNode?.type === 'scene' && editingNode.id === s.id ? (
            <input 
              className={styles.binderAllScenesHeaderInput}
              ref={renameInputRef}
              value={editingNode.text}
              onChange={e => setEditingNode({ ...editingNode, text: e.target.value })}
              onKeyDown={e => { 
                if (e.key === 'Enter') { updateScene(s.id, { title: editingNode.text }); setEditingNode(null); }
                else if (e.key === 'Escape') setEditingNode(null);
              }}
            />
          ) : (
            <div 
              className={styles.binderAllScenesHeader}
              onClick={(e) => { e.stopPropagation(); handleRenameClick('scene', s.id, s.title); }}
              title="Click twice to rename"
            >
              {s.title}
            </div>
          )}
          {activeProject?.writingMode === 'screenplay'
            ? <ScreenplayEditor key={s.id} scene={s} />
            : <DeskTipTapEditor key={s.id} sceneId={s.id} content={s.content} onUpdate={(html, count) => updateScene(s.id, { content: html, wordCount: count })} onFocus={noopFocus} />}
        </div>
      ))}
      <button className={styles.binderAddSceneBtn} onClick={handleAddScene}>+ Add Another Scene</button>
    </div>
    );
  })() : activeScene ? (
    <div className={styles.binderAllScenesContainer} onMouseDown={e => e.stopPropagation()}>
      <div className={styles.binderAllScenesItem}>
        {editingNode?.type === 'scene' && editingNode.id === activeScene.id ? (
          <input 
            className={styles.binderAllScenesHeaderInput}
            ref={renameInputRef}
            value={editingNode.text}
            onChange={e => setEditingNode({ ...editingNode, text: e.target.value })}
            onKeyDown={e => { 
              if (e.key === 'Enter') { updateScene(activeScene.id, { title: editingNode.text }); setEditingNode(null); }
              else if (e.key === 'Escape') setEditingNode(null);
            }}
          />
        ) : (
          <div 
            className={styles.binderAllScenesHeader}
            onClick={(e) => { e.stopPropagation(); handleRenameClick('scene', activeScene.id, activeScene.title); }}
            title="Click twice to rename"
          >
            {activeScene.title}
          </div>
        )}
        {activeProject?.writingMode === 'screenplay'
          ? <ScreenplayEditor key={activeScene.id} scene={activeScene} />
          : <DeskTipTapEditor key={activeScene.id} sceneId={activeScene.id} content={activeScene.content} onUpdate={(html, count) => updateScene(activeScene.id, { content: html, wordCount: count })} onFocus={noopFocus} />}
      </div>
    </div>
  ) : (
    <div className={styles.binderEditorEmpty}><span>No scenes yet</span><button onClick={handleAddScene}>Add Scene</button></div>
  );

  const ui = (
    <div className={`${styles.writingZoneBinder} ${isFocusMode ? styles.writingZoneBinderFocus : ''} ${content.isCollapsed ? styles.writingZoneBinderCollapsed : ''}`}
         onMouseMove={binderMode === 'smart' ? handleSmartHover : undefined}
         onMouseLeave={binderMode === 'smart' ? handleSmartLeave : undefined}>
      
      {!content.isCollapsed && (
        <div className={styles.binderBody}>
          {isFocusMode && <button className={styles.focusExitPill} onClick={() => setIsFocusMode(false)}>✕ Exit Focus</button>}

          <div className={styles.binderSpine} onMouseDown={e => widget.dock === null ? onDragStart(e, widget) : undefined}>
            <div className={styles.spineCoverContainer}>
              {activeProject?.coverImageUrl ? (
                <img 
                  src={activeProject.coverImageUrl} 
                  className={styles.spineCoverImg} 
                  onClick={() => setActiveSceneId('cover')}
                  title="Book Information"
                />
              ) : (
                <div 
                  className={styles.spineCoverPlaceholder} 
                  style={{ background: activeProject?.coverColor || 'var(--surface)' }}
                  onClick={() => setActiveSceneId('cover')}
                  title="Book Information"
                >
                  <span className={styles.spineCoverInitials}>{activeProject?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'}</span>
                </div>
              )}
              
              <button 
                className={styles.spineSaveBtn}
                data-status={content.saveStatus}
                onClick={() => {
                  (onChangeImmediate ?? onChange)({ ...content, saveStatus: 'saving' });
                  onManualSave?.();
                  setTimeout(() => {
                    (onChangeImmediate ?? onChange)({ ...content, saveStatus: 'saved' });
                    setTimeout(() => (onChangeImmediate ?? onChange)({ ...content, saveStatus: null }), 2000);
                  }, 500);
                }}
              >
                {content.saveStatus === 'saved' ? '✔️' : '💾'}
              </button>
            </div>

            <div className={styles.spineChaptersAccordion}>
              <button 
                className={`${styles.spineBookModeHeader} ${isBookMode ? styles.spineBookModeHeaderActive : ''}`}
                onClick={showManuscriptView}
              >
                <span className={styles.spineBookModeIcon}>📜</span>
                <span className={styles.spineBookModeLabel}>MANUSCRIPT VIEW</span>
                <span className={styles.spineBookModeStatus}>{isBookMode ? 'ON' : 'OFF'}</span>
              </button>

              {projectDocs.map((doc, idx) => {
                const isDocActive = doc.id === activeDocId;
                const scenes = projectScenes.filter(s => s.documentId === doc.id).sort((a, b) => a.order - b.order);
                return (
                  <div key={doc.id} className={styles.spineSceneListGroup}>
                    <button 
                      className={`${styles.spineSceneListHeader} ${isDocActive ? styles.spineSceneListHeaderActive : ''}`} 
                      onClick={() => {
                        (onChangeImmediate ?? onChange)({ ...content, documentId: doc.id, sceneId: 'all' });
                      }}
                    >
                      <div 
                        className={styles.spineSceneListArrowContainer}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isDocActive) {
                            (onChangeImmediate ?? onChange)({ ...content, documentId: doc.id, sceneId: scenes[0]?.id || '' });
                            setIsSceneListCollapsed(false);
                          } else {
                            setIsSceneListCollapsed(prev => !prev);
                          }
                        }}
                      >
                        <span className={styles.spineSceneListArrow}>
                          {isDocActive && !isSceneListCollapsed ? '▼' : '▶'}
                        </span>
                      </div>
                      <div className={styles.spineSceneListHeaderText}>
                        <div className={styles.spineSceneListHeaderMain}>Chapter {idx + 1}</div>
                        {editingNode?.type === 'chapter' && editingNode.id === doc.id ? (
                          <input 
                            className={styles.spineRenameInput}
                            ref={renameInputRef}
                            value={editingNode.text}
                            onChange={e => setEditingNode({ ...editingNode, text: e.target.value })}
                            onKeyDown={e => { 
                              if (e.key === 'Enter') { updateDocument(doc.id, { title: editingNode.text }); setEditingNode(null); }
                              else if (e.key === 'Escape') setEditingNode(null);
                            }}
                            onClick={e => e.stopPropagation()}
                            onDoubleClick={e => e.stopPropagation()}
                          />
                        ) : (
                          <div 
                            className={styles.spineSceneListHeaderSub}
                            onDoubleClick={() => setEditingNode({ type: 'chapter', id: doc.id, text: doc.title })}
                            title="Double-click to rename"
                          >
                            {doc.title}
                          </div>
                        )}
                      </div>
                    </button>

                    {(isDocActive && !isSceneListCollapsed) && (
                      <div className={styles.binderSceneList} onMouseDown={e => e.stopPropagation()}>
                        {scenes.map(s => (
                          <button key={s.id} className={`${styles.binderSpineSceneTab} ${s.id === activeScene?.id ? styles.binderSpineSceneTabActive : ''}`} onClick={() => setActiveSceneId(s.id)}>
                            {editingNode?.type === 'scene' && editingNode.id === s.id ? (
                              <input 
                                className={styles.spineRenameInput}
                                ref={renameInputRef}
                                value={editingNode.text}
                                onChange={e => setEditingNode({ ...editingNode, text: e.target.value })}
                                onKeyDown={e => { 
                                  if (e.key === 'Enter') { updateScene(s.id, { title: editingNode.text }); setEditingNode(null); }
                                  else if (e.key === 'Escape') setEditingNode(null);
                                }}
                                onClick={e => e.stopPropagation()}
                                onDoubleClick={e => e.stopPropagation()}
                              />
                            ) : (
                              <span 
                                className={styles.binderSpineSceneTitle}
                                onDoubleClick={() => setEditingNode({ type: 'scene', id: s.id, text: s.title })}
                                title="Double-click to rename"
                              >
                                {s.title}
                              </span>
                            )}
                            <span className={styles.binderSpineSceneMeta}>{s.wordCount || 0} words</span>
                          </button>
                        ))}
                        <button className={styles.binderAddSceneBtn} onClick={() => {
                          const nid = crypto.randomUUID();
                          addScene({ id: nid, documentId: doc.id, projectId: activeProjectId!, title: `Scene ${scenes.length + 1}`, content: '', order: scenes.length, createdAt: new Date() });
                          setActiveSceneId(nid);
                        }}><span>+</span> Add Scene</button>
                      </div>
                    )}
                  </div>
                );
              })}
              <button className={styles.spineAddChapterBtn} onClick={handleAddChapter}><span>+</span> Add Chapter</button>
            </div>
            <div className={styles.spineControls}>
              <WidgetLibraryDropdown onSelect={onAddAtCenter} />
            </div>
          </div>
          <div className={styles.binderChapters}>
            <div className={styles.binderChapterActive}>
              <div className={styles.binderEditorArea}>
                {editorSlot}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );



  return (
    <>
      {isFocusMode && typeof document !== 'undefined' ? createPortal(ui, document.body) : ui}
      {activeProjectId && <ProjectSettingsModal isOpen={showSettings} onClose={() => (onChangeImmediate ?? onChange)({ ...content, showSettings: false })} projectId={activeProjectId} />}
    </>
  );
}
