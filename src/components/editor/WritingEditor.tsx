import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import styles from './WritingEditor.module.css';
import { useWorkspaceStore, Scene } from '@/store/workspaceStore';
import { getStoredValue, setStoredValue } from '@/lib/storage';
import { EntityMark } from '@/lib/EntityMark';
import { ATMOSPHERE_PRESETS } from '@/lib/atmospherePresets';
import ScreenplayEditor from './ScreenplayEditor';

// TypeScript declaration for window.find (non-standard but supported in all major browsers)
declare global {
    interface Window {
        find(text: string, caseSensitive?: boolean, backwards?: boolean, wrapAround?: boolean, wholeWord?: boolean, searchInFrames?: boolean, showDialog?: boolean): boolean;
    }
}

const EDITOR_PLACEHOLDER = '<p>Start writing your story here...</p>';

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
    const projects = useWorkspaceStore((state) => state.projects);
    const activeProject = projects.find(p => p.id === activeProjectId);
    const writingMode = activeProject?.writingMode || 'novel';

    const openInlineCreatorRef = React.useRef(openInlineCreator);
    const entitiesRef = React.useRef(entities.filter(e => e.projectId === activeProjectId));
    const setHoveredEntityRef = React.useRef(setHoveredEntity);
    const isTypewriterModeRef = React.useRef(isTypewriterMode);

    const debounceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const initialWordCountRef = React.useRef<number | null>(null);

    useEffect(() => {
        openInlineCreatorRef.current = openInlineCreator;
        entitiesRef.current = entities.filter(e => e.projectId === activeProjectId);
        setHoveredEntityRef.current = setHoveredEntity;
        isTypewriterModeRef.current = isTypewriterMode;
    }, [openInlineCreator, entities, activeProjectId, setHoveredEntity, isTypewriterMode]);

    const editor = useEditor({
        extensions: [
            StarterKit,
            EntityMark,
            Underline,
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
        ],
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
            }
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

                // Task 1: Dispatch custom event so the autosave indicator in WritingEditor fires
                window.dispatchEvent(new CustomEvent('mythforge:contentSaved'));

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
            className={`${styles.sceneContainer} ${styles[(writingMode || 'novel') + 'Mode'] || ''}`}
            style={{
                ...(currentAtmosphere && atmosphereTypographyEnabled ? {
                    '--atmosphere-line-height-shift': currentAtmosphere.lineHeightShift,
                    '--atmosphere-letter-spacing-shift': currentAtmosphere.letterSpacingShift
                } : {})
            } as React.CSSProperties}
        >
            <div className={styles.sceneToolbar}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', marginRight: 'auto' }}>
                    {scene.title}
                </span>
                <span>{scene.wordCount || 0} words</span>
            </div>

            {/* Formatting toolbar — always visible, highlights on focus */}
            {writingMode !== 'screenplay' && (
                <div className={styles.sceneFormatBar}>
                    {/* Paragraph style */}
                    <select
                        className={styles.toolbarSelect}
                        value={
                            editor?.isActive('heading', { level: 1 }) ? 'h1' :
                                editor?.isActive('heading', { level: 2 }) ? 'h2' :
                                    editor?.isActive('heading', { level: 3 }) ? 'h3' :
                                        editor?.isActive('blockquote') ? 'blockquote' : 'p'
                        }
                        onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'p') editor?.chain().focus().setParagraph().run();
                            else if (val === 'h1') editor?.chain().focus().toggleHeading({ level: 1 }).run();
                            else if (val === 'h2') editor?.chain().focus().toggleHeading({ level: 2 }).run();
                            else if (val === 'h3') editor?.chain().focus().toggleHeading({ level: 3 }).run();
                            else if (val === 'blockquote') editor?.chain().focus().toggleBlockquote().run();
                        }}
                    >
                        <option value="p">Paragraph</option>
                        <option value="h1">Heading 1</option>
                        <option value="h2">Heading 2</option>
                        <option value="h3">Heading 3</option>
                        <option value="blockquote">Block Quote</option>
                    </select>

                    {/* Text formatting */}
                    <div className={styles.toolbarGroup}>
                        <button className={`${styles.toolbarBtn} ${editor?.isActive('bold') ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().toggleBold().run(); }} title="Bold"><strong>B</strong></button>
                        <button className={`${styles.toolbarBtn} ${editor?.isActive('italic') ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().toggleItalic().run(); }} title="Italic"><em>I</em></button>
                        <button className={`${styles.toolbarBtn} ${editor?.isActive('underline') ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().toggleUnderline().run(); }} title="Underline"><u>U</u></button>
                        <button className={`${styles.toolbarBtn} ${editor?.isActive('strike') ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().toggleStrike().run(); }} title="Strikethrough"><s>S</s></button>
                        <button className={`${styles.toolbarBtn} ${editor?.isActive('blockquote') ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().toggleBlockquote().run(); }} title="Block Quote">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" /><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" /></svg>
                        </button>
                    </div>

                    {/* Alignment */}
                    <div className={styles.toolbarGroup}>
                        <button className={`${styles.toolbarBtn} ${editor?.isActive({ textAlign: 'left' }) ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().setTextAlign('left').run(); }} title="Align Left">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="15" y2="12" /><line x1="3" y1="18" x2="18" y2="18" /></svg>
                        </button>
                        <button className={`${styles.toolbarBtn} ${editor?.isActive({ textAlign: 'center' }) ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().setTextAlign('center').run(); }} title="Align Center">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="6" y1="12" x2="18" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /></svg>
                        </button>
                        <button className={`${styles.toolbarBtn} ${editor?.isActive({ textAlign: 'right' }) ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().setTextAlign('right').run(); }} title="Align Right">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="9" y1="12" x2="21" y2="12" /><line x1="6" y1="18" x2="21" y2="18" /></svg>
                        </button>
                    </div>

                    {/* Lists */}
                    <div className={styles.toolbarGroup}>
                        <button className={`${styles.toolbarBtn} ${editor?.isActive('bulletList') ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().toggleBulletList().run(); }} title="Bullet List">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="9" y1="6" x2="20" y2="6" /><line x1="9" y1="12" x2="20" y2="12" /><line x1="9" y1="18" x2="20" y2="18" /><circle cx="4" cy="6" r="1.5" fill="currentColor" /><circle cx="4" cy="12" r="1.5" fill="currentColor" /><circle cx="4" cy="18" r="1.5" fill="currentColor" /></svg>
                        </button>
                        <button className={`${styles.toolbarBtn} ${editor?.isActive('orderedList') ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().toggleOrderedList().run(); }} title="Numbered List">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="21" y2="6" /><line x1="10" y1="12" x2="21" y2="12" /><line x1="10" y1="18" x2="21" y2="18" /><text x="1" y="8" fontSize="6" fill="currentColor" stroke="none">1.</text><text x="1" y="14" fontSize="6" fill="currentColor" stroke="none">2.</text><text x="1" y="20" fontSize="6" fill="currentColor" stroke="none">3.</text></svg>
                        </button>
                    </div>
                </div>
            )}

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
    const activeProjectId = useWorkspaceStore((state) => state.activeProjectId);
    const projects = useWorkspaceStore((state) => state.projects);
    const updateProject = useWorkspaceStore((state) => state.updateProject);
    const activeProject = projects.find(p => p.id === activeProjectId);
    const writingMode = activeProject?.writingMode || 'novel';

    const isTypewriterMode = useWorkspaceStore((state) => state.isTypewriterMode);
    const toggleTypewriterMode = useWorkspaceStore((state) => state.toggleTypewriterMode);
    const isFullscreen = useWorkspaceStore((state) => state.isFullscreen);
    const toggleFullscreen = useWorkspaceStore((state) => state.toggleFullscreen);
    const isFocusMode = useWorkspaceStore((state) => state.isFocusMode);
    const toggleFocusMode = useWorkspaceStore((state) => state.toggleFocusMode);
    const isToolbarVisible = useWorkspaceStore((state) => state.isToolbarVisible);
    const toggleToolbarVisible = useWorkspaceStore((state) => state.toggleToolbarVisible);
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

    // Task 1: Wire autosave indicator to content changes via mythforge:contentSaved event
    useEffect(() => {
        const handleContentSaved = () => {
            /* eslint-disable react-hooks/set-state-in-effect */
            setSaveState('saving');
            if (saveStateTimerRef.current) clearTimeout(saveStateTimerRef.current);
            // Visual delay to show "Saving..." briefly before "Saved"
            setTimeout(() => {
                setSaveState('saved');
                saveStateTimerRef.current = setTimeout(() => setSaveState('idle'), 2000);
            }, 500);
            /* eslint-enable react-hooks/set-state-in-effect */
        };
        window.addEventListener('mythforge:contentSaved', handleContentSaved);
        return () => window.removeEventListener('mythforge:contentSaved', handleContentSaved);
    }, []);

    // Task 3: Find & Replace state (custom, no npm packages)
    const [isFindOpen, setIsFindOpen] = useState(false);
    const [isReplaceVisible, setIsReplaceVisible] = useState(false);
    const [findTerm, setFindTerm] = useState('');
    const [replaceTerm, setReplaceTerm] = useState('');
    const [matchCount, setMatchCount] = useState(0);
    const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

    // Ctrl+F and Ctrl+H keyboard shortcuts for find/replace
    useEffect(() => {
        const handleFindKeys = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                /* eslint-disable react-hooks/set-state-in-effect */
                setIsFindOpen(true);
                setIsReplaceVisible(false);
                /* eslint-enable react-hooks/set-state-in-effect */
                setTimeout(() => document.getElementById('mythforge-find-input')?.focus(), 50);
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
                e.preventDefault();
                /* eslint-disable react-hooks/set-state-in-effect */
                setIsFindOpen(true);
                setIsReplaceVisible(true);
                /* eslint-enable react-hooks/set-state-in-effect */
                setTimeout(() => document.getElementById('mythforge-replace-input')?.focus(), 50);
            } else if (e.key === 'Escape' && isFindOpen) {
                // Close find/replace bar on Escape
                setIsFindOpen(false);
                setFindTerm('');
                setReplaceTerm('');
            }
        };
        window.addEventListener('keydown', handleFindKeys);
        return () => window.removeEventListener('keydown', handleFindKeys);
    }, [isFindOpen]);

    // Count matches whenever findTerm changes
    useEffect(() => {
        if (!findTerm) {
            setMatchCount(0);
            setCurrentMatchIndex(0);
            // Remove any existing highlights
            document.querySelectorAll('.mythforge-search-highlight').forEach(el => {
                const parent = el.parentNode;
                if (parent) {
                    parent.replaceChild(document.createTextNode(el.textContent || ''), el);
                    parent.normalize();
                }
            });
            return;
        }
        // Highlight logic is deferred to when the user navigates — we just count here
        const editorWrapper = document.querySelector(`.${styles.editorWrapper}`);
        if (!editorWrapper) return;
        const textContent = editorWrapper.textContent || '';
        const regex = new RegExp(findTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const matches = textContent.match(regex);
        setMatchCount(matches ? matches.length : 0);
        setCurrentMatchIndex(matches && matches.length > 0 ? 1 : 0);
    }, [findTerm]);

    // Find next match and scroll to it
    const handleFindNext = React.useCallback(() => {
        if (!findTerm || matchCount === 0) return;
        // Use window.find for native browser text search navigation
        const found = window.find(findTerm, false, false, true, false, false, false);
        if (!found) {
            // Wrap around to beginning
            const sel = window.getSelection();
            if (sel) sel.removeAllRanges();
            window.find(findTerm, false, false, true, false, false, false);
        }
        setCurrentMatchIndex(prev => prev >= matchCount ? 1 : prev + 1);
    }, [findTerm, matchCount]);

    // Find previous match
    const handleFindPrev = React.useCallback(() => {
        if (!findTerm || matchCount === 0) return;
        const found = window.find(findTerm, false, true, true, false, false, false);
        if (!found) {
            const sel = window.getSelection();
            if (sel) sel.removeAllRanges();
            window.find(findTerm, false, true, true, false, false, false);
        }
        setCurrentMatchIndex(prev => prev <= 1 ? matchCount : prev - 1);
    }, [findTerm, matchCount]);

    // Replace current match
    const handleReplaceOne = React.useCallback(() => {
        if (!findTerm) return;
        const sel = window.getSelection();
        // Only replace if the current selection matches the find term
        if (sel && sel.toString().toLowerCase() === findTerm.toLowerCase()) {
            document.execCommand('insertText', false, replaceTerm);
            // After replacing, the match count changed — recount
            setMatchCount(prev => Math.max(0, prev - 1));
        }
        // Advance to next match
        handleFindNext();
    }, [findTerm, replaceTerm, handleFindNext]);

    // Replace all matches
    const handleReplaceAll = React.useCallback(() => {
        if (!findTerm) return;
        // Dispatch replaceAll event to all SceneEditors
        window.dispatchEvent(new CustomEvent('mythforge:replaceAll', {
            detail: { findTerm, replaceTerm }
        }));
    }, [findTerm, replaceTerm]);

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

            {!isFullscreen && isToolbarVisible && (
                <div className={styles.richToolbar}>
                    {/* Writing mode */}
                    <select
                        className={styles.toolbarSelect}
                        value={writingMode}
                        onChange={(e) => {
                            if (activeProjectId) {
                                updateProject(activeProjectId, { writingMode: e.target.value as 'novel' | 'screenplay' | 'markdown' | 'poetry' });
                            }
                        }}
                        title="Writing Mode"
                    >
                        <option value="novel">📖 Novel</option>
                        <option value="screenplay">🎬 Screenplay</option>
                        <option value="markdown">📝 Markdown</option>
                        <option value="poetry">✍️ Poetry</option>
                    </select>

                    {/* Right side controls */}
                    <div className={styles.toolbarGroupRight}>
                        <button className={`${styles.toolbarBtn} ${isTypewriterMode ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); toggleTypewriterMode(); }} title="Typewriter Mode">✍️</button>
                        <button className={`${styles.toolbarBtn} ${isFocusMode ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); toggleFocusMode(); }} title="Focus Mode">◎</button>
                        <button className={`${styles.toolbarBtn} ${isFullscreen ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); toggleFullscreen(); }} title="Fullscreen">⛶</button>
                        <button className={styles.toolbarBtn} onMouseDown={(e) => { e.preventDefault(); toggleToolbarVisible(); }} title="Hide Toolbar">⊟</button>
                    </div>
                </div>
            )}
            {!isFullscreen && !isToolbarVisible && (
                <button className={styles.toolbarShowBtn} onMouseDown={(e) => { e.preventDefault(); toggleToolbarVisible(); }} title="Show Toolbar">⊞</button>
            )}

            {/* Task 3: Find & Replace Bar — sticky below toolbar, above editor header */}
            {isFindOpen && (
                <div className={styles.findReplaceBar}>
                    <div className={styles.findRow}>
                        <input
                            id="mythforge-find-input"
                            type="text"
                            className={styles.findInput}
                            placeholder="Find..."
                            value={findTerm}
                            onChange={(e) => setFindTerm(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); handleFindNext(); }
                            }}
                        />
                        <span className={styles.findCount}>{matchCount > 0 ? `${currentMatchIndex}/${matchCount}` : '0'}</span>
                        <button className={styles.findBtn} onMouseDown={(e) => { e.preventDefault(); handleFindPrev(); }} title="Previous">←</button>
                        <button className={styles.findBtn} onMouseDown={(e) => { e.preventDefault(); handleFindNext(); }} title="Next">→</button>
                        {isReplaceVisible && (
                            <>
                                <input
                                    id="mythforge-replace-input"
                                    type="text"
                                    className={styles.findInput}
                                    placeholder="Replace..."
                                    value={replaceTerm}
                                    onChange={(e) => setReplaceTerm(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') { e.preventDefault(); handleReplaceOne(); }
                                    }}
                                />
                                <button className={styles.findBtn} onMouseDown={(e) => { e.preventDefault(); handleReplaceOne(); }} title="Replace">Replace</button>
                                <button className={styles.findBtn} onMouseDown={(e) => { e.preventDefault(); handleReplaceAll(); }} title="Replace All">All</button>
                            </>
                        )}
                        <button
                            className={styles.findBtn}
                            onMouseDown={(e) => { e.preventDefault(); setIsReplaceVisible(!isReplaceVisible); }}
                            title={isReplaceVisible ? 'Hide Replace' : 'Show Replace'}
                        >
                            {isReplaceVisible ? '▲' : '▼'}
                        </button>
                        <button
                            className={styles.findCloseBtn}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                setIsFindOpen(false);
                                setFindTerm('');
                                setReplaceTerm('');
                            }}
                            title="Close"
                        >
                            ×
                        </button>
                    </div>
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

                {/* Chapter total word count — shown only when viewing multiple scenes */}
                {!activeSceneId && activeScenes.length > 1 && (
                    <div className={styles.chapterWordCount}>
                        {currentChapterWordCount.toLocaleString()} words total
                    </div>
                )}
            </div>

            {/* RENDER ALL SCENES */}
            {activeScenes.map((scene, index) => (
                <React.Fragment key={scene.id}>
                    {writingMode === 'screenplay' ? (
                        <ScreenplayEditor scene={scene} />
                    ) : (
                        <SceneEditor scene={scene} index={index} />
                    )}
                    {index < activeScenes.length - 1 && (
                        <hr className={styles.sceneSeparator} />
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

            {/* Task 2: Exit Focus pill — persistent bottom-center button when focus mode is on */}
            {isFocusMode && (
                <button
                    className={styles.exitFocusPill}
                    onMouseDown={(e) => { e.preventDefault(); toggleFocusMode(); }}
                    title="Exit Focus Mode (Esc)"
                >
                    Exit Focus
                </button>
            )}
        </div>
    );
}
