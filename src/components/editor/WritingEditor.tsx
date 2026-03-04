import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import styles from './WritingEditor.module.css';
import { useWorkspaceStore, Scene } from '@/store/workspaceStore';
import { getStoredValue, setStoredValue } from '@/lib/storage';
import { EntityMark } from '@/lib/EntityMark';
import { createPortal } from 'react-dom';
import { ATMOSPHERE_PRESETS } from '@/lib/atmospherePresets';
import { AtmospherePicker } from '../ui/AtmospherePicker';

const EDITOR_PLACEHOLDER = '<p>Start writing your story here...</p>';

/**
 * Scene Editor Component
 * Manages an individual Tiptap instance for a specific scene.
 */
function SceneEditor({ scene, index }: { scene: Scene, index: number }) {
    const activeProjectId = useWorkspaceStore((state) => state.activeProjectId);
    const updateScene = useWorkspaceStore((state) => state.updateScene);
    const openInlineCreator = useWorkspaceStore((state) => state.openInlineCreator);
    const entities = useWorkspaceStore((state) => state.entities);
    const setHoveredEntity = useWorkspaceStore((state) => state.setHoveredEntity);
    const isTypewriterMode = useWorkspaceStore((state) => state.isTypewriterMode);

    // Atmosphere state
    const customAtmospheres = useWorkspaceStore((state) => state.customAtmospheres);
    const atmospheresEnabled = useWorkspaceStore((state) => state.atmospheresEnabled);
    const atmosphereTypographyEnabled = useWorkspaceStore((state) => state.atmosphereTypographyEnabled);

    const setSessionWordCount = useWorkspaceStore((state) => state.setSessionWordCount);

    const openInlineCreatorRef = React.useRef(openInlineCreator);
    const entitiesRef = React.useRef(entities.filter(e => e.projectId === activeProjectId));
    const setHoveredEntityRef = React.useRef(setHoveredEntity);
    const isTypewriterModeRef = React.useRef(isTypewriterMode);

    const debounceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const initialWordCountRef = React.useRef<number | null>(null);

    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [pickerPosition, setPickerPosition] = useState<{ top: number; left: number } | null>(null);
    const pickerRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                setIsPickerOpen(false);
            }
        };
        if (isPickerOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isPickerOpen]);

    useEffect(() => {
        openInlineCreatorRef.current = openInlineCreator;
        entitiesRef.current = entities.filter(e => e.projectId === activeProjectId);
        setHoveredEntityRef.current = setHoveredEntity;
        isTypewriterModeRef.current = isTypewriterMode;
    }, [openInlineCreator, entities, activeProjectId, setHoveredEntity, isTypewriterMode]);

    const editor = useEditor({
        extensions: [StarterKit, EntityMark],
        content: scene.content || '',
        // Only autofocus the very first scene if it's not a rehydration flash
        autofocus: index === 0 ? 'end' : false,
        immediatelyRender: false,
        onCreate: ({ editor }) => {
            const count = editor.getText().split(/\s+/).filter(w => w.length > 0).length;
            initialWordCountRef.current = count;

            // Sync initial content if empty so the placeholder works
            if (!scene.content) {
                editor.commands.setContent('');
            }
        },
        editorProps: {
            attributes: {
                class: styles.editorContent,
                'data-placeholder': 'Start writing your story here...'
            },
        },
        onUpdate: ({ editor }) => {
            const currentText = editor.getText();
            const count = currentText.split(/\s+/).filter(w => w.length > 0).length;

            if (initialWordCountRef.current !== null) {
                const added = count - initialWordCountRef.current;
                // Only increment session if we actually added words globally
                if (added > 0) {
                    setSessionWordCount(added);
                    // Reset the initial word count ref so we don't double count if they jump around
                    initialWordCountRef.current = count;
                }
            }

            if (isTypewriterModeRef.current) {
                const selection = window.getSelection();
                if (selection && selection.anchorNode && editor.view.dom.contains(selection.anchorNode)) {
                    const anchor = selection.anchorNode;
                    const element = anchor.nodeType === Node.TEXT_NODE ? anchor.parentElement : (anchor as HTMLElement);
                    if (element && element.scrollIntoView) {
                        element.scrollIntoView({ block: 'center' });
                    }
                }
            }

            // DETECT ENTITY TRIGGER `[[`
            if (currentText.includes('[[')) {
                const state = editor.state;
                const tr = state.tr;
                let triggerFound = false;

                state.doc.descendants((node, pos) => {
                    if (node.isText && node.text?.includes('[[')) {
                        const triggerStart = pos + node.text.indexOf('[[');
                        tr.delete(triggerStart, triggerStart + 2);
                        triggerFound = true;
                    }
                });

                if (triggerFound) {
                    editor.view.dispatch(tr);
                    openInlineCreatorRef.current();
                }
            }

            // ENTITY DETECTION PASS
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = setTimeout(() => {
                if (editor.isDestroyed) return;

                const currentEntities = entitiesRef.current;
                const pmState = editor.state;
                const pmTr = pmState.tr;
                let marksChanged = false;
                const desiredMarks: { start: number, end: number, id: string }[] = [];

                pmState.doc.descendants((node, pos) => {
                    if (node.isText && node.text) {
                        const text = node.text;
                        const textLower = text.toLowerCase();

                        currentEntities.forEach(entity => {
                            const matchStr = entity.name.toLowerCase();
                            if (!matchStr.trim()) return;

                            let startIndex = 0;
                            let idx;
                            while ((idx = textLower.indexOf(matchStr, startIndex)) > -1) {
                                desiredMarks.push({
                                    start: pos + idx,
                                    end: pos + idx + entity.name.length,
                                    id: entity.id
                                });
                                startIndex = idx + matchStr.length;
                            }
                        });
                    }
                });

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const existingMarks: { start: number, end: number, id: string, type: any }[] = [];
                pmState.doc.descendants((node, pos) => {
                    if (node.isText) {
                        const mark = node.marks.find(m => m.type.name === 'entityMark');
                        if (mark) {
                            existingMarks.push({
                                start: pos,
                                end: pos + node.nodeSize,
                                id: mark.attrs.entityId,
                                type: mark.type
                            });
                        }
                    }
                });

                // 1. Remove invalid/stale marks
                existingMarks.forEach(em => {
                    const isValid = desiredMarks.some(dm => dm.id === em.id && dm.start <= em.start && dm.end >= em.end);
                    if (!isValid) {
                        pmTr.removeMark(em.start, em.end, em.type);
                        marksChanged = true;
                    }
                });

                // 2. Add missing marks
                desiredMarks.forEach(dm => {
                    let missing = false;
                    pmState.doc.nodesBetween(dm.start, dm.end, (node) => {
                        if (node.isText) {
                            if (!node.marks.find(m => m.type.name === 'entityMark' && m.attrs.entityId === dm.id)) {
                                missing = true;
                            }
                        }
                    });

                    if (missing) {
                        pmTr.addMark(dm.start, dm.end, pmState.schema.marks.entityMark.create({ entityId: dm.id }));
                        marksChanged = true;
                    }
                });

                if (marksChanged) {
                    editor.view.dispatch(pmTr);
                }

                // CACHE PROSEMIRROR FLOW
                const rawContent = editor.getHTML();

                // If it's just the empty paragraph tag, save as empty string so placeholder works
                if (rawContent === '<p></p>' || rawContent === EDITOR_PLACEHOLDER) {
                    updateScene(scene.id, { content: '', wordCount: 0 });
                } else {
                    updateScene(scene.id, { content: rawContent, wordCount: count });
                }

            }, 300);
        },
    }, [scene.id]); // Re-init if scene ID changes entirely

    // We listen for a custom event emitted by UI modals when they close.
    useEffect(() => {
        const handleFocusReturn = () => {
            // Only focus the last active editor or just default to the first one?
            // Since we have multiple scenes, focusing all is bad. Let's let the user click back.
        };
        window.addEventListener('mythforge:returnFocusToEditor', handleFocusReturn);
        return () => window.removeEventListener('mythforge:returnFocusToEditor', handleFocusReturn);
    }, []);

    // DOM EVENT DELEGATION for entities
    useEffect(() => {
        if (!editor || editor.isDestroyed) return;

        const handleMouseOver = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target && target.classList.contains('entity-tag')) {
                const entityId = target.getAttribute('data-entity-id');
                if (entityId) setHoveredEntityRef.current(entityId);
            }
        };

        const handleMouseOut = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target && target.classList.contains('entity-tag')) {
                setHoveredEntityRef.current(null);
            }
        };

        const domNode = editor.view.dom;
        domNode.addEventListener('mouseover', handleMouseOver);
        domNode.addEventListener('mouseout', handleMouseOut);

        return () => {
            domNode.removeEventListener('mouseover', handleMouseOver);
            domNode.removeEventListener('mouseout', handleMouseOut);
        };
    }, [editor]);

    // Cleanup editor on unmount
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            if (editor) editor.destroy();
        };
    }, [editor]);

    const getAtmosphere = (id?: string) => {
        if (!id) return undefined;
        return ATMOSPHERE_PRESETS.find(p => p.id === id) || customAtmospheres.find(a => a.id === id);
    };

    const currentAtmosphere = atmospheresEnabled ? getAtmosphere(scene.atmosphereId) : undefined;

    return (
        <div
            className={styles.sceneContainer}
            style={{
                ...(currentAtmosphere && atmosphereTypographyEnabled ? {
                    '--atmosphere-line-height-shift': currentAtmosphere.lineHeightShift,
                    '--atmosphere-letter-spacing-shift': currentAtmosphere.letterSpacingShift
                } : {})
            } as React.CSSProperties}
        >
            <div className={styles.sceneToolbar}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', marginRight: 'auto' }}>
                    {currentAtmosphere && <span style={{ marginRight: '0.4rem', fontSize: '0.9rem' }}>{currentAtmosphere.icon}</span>}
                    {scene.title}
                </span>

                {atmospheresEnabled && (
                    <div ref={pickerRef} style={{ display: 'inline-flex', alignItems: 'center', position: 'relative' }}>
                        <button
                            className={styles.sceneToolbarButton}
                            onClick={(e) => {
                                if (isPickerOpen) {
                                    setIsPickerOpen(false);
                                    setPickerPosition(null);
                                } else {
                                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                    setIsPickerOpen(true);
                                    setPickerPosition({ top: rect.bottom + 8, left: rect.left });
                                }
                            }}
                        >
                            {currentAtmosphere ? (
                                <><span>{currentAtmosphere.icon}</span><span>{currentAtmosphere.name}</span></>
                            ) : (
                                <><span>✦</span><span>Atmosphere</span></>
                            )}
                        </button>
                        {isPickerOpen && pickerPosition && typeof document !== 'undefined' && createPortal(
                            <div
                                style={{ position: 'fixed', top: pickerPosition.top, left: pickerPosition.left, zIndex: 9999 }}
                                onClick={e => e.stopPropagation()}
                            >
                                <AtmospherePicker
                                    sceneId={scene.id}
                                    currentAtmosphereId={scene.atmosphereId}
                                    onClose={() => { setIsPickerOpen(false); setPickerPosition(null); }}
                                />
                            </div>,
                            document.body
                        )}
                    </div>
                )}
                <span>{scene.wordCount || 0} words</span>
            </div>

            <EditorContent editor={editor} />
        </div>
    );
}

/**
 * Writing Editor Container
 * Renders all scenes in the active chapter.
 */
export default function WritingEditor() {
    const documents = useWorkspaceStore((state) => state.documents);
    const activeDocumentId = useWorkspaceStore((state) => state.activeDocumentId);
    const activeSceneId = useWorkspaceStore((state) => state.activeSceneId);
    const updateDocument = useWorkspaceStore((state) => state.updateDocument);

    const scenes = useWorkspaceStore((state) => state.scenes);
    const addScene = useWorkspaceStore((state) => state.addScene);

    const activeDocument = documents.find(d => d.id === activeDocumentId);

    // Sort active scenes by their order, and optionally filter by activeScene
    const activeScenes = React.useMemo(() => {
        const docScenes = scenes
            .filter(s => s.documentId === activeDocumentId)
            .sort((a, b) => a.order - b.order);

        if (activeSceneId) {
            return docScenes.filter(s => s.id === activeSceneId);
        }
        return docScenes;
    }, [scenes, activeDocumentId, activeSceneId]);

    const [showHint, setShowHint] = useState(() => getStoredValue('mythforge-hint-dismissed') !== 'true');

    const writingGoal = useWorkspaceStore((state) => state.writingGoal);
    const sessionWordCount = useWorkspaceStore((state) => state.sessionWordCount);
    const isTypewriterMode = useWorkspaceStore((state) => state.isTypewriterMode);
    const toggleTypewriterMode = useWorkspaceStore((state) => state.toggleTypewriterMode);
    const isFullscreen = useWorkspaceStore((state) => state.isFullscreen);
    const toggleFullscreen = useWorkspaceStore((state) => state.toggleFullscreen);
    const editorWidth = useWorkspaceStore((state) => state.editorWidth);
    const atmosphereReducedMotion = useWorkspaceStore((state) => state.atmosphereReducedMotion);

    const saveStateTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

    const [showFullscreenHint, setShowFullscreenHint] = useState(false);

    useEffect(() => {
        /* eslint-disable react-hooks/set-state-in-effect */
        if (isFullscreen) {
            setShowFullscreenHint(true);
            const t = setTimeout(() => {
                setShowFullscreenHint(false);
            }, 3000);
            return () => clearTimeout(t);
        } else {
            setShowFullscreenHint(false);
        }
        /* eslint-enable react-hooks/set-state-in-effect */
    }, [isFullscreen]);

    // Aggregate word count for the entire chapter
    const currentChapterWordCount = React.useMemo(() => {
        return activeScenes.reduce((acc, scene) => acc + (scene.wordCount || 0), 0);
    }, [activeScenes]);

    if (!activeDocument) {
        return (
            <div className={styles.editorWrapper} style={{ paddingTop: '2rem', paddingBottom: '2rem', paddingLeft: '2rem', paddingRight: '2rem', color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                Loading chapter...
            </div>
        );
    }

    if (activeScenes.length === 0) {
        return (
            <div className={styles.editorWrapper} style={{ paddingTop: '2rem', paddingBottom: '2rem', paddingLeft: '2rem', paddingRight: '2rem', color: '#888', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                <p>No scenes in this chapter</p>
                <button
                    onClick={() => {
                        const newScene = {
                            id: crypto.randomUUID(),
                            documentId: activeDocument.id,
                            projectId: activeDocument.projectId,
                            title: `Scene 1`,
                            content: '',
                            order: 0,
                            createdAt: new Date()
                        };
                        addScene(newScene);
                    }}
                    style={{
                        padding: '0.5rem 1rem',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-primary)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer'
                    }}
                >
                    Create Scene
                </button>
            </div>
        );
    }

    return (
        <div
            className={`${styles.editorWrapper} ${isTypewriterMode ? styles.typewriterActive : ''} ${atmosphereReducedMotion ? styles.reducedMotion : ''}`}
            style={{
                paddingTop: isTypewriterMode ? '45vh' : undefined,
                '--editor-width': `${editorWidth}px`,
            } as React.CSSProperties}
        >

            {!isFullscreen && (
                <div className={styles.editorToolbar}>
                    <button
                        className={`${styles.editorToolbarButton} ${isTypewriterMode ? styles.active : ''}`}
                        onClick={toggleTypewriterMode}
                        title="Typewriter Mode"
                        aria-label="Toggle Typewriter Mode"
                    >
                        ✍️
                    </button>
                    <button
                        className={`${styles.editorToolbarButton} ${isFullscreen ? styles.active : ''}`}
                        onClick={toggleFullscreen}
                        title="Fullscreen Mode (F11)"
                        aria-label="Toggle Fullscreen Mode"
                    >
                        ⛶
                    </button>
                </div>
            )}

            {isFullscreen && showFullscreenHint && (
                <div style={{
                    position: 'fixed',
                    bottom: '2rem',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(var(--background-rgb), 0.8)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid var(--border)',
                    padding: '0.5rem 1.5rem',
                    borderRadius: '24px',
                    color: 'var(--foreground)',
                    fontSize: '0.85rem',
                    zIndex: 9999,
                    animation: 'fadeIn 0.3s ease-in-out',
                    transition: 'opacity 0.3s ease-in-out',
                }}>
                    Press <kbd style={{ padding: '0.2rem 0.4rem', background: 'var(--surface)', borderRadius: '4px', border: '1px solid var(--border)', fontFamily: 'monospace' }}>Esc</kbd> to exit fullscreen
                </div>
            )}

            <div className={styles.editorHeader} style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <input
                        type="text"
                        className={styles.documentTitle}
                        value={activeDocument.title}
                        onChange={(e) => {
                            updateDocument(activeDocumentId!, { title: e.target.value });
                            setSaveState('saving');
                            if (saveStateTimerRef.current) clearTimeout(saveStateTimerRef.current);
                            saveStateTimerRef.current = setTimeout(() => {
                                setSaveState('saved');
                                saveStateTimerRef.current = setTimeout(() => setSaveState('idle'), 2000);
                            }, 500);
                        }}
                        placeholder="Untitled Chapter"
                        style={{ flex: 1 }}
                    />
                    {saveState !== 'idle' && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--muted)', marginLeft: '1rem', whiteSpace: 'nowrap' }}>
                            {saveState === 'saving' ? 'Saving...' : '✓ Saved'}
                        </span>
                    )}
                </div>
            </div>

            {/* RENDER ALL SCENES */}
            {activeScenes.map((scene, index) => (
                <React.Fragment key={scene.id}>
                    <SceneEditor scene={scene} index={index} />
                    {index < activeScenes.length - 1 && (
                        <div className={styles.sceneSeparator}>* * *</div>
                    )}
                </React.Fragment>
            ))}

            {(writingGoal.dailyTarget > 0 || writingGoal.sessionTarget > 0) && (
                <div className={styles.writingGoals}>
                    {writingGoal.dailyTarget > 0 && (
                        <div className={styles.goalRow}>
                            <div className={styles.goalInfo}>
                                <span>Daily Target</span>
                                <span>{currentChapterWordCount} / {writingGoal.dailyTarget}</span>
                            </div>
                            <div className={styles.progressBar}>
                                <div
                                    className={`${styles.progressFill} ${currentChapterWordCount >= writingGoal.dailyTarget ? styles.goalMet : ''}`}
                                    style={{ width: `${Math.min(100, (currentChapterWordCount / writingGoal.dailyTarget) * 100)}%` }}
                                />
                            </div>
                        </div>
                    )}
                    {writingGoal.sessionTarget > 0 && (
                        <div className={styles.goalRow}>
                            <div className={styles.goalInfo}>
                                <span>Session Target</span>
                                <span>{sessionWordCount} / {writingGoal.sessionTarget}</span>
                            </div>
                            <div className={styles.progressBar}>
                                <div
                                    className={`${styles.progressFill} ${sessionWordCount >= writingGoal.sessionTarget ? styles.goalMet : ''}`}
                                    style={{ width: `${Math.min(100, (sessionWordCount / writingGoal.sessionTarget) * 100)}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {showHint && (
                <div style={{
                    fontSize: '0.85rem',
                    color: '#888',
                    marginTop: '2rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(0,0,0,0.02)'
                }}>
                    <span>Tip: type [[ to instantly create a world entry without leaving your writing</span>
                    <button
                        onClick={() => {
                            setShowHint(false);
                            setStoredValue('mythforge-hint-dismissed', 'true');
                        }}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#888',
                            cursor: 'pointer',
                            fontSize: '1.2rem',
                            lineHeight: 1,
                            padding: '0 0.5rem'
                        }}
                        aria-label="Dismiss hint"
                        title="Dismiss"
                    >
                        ×
                    </button>
                </div>
            )}
        </div>
    );
}
