"use client";

import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import styles from './WritingEditor.module.css';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { getStoredValue, setStoredValue } from '@/lib/storage';
import { EntityMark } from '@/lib/EntityMark';
import { BreadcrumbBar } from '@/components/navigation/BreadcrumbBar';

const EDITOR_PLACEHOLDER = '<p>Start writing your story here...</p>';

/**
 * Writing Editor
 * 
 * The primary surface for the application. This must remain distraction-free.
 * 
 * WHY TIPTAP INSTEAD OF NATIVE contentEditable?
 * We rely on Tiptap because native `contentEditable` is notoriously unpredictable across browsers.
 * For our core promise "Creation happens at the point of inspiration," we need absolute certainty 
 * when capturing keystrokes, managing the cursor position, and programmatically inserting 
 * Entity Tags without destroying the DOM or the writer's flow. 
 * Tiptap provides a headless, predictable ProseMirror foundation we can cleanly build upon.
 * 
 * WHY A CONTROLLED INPUT FOR THE TITLE?
 * The document title is distinct from the rich text flow. Using a standard controlled React input
 * allows us to cleanly parse the chapter name in the React boundary without dealing with nested 
 * contentEditable nodes or ProseMirror documents. It looks identical to the text flow via CSS.
 */
export default function WritingEditor() {
    const documents = useWorkspaceStore((state) => state.documents);
    const activeDocumentId = useWorkspaceStore((state) => state.activeDocumentId);
    const activeProjectId = useWorkspaceStore((state) => state.activeProjectId);
    const updateDocument = useWorkspaceStore((state) => state.updateDocument);

    const scenes = useWorkspaceStore((state) => state.scenes);
    const activeSceneId = useWorkspaceStore((state) => state.activeSceneId);
    const updateScene = useWorkspaceStore((state) => state.updateScene);
    const addScene = useWorkspaceStore((state) => state.addScene);
    const setActiveScene = useWorkspaceStore((state) => state.setActiveScene);

    const activeDocument = documents.find(d => d.id === activeDocumentId);
    const activeScene = scenes.find(s => s.id === activeSceneId);

    const [showHint, setShowHint] = useState(() => {
        return getStoredValue('mythforge-hint-dismissed') !== 'true';
    });

    const openInlineCreator = useWorkspaceStore((state) => state.openInlineCreator);
    const entities = useWorkspaceStore((state) => state.entities);
    const setHoveredEntity = useWorkspaceStore((state) => state.setHoveredEntity);
    const writingGoal = useWorkspaceStore((state) => state.writingGoal);
    const sessionWordCount = useWorkspaceStore((state) => state.sessionWordCount);
    const setSessionWordCount = useWorkspaceStore((state) => state.setSessionWordCount);
    const isTypewriterMode = useWorkspaceStore((state) => state.isTypewriterMode);
    const isFullscreen = useWorkspaceStore((state) => state.isFullscreen);
    const editorWidth = useWorkspaceStore((state) => state.editorWidth);

    // FIX: ZUSTAND SELECTOR STABILITY
    // Tiptap's `useEditor` config object does not reliably react to external state
    // changes once initialized without causing re-renders or stale closures during
    // rapid typing (onUpdate). By storing our Zustand action in a mutable ref, we 
    // guarantee `onUpdate` always calls the freshest version of the function.
    const openInlineCreatorRef = React.useRef(openInlineCreator);
    const entitiesRef = React.useRef(entities.filter(e => e.projectId === activeProjectId));
    const setHoveredEntityRef = React.useRef(setHoveredEntity);
    const isTypewriterModeRef = React.useRef(isTypewriterMode);

    // TRACKER: Defends the main thread from rapid keystroke starvation.
    const debounceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const saveStateTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [liveWordCount, setLiveWordCount] = useState<number>(activeScene?.wordCount || 0);
    const initialWordCountRef = React.useRef<number | null>(null);

    useEffect(() => {
        openInlineCreatorRef.current = openInlineCreator;
        entitiesRef.current = entities.filter(e => e.projectId === activeProjectId);
        setHoveredEntityRef.current = setHoveredEntity;
        isTypewriterModeRef.current = isTypewriterMode;
    }, [openInlineCreator, entities, activeProjectId, setHoveredEntity, isTypewriterMode]);

    const [showFullscreenHint, setShowFullscreenHint] = useState(false);

    useEffect(() => {
        if (isFullscreen) {
            // eslint-disable-next-line
            setShowFullscreenHint(true);
            const t = setTimeout(() => setShowFullscreenHint(false), 3000);
            return () => clearTimeout(t);
        } else {
            setShowFullscreenHint(false);
        }
    }, [isFullscreen]);

    const editor = useEditor({
        extensions: [
            StarterKit,
            EntityMark,
        ],
        // MIGRATION: 
        // We now initialize directly from our activeScene content mapped within the store.
        // We fall back conditionally to our placeholder constant.
        content: activeScene?.content || EDITOR_PLACEHOLDER,
        autofocus: true,
        immediatelyRender: false,
        onCreate: ({ editor }) => {
            const count = editor.getText().split(/\s+/).filter(w => w.length > 0).length;
            setLiveWordCount(count);
            initialWordCountRef.current = count;
        },
        editorProps: {
            attributes: {
                class: styles.editorContent,
            },
        },
        onUpdate: ({ editor }) => {
            setSaveState('saving');

            const currentText = editor.getText();
            const count = currentText.split(/\s+/).filter(w => w.length > 0).length;
            setLiveWordCount(count);

            if (initialWordCountRef.current !== null) {
                const added = count - initialWordCountRef.current;
                setSessionWordCount(Math.max(0, added));
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
                // Find all text block nodes where the `[[` was typed.
                // We use ProseMirror's state structure to cleanly delete just the trigger characters
                // without erasing any preceding real text.
                const state = editor.state;
                const tr = state.tr;
                let triggerFound = false;

                state.doc.descendants((node, pos) => {
                    if (node.isText && node.text?.includes('[[')) {
                        const triggerStart = pos + node.text.indexOf('[[');
                        // Delete exactly the two `[` characters
                        tr.delete(triggerStart, triggerStart + 2);
                        triggerFound = true;
                    }
                });

                if (triggerFound) {
                    // 1. Dispatch the deletion transaction back to the editor
                    editor.view.dispatch(tr);

                    // 2. Call the ref-stabilized Zustand action
                    openInlineCreatorRef.current();
                }
            }

            // ENTITY DETECTION PASS
            // PERFORMANCE DEBOUNCE: Scanning the full document tree and dispatching 
            // ProseMirror Mark transactions on every keystroke causes severe input lag 
            // on large documents. We debounce this pass by 300ms, ensuring it only 
            // evaluates when the user naturally pauses typing.
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }

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
                            let index;
                            while ((index = textLower.indexOf(matchStr, startIndex)) > -1) {
                                desiredMarks.push({
                                    start: pos + index,
                                    end: pos + index + entity.name.length,
                                    id: entity.id
                                });
                                startIndex = index + matchStr.length;
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

                // Guard against empty state overwrite pollution
                if (rawContent === EDITOR_PLACEHOLDER) {
                    if (activeSceneId) updateScene(activeSceneId, { content: '', wordCount: 0 });
                } else {
                    if (activeSceneId) updateScene(activeSceneId, { content: rawContent, wordCount: count });
                }

                setSaveState('saved');
                if (saveStateTimerRef.current) clearTimeout(saveStateTimerRef.current);
                saveStateTimerRef.current = setTimeout(() => setSaveState('idle'), 2000);

            }, 300);
        },
    });

    // FIX: DECOUPLED EDITOR FOCUS
    // We listen for a custom event emitted by UI modals when they close.
    // This allows the UI overlays to return focus to the writing flow without
    // needing a direct React prop/ref dependency to this specific component instance.
    useEffect(() => {
        const handleFocusReturn = () => {
            if (editor && !editor.isDestroyed) {
                editor.commands.focus();
            }
        };

        window.addEventListener('mythforge:returnFocusToEditor', handleFocusReturn);

        return () => {
            window.removeEventListener('mythforge:returnFocusToEditor', handleFocusReturn);
        };
    }, [editor]);

    // DOM EVENT DELEGATION
    // Attach pure DOM event listeners to the editor root element to capture pointer
    // events bubbling up from the dynamic `.entity-tag` spans injected by the EntityMark.
    // This allows seamless hover-previews without muddying the React render cycle or ProseMirror state.
    useEffect(() => {
        if (!editor || editor.isDestroyed) return;

        const handleMouseOver = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target && target.classList.contains('entity-tag')) {
                const entityId = target.getAttribute('data-entity-id');
                if (entityId) {
                    setHoveredEntityRef.current(entityId);
                }
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
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            if (editor) {
                editor.destroy();
            }
        };
    }, [editor]);

    // --- RENDER ---

    // Guard against mounting the editor shell if Rehydration hasn't resolved
    // the document targeting yet. Prevents flashing defaults.
    if (!activeDocument) {
        return (
            <div className={styles.editorWrapper} style={{ paddingTop: '2rem', paddingBottom: '2rem', paddingLeft: '2rem', paddingRight: '2rem', color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                Loading chapter...
            </div>
        );
    }

    if (!activeScene) {
        return (
            <div className={styles.editorWrapper} style={{ paddingTop: '2rem', paddingBottom: '2rem', paddingLeft: '2rem', paddingRight: '2rem', color: '#888', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                <p>No scene selected</p>
                <button
                    onClick={() => {
                        const newScene = {
                            id: crypto.randomUUID(),
                            documentId: activeDocument.id,
                            projectId: activeDocument.projectId,
                            title: `Scene ${scenes.filter(s => s.documentId === activeDocument.id).length + 1}`,
                            content: '',
                            order: scenes.filter(s => s.documentId === activeDocument.id).length,
                            createdAt: new Date()
                        };
                        addScene(newScene);
                        setActiveScene(newScene.id);
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
            className={`${styles.editorWrapper} ${isTypewriterMode ? styles.typewriterActive : ''}`}
            style={{
                paddingTop: isTypewriterMode ? '45vh' : undefined,
                paddingBottom: isTypewriterMode ? '45vh' : undefined,
                '--editor-width': `${editorWidth}px`
            } as React.CSSProperties}
        >
            {!isFullscreen && <BreadcrumbBar />}

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

            <div className={styles.editorHeader} style={{ display: 'flex', alignItems: 'center' }}>
                {/* Document Title / Chapter Metadata */}
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
                <span style={{ fontSize: '0.8rem', color: 'var(--muted)', marginLeft: '1rem', whiteSpace: 'nowrap' }}>
                    {liveWordCount} words
                </span>
            </div>

            <EditorContent editor={editor} />

            {(writingGoal.dailyTarget > 0 || writingGoal.sessionTarget > 0) && (
                <div className={styles.writingGoals}>
                    {writingGoal.dailyTarget > 0 && (
                        <div className={styles.goalRow}>
                            <div className={styles.goalInfo}>
                                <span>Daily Target</span>
                                <span>{activeScene?.wordCount || liveWordCount} / {writingGoal.dailyTarget}</span>
                            </div>
                            <div className={styles.progressBar}>
                                <div
                                    className={`${styles.progressFill} ${(activeScene?.wordCount || liveWordCount) >= writingGoal.dailyTarget ? styles.goalMet : ''}`}
                                    style={{ width: `${Math.min(100, ((activeScene?.wordCount || liveWordCount) / writingGoal.dailyTarget) * 100)}%` }}
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

            {/* 
             * FIRST-RUN ONBOARDING PATTERN: 
             * Contextual onboarding is less disruptive than upfront tours.
             * We guide the writer towards power features (slash commands / inline entries)
             * at the point of need, and save their dismissal natively. 
             */}
            {showHint && (
                <div style={{
                    fontSize: '0.85rem',
                    color: '#888',
                    marginTop: '1rem',
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
