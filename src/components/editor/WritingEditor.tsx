import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import styles from './WritingEditor.module.css';
import { useWorkspaceStore, Scene, Document as MFDocument } from '@/store/workspaceStore';
import ShareModal from '../ui/ShareModal';
import { ShareCardOptions } from '@/lib/shareCard';
import { getStoredValue, setStoredValue } from '@/lib/storage';
import { EntityMark } from '@/lib/EntityMark';
import { ATMOSPHERE_PRESETS } from '@/lib/atmospherePresets';
import ScreenplayEditor from './ScreenplayEditor';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

/**
 * Custom FindReplace TipTap extension — ProseMirror-based, no npm packages.
 * Stores searchTerm, replaceTerm, matches[], and currentIndex in extension storage.
 * Adds decorations via a ProseMirror plugin to highlight matches in the document.
 */
interface FindReplaceStorage {
    searchTerm: string;
    results: { from: number; to: number }[];
    currentIndex: number;
}

const findReplacePluginKey = new PluginKey('findReplace');

/** Scans a ProseMirror doc for all case-insensitive occurrences of `term` */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findAllMatches(doc: any, term: string): { from: number; to: number }[] {
    if (!term) return [];
    const results: { from: number; to: number }[] = [];
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedTerm, 'gi');
    doc.descendants((node: { isText: boolean; text?: string }, pos: number) => {
        if (node.isText && node.text) {
            let match;
            while ((match = regex.exec(node.text)) !== null) {
                results.push({ from: pos + match.index, to: pos + match.index + match[0].length });
            }
        }
    });
    return results;
}

const FindReplace = Extension.create<Record<string, never>, FindReplaceStorage>({
    name: 'findReplace',

    addStorage() {
        return {
            searchTerm: '',
            results: [],
            currentIndex: 0,
        };
    },

    // @ts-expect-error — Custom commands do not satisfy Partial<RawCommands> but work at runtime
    addCommands() {
        return {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setSearchTerm: (term: string) => ({ editor }: { editor: any }) => {
                this.storage.searchTerm = term;
                this.storage.results = findAllMatches(editor.state.doc, term);
                this.storage.currentIndex = this.storage.results.length > 0 ? 0 : -1;
                // Force plugin state update by dispatching a no-op transaction
                editor.view.dispatch(editor.state.tr.setMeta(findReplacePluginKey, { updated: true }));
                return true;
            },

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            findNext: () => ({ editor }: { editor: any }) => {
                const { results } = this.storage;
                if (results.length === 0) return false;
                this.storage.currentIndex = (this.storage.currentIndex + 1) % results.length;
                const match = results[this.storage.currentIndex];
                editor.view.dispatch(editor.state.tr.setMeta(findReplacePluginKey, { updated: true }));
                // Scroll the current match into view by setting selection there
                editor.chain().setTextSelection(match).scrollIntoView().run();
                return true;
            },

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            findPrev: () => ({ editor }: { editor: any }) => {
                const { results } = this.storage;
                if (results.length === 0) return false;
                this.storage.currentIndex = (this.storage.currentIndex - 1 + results.length) % results.length;
                const match = results[this.storage.currentIndex];
                editor.view.dispatch(editor.state.tr.setMeta(findReplacePluginKey, { updated: true }));
                editor.chain().setTextSelection(match).scrollIntoView().run();
                return true;
            },

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            replaceOne: (replacement: string) => ({ editor }: { editor: any }) => {
                const { results, currentIndex } = this.storage;
                if (results.length === 0 || currentIndex < 0) return false;
                const match = results[currentIndex];
                // Replace via a ProseMirror transaction
                editor.chain()
                    .setTextSelection(match)
                    .insertContent(replacement)
                    .run();
                // Re-scan after replacement
                this.storage.results = findAllMatches(editor.state.doc, this.storage.searchTerm);
                if (this.storage.currentIndex >= this.storage.results.length) {
                    this.storage.currentIndex = 0;
                }
                editor.view.dispatch(editor.state.tr.setMeta(findReplacePluginKey, { updated: true }));
                return true;
            },

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            replaceAll: (term: string, replacement: string) => ({ editor }: { editor: any }) => {
                const matches = findAllMatches(editor.state.doc, term);
                if (matches.length === 0) return false;
                // Process in reverse order so earlier positions aren't shifted
                const { tr } = editor.state;
                for (let i = matches.length - 1; i >= 0; i--) {
                    tr.replaceWith(matches[i].from, matches[i].to, editor.state.schema.text(replacement));
                }
                editor.view.dispatch(tr);
                // Clear search results after replacing all
                this.storage.results = [];
                this.storage.currentIndex = -1;
                editor.view.dispatch(editor.state.tr.setMeta(findReplacePluginKey, { updated: true }));
                return true;
            },
        };
    },

    addProseMirrorPlugins() {
        const extensionStorage = this.storage;
        return [
            new Plugin({
                key: findReplacePluginKey,
                state: {
                    init() {
                        return DecorationSet.empty;
                    },
                    apply(tr, oldDecorations) {
                        // Only rebuild decorations when our meta flag is set
                        if (!tr.getMeta(findReplacePluginKey) && !tr.docChanged) {
                            return oldDecorations;
                        }
                        const { results, currentIndex } = extensionStorage;
                        if (results.length === 0) return DecorationSet.empty;
                        const decorations = results.map((match, i) => {
                            const className = i === currentIndex ? 'mythforge-search-current' : 'mythforge-search-match';
                            return Decoration.inline(match.from, match.to, { class: className });
                        });
                        return DecorationSet.create(tr.doc, decorations);
                    },
                },
                props: {
                    decorations(state) {
                        return this.getState(state) ?? DecorationSet.empty;
                    },
                },
            }),
        ];
    },
});

const EDITOR_PLACEHOLDER = '<p>Start writing your story here...</p>';

/**
 * Convert a string to title case.
 * Capitalizes the first letter of every word EXCEPT common small words
 * (a, an, the, and, but, or, for, nor, on, at, to, by, in, of, up)
 * unless they are the first word of the string.
 */
const TITLE_CASE_EXCEPTIONS = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'by', 'in', 'of', 'up']);
function toTitleCase(str: string): string {
    return str
        .trim()
        .split(/\s+/)
        .map((word, index) => {
            if (index === 0 || !TITLE_CASE_EXCEPTIONS.has(word.toLowerCase())) {
                return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
            }
            return word.toLowerCase();
        })
        .join(' ');
}

function SceneEditor({ scene, index, onEditorFocus, containerRef }: { scene: Scene, index: number, onEditorFocus: (editor: ReturnType<typeof useEditor>) => void, containerRef: (el: HTMLDivElement | null) => void }) {
    const activeProjectId = useWorkspaceStore((state) => state.activeProjectId);
    const updateScene = useWorkspaceStore((state) => state.updateScene);
    const openInlineCreator = useWorkspaceStore((state) => state.openInlineCreator);
    const entities = useWorkspaceStore((state) => state.entities);
    const setHoveredEntity = useWorkspaceStore((state) => state.setHoveredEntity);
    const isTypewriterMode = useWorkspaceStore((state) => state.isTypewriterMode);
    const baseFontSize = useWorkspaceStore((state) => state.baseFontSize);

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
            FindReplace,
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
        // Sprint 44: Register this editor as active when it gains focus
        onFocus: ({ editor: focusedEditor }) => {
            onEditorFocus(focusedEditor as ReturnType<typeof useEditor>);
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

    // Listen for global find/replace events from the FindReplaceBar
    useEffect(() => {
        if (!editor || editor.isDestroyed) return;

        // When the search term changes, scan this editor's document
        const handleSearchChange = (e: Event) => {
            const detail = (e as CustomEvent<{ term: string }>).detail;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (editor.commands as any).setSearchTerm(detail.term);
        };
        // Navigate to next match in this editor
        const handleFindNext = () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (editor.commands as any).findNext();
        };
        // Navigate to previous match
        const handleFindPrev = () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (editor.commands as any).findPrev();
        };
        // Replace current match
        const handleReplaceOne = (e: Event) => {
            const detail = (e as CustomEvent<{ replacement: string }>).detail;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (editor.commands as any).replaceOne(detail.replacement);
        };
        // Replace all matches
        const handleReplaceAll = (e: Event) => {
            const detail = (e as CustomEvent<{ term: string; replacement: string }>).detail;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (editor.commands as any).replaceAll(detail.term, detail.replacement);
        };

        window.addEventListener('mythforge:searchChange', handleSearchChange);
        window.addEventListener('mythforge:findNext', handleFindNext);
        window.addEventListener('mythforge:findPrev', handleFindPrev);
        window.addEventListener('mythforge:replaceOne', handleReplaceOne);
        window.addEventListener('mythforge:replaceAll', handleReplaceAll);

        return () => {
            window.removeEventListener('mythforge:searchChange', handleSearchChange);
            window.removeEventListener('mythforge:findNext', handleFindNext);
            window.removeEventListener('mythforge:findPrev', handleFindPrev);
            window.removeEventListener('mythforge:replaceOne', handleReplaceOne);
            window.removeEventListener('mythforge:replaceAll', handleReplaceAll);
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
            data-scene-id={scene.id}
            ref={containerRef}
            style={{
                '--base-font-size': `${baseFontSize}px`,
                ...(currentAtmosphere && atmosphereTypographyEnabled ? {
                    '--atmosphere-line-height-shift': currentAtmosphere.lineHeightShift,
                    '--atmosphere-letter-spacing-shift': currentAtmosphere.letterSpacingShift
                } : {})
            } as React.CSSProperties}
        >
            <EditorContent editor={editor} />
        </div>
    );
}

/**
 * Sprint 44: ContextBar — sticky bar with breadcrumb + formatting + controls.
 * Renders inside WritingEditor, not a separate file.
 */
function ContextBar({
    activeEditor,
    visibleSceneId,
    documents,
    scenes,
    activeProjectId,
    activeDocumentId,
    activeDocument,
    writingMode,
    updateDocument,
    updateScene,
    updateProject,
    isTypewriterMode,
    toggleTypewriterMode,
    isFocusMode,
    toggleFocusMode,
    isFullscreen,
    toggleFullscreen,
    toggleToolbarVisible,
    saveState,
    isStandardFormat,
    toggleStandardFormat,
    baseFontSize,
    setBaseFontSize,
    isCompact,
}: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    activeEditor: any;
    visibleSceneId: string | null;
    documents: MFDocument[];
    scenes: Scene[];
    activeProjectId: string | null;
    activeDocumentId: string | null;
    activeDocument: MFDocument;
    writingMode: string;
    updateDocument: (id: string, updates: Partial<Omit<MFDocument, 'id' | 'projectId' | 'createdAt'>>) => void;
    updateScene: (id: string, updates: Partial<Omit<Scene, 'id' | 'documentId' | 'projectId' | 'createdAt'>>) => void;
    updateProject: (id: string, updates: Record<string, unknown>) => void;
    isTypewriterMode: boolean;
    toggleTypewriterMode: () => void;
    isFocusMode: boolean;
    toggleFocusMode: () => void;
    isFullscreen: boolean;
    toggleFullscreen: () => void;
    toggleToolbarVisible: () => void;
    saveState: 'idle' | 'saving' | 'saved';
    isStandardFormat: boolean;
    toggleStandardFormat: () => void;
    baseFontSize: number;
    setBaseFontSize: (size: number) => void;
    isCompact?: boolean;
}) {
    // Inline editing state for chapter and scene names
    const [editingChapter, setEditingChapter] = useState(false);
    const [editingScene, setEditingScene] = useState(false);
    const [chapterDraft, setChapterDraft] = useState('');
    const [sceneDraft, setSceneDraft] = useState('');

    // Compute chapter number from document order within the project
    const projectDocs = documents.filter(d => d.projectId === activeProjectId).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const chapterNumber = projectDocs.findIndex(d => d.id === activeDocumentId) + 1;

    // Compute visible scene data
    const docScenes = scenes.filter(s => s.documentId === activeDocumentId).sort((a, b) => a.order - b.order);
    const visibleScene = visibleSceneId ? docScenes.find(s => s.id === visibleSceneId) : docScenes[0];
    const sceneNumber = visibleScene ? docScenes.indexOf(visibleScene) + 1 : 1;

    // Does the document have a custom (non-default) title?
    const docTitle = activeDocument.title;
    const hasCustomDocTitle = docTitle && docTitle !== 'Untitled Chapter' && docTitle.trim() !== '';

    // Does the scene have a custom (non-default) title?
    const sceneTitle = visibleScene?.title || '';
    const isDefaultSceneTitle = /^Scene \d+$/.test(sceneTitle);
    const hasCustomSceneTitle = sceneTitle && !isDefaultSceneTitle && sceneTitle.trim() !== '';

    // Visible scene word count
    const visibleWordCount = visibleScene?.wordCount || 0;

    // Chapter name save — auto title case before persisting
    const saveChapterName = () => {
        if (activeDocumentId && chapterDraft.trim()) {
            updateDocument(activeDocumentId, { title: toTitleCase(chapterDraft) });
        }
        setEditingChapter(false);
    };

    // Scene name save — auto title case before persisting
    const saveSceneName = () => {
        if (visibleScene && sceneDraft.trim()) {
            updateScene(visibleScene.id, { title: toTitleCase(sceneDraft) });
        }
        setEditingScene(false);
    };

    return (
        <div className={`${styles.contextBar} ${isCompact ? styles.contextBarCompact : ''}`}>
            {isCompact ? (
                <>
                    <div className={styles.contextBarRow}>
                        {/* LEFT — Breadcrumb context */}
                        <div className={styles.contextBreadcrumb}>
                            {/* Chapter number (read-only) */}
                            <span className={styles.breadcrumbNumber}>Chapter {chapterNumber}</span>

                            {/* Chapter custom name — click to edit */}
                            {editingChapter ? (
                                <input
                                    className={styles.breadcrumbInput}
                                    value={chapterDraft}
                                    onChange={(e) => setChapterDraft(e.target.value)}
                                    onBlur={saveChapterName}
                                    onKeyDown={(e) => { if (e.key === 'Enter') saveChapterName(); }}
                                    autoFocus
                                    placeholder="Chapter name"
                                />
                            ) : hasCustomDocTitle ? (
                                <span
                                    className={styles.breadcrumbName}
                                    onClick={() => { setChapterDraft(docTitle); setEditingChapter(true); }}
                                    title="Click to rename chapter"
                                >
                                    : {docTitle}<span className={styles.breadcrumbPencil}>✏</span>
                                </span>
                            ) : (
                                <span
                                    className={styles.breadcrumbNamePlaceholder}
                                    onClick={() => { setChapterDraft(''); setEditingChapter(true); }}
                                    title="Click to add chapter name"
                                >
                                    + name
                                </span>
                            )}

                            {/* Separator */}
                            <span className={styles.breadcrumbSep}>›</span>

                            {/* Scene number (read-only) */}
                            <span className={styles.breadcrumbNumber}>Scene {sceneNumber}</span>

                            {/* Scene custom name — click to edit */}
                            {editingScene ? (
                                <input
                                    className={styles.breadcrumbInput}
                                    value={sceneDraft}
                                    onChange={(e) => setSceneDraft(e.target.value)}
                                    onBlur={saveSceneName}
                                    onKeyDown={(e) => { if (e.key === 'Enter') saveSceneName(); }}
                                    autoFocus
                                    placeholder="Scene name"
                                />
                            ) : hasCustomSceneTitle ? (
                                <span
                                    className={styles.breadcrumbName}
                                    onClick={() => { setSceneDraft(sceneTitle); setEditingScene(true); }}
                                    title="Click to rename scene"
                                >
                                    : {sceneTitle}<span className={styles.breadcrumbPencil}>✏</span>
                                </span>
                            ) : (
                                <span
                                    className={styles.breadcrumbNamePlaceholder}
                                    onClick={() => { setSceneDraft(''); setEditingScene(true); }}
                                    title="Click to add scene name"
                                >
                                    + name
                                </span>
                            )}

                            {/* Word count — after scene portion, updates with visibleSceneId */}
                            <span className={styles.breadcrumbWordCount}>· {visibleWordCount.toLocaleString()} words</span>

                            {/* Autosave indicator */}
                            {saveState !== 'idle' && (
                                <span className={styles.breadcrumbSave}>
                                    {saveState === 'saving' ? 'Saving...' : '✓ Saved'}
                                </span>
                            )}
                        </div>

                        {/* RIGHT — Mode selector, toggles */}
                        <div className={styles.contextRight}>
                            <select
                                className={styles.toolbarSelect}
                                value={writingMode}
                                onChange={(e) => {
                                    if (activeProjectId) {
                                        updateProject(activeProjectId, { writingMode: e.target.value });
                                    }
                                }}
                                title="Writing Mode"
                            >
                                <option value="novel">📖 Novel</option>
                                <option value="screenplay">🎬 Screenplay</option>
                                <option value="markdown">📝 Markdown</option>
                                <option value="poetry">✍️ Poetry</option>
                            </select>
                            <button className={`${styles.toolbarBtn} ${isTypewriterMode ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); toggleTypewriterMode(); }} title="Typewriter Mode (Ctrl+Shift+W)">✍️</button>
                            <button className={`${styles.toolbarBtn} ${isStandardFormat ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); toggleStandardFormat(); }} title="Standard Format (720px) (Ctrl+Shift+P)">📄</button>
                            <button className={`${styles.toolbarBtn} ${isFocusMode ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); toggleFocusMode(); }} title="Focus Mode">◎</button>
                            <button className={`${styles.toolbarBtn} ${isFullscreen ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); toggleFullscreen(); }} title="Fullscreen">⛶</button>
                            <button className={styles.toolbarBtn} onMouseDown={(e) => { e.preventDefault(); toggleToolbarVisible(); }} title="Hide Toolbar">⊟</button>
                        </div>
                    </div>

                    <div className={styles.contextBarRow}>
                        {/* CENTER — Formatting tools (only for non-screenplay modes) */}
                        <div className={styles.contextFormatting}>
                            <div className={styles.toolbarGroup} style={{ borderRight: 'none' }}>
                                <select
                                    className={styles.toolbarSelect}
                                    value={baseFontSize}
                                    onChange={(e) => setBaseFontSize(Number(e.target.value))}
                                    title="Font Size"
                                >
                                    {[14, 16, 18, 20, 22, 24, 28, 32, 40].map(size => (
                                        <option key={size} value={size}>{size}px</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        {writingMode !== 'screenplay' && (
                            <div className={styles.contextFormatting}>
                                {/* Paragraph style dropdown */}
                                <select
                                    className={styles.toolbarSelect}
                                    value={
                                        activeEditor?.isActive('heading', { level: 1 }) ? 'h1' :
                                            activeEditor?.isActive('heading', { level: 2 }) ? 'h2' :
                                                activeEditor?.isActive('heading', { level: 3 }) ? 'h3' :
                                                    activeEditor?.isActive('blockquote') ? 'blockquote' : 'p'
                                    }
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === 'p') activeEditor?.chain().focus().setParagraph().run();
                                        else if (val === 'h1') activeEditor?.chain().focus().toggleHeading({ level: 1 }).run();
                                        else if (val === 'h2') activeEditor?.chain().focus().toggleHeading({ level: 2 }).run();
                                        else if (val === 'h3') activeEditor?.chain().focus().toggleHeading({ level: 3 }).run();
                                        else if (val === 'blockquote') activeEditor?.chain().focus().toggleBlockquote().run();
                                    }}
                                >
                                    <option value="p">Paragraph</option>
                                    <option value="h1">H1</option>
                                    <option value="h2">H2</option>
                                    <option value="h3">H3</option>
                                    <option value="blockquote">Quote</option>
                                </select>

                                {/* Text formatting */}
                                <div className={styles.toolbarGroup}>
                                    <button className={`${styles.toolbarBtn} ${activeEditor?.isActive('bold') ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); activeEditor?.chain().focus().toggleBold().run(); }} title="Bold"><strong>B</strong></button>
                                    <button className={`${styles.toolbarBtn} ${activeEditor?.isActive('italic') ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); activeEditor?.chain().focus().toggleItalic().run(); }} title="Italic"><em>I</em></button>
                                    <button className={`${styles.toolbarBtn} ${activeEditor?.isActive('underline') ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); activeEditor?.chain().focus().toggleUnderline().run(); }} title="Underline"><u>U</u></button>
                                    <button className={`${styles.toolbarBtn} ${activeEditor?.isActive('strike') ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); activeEditor?.chain().focus().toggleStrike().run(); }} title="Strikethrough"><s>S</s></button>
                                    <button className={`${styles.toolbarBtn} ${activeEditor?.isActive('blockquote') ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); activeEditor?.chain().focus().toggleBlockquote().run(); }} title="Block Quote">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" /><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" /></svg>
                                    </button>
                                </div>

                                {/* Alignment */}
                                <div className={styles.toolbarGroup}>
                                    <button className={`${styles.toolbarBtn} ${activeEditor?.isActive({ textAlign: 'left' }) ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); activeEditor?.chain().focus().setTextAlign('left').run(); }} title="Align Left">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="15" y2="12" /><line x1="3" y1="18" x2="18" y2="18" /></svg>
                                    </button>
                                    <button className={`${styles.toolbarBtn} ${activeEditor?.isActive({ textAlign: 'center' }) ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); activeEditor?.chain().focus().setTextAlign('center').run(); }} title="Align Center">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="6" y1="12" x2="18" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /></svg>
                                    </button>
                                    <button className={`${styles.toolbarBtn} ${activeEditor?.isActive({ textAlign: 'right' }) ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); activeEditor?.chain().focus().setTextAlign('right').run(); }} title="Align Right">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="9" y1="12" x2="21" y2="12" /><line x1="6" y1="18" x2="21" y2="18" /></svg>
                                    </button>
                                </div>

                                {/* Lists */}
                                <div className={styles.toolbarGroup}>
                                    <button className={`${styles.toolbarBtn} ${activeEditor?.isActive('bulletList') ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); activeEditor?.chain().focus().toggleBulletList().run(); }} title="Bullet List">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="9" y1="6" x2="20" y2="6" /><line x1="9" y1="12" x2="20" y2="12" /><line x1="9" y1="18" x2="20" y2="18" /><circle cx="4" cy="6" r="1.5" fill="currentColor" /><circle cx="4" cy="12" r="1.5" fill="currentColor" /><circle cx="4" cy="18" r="1.5" fill="currentColor" /></svg>
                                    </button>
                                    <button className={`${styles.toolbarBtn} ${activeEditor?.isActive('orderedList') ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); activeEditor?.chain().focus().toggleOrderedList().run(); }} title="Numbered List">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="21" y2="6" /><line x1="10" y1="12" x2="21" y2="12" /><line x1="10" y1="18" x2="21" y2="18" /><text x="1" y="8" fontSize="6" fill="currentColor" stroke="none">1.</text><text x="1" y="14" fontSize="6" fill="currentColor" stroke="none">2.</text><text x="1" y="20" fontSize="6" fill="currentColor" stroke="none">3.</text></svg>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <>
                    {/* LEFT — Breadcrumb context */}
                    <div className={styles.contextBreadcrumb}>
                        {/* Chapter number (read-only) */}
                        <span className={styles.breadcrumbNumber}>Chapter {chapterNumber}</span>

                        {/* Chapter custom name — click to edit */}
                        {editingChapter ? (
                            <input
                                className={styles.breadcrumbInput}
                                value={chapterDraft}
                                onChange={(e) => setChapterDraft(e.target.value)}
                                onBlur={saveChapterName}
                                onKeyDown={(e) => { if (e.key === 'Enter') saveChapterName(); }}
                                autoFocus
                                placeholder="Chapter name"
                            />
                        ) : hasCustomDocTitle ? (
                            <span
                                className={styles.breadcrumbName}
                                onClick={() => { setChapterDraft(docTitle); setEditingChapter(true); }}
                                title="Click to rename chapter"
                            >
                                : {docTitle}<span className={styles.breadcrumbPencil}>✏</span>
                            </span>
                        ) : (
                            <span
                                className={styles.breadcrumbNamePlaceholder}
                                onClick={() => { setChapterDraft(''); setEditingChapter(true); }}
                                title="Click to add chapter name"
                            >
                                + name
                            </span>
                        )}

                        {/* Separator */}
                        <span className={styles.breadcrumbSep}>›</span>

                        {/* Scene number (read-only) */}
                        <span className={styles.breadcrumbNumber}>Scene {sceneNumber}</span>

                        {/* Scene custom name — click to edit */}
                        {editingScene ? (
                            <input
                                className={styles.breadcrumbInput}
                                value={sceneDraft}
                                onChange={(e) => setSceneDraft(e.target.value)}
                                onBlur={saveSceneName}
                                onKeyDown={(e) => { if (e.key === 'Enter') saveSceneName(); }}
                                autoFocus
                                placeholder="Scene name"
                            />
                        ) : hasCustomSceneTitle ? (
                            <span
                                className={styles.breadcrumbName}
                                onClick={() => { setSceneDraft(sceneTitle); setEditingScene(true); }}
                                title="Click to rename scene"
                            >
                                : {sceneTitle}<span className={styles.breadcrumbPencil}>✏</span>
                            </span>
                        ) : (
                            <span
                                className={styles.breadcrumbNamePlaceholder}
                                onClick={() => { setSceneDraft(''); setEditingScene(true); }}
                                title="Click to add scene name"
                                >
                                + name
                            </span>
                        )}

                        {/* Word count — after scene portion, updates with visibleSceneId */}
                        <span className={styles.breadcrumbWordCount}>· {visibleWordCount.toLocaleString()} words</span>

                        {/* Autosave indicator */}
                        {saveState !== 'idle' && (
                            <span className={styles.breadcrumbSave}>
                                {saveState === 'saving' ? 'Saving...' : '✓ Saved'}
                            </span>
                        )}
                    </div>

                    {/* CENTER — Formatting tools (only for non-screenplay modes) */}
                    {writingMode !== 'screenplay' && (
                        <div className={styles.contextFormatting}>
                            {/* Paragraph style dropdown */}
                            <select
                                className={styles.toolbarSelect}
                                value={
                                    activeEditor?.isActive('heading', { level: 1 }) ? 'h1' :
                                        activeEditor?.isActive('heading', { level: 2 }) ? 'h2' :
                                            activeEditor?.isActive('heading', { level: 3 }) ? 'h3' :
                                                activeEditor?.isActive('blockquote') ? 'blockquote' : 'p'
                                }
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === 'p') activeEditor?.chain().focus().setParagraph().run();
                                    else if (val === 'h1') activeEditor?.chain().focus().toggleHeading({ level: 1 }).run();
                                    else if (val === 'h2') activeEditor?.chain().focus().toggleHeading({ level: 2 }).run();
                                    else if (val === 'h3') activeEditor?.chain().focus().toggleHeading({ level: 3 }).run();
                                    else if (val === 'blockquote') activeEditor?.chain().focus().toggleBlockquote().run();
                                }}
                            >
                                <option value="p">Paragraph</option>
                                <option value="h1">H1</option>
                                <option value="h2">H2</option>
                                <option value="h3">H3</option>
                                <option value="blockquote">Quote</option>
                            </select>

                            {/* Text formatting */}
                            <div className={styles.toolbarGroup}>
                                <button className={`${styles.toolbarBtn} ${activeEditor?.isActive('bold') ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); activeEditor?.chain().focus().toggleBold().run(); }} title="Bold"><strong>B</strong></button>
                                <button className={`${styles.toolbarBtn} ${activeEditor?.isActive('italic') ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); activeEditor?.chain().focus().toggleItalic().run(); }} title="Italic"><em>I</em></button>
                                <button className={`${styles.toolbarBtn} ${activeEditor?.isActive('underline') ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); activeEditor?.chain().focus().toggleUnderline().run(); }} title="Underline"><u>U</u></button>
                                <button className={`${styles.toolbarBtn} ${activeEditor?.isActive('strike') ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); activeEditor?.chain().focus().toggleStrike().run(); }} title="Strikethrough"><s>S</s></button>
                                <button className={`${styles.toolbarBtn} ${activeEditor?.isActive('blockquote') ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); activeEditor?.chain().focus().toggleBlockquote().run(); }} title="Block Quote">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" /><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" /></svg>
                                </button>
                            </div>

                            {/* Alignment */}
                            <div className={styles.toolbarGroup}>
                                <button className={`${styles.toolbarBtn} ${activeEditor?.isActive({ textAlign: 'left' }) ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); activeEditor?.chain().focus().setTextAlign('left').run(); }} title="Align Left">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="15" y2="12" /><line x1="3" y1="18" x2="18" y2="18" /></svg>
                                </button>
                                <button className={`${styles.toolbarBtn} ${activeEditor?.isActive({ textAlign: 'center' }) ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); activeEditor?.chain().focus().setTextAlign('center').run(); }} title="Align Center">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="6" y1="12" x2="18" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /></svg>
                                </button>
                                <button className={`${styles.toolbarBtn} ${activeEditor?.isActive({ textAlign: 'right' }) ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); activeEditor?.chain().focus().setTextAlign('right').run(); }} title="Align Right">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="9" y1="12" x2="21" y2="12" /><line x1="6" y1="18" x2="21" y2="18" /></svg>
                                </button>
                            </div>

                            {/* Lists */}
                            <div className={styles.toolbarGroup}>
                                <button className={`${styles.toolbarBtn} ${activeEditor?.isActive('bulletList') ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); activeEditor?.chain().focus().toggleBulletList().run(); }} title="Bullet List">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="9" y1="6" x2="20" y2="6" /><line x1="9" y1="12" x2="20" y2="12" /><line x1="9" y1="18" x2="20" y2="18" /><circle cx="4" cy="6" r="1.5" fill="currentColor" /><circle cx="4" cy="12" r="1.5" fill="currentColor" /><circle cx="4" cy="18" r="1.5" fill="currentColor" /></svg>
                                </button>
                                <button className={`${styles.toolbarBtn} ${activeEditor?.isActive('orderedList') ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); activeEditor?.chain().focus().toggleOrderedList().run(); }} title="Numbered List">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="21" y2="6" /><line x1="10" y1="12" x2="21" y2="12" /><line x1="10" y1="18" x2="21" y2="18" /><text x="1" y="8" fontSize="6" fill="currentColor" stroke="none">1.</text><text x="1" y="14" fontSize="6" fill="currentColor" stroke="none">2.</text><text x="1" y="20" fontSize="6" fill="currentColor" stroke="none">3.</text></svg>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* RIGHT — Mode selector, toggles */}
                    <div className={styles.contextRight}>
                        <select
                            className={styles.toolbarSelect}
                            value={writingMode}
                            onChange={(e) => {
                                if (activeProjectId) {
                                    updateProject(activeProjectId, { writingMode: e.target.value });
                                }
                            }}
                            title="Writing Mode"
                        >
                            <option value="novel">📖 Novel</option>
                            <option value="screenplay">🎬 Screenplay</option>
                            <option value="markdown">📝 Markdown</option>
                            <option value="poetry">✍️ Poetry</option>
                        </select>
                        <button className={`${styles.toolbarBtn} ${isTypewriterMode ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); toggleTypewriterMode(); }} title="Typewriter Mode (Ctrl+Shift+W)">✍️</button>
                        <button className={`${styles.toolbarBtn} ${isStandardFormat ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); toggleStandardFormat(); }} title="Standard Format (720px) (Ctrl+Shift+P)">📄</button>
                        <button className={`${styles.toolbarBtn} ${isFocusMode ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); toggleFocusMode(); }} title="Focus Mode">◎</button>
                        <button className={`${styles.toolbarBtn} ${isFullscreen ? styles.toolbarBtnActive : ''}`} onMouseDown={(e) => { e.preventDefault(); toggleFullscreen(); }} title="Fullscreen">⛶</button>
                        <button className={styles.toolbarBtn} onMouseDown={(e) => { e.preventDefault(); toggleToolbarVisible(); }} title="Hide Toolbar">⊟</button>
                    </div>
                </>
            )}
        </div>
    );
}

/**
 * Writing Editor Container
 * Renders all scenes in the active chapter.
 */
export default function WritingEditor() {
    const editorWrapperRef = useRef<HTMLDivElement>(null);
    const [isCompact, setIsCompact] = useState(false);

    useEffect(() => {
        if (!editorWrapperRef.current) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setIsCompact(entry.contentRect.width < 800);
            }
        });

        observer.observe(editorWrapperRef.current);
        return () => observer.disconnect();
    }, []);

    const documents = useWorkspaceStore((state) => state.documents);
    const activeDocumentId = useWorkspaceStore((state) => state.activeDocumentId);
    const activeSceneId = useWorkspaceStore((state) => state.activeSceneId);
    const updateDocument = useWorkspaceStore((state) => state.updateDocument);

    const scenes = useWorkspaceStore((state) => state.scenes);
    const addScene = useWorkspaceStore((state) => state.addScene);

    const activeDocument = documents.find(d => d.id === activeDocumentId);

    const isStandardFormat = useWorkspaceStore((state) => state.isStandardFormat);
    const toggleStandardFormat = useWorkspaceStore((state) => state.toggleStandardFormat);
    const baseFontSize = useWorkspaceStore((state) => state.baseFontSize);
    const setBaseFontSize = useWorkspaceStore((state) => state.setBaseFontSize);

    // Sprint 44: Local UI toggle for ContextBar layout
    const isContextBarCompact = isCompact; // Renamed for clarity in ContextBar props

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
    const updateScene = useWorkspaceStore((state) => state.updateScene);

    // Session share milestone state
    const [sessionMilestoneReached, setSessionMilestoneReached] = useState(false);
    const [dismissedSessionMilestone, setDismissedSessionMilestone] = useState(false);
    const [shareData, setShareData] = useState<ShareCardOptions | null>(null);

    // Monitor for 1000 word session milestone
    useEffect(() => {
        if (sessionWordCount >= 1000 && !sessionMilestoneReached) {
            setSessionMilestoneReached(true);
        }
    }, [sessionWordCount, sessionMilestoneReached]);

    // Sprint 44: Active editor ref — updated when a SceneEditor gains focus
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const activeEditorRef = useRef<any>(null);
    // Force re-render counter so ContextBar formatting buttons update
    const [, setEditorTick] = useState(0);
    const handleEditorFocus = useCallback((editor: ReturnType<typeof useEditor>) => {
        activeEditorRef.current = editor;
        setEditorTick(t => t + 1);
    }, []);

    // Sprint 44: IntersectionObserver to track which scene is most visible
    const [visibleSceneId, setVisibleSceneId] = useState<string | null>(null);
    const sceneRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
    const observerRef = useRef<IntersectionObserver | null>(null);

    // Set up IntersectionObserver once
    useEffect(() => {
        observerRef.current = new IntersectionObserver(
            (entries) => {
                let bestEntry: IntersectionObserverEntry | null = null;
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        if (!bestEntry || entry.intersectionRatio > bestEntry.intersectionRatio) {
                            bestEntry = entry;
                        }
                    }
                });
                if (bestEntry) {
                    const sceneId = (bestEntry as IntersectionObserverEntry).target.getAttribute('data-scene-id');
                    if (sceneId) setVisibleSceneId(sceneId);
                }
            },
            { threshold: [0, 0.25, 0.5, 0.75, 1.0] }
        );
        return () => { observerRef.current?.disconnect(); };
    }, []);

    // Callback ref for scene containers — observe/unobserve
    const setSceneRef = useCallback((sceneId: string) => (el: HTMLDivElement | null) => {
        const map = sceneRefsMap.current;
        const prev = map.get(sceneId);
        if (prev && observerRef.current) observerRef.current.unobserve(prev);
        if (el) {
            map.set(sceneId, el);
            if (observerRef.current) observerRef.current.observe(el);
        } else {
            map.delete(sceneId);
        }
    }, []);

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

    // Task 3: Find & Replace state — dispatches events to all SceneEditors
    const [isFindOpen, setIsFindOpen] = useState(false);
    const [isReplaceVisible, setIsReplaceVisible] = useState(false);
    const [findTerm, setFindTerm] = useState('');
    const [replaceTerm, setReplaceTerm] = useState('');

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
            } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'w') {
                e.preventDefault();
                toggleTypewriterMode();
            } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
                e.preventDefault();
                toggleStandardFormat();
            } else if (e.key === 'Escape' && isFindOpen) {
                // Close find/replace bar and clear search highlights
                setIsFindOpen(false);
                setFindTerm('');
                setReplaceTerm('');
                // Clear highlights from all editors
                window.dispatchEvent(new CustomEvent('mythforge:searchChange', { detail: { term: '' } }));
            }
        };
        window.addEventListener('keydown', handleFindKeys);
        return () => window.removeEventListener('keydown', handleFindKeys);
    }, [isFindOpen, toggleTypewriterMode, toggleStandardFormat]);

    // Dispatch searchTerm to all SceneEditors whenever it changes
    useEffect(() => {
        window.dispatchEvent(new CustomEvent('mythforge:searchChange', { detail: { term: findTerm } }));
    }, [findTerm]);

    // ProseMirror-based find next: dispatch event to all SceneEditors
    const handleFindNext = React.useCallback(() => {
        window.dispatchEvent(new CustomEvent('mythforge:findNext'));
    }, []);

    // ProseMirror-based find previous
    const handleFindPrev = React.useCallback(() => {
        window.dispatchEvent(new CustomEvent('mythforge:findPrev'));
    }, []);

    // Replace current match via ProseMirror transaction
    const handleReplaceOne = React.useCallback(() => {
        window.dispatchEvent(new CustomEvent('mythforge:replaceOne', { detail: { replacement: replaceTerm } }));
    }, [replaceTerm]);

    // Replace all via ProseMirror transactions (reverse iteration)
    const handleReplaceAll = React.useCallback(() => {
        window.dispatchEvent(new CustomEvent('mythforge:replaceAll', {
            detail: { term: findTerm, replacement: replaceTerm }
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
            ref={editorWrapperRef}
            className={`${styles.editorWrapper} ${isTypewriterMode ? styles.typewriterActive : ''} ${atmosphereReducedMotion ? styles.reducedMotion : ''}`}
            style={{
                '--editor-width': `${editorWidth}px`,
                '--base-font-size': `${baseFontSize}px`,
            } as React.CSSProperties}
        >

            {isToolbarVisible && (
                <ContextBar
                    activeEditor={activeEditorRef.current}
                    visibleSceneId={visibleSceneId}
                    documents={documents}
                    scenes={scenes}
                    activeProjectId={activeProjectId}
                    activeDocumentId={activeDocumentId}
                    activeDocument={activeDocument}
                    writingMode={writingMode}
                    updateDocument={updateDocument}
                    updateScene={updateScene}
                    updateProject={updateProject}
                    isTypewriterMode={isTypewriterMode}
                    toggleTypewriterMode={toggleTypewriterMode}
                    isFocusMode={isFocusMode}
                    toggleFocusMode={toggleFocusMode}
                    isFullscreen={isFullscreen}
                    toggleFullscreen={toggleFullscreen}
                    toggleToolbarVisible={toggleToolbarVisible}
                    saveState={saveState}
                    isStandardFormat={isStandardFormat}
                    toggleStandardFormat={toggleStandardFormat}
                    baseFontSize={baseFontSize}
                    setBaseFontSize={setBaseFontSize}
                    isCompact={isContextBarCompact}
                />
            )}
            {!isToolbarVisible && (
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
                        <span className={styles.findCount}>{findTerm ? '🔍' : ''}</span>
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


            {/* RENDER CONTENT AREA WITH TYPEWRITER PADDING */}
            <div 
                className={styles.editorBody}
                style={{ paddingTop: isTypewriterMode ? '45vh' : undefined }}
            >
                {/* RENDER ALL SCENES */}
                {activeScenes.map((scene, index) => (
                    <React.Fragment key={scene.id}>
                        {writingMode === 'screenplay' ? (
                            <ScreenplayEditor scene={scene} />
                        ) : (
                            <SceneEditor scene={scene} index={index} onEditorFocus={handleEditorFocus} containerRef={setSceneRef(scene.id)} />
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

                {/* Session Milestone Toast */}
                {sessionMilestoneReached && !dismissedSessionMilestone && (
                    <div className={styles.sessionMilestoneToast}>
                        <span className={styles.sessionMilestoneText}>
                            Great session! <strong>{sessionWordCount.toLocaleString()} words</strong> written. Share your progress?
                        </span>
                        <button 
                            className={styles.sessionShareBtn}
                            onClick={() => setShareData({
                                projectName: activeProject?.name || 'MythForge',
                                projectCoverColor: activeProject?.coverColor,
                                milestoneType: 'session',
                                milestoneValue: sessionWordCount,
                                milestoneLabel: 'Words written'
                            })}
                        >
                            Share
                        </button>
                        <button 
                            className={styles.sessionCloseBtn}
                            onClick={() => setDismissedSessionMilestone(true)}
                        >
                            ×
                        </button>
                    </div>
                )}
            </div>

            {/* Share Modal */}
            <ShareModal 
                isOpen={!!shareData} 
                onClose={() => setShareData(null)} 
                shareData={shareData || {
                    projectName: '',
                    milestoneType: 'session',
                    milestoneValue: 0,
                    milestoneLabel: ''
                }}
            />
        </div>
    );
}
