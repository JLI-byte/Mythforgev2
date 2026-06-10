"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useWorkspaceStore, EntityType, ENTITY_TYPE_LABELS } from '@/store/workspaceStore';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import Highlight from '@tiptap/extension-highlight';
import Color from '@tiptap/extension-color';
import { Extension } from '@tiptap/core';
import { useShallow } from 'zustand/react/shallow';
import styles from './WritingDesk.module.css';

import { NewProjectModal } from '@/components/ui/NewProjectModal';
import { ImportModal } from '@/components/ui/ImportModal';
import { ProjectSettingsModal } from '@/components/ui/ProjectSettingsModal';
import ScreenplayEditor from '@/components/editor/ScreenplayEditor';
import { useWritingSession } from '@/lib/useWritingSession';

type BinderMode = 'shown' | 'hidden' | 'smart';


// ============================================================
// CUSTOM TIPTAP EXTENSIONS
// ============================================================

const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return {
      types: ['textStyle'],
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize?.replace(/['"]+/g, ''),
            renderHTML: (attributes: Record<string, any>) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize: (fontSize: string) => ({ chain }: any) => {
        return chain().setMark('textStyle', { fontSize }).run();
      },
      unsetFontSize: () => ({ chain }: any) => {
        return chain().setMark('textStyle', { fontSize: null }).run();
      },
    } as any;
  },
});

import { Node as TiptapNode, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';

const ChapterSeparator = TiptapNode.create({
  name: 'chapterSeparator',
  group: 'block',
  selectable: true,
  draggable: true,
  atom: true,
  addAttributes() {
    return {
      id: { default: null },
      title: { default: 'New Chapter' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="chapter-separator"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'chapter-separator', class: 'chapter-separator' })];
  },
});

const SceneSeparator = TiptapNode.create({
  name: 'sceneSeparator',
  group: 'block',
  selectable: true,
  draggable: true,
  atom: true,
  addAttributes() {
    return {
      id: { default: null },
      title: { default: 'New Scene' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="scene-separator"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'scene-separator', class: 'scene-separator' })];
  },
});

const ChapterTitleNodeView = (props: any) => {
  const updateProject = useWorkspaceStore(s => s.updateProject);
  const updateDocument = useWorkspaceStore(s => s.updateDocument);
  const { node, updateAttributes } = props;

  return (
    <NodeViewWrapper className={styles.bookViewChapterSeparator}>
      <div className={styles.bookViewSeparatorLine} onMouseDown={e => e.stopPropagation()}>
        <span>--- CHAPTER: </span>
        <input 
          className={styles.bookViewSeparatorInput}
          value={node.attrs.title}
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
          onChange={e => {
            const val = e.target.value;
            updateAttributes({ title: val });
            if (node.attrs.id) {
              updateDocument(node.attrs.id, { title: val });
            }
          }}
        />
        <span> ---</span>
      </div>
    </NodeViewWrapper>
  );
};

const SceneTitleNodeView = (props: any) => {
  const updateScene = useWorkspaceStore(s => s.updateScene);
  const { node, updateAttributes } = props;

  return (
    <NodeViewWrapper className={styles.bookViewSceneSeparator}>
      <div className={styles.bookViewSeparatorLine} onMouseDown={e => e.stopPropagation()}>
        <span>--- Scene: </span>
        <input 
          className={styles.bookViewSeparatorInput}
          value={node.attrs.title}
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
          onChange={e => {
            const val = e.target.value;
            updateAttributes({ title: val });
            if (node.attrs.id) {
              updateScene(node.attrs.id, { title: val });
            }
          }}
        />
        <span> ---</span>
      </div>
    </NodeViewWrapper>
  );
};

function BookViewEditor({ activeSceneId }: { activeSceneId?: string }) {
  const activeProjectId = useWorkspaceStore(s => s.activeProjectId);
  const projectDocs = useWorkspaceStore(useShallow(s => s.documents.filter(d => d.projectId === activeProjectId).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())));
  const allScenes = useWorkspaceStore(useShallow(s => s.scenes.filter(sc => sc.projectId === activeProjectId)));
  const updateScene = useWorkspaceStore(s => s.updateScene);
  const updateDocument = useWorkspaceStore(s => s.updateDocument);
  const addDocument = useWorkspaceStore(s => s.addDocument);
  const addScene = useWorkspaceStore(s => s.addScene);

  const assembleHTML = useCallback(() => {
    let html = '';
    projectDocs.forEach(doc => {
      html += `<div data-type="chapter-separator" id="${doc.id}" title="${doc.title.replace(/"/g, '&quot;')}"></div>`;
      if (doc.content) html += doc.content;
      
      const scenes = allScenes.filter(s => s.documentId === doc.id).sort((a,b) => a.order - b.order);
      scenes.forEach(s => {
        html += `<div data-type="scene-separator" id="${s.id}" title="${s.title.replace(/"/g, '&quot;')}"></div>`;
        html += s.content;
      });
    });
    return html;
  }, [projectDocs, allScenes]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      FontFamily,
      Highlight.configure({ multicolor: true }),
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      ChapterSeparator.extend({
        addNodeView() { return ReactNodeViewRenderer(ChapterTitleNodeView); }
      }),
      SceneSeparator.extend({
        addNodeView() { return ReactNodeViewRenderer(SceneTitleNodeView); }
      }),
    ],
    content: assembleHTML(),
    immediatelyRender: false,
    editorProps: {
      attributes: { class: styles.deskEditorContent }
    },
    onUpdate: ({ editor }) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const html = editor.getHTML();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const children = Array.from(doc.body.children);

        let currentSectionId: string | null = null;
        let currentSectionType: 'chapter' | 'scene' | null = null;
        let currentBuffer: string[] = [];
        const updates: { id: string, type: 'chapter' | 'scene', content: string }[] = [];

        children.forEach(child => {
          const type = child.getAttribute('data-type');
          if (type === 'chapter-separator' || type === 'scene-separator') {
            if (currentSectionId) {
              updates.push({ id: currentSectionId, type: currentSectionType!, content: currentBuffer.join('') });
            }
            currentSectionId = child.getAttribute('id');
            currentSectionType = type === 'chapter-separator' ? 'chapter' : 'scene';
            currentBuffer = [];
          } else {
            currentBuffer.push(child.outerHTML);
          }
        });

        if (currentSectionId) {
          updates.push({ id: currentSectionId, type: currentSectionType!, content: currentBuffer.join('') });
        }

        updates.forEach(u => {
          if (u.type === 'chapter') {
            const existing = projectDocs.find(d => d.id === u.id);
            if (existing && existing.content !== u.content) {
              updateDocument(u.id, { content: u.content });
            }
          } else {
            const existing = allScenes.find(s => s.id === u.id);
            if (existing && existing.content !== u.content) {
              const words = parser.parseFromString(u.content, 'text/html').body.textContent?.split(/\s+/).filter(w => w.length > 0).length || 0;
              updateScene(u.id, { content: u.content, wordCount: words });
            }
          }
        });
      }, 500);
    }
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  useEffect(() => {
    if (!editor || !activeSceneId) return;
    const el = editor.options.element as HTMLElement;
    const target = el?.querySelector?.(`[id="${activeSceneId}"]`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [editor, activeSceneId]);

  if (!editor) return null;

  return (
    <div className={styles.deskEditorWrapper}>
      <div className={styles.deskEditorToolbar}>
        <div className={styles.deskToolbarGroup}>
          <button className={styles.deskFmtBtn} onClick={() => editor.chain().focus().toggleBold().run()}>B</button>
          <button className={styles.deskFmtBtn} onClick={() => editor.chain().focus().toggleItalic().run()}>I</button>
        </div>
      </div>
      <div className={styles.deskEditorBody}>
        <div className={styles.deskEditorContent}>
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}


// =============================================
// TYPES & CONSTANTS
// =============================================

// Moved DeskWidget and DeskWidgetType to workspaceStore.ts

import { DeskWidget, DeskWidgetType } from '@/store/workspaceStore';

const MIN_W = 160;
const MIN_H = 100;

const DEFAULT_DIMS: Record<DeskWidgetType, { w: number; h: number }> = {
  writingZone: { w: 900, h: 600 },
  sticky:      { w: 200, h: 200 },
  reference:   { w: 300, h: 400 },
  image:       { w: 300, h: 360 },
  biblePinit:  { w: 280, h: 380 },
  sceneControl: { w: 320, h: 540 },
  characterState: { w: 340, h: 580 },
  continuity: { w: 340, h: 600 },
  structure: { w: 380, h: 640 },
  research: { w: 420, h: 680 },
  progress: { w: 340, h: 480 },
  relMap: { w: 440, h: 540 },
  draftNav: { w: 340, h: 620 },
  untyped:     { w: 300, h: 200 },
};

const PALETTE_ITEMS: { type: DeskWidgetType; icon: string; label: string }[] = [
  { type: 'writingZone', icon: '🖋️', label: 'Writing Zone' },
  { type: 'sticky',      icon: '📌', label: 'Sticky Note' },
  { type: 'reference',   icon: '🗂️', label: 'Ref Card' },
  { type: 'image',       icon: '🖼️', label: 'Image Pin' },
  { type: 'biblePinit',  icon: '📖', label: 'Bible Pin' },
  { type: 'sceneControl',icon: '🎬', label: 'Scene Control' },
  { type: 'characterState',icon: '👤', label: 'Character State' },
  { type: 'continuity',    icon: '⛓️', label: 'Continuity' },
  { type: 'structure',     icon: '🏗️', label: 'Structure' },
  { type: 'research',      icon: '🎨', label: 'Research' },
  { type: 'progress',      icon: '📈', label: 'Progress' },
  { type: 'relMap',        icon: '🕸️', label: 'Rel Map' },
  { type: 'draftNav',      icon: '🗺️', label: 'Draft Nav' },
];

const PALETTE_MAP = Object.fromEntries(
  PALETTE_ITEMS.map(item => [item.type, item])
) as Record<DeskWidgetType, { type: DeskWidgetType; icon: string; label: string } | undefined>;

const STICKY_COLORS: Record<string, string> = {
  yellow: '#fef08a',
  blue:   '#bfdbfe',
  green:  '#bbf7d0',
  pink:   '#fbcfe8',
  purple: '#ddd6fe',
};

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

// ============================================================
// SURFACE CANVAS (Static grid, synced to pan/zoom)
// ============================================================

const DOT_SPACING = 28;
const DOT_RADIUS = 1.5;
const DOT_COLOR = 'rgba(255, 255, 255, 0.15)';

const SurfaceCanvas = React.forwardRef<{ redraw: (off: { x: number; y: number }, z: number) => void }, { 
  containerRef: React.RefObject<HTMLDivElement | null>;
  zoom: number;
  offset: { x: number; y: number };
}>(({ containerRef, zoom, offset }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback((currentOffset: { x: number; y: number }, currentZoom: number) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const vw = canvas.width;
    const vh = canvas.height;
    ctx.clearRect(0, 0, vw, vh);

    const scaledSpacing = DOT_SPACING * currentZoom;
    const colStart = Math.floor(-currentOffset.x / scaledSpacing) - 1;
    const colEnd = Math.ceil((vw - currentOffset.x) / scaledSpacing) + 1;
    const rowStart = Math.floor(-currentOffset.y / scaledSpacing) - 1;
    const rowEnd = Math.ceil((vh - currentOffset.y) / scaledSpacing) + 1;

    ctx.fillStyle = DOT_COLOR;
    const radius = DOT_RADIUS * Math.max(0.5, currentZoom);

    for (let r = rowStart; r <= rowEnd; r++) {
      for (let c = colStart; c <= colEnd; c++) {
        const vx = (c * scaledSpacing) + currentOffset.x; 
        const vy = (r * scaledSpacing) + currentOffset.y;
        
        ctx.beginPath(); 
        ctx.arc(vx, vy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [containerRef]);

  React.useImperativeHandle(ref, () => ({
    redraw: (off, z) => draw(off, z),
  }));

  useEffect(() => {
    draw(offset, zoom);
  }, [draw, offset, zoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ro = new ResizeObserver(() => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      draw(offset, zoom);
    });

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    ro.observe(container);
    return () => ro.disconnect();
  }, [containerRef, draw, offset, zoom]);

  return <canvas ref={canvasRef} className={styles.rippleCanvas} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />;
});

// ============================================================
// WIDGET RENDERERS
// ============================================================

function DeskTipTapEditor({ sceneId, content, onUpdate, onFocus }: {
  sceneId: string;
  content: string;
  onUpdate: (html: string, wordCount: number) => void;
  onFocus: (editor: any) => void;
}) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedContentRef = useRef<string>(content || '');
  const trackSession = useWritingSession();
  const isSpellcheckEnabled = useWorkspaceStore(s => s.isSpellcheckEnabled);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      FontFamily,
      FontSize,
      Highlight.configure({ multicolor: true }),
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: content || '',
    immediatelyRender: false,
    editorProps: {
      attributes: { class: styles.deskEditorContent, spellcheck: String(isSpellcheckEnabled) }
    },
    onUpdate: ({ editor }) => {
      // Atomic guard: Only process updates if the user is actively focused in this editor
      // This completely drops TipTap's automatic mount-time `<p></p>` injection parsing
      if (!editor.isFocused) return;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const html = editor.getHTML();
        const normalize = (h: string) => h.replace(/\s+/g, ' ').trim();
        if (normalize(html) === normalize(lastSavedContentRef.current)) return;

        lastSavedContentRef.current = html;
        const words = editor.getText().split(/\s+/).filter(w => w.length > 0).length;
        onUpdate(html, words);
        // Feed the Goals system (streaks/badges) + Version History auto-snapshots.
        trackSession(sceneId, words, Date.now());
      }, 300);
    },
    onFocus: ({ editor }) => onFocus(editor),
  }, [sceneId, isSpellcheckEnabled]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (editor) {
      lastSavedContentRef.current = editor.getHTML();
    } else {
      lastSavedContentRef.current = content || '';
    }
  }, [sceneId, editor]);

  if (!editor) return null;

  return (
    <div className={styles.deskEditorWrapper}>
      <div className={styles.deskEditorToolbar}>
        <div className={styles.deskToolbarGroup}>
          <select
            className={styles.deskToolbarDropdown}
            value={
              editor.isActive('heading', { level: 1 }) ? 'h1' :
              editor.isActive('heading', { level: 2 }) ? 'h2' :
              editor.isActive('heading', { level: 3 }) ? 'h3' :
              editor.isActive('blockquote') ? 'blockquote' : 'p'
            }
            onChange={e => {
              const val = e.target.value;
              if (val === 'p') editor.chain().focus().setParagraph().run();
              if (val === 'h1') editor.chain().focus().toggleHeading({ level: 1 }).run();
              if (val === 'h2') editor.chain().focus().toggleHeading({ level: 2 }).run();
              if (val === 'h3') editor.chain().focus().toggleHeading({ level: 3 }).run();
              if (val === 'blockquote') editor.chain().focus().toggleBlockquote().run();
            }}
          >
            <option value="p">Paragraph</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
            <option value="blockquote">Quote</option>
          </select>
          <select
            className={styles.deskToolbarDropdown}
            style={{ width: '110px' }}
            onChange={e => editor.chain().focus().setFontFamily(e.target.value).run()}
            value={editor.getAttributes('textStyle').fontFamily || 'Inter'}
          >
            <option value="Inter">Sans (Inter)</option>
            <option value="Georgia">Serif (Georgia)</option>
            <option value="'Times New Roman'">Serif (TNR)</option>
            <option value="Arial">Sans (Arial)</option>
            <option value="'Courier New'">Mono (Courier)</option>
          </select>
          <select
            className={styles.deskToolbarDropdown}
            style={{ width: '60px' }}
            onChange={e => (editor.commands as any).setFontSize(e.target.value)}
            value={editor.getAttributes('textStyle').fontSize || '16px'}
          >
            {['12px', '14px', '16px', '18px', '20px', '24px', '32px', '40px'].map(size => (
              <option key={size} value={size}>{size.replace('px', '')}</option>
            ))}
          </select>
        </div>
        <span className={styles.deskFmtSep} />
        <div className={styles.deskToolbarGroup}>
          <button
            className={`${styles.deskFmtBtn} ${editor.isActive('bold') ? styles.deskFmtBtnActive : ''}`}
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
            title="Bold"
          >B</button>
          <button
            className={`${styles.deskFmtBtn} ${editor.isActive('italic') ? styles.deskFmtBtnActive : ''}`}
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}
            title="Italic"
          >I</button>
          <button
            className={`${styles.deskFmtBtn} ${editor.isActive('underline') ? styles.deskFmtBtnActive : ''}`}
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); }}
            title="Underline"
          >U</button>
          <button
            className={`${styles.deskFmtBtn} ${editor.isActive('strike') ? styles.deskFmtBtnActive : ''}`}
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleStrike().run(); }}
            title="Strikethrough"
          >S</button>
          <button
            className={`${styles.deskFmtBtn} ${editor.isActive('highlight') ? styles.deskFmtBtnActive : ''}`}
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHighlight().run(); }}
            title="Highlight"
          >🖊️</button>
        </div>
        <span className={styles.deskFmtSep} />
        <div className={styles.deskToolbarGroup}>
          <button
            className={`${styles.deskFmtBtn} ${editor.isActive({ textAlign: 'left' }) ? styles.deskFmtBtnActive : ''}`}
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().setTextAlign('left').run(); }}
            title="Align Left"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
          </button>
          <button
            className={`${styles.deskFmtBtn} ${editor.isActive({ textAlign: 'center' }) ? styles.deskFmtBtnActive : ''}`}
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().setTextAlign('center').run(); }}
            title="Align Center"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
          </button>
          <button
            className={`${styles.deskFmtBtn} ${editor.isActive({ textAlign: 'right' }) ? styles.deskFmtBtnActive : ''}`}
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().setTextAlign('right').run(); }}
            title="Align Right"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>
          </button>
          <button
            className={`${styles.deskFmtBtn} ${editor.isActive({ textAlign: 'justify' }) ? styles.deskFmtBtnActive : ''}`}
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().setTextAlign('justify').run(); }}
            title="Justify"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
        </div>
        <span className={styles.deskFmtSep} />
        <div className={styles.deskToolbarGroup}>
          <button
            className={`${styles.deskFmtBtn} ${editor.isActive('bulletList') ? styles.deskFmtBtnActive : ''}`}
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }}
            title="Bullet List"
          >•</button>
          <button
            className={`${styles.deskFmtBtn} ${editor.isActive('orderedList') ? styles.deskFmtBtnActive : ''}`}
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run(); }}
            title="Numbered List"
          >1.</button>
          <button
            className={styles.deskFmtBtn}
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().setHorizontalRule().run(); }}
            title="Horizontal Rule"
          >―</button>
          <button
            className={styles.deskFmtBtn}
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().unsetAllMarks().clearNodes().run(); }}
            title="Clear Formatting"
          >Ø</button>
        </div>
      </div>
      <div className={styles.deskEditorBody} onClick={() => editor.chain().focus().run()}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

// WIDGET LIBRARY DROPDOWN
// ============================================================

function WidgetLibraryDropdown({ onSelect }: { onSelect: (type: DeskWidgetType) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className={styles.modeDropdownContainer} ref={dropdownRef}>
      <button 
        className={`${styles.spineControlBtn} ${isOpen ? styles.spineControlBtnActive : ''}`} 
        onClick={() => setIsOpen(!isOpen)}
        title="Artifact Library"
      >
        ➕
      </button>

      {isOpen && (
        <div className={styles.modeDropdownContent} style={{ width: '200px' }}>
          <div className={styles.modeDropdownHeader}>Widget Library</div>
          <div className={styles.modeDropdownScroll} style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {PALETTE_ITEMS.filter(item => item.type !== 'writingZone').map(item => (
              <button 
                key={item.type} 
                className={styles.modeOption}
                onClick={() => { onSelect(item.type); setIsOpen(false); }}
              >
                <span className={styles.modeOptionIcon}>{item.icon}</span>
                <span className={styles.modeOptionLabel}>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BookCoverEditor({ projectId }: { projectId: string }) {
  const project = useWorkspaceStore(s => s.projects.find(p => p.id === projectId));
  const worlds = useWorkspaceStore(s => s.worlds);
  const entities = useWorkspaceStore(s => s.entities);
  const updateProject = useWorkspaceStore(s => s.updateProject);

  const [name, setName] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [description, setDescription] = useState('');
  const [worldId, setWorldId] = useState('');
  const [attributedEntityId, setAttributedEntityId] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');

  useEffect(() => {
    if (project) {
      setName(project.name);
      setAuthorName(project.authorName || '');
      setDescription(project.description || '');
      setWorldId(project.worldId || '');
      setAttributedEntityId(project.attributedEntityId || '');
      setCoverImageUrl(project.coverImageUrl || '');
    }
  }, [project]);

  if (!project) return null;

  const handleSave = () => {
    updateProject(projectId, {
      name,
      authorName,
      description,
      worldId: worldId || undefined,
      attributedEntityId: attributedEntityId || undefined,
      coverImageUrl
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setCoverImageUrl(base64);
      updateProject(projectId, { coverImageUrl: base64 });
    };
    reader.readAsDataURL(file);
  };

  const worldCharacters = entities.filter(e => 
// @ts-ignore
    e.worldId === worldId && 
    e.type === 'character'
  );

  return (
    <div className={styles.coverEditorContainer} onMouseDown={e => e.stopPropagation()}>
      <div className={styles.coverEditorHeader}>
        <h1 className={styles.coverEditorHeaderTitle}>Book Information</h1>
        <p className={styles.coverEditorHeaderSub}>Manage manuscript metadata and cover design</p>
      </div>

      <div className={styles.coverEditorGrid}>
        <div className={styles.coverEditorSidebar}>
          <div 
            className={styles.coverEditorPreview} 
            style={{ 
              background: project.coverColor, 
              backgroundImage: coverImageUrl ? `url(${coverImageUrl})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            {!coverImageUrl && (
              <span className={styles.coverEditorPreviewInitials}>
                {name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </span>
            )}
            <input 
              type="file" 
              id="cover-editor-upload" 
              hidden 
              accept="image/*" 
              onChange={handleFileChange} 
            />
            <label htmlFor="cover-editor-upload" className={styles.coverEditorUploadOverlay}>
              <span>📷 Change Cover</span>
            </label>
          </div>
          {coverImageUrl && (
            <button 
              className={styles.coverEditorRemoveBtn}
              onClick={() => { setCoverImageUrl(''); updateProject(projectId, { coverImageUrl: '' }); }}
            >
              Remove Image
            </button>
          )}
        </div>

        <div className={styles.coverEditorForm}>
          <div className={styles.coverEditorField}>
            <label>Project Title</label>
            <input 
              value={name}
              onChange={e => { setName(e.target.value); updateProject(projectId, { name: e.target.value }); }}
              placeholder="The Great Novel..."
            />
          </div>

          <div className={styles.coverEditorField}>
            <label>Author Name</label>
            <input 
              value={authorName}
              onChange={e => { setAuthorName(e.target.value); updateProject(projectId, { authorName: e.target.value }); }}
              placeholder="Your pen name..."
            />
          </div>

          <div className={styles.coverEditorField}>
            <label>Associated World Bible</label>
            <select 
              value={worldId}
              onChange={e => {
                const wid = e.target.value;
                setWorldId(wid);
                setAttributedEntityId('');
                updateProject(projectId, { worldId: wid || undefined, attributedEntityId: undefined });
              }}
            >
              <option value="">No Associated World</option>
              {worlds.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          {worldId && (
            <div className={styles.coverEditorField}>
              <label>Fictional Character Attribution</label>
              <select 
                value={attributedEntityId}
                onChange={e => {
                  const aid = e.target.value;
                  setAttributedEntityId(aid);
                  updateProject(projectId, { attributedEntityId: aid || undefined });
                }}
              >
                <option value="">None</option>
                {worldCharacters.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <p className={styles.fieldHint}>Linking to a character will show this book on their article page.</p>
            </div>
          )}

          <div className={styles.coverEditorField}>
            <label>Project Description / Blurb</label>
            <textarea 
              value={description}
              onChange={e => { setDescription(e.target.value); updateProject(projectId, { description: e.target.value }); }}
              placeholder="A brief summary of your masterpiece..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function WritingZoneRenderer({ content, onChange, onChangeImmediate, widget, onDragStart, onDeleteWidget, onDockChange, onManualSave, onAddAtCenter }: {
  content: any;
  onChange: (c: any) => void;
  onChangeImmediate?: (c: any) => void;
  widget: DeskWidget;
  onDragStart: (e: React.MouseEvent, w: DeskWidget) => void;
  onDeleteWidget: (id: string) => void;
  onDockChange: (dock: DeskWidget['dock']) => void;
  onManualSave: () => void;
  onAddAtCenter: (type: DeskWidgetType) => void;
}) {
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

function StickyNoteRenderer({ content, onChange, onChangeImmediate }: { content: any; onChange: (c: any) => void; onChangeImmediate?: (c: any) => void; }) {
  const [localContent, setLocalContent] = useState(content);
  const lastPropContent = useRef(content);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (content !== lastPropContent.current) {
      setLocalContent(content);
      lastPropContent.current = content;
    }
  }, [content]);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const handleChange = (updates: Record<string, any>) => {
    const next = { ...localContent, ...updates };
    setLocalContent(next);
    lastPropContent.current = next;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(next), 600);
  };

  const handleImmediate = (updates: Record<string, any>) => {
    const next = { ...localContent, ...updates };
    setLocalContent(next);
    lastPropContent.current = next;
    onChange(next);
  };

  const color = localContent.color || 'yellow';
  return (
    <div className={styles.stickyNote} style={{ background: STICKY_COLORS[color] }}>
      <div className={styles.stickyColorBar}>
        {Object.entries(STICKY_COLORS).map(([name, hex]) => (
          <button key={name} className={`${styles.stickyColorDot} ${color === name ? styles.stickyColorDotActive : ''}`} style={{ background: hex }} onClick={() => handleImmediate({ color: name })} />
        ))}
      </div>
      <textarea className={styles.stickyTextarea} placeholder="Write a note..." value={localContent.text || ''} onChange={e => handleChange({ text: e.target.value })} />
    </div>
  );
}

function ReferenceCardRenderer({ content, onChange }: { content: any; onChange: (c: any) => void; }) {
  const [localContent, setLocalContent] = useState(content);
  const lastPropContent = useRef(content);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (content !== lastPropContent.current) {
      setLocalContent(content);
      lastPropContent.current = content;
    }
  }, [content]);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const handleChange = (updates: Record<string, any>) => {
    const next = { ...localContent, ...updates };
    setLocalContent(next);
    lastPropContent.current = next;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(next), 600);
  };

  return (
    <div className={styles.referenceCard}>
      <input className={styles.referenceTitle} placeholder="Title..." value={localContent.title || ''} onChange={e => handleChange({ title: e.target.value })} />
      <textarea className={styles.referenceBody} placeholder="Notes..." value={localContent.body || ''} onChange={e => handleChange({ body: e.target.value })} />
    </div>
  );
}

function ImagePinRenderer({ content, onChange, onChangeImmediate }: { content: any; onChange: (c: any) => void; onChangeImmediate?: (c: any) => void; }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const labelDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [localLabel, setLocalLabel] = useState(content.label || '');
  const [localRotation, setLocalRotation] = useState(content.rotation ?? 0);
  const lastPropLabel = useRef(content.label);
  const lastPropRotation = useRef(content.rotation);

  useEffect(() => {
    if (content.label !== lastPropLabel.current) {
      setLocalLabel(content.label || '');
      lastPropLabel.current = content.label;
    }
    if (content.rotation !== lastPropRotation.current) {
      setLocalRotation(content.rotation ?? 0);
      lastPropRotation.current = content.rotation;
    }
  }, [content.label, content.rotation]);

  useEffect(() => () => { if (labelDebounceRef.current) clearTimeout(labelDebounceRef.current); }, []);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => (onChangeImmediate ?? onChange)({ ...content, src: reader.result });
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className={styles.imagePin} style={{ transform: `rotate(${localRotation}deg)` }}>
      {content.src ? (
        <>
          <div className={styles.imagePinImgWrap} onMouseDown={e => e.stopPropagation()}>
            <img src={content.src} className={styles.imagePinImg} />
          </div>
          <div className={styles.imagePinControls} onMouseDown={e => e.stopPropagation()}>
            <input
              className={styles.imagePinLabel}
              placeholder="Caption..."
              value={localLabel}
              onChange={e => {
                const val = e.target.value;
                setLocalLabel(val);
                lastPropLabel.current = val;
                if (labelDebounceRef.current) clearTimeout(labelDebounceRef.current);
                labelDebounceRef.current = setTimeout(() => onChange({ ...content, label: val }), 600);
              }}
            />
            <div className={styles.imagePinRotateRow}>
              <input
                type="range" min={-15} max={15} step={1}
                value={localRotation}
                className={styles.imagePinRotateSlider}
                onChange={e => {
                  const val = parseInt(e.target.value);
                  setLocalRotation(val);
                  lastPropRotation.current = val;
                  if (labelDebounceRef.current) clearTimeout(labelDebounceRef.current);
                  labelDebounceRef.current = setTimeout(() => onChange({ ...content, rotation: val }), 300);
                }}
              />
            </div>
          </div>
        </>
      ) : <div className={styles.imagePinUpload} onClick={() => fileRef.current?.click()}><span>🖼️</span><span>Click to pin image</span></div>}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
    </div>
  );
}

function formatRelative(date: Date | string): string {
  if (!date) return 'Unknown';
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  if (diff < 172800) return 'Yesterday';
  return d.toLocaleDateString();
}

function WorldBiblePinRenderer({ content, onChange }: { content: any; onChange: (c: any) => void; }) {
  const entities = useWorkspaceStore(s => s.entities);
  const activeProjectId = useWorkspaceStore(s => s.activeProjectId);
  const [searchTerm, setSearchTerm] = useState('');

  const entityId = content.entityId;
  const entity = useMemo(() => entities.find(e => e.id === entityId), [entities, entityId]);

  const filtered = useMemo(() => {
    if (entityId) return [];
    return entities
      .filter(e => e.projectId === activeProjectId && e.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .slice(0, 15);
  }, [entities, activeProjectId, searchTerm, entityId]);

  if (!entityId) {
    return (
      <div className={styles.biblePinCard}>
        <div className={styles.biblePinSearchWrap}>
          <input
            className={styles.biblePinSearch}
            placeholder="Search entities..."
            autoFocus
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className={styles.biblePinResultList}>
          {filtered.map(e => (
            <button 
              key={e.id} 
              className={styles.biblePinResultItem} 
              onMouseDown={e => e.stopPropagation()}
              onClick={() => onChange({ entityId: e.id, lastUpdatedAt: new Date().toISOString() })}
            >
              <span className={styles.biblePinResultName}>{e.name}</span>
              <span className={styles.biblePinResultType}>{ENTITY_TYPE_LABELS[e.type]}</span>
            </button>
          ))}
          {searchTerm && filtered.length === 0 && <div className={styles.biblePinEmpty}>No matches found.</div>}
          {!searchTerm && filtered.length === 0 && <div className={styles.biblePinEmpty}>Start typing to search...</div>}
        </div>
      </div>
    );
  }

  if (!entity) {
    return (
      <div className={styles.biblePinCard}>
        <div className={styles.biblePinEmpty}>
          <p>Entity deleted or not found.</p>
          <button className={styles.biblePinChangeBtn} 
            onMouseDown={e => e.stopPropagation()}
            onClick={() => onChange({ entityId: null, lastUpdatedAt: null })}
          >
            Clear pin
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.biblePinCard}>
      <div className={styles.biblePinHeader}>
        {entity.imageUrl ? (
          <img src={entity.imageUrl} className={styles.biblePinThumb} />
        ) : (
          <div className={styles.biblePinThumbPlaceholder}>📖</div>
        )}
        <div className={styles.biblePinName}>{entity.name}</div>
        <div className={styles.biblePinBadge}>{ENTITY_TYPE_LABELS[entity.type]}</div>
      </div>
      {entity.subcategory && <div className={styles.biblePinSub}>{entity.subcategory}</div>}
      <div className={styles.biblePinBody}>
        {entity.description && <div className={styles.biblePinDesc}>{entity.description}</div>}
        {entity.customFields && entity.customFields.length > 0 && (
          <div className={styles.biblePinFields}>
            {entity.customFields.slice(0, 5).map((f: any, i: number) => (
              <div key={i} className={styles.biblePinFieldRow}>
                <span className={styles.biblePinFieldLabel}>{f.label}:</span>
                <span className={styles.biblePinFieldValue}>{f.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className={styles.biblePinFooter}>
        <span>Last updated: {formatRelative(entity.updatedAt || entity.createdAt)}</span>
        <button className={styles.biblePinChangeBtn} 
          onMouseDown={e => e.stopPropagation()}
          onClick={() => onChange({ entityId: null, lastUpdatedAt: null })}
        >
          Change
        </button>
      </div>
    </div>
  );
}

function UntypedWidgetRenderer() {
  return <div className={styles.untypedWidget}><span className={styles.untypedHint}>Use "Choose" in the title bar to set widget type</span></div>;
}

function SceneControlRenderer({ content, onChange }: { content: any; onChange: (c: any) => void; }) {
  const activeProjectId = useWorkspaceStore(s => s.activeProjectId);
  const scenes = useWorkspaceStore(s => s.scenes);
  const projectScenes = useMemo(() => scenes.filter(sc => sc.projectId === activeProjectId), [scenes, activeProjectId]);

  // --- Local state for debounced text inputs ---
  const [localContent, setLocalContent] = useState(content);
  const lastPropContent = useRef(content);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (content !== lastPropContent.current) {
      setLocalContent(content);
      lastPropContent.current = content;
    }
  }, [content]);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const handleChange = (updates: Record<string, any>) => {
    const next = { ...localContent, ...updates };
    setLocalContent(next);
    lastPropContent.current = next;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(next), 600);
  };

  // Structural fields flush immediately
  const updateImmediate = (updates: any) => onChange({ ...content, ...updates });
  // --- End local state ---

  const statusOptions = ['Draft', 'Needs Revision', 'Locked', 'Continuity Issue'];

  const checklist = content.checklist || [];
  const toggleCheck = (id: string) => {
    updateImmediate({ checklist: checklist.map((item: any) => item.id === id ? { ...item, checked: !item.checked } : item) });
  };
  const addCheck = () => {
    const text = window.prompt("Checklist item:");
    if (text) {
      updateImmediate({ checklist: [...checklist, { id: crypto.randomUUID(), text, checked: false }] });
    }
  };
  const removeCheck = (id: string) => {
    updateImmediate({ checklist: checklist.filter((item: any) => item.id !== id) });
  };

  const isCompact = content.isCompact || false;

  if (isCompact) {
    return (
      <div className={styles.sceneControlCompact}>
        <div className={styles.sceneControlStatusPill} style={{
          backgroundColor: 
            content.status === 'Locked' ? 'rgba(74, 222, 128, 0.2)' :
            content.status === 'Needs Revision' ? 'rgba(248, 113, 113, 0.2)' :
            content.status === 'Continuity Issue' ? 'rgba(251, 191, 36, 0.2)' : 'rgba(255, 255, 255, 0.1)'
        }}>{content.status || 'Draft'}</div>
        <div className={styles.sceneControlTensionBar} title={`Tension: ${localContent.tension || 0}%`}>
          <div className={styles.sceneControlTensionFill} style={{ width: `${localContent.tension || 0}%` }} />
        </div>
        <button className={styles.sceneControlCompactToggle} onClick={() => updateImmediate({ isCompact: false })}>↙️</button>
      </div>
    );
  }

  return (
    <div className={styles.sceneControl}>
      <div className={styles.sceneControlHeader}>
        <select 
          className={styles.sceneControlStatus} 
          value={content.status || 'Draft'} 
          onChange={e => updateImmediate({ status: e.target.value })}
        >
          {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <button className={styles.sceneControlCompactToggle} onClick={() => updateImmediate({ isCompact: true })}>↗️</button>
      </div>

      <div className={styles.sceneControlScroll}>
        <div className={styles.sceneControlSection}>
          <label className={styles.sceneControlLabel}>Link to Scene</label>
          <select 
            className={styles.sceneControlSelect} 
            value={content.linkedSceneId || ''} 
            onChange={e => updateImmediate({ linkedSceneId: e.target.value })}
          >
            <option value="">(None)</option>
            {projectScenes.map((sc: any) => <option key={sc.id} value={sc.id}>{sc.title}</option>)}
          </select>
        </div>

        <div className={styles.sceneControlSection}>
          <label className={styles.sceneControlLabel}>Purpose / Objective</label>
          <textarea className={styles.sceneControlInput} value={localContent.purpose || ''} onChange={e => handleChange({ purpose: e.target.value })} placeholder="What must happen?" />
        </div>

        <div className={styles.sceneControlSection}>
          <label className={styles.sceneControlLabel}>Conflict / obstacle</label>
          <textarea className={styles.sceneControlInput} value={localContent.conflict || ''} onChange={e => handleChange({ conflict: e.target.value })} placeholder="What stands in the way?" />
        </div>

        <div className={styles.sceneControlSection}>
          <label className={styles.sceneControlLabel}>Stakes</label>
          <textarea className={styles.sceneControlInput} value={localContent.stakes || ''} onChange={e => handleChange({ stakes: e.target.value })} placeholder="Result of failure?" />
        </div>

        <div className={styles.sceneControlSection}>
          <label className={styles.sceneControlLabel}>Outcome / Change</label>
          <textarea className={styles.sceneControlInput} value={localContent.outcome || ''} onChange={e => handleChange({ outcome: e.target.value })} placeholder="Valence shift..." />
        </div>

        <div className={styles.sceneControlSection}>
          <label className={styles.sceneControlLabel}>Checklist</label>
          <div className={styles.sceneChecklist}>
            {checklist.map((item: any) => (
              <div key={item.id} className={styles.sceneCheckItem}>
                <input type="checkbox" checked={item.checked} onChange={() => toggleCheck(item.id)} />
                <span className={item.checked ? styles.sceneCheckDone : ''}>{item.text}</span>
                <button className={styles.sceneCheckRemove} onClick={() => removeCheck(item.id)}>×</button>
              </div>
            ))}
            <button className={styles.sceneCheckAdd} onClick={addCheck}>+ Add Item</button>
          </div>
        </div>

        <div className={styles.sceneControlSection}>
          <label className={styles.sceneControlLabel}>Emotional Arc</label>
          <div className={styles.sceneArcRow}>
            <input className={styles.sceneArcInput} value={localContent.emotionalArc?.start || ''} onChange={e => handleChange({ emotionalArc: { ...localContent.emotionalArc, start: e.target.value } })} placeholder="Start" />
            <span className={styles.sceneArcArrow}>→</span>
            <input className={styles.sceneArcInput} value={localContent.emotionalArc?.turn || ''} onChange={e => handleChange({ emotionalArc: { ...localContent.emotionalArc, turn: e.target.value } })} placeholder="Turn" />
            <span className={styles.sceneArcArrow}>→</span>
            <input className={styles.sceneArcInput} value={localContent.emotionalArc?.end || ''} onChange={e => handleChange({ emotionalArc: { ...localContent.emotionalArc, end: e.target.value } })} placeholder="End" />
          </div>
        </div>

        <div className={styles.sceneControlSection}>
          <div className={styles.sceneControlLabelRow}>
            <label className={styles.sceneControlLabel}>Tension</label>
            <span className={styles.sceneControlValue}>{localContent.tension || 0}%</span>
          </div>
          <input type="range" className={styles.sceneTensionSlider} min="0" max="100" value={localContent.tension || 0} onChange={e => handleChange({ tension: parseInt(e.target.value) })} />
        </div>
      </div>
    </div>
  );
}

function CharacterStateRenderer({ content, onChange }: { content: any; onChange: (c: any) => void; }) {
  const activeProjectId = useWorkspaceStore(s => s.activeProjectId);
  const entities = useWorkspaceStore(s => s.entities);
  const characters = useMemo(() => 
    entities.filter(e => e.projectId === activeProjectId && e.type === 'character'),
    [entities, activeProjectId]
  );

  // --- Local state for debounced text inputs ---
  const [localContent, setLocalContent] = useState(content);
  const lastPropContent = useRef(content);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (content !== lastPropContent.current) {
      setLocalContent(content);
      lastPropContent.current = content;
    }
  }, [content]);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const handleChange = (updates: Record<string, any>) => {
    const next = { ...localContent, ...updates };
    setLocalContent(next);
    lastPropContent.current = next;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(next), 600);
  };

  // Structural fields flush immediately
  const updateImmediate = (updates: any) => onChange({ ...content, ...updates });
  // --- End local state ---

  const selectedChar = characters.find(c => c.id === content.characterId);

  const relationships = localContent.relationships || [];
  const addRel = (targetId: string) => {
    if (relationships.find((r: any) => r.targetId === targetId)) return;
    updateImmediate({ relationships: [...(content.relationships || []), { id: crypto.randomUUID(), targetId, status: '' }] });
  };
  const updateRel = (id: string, status: string) => {
    // Free-text: debounced
    handleChange({ relationships: relationships.map((r: any) => r.id === id ? { ...r, status } : r) });
  };
  const removeRel = (id: string) => {
    updateImmediate({ relationships: (content.relationships || []).filter((r: any) => r.id !== id) });
  };

  const isCompact = content.isCompact || false;

  if (isCompact) {
    return (
      <div className={styles.charStateCompact}>
        <div className={styles.charStateAvatarSmall}>
          {selectedChar?.imageUrl ? <img src={selectedChar.imageUrl} alt="" /> : <span>👤</span>}
        </div>
        <div className={styles.charStateMetaSmall}>
          <div className={styles.charStateNameSmall}>{selectedChar?.name || '(Unknown)'}</div>
          <div className={styles.charStateEmotionSmall}>{localContent.emotionalState || 'Calm'}</div>
        </div>
        <button className={styles.sceneControlCompactToggle} onClick={() => updateImmediate({ isCompact: false })}>↙️</button>
      </div>
    );
  }

  return (
    <div className={styles.charState}>
      <div className={styles.charStateHeader}>
        <select 
          className={styles.charStateSelect} 
          value={content.characterId || ''} 
          onChange={e => updateImmediate({ characterId: e.target.value })}
        >
          <option value="">(POV Character)</option>
          {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className={styles.sceneControlCompactToggle} onClick={() => updateImmediate({ isCompact: true })}>↗️</button>
      </div>

      <div className={styles.charStateScroll}>
        <div className={styles.charStateHero}>
          <div className={styles.charStateAvatar}>
            {selectedChar?.imageUrl ? <img src={selectedChar.imageUrl} alt="" /> : <span>👤</span>}
          </div>
          <div className={styles.charStateIdentity}>
            <div className={styles.charStateName}>{selectedChar?.name || 'POV Character'}</div>
            <input 
              className={styles.charStateEmotionInput} 
              value={localContent.emotionalState || ''} 
              onChange={e => handleChange({ emotionalState: e.target.value })}
              placeholder="Emotional State (Anxious, Excited...)" 
            />
          </div>
        </div>

        <div className={styles.sceneControlSection}>
          <label className={styles.sceneControlLabel}>Current Goal</label>
          <textarea className={styles.sceneControlInput} value={localContent.goal || ''} onChange={e => handleChange({ goal: e.target.value })} placeholder="What is their target right now?" />
        </div>

        <div className={styles.sceneControlSection}>
          <label className={styles.sceneControlLabel}>Knowledge (Known / Unknown)</label>
          <div className={styles.charKnowledgeGrid}>
            <div className={styles.charKnowledgeCol}>
              <div className={styles.charKnowledgeLabel}>Knows</div>
              <textarea className={styles.charKnowledgeText} value={localContent.knows || ''} onChange={e => handleChange({ knows: e.target.value })} placeholder="Key facts..." />
            </div>
            <div className={styles.charKnowledgeCol}>
              <div className={styles.charKnowledgeLabel}>Unknown</div>
              <textarea className={styles.charKnowledgeText} value={localContent.unknowns || ''} onChange={e => handleChange({ unknowns: e.target.value })} placeholder="Blind spots..." />
            </div>
          </div>
        </div>

        <div className={styles.sceneControlSection}>
          <label className={styles.sceneControlLabel}>Relationships in Scene</label>
          <div className={styles.charRelList}>
            {relationships.map((r: any) => {
              const target = characters.find(c => c.id === r.targetId);
              return (
                <div key={r.id} className={styles.charRelItem}>
                  <div className={styles.charRelName}>{target?.name || '(Unknown)'}</div>
                  <input className={styles.charRelStatus} value={r.status} onChange={e => updateRel(r.id, e.target.value)} placeholder="Tension / Status" />
                  <button className={styles.sceneCheckRemove} onClick={() => removeRel(r.id)}>×</button>
                </div>
              );
            })}
            <select className={styles.charRelAddSelect} value="" onChange={e => addRel(e.target.value)}>
              <option value="">+ Add Relationship Context</option>
              {characters.filter(c => c.id !== content.characterId).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.sceneControlSection}>
          <label className={styles.sceneControlLabel}>Active Arc Notes</label>
          <textarea className={styles.sceneControlInput} value={localContent.arcNotes || ''} onChange={e => handleChange({ arcNotes: e.target.value })} placeholder="Internal journey context..." />
        </div>
      </div>
    </div>
  );
}

function ContinuityRenderer({ content, onChange }: { content: any; onChange: (c: any) => void; }) {
  const activeProjectId = useWorkspaceStore(s => s.activeProjectId);
  const activeSceneId = useWorkspaceStore(s => s.activeSceneId);
  const scenes = useWorkspaceStore(s => s.scenes);
  const projectScenes = useMemo(() => 
    scenes.filter(sc => sc.projectId === activeProjectId).sort((a, b) => a.order - b.order),
    [scenes, activeProjectId]
  );

  // --- Local state for debounced text inputs ---
  const [localContent, setLocalContent] = useState(content);
  const lastPropContent = useRef(content);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (content !== lastPropContent.current) {
      setLocalContent(content);
      lastPropContent.current = content;
    }
  }, [content]);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const handleChange = (updates: Record<string, any>) => {
    const next = { ...localContent, ...updates };
    setLocalContent(next);
    lastPropContent.current = next;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(next), 600);
  };

  // Structural fields flush immediately (read from content, not localContent)
  const updateImmediate = (updates: any) => onChange({ ...content, ...updates });
  // --- End local state ---

  const looseEnds = content.looseEnds || [];
  const addLooseEnd = () => {
    const text = window.prompt("Unresolved Question / Loose End:");
    if (text) updateImmediate({ looseEnds: [...looseEnds, { id: crypto.randomUUID(), text, checked: false }] });
  };
  const toggleLooseEnd = (id: string) => {
    updateImmediate({ looseEnds: looseEnds.map((l: any) => l.id === id ? { ...l, checked: !l.checked } : l) });
  };

  const researchTasks = content.researchTasks || [];
  const addResearch = () => {
    const text = window.prompt("Research Task:");
    if (text) updateImmediate({ researchTasks: [...researchTasks, { id: crypto.randomUUID(), text, checked: false }] });
  };
  const toggleResearch = (id: string) => {
    updateImmediate({ researchTasks: researchTasks.map((t: any) => t.id === id ? { ...t, checked: !t.checked } : t) });
  };

  const isCompact = content.isCompact || false;

  if (isCompact) {
    const activeIndex = projectScenes.findIndex(s => s.id === activeSceneId);
    const progress = projectScenes.length > 1 ? (activeIndex / (projectScenes.length - 1)) * 100 : 0;
    const pendingResearch = researchTasks.filter((t: any) => !t.checked).length;

    return (
      <div className={styles.continuityCompact}>
        <div className={styles.continuityCompactSummary}>
          <div className={styles.timelineTitleActive} style={{ fontSize: '0.65rem' }}>
            {projectScenes[activeIndex]?.title || 'Timeline'}
          </div>
          {pendingResearch > 0 && <div className={styles.continuityResearchPill}>{pendingResearch} RESEARCH</div>}
        </div>
        <div className={styles.continuityTimelineMini}>
          <div className={styles.continuityTimelineMiniFill} style={{ width: `${progress}%` }} />
        </div>
        <button className={styles.sceneControlCompactToggle} onClick={() => updateImmediate({ isCompact: false })}>↙️</button>
      </div>
    );
  }

  return (
    <div className={styles.continuity}>
      <div className={styles.sceneControlHeader}>
        <span className={styles.sceneControlLabel} style={{ color: '#fbbf24' }}>Continuity Engine</span>
        <button className={styles.sceneControlCompactToggle} onClick={() => updateImmediate({ isCompact: true })}>↗️</button>
      </div>

      <div className={styles.continuityScroll}>
        <div className={styles.sceneControlSection}>
          <label className={styles.sceneControlLabel}>Story Timeline Strip</label>
          <div className={styles.timelineStrip}>
            {projectScenes.map((sc) => (
              <div key={sc.id} className={styles.timelineItem}>
                <div className={styles.timelineItemLine} />
                <div className={`${styles.timelineDot} ${sc.id === activeSceneId ? styles.timelineDotActive : ''}`} />
                <div className={`${styles.timelineTitle} ${sc.id === activeSceneId ? styles.timelineTitleActive : ''}`}>
                  {sc.title}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.continuityRulesGrid}>
          <div className={styles.continuityRuleBox}>
            <label className={styles.continuityRuleLabel}>Magic & World Rules</label>
            <textarea 
              className={styles.continuityRuleText} 
              value={localContent.worldRules || ''} 
              onChange={e => handleChange({ worldRules: e.target.value })} 
              placeholder="e.g. Gravity is 2x, Magic requires blood..." 
            />
          </div>
          <div className={styles.continuityRuleBox}>
            <label className={styles.continuityRuleLabel}>Canon / Lore Reminders</label>
            <textarea 
              className={styles.continuityRuleText} 
              value={localContent.canonLore || ''} 
              onChange={e => handleChange({ canonLore: e.target.value })} 
              placeholder="Factual constraints for this scene..." 
            />
          </div>
        </div>

        <div className={styles.sceneControlSection}>
          <label className={styles.sceneControlLabel}>Loose Ends</label>
          <div className={styles.sceneChecklist}>
            {looseEnds.map((l: any) => (
              <div key={l.id} className={styles.continuityCheckItem}>
                <input type="checkbox" checked={l.checked} onChange={() => toggleLooseEnd(l.id)} />
                <span className={l.checked ? styles.sceneCheckDone : ''}>{l.text}</span>
              </div>
            ))}
            <button className={styles.continuityResearchAdd} onClick={addLooseEnd}>+ Add Plot Point</button>
          </div>
        </div>

        <div className={styles.sceneControlSection}>
          <label className={styles.sceneControlLabel}>Needs Research / Ref</label>
          <div className={styles.sceneChecklist}>
            {researchTasks.map((t: any) => (
              <div key={t.id} className={styles.continuityCheckItem}>
                <input type="checkbox" checked={t.checked} onChange={() => toggleResearch(t.id)} />
                <span className={t.checked ? styles.sceneCheckDone : ''}>{t.text}</span>
              </div>
            ))}
            <button className={styles.continuityResearchAdd} onClick={addResearch}>+ Add Research Flag</button>
          </div>
        </div>

        <div className={styles.sceneControlSection}>
          <label className={styles.sceneControlLabel}>Continuity Warnings</label>
          <textarea 
            className={styles.continuityRuleText} 
            style={{ minHeight: '60px', borderColor: 'rgba(248, 113, 113, 0.2)' }}
            value={localContent.warnings || ''} 
            onChange={e => handleChange({ warnings: e.target.value })} 
            placeholder="Potential contradictions to fix..." 
          />
        </div>
      </div>
    </div>
  );
}

function StructureRenderer({ content, onChange }: { content: any; onChange: (c: any) => void; }) {
  const activeProjectId = useWorkspaceStore(s => s.activeProjectId);
  const activeSceneId = useWorkspaceStore(s => s.activeSceneId);
  const scenes = useWorkspaceStore(s => s.scenes);
  const projectScenes = useMemo(() => 
    scenes.filter(sc => sc.projectId === activeProjectId).sort((a, b) => a.order - b.order),
    [scenes, activeProjectId]
  );
  
  const [localBeats, setLocalBeats] = useState(content.beats || []);
  const lastPropBeats = useRef(content.beats);
  const beatDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (content.beats !== lastPropBeats.current) {
      setLocalBeats(content.beats || []);
      lastPropBeats.current = content.beats;
    }
  }, [content.beats]);

  useEffect(() => () => { if (beatDebounceRef.current) clearTimeout(beatDebounceRef.current); }, []);

  // Immediate flush — structural changes (add, remove, reorder, color, scene link)
  const updateBeatsImmediate = (nextBeats: any) => {
    setLocalBeats(nextBeats);
    lastPropBeats.current = nextBeats;
    onChange({ ...content, beats: nextBeats });
  };

  // Debounced flush — text inputs only (beat title)
  const updateBeatsDebounced = (nextBeats: any) => {
    setLocalBeats(nextBeats);
    lastPropBeats.current = nextBeats;
    if (beatDebounceRef.current) clearTimeout(beatDebounceRef.current);
    beatDebounceRef.current = setTimeout(() => onChange({ ...content, beats: nextBeats }), 600);
  };

  const addItem = (type: 'beat' | 'act') => {
    const newItem = { 
      id: crypto.randomUUID(), 
      type, 
      title: type === 'act' ? 'New Act' : 'New Beat', 
      color: type === 'act' ? '#6B4C9A' : '#4A6FA5',
      sceneId: ''
    };
    updateBeatsImmediate([...localBeats, newItem]);
  };

  const removeItem = (id: string) => {
    updateBeatsImmediate(localBeats.filter((b: any) => b.id !== id));
  };

  const updateItemImmediate = (id: string, updates: any) => {
    updateBeatsImmediate(localBeats.map((b: any) => b.id === id ? { ...b, ...updates } : b));
  };

  const updateItemDebounced = (id: string, updates: any) => {
    updateBeatsDebounced(localBeats.map((b: any) => b.id === id ? { ...b, ...updates } : b));
  };

  const reorderItem = (index: number, direction: 'up' | 'down') => {
    const nextBeats = [...localBeats];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= nextBeats.length) return;
    [nextBeats[index], nextBeats[target]] = [nextBeats[target], nextBeats[index]];
    updateBeatsImmediate(nextBeats);
  };

  const isCompact = content.isCompact || false;

  if (isCompact) {
    return (
      <div className={styles.structureCompact}>
        <div className={styles.actSparkline}>
          {localBeats.length === 0 ? <span className={styles.paletteHint} style={{ fontSize: '0.6rem' }}>No structure defined</span> : 
            localBeats.map((b: any) => (
              <div 
                key={b.id} 
                className={`${styles.actSparkSeg} ${b.type === 'act' ? styles.actSparkSegActive : ''}`}
                style={b.type === 'beat' ? { height: '30%', backgroundColor: b.color } : { backgroundColor: b.color }}
                title={b.title}
              />
            ))
          }
        </div>
        <button className={styles.sceneControlCompactToggle} onClick={() => onChange({ ...content, isCompact: false })}>↙️</button>
      </div>
    );
  }

  return (
    <div className={styles.structure}>
      <div className={styles.structureHeader}>
        <div className={styles.structureControls}>
          <button className={styles.structureBtn} onClick={() => addItem('act')}>+ Act</button>
          <button className={styles.structureBtn} onClick={() => addItem('beat')}>+ Beat</button>
        </div>
        <button className={styles.sceneControlCompactToggle} onClick={() => onChange({ ...content, isCompact: true })}>↗️</button>
      </div>

      <div className={styles.structureScroll}>
        <div className={styles.beatList}>
          {localBeats.map((beat: any, idx: number) => {
            const linkedScene = projectScenes.find(s => s.id === beat.sceneId);
            const wordCount = linkedScene?.wordCount || 0;
            const target = 2000; // Default target
            const progress = Math.min(100, (wordCount / target) * 100);

            return (
              <div key={beat.id} className={`${styles.beatCard} ${beat.type === 'act' ? styles.beatCardAct : ''}`} style={beat.type === 'act' ? { borderColor: beat.color } : { borderLeft: `3px solid ${beat.color}` }}>
                <button className={styles.beatRemove} onClick={() => removeItem(beat.id)}>×</button>
                
                <div className={styles.beatCardHeader}>
                  <div className={styles.structureControls} style={{ gap: '2px', flexDirection: 'column' }}>
                    <button className={styles.beatDragHandle} style={{ fontSize: '0.6rem', border: 'none', background: 'transparent', padding: 0 }} onClick={() => reorderItem(idx, 'up')} disabled={idx === 0}>▲</button>
                    <button className={styles.beatDragHandle} style={{ fontSize: '0.6rem', border: 'none', background: 'transparent', padding: 0 }} onClick={() => reorderItem(idx, 'down')} disabled={idx === localBeats.length - 1}>▼</button>
                  </div>
                  <span className={styles.beatTypeIcon}>{beat.type === 'act' ? '🏛️' : '🎬'}</span>
                  <input 
                    className={styles.beatTitleInput} 
                    value={beat.title} 
                    onChange={e => updateItemDebounced(beat.id, { title: e.target.value })} 
                    placeholder="Beat Title..." 
                  />
                  <div className={styles.beatColorPicker} style={{ backgroundColor: beat.color }}>
                    <input type="color" value={beat.color} onChange={e => updateItemImmediate(beat.id, { color: e.target.value })} />
                  </div>
                </div>

                {beat.type === 'beat' && (
                  <div className={styles.beatCardBody}>
                    <div className={styles.beatDetails}>
                      <select 
                        className={styles.beatSceneSelect} 
                        value={beat.sceneId} 
                        onChange={e => updateItemImmediate(beat.id, { sceneId: e.target.value })}
                      >
                        <option value="">(Not Linked to Scene)</option>
                        {projectScenes.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                      </select>
                      {beat.sceneId && (
                        <div className={styles.pacingBarContainer} title={`${wordCount} / ${target} words`}>
                          <div className={styles.pacingBarFill} style={{ width: `${progress}%`, backgroundColor: beat.color + 'aa' }} />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ResearchRenderer({ content, onChange }: { content: any; onChange: (c: any) => void; }) {
  const [localItems, setLocalItems] = useState(content.items || []);
  const lastPropItems = useRef(content.items);

  // Sync local state when external content changes (e.g. from refresh or other widgets)
  useEffect(() => {
    if (content.items !== lastPropItems.current) {
      setLocalItems(content.items || []);
      lastPropItems.current = content.items;
    }
  }, [content.items]);

  // Debounce ref for free-text field flushes
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const updateContentItems = (nextItems: any) => {
    setLocalItems(nextItems);
    lastPropItems.current = nextItems;
    onChange({ ...content, items: nextItems });
  };

  const addItem = (type: 'image' | 'text' | 'link' | 'sensory') => {
    const defaultContent = type === 'sensory' ? { sight: '', sound: '', smell: '', touch: '', taste: '' } : '';
    const newItem = {
      id: crypto.randomUUID(),
      type,
      content: defaultContent,
      tags: [],
      title: type === 'image' ? 'Image Pin' : type === 'sensory' ? 'Sensory Moment' : 'Research Snippet'
    };
    updateContentItems([newItem, ...localItems]);
  };

  const removeItem = (id: string) => {
    updateContentItems(localItems.filter((i: any) => i.id !== id));
  };

  // Structural changes (tag add/remove) — immediate flush
  const updateItemImmediate = (id: string, updates: any) => {
    updateContentItems(localItems.map((i: any) => i.id === id ? { ...i, ...updates } : i));
  };

  // Free-text changes — debounced flush (updates localItems instantly, defers onChange)
  const updateItemDebounced = (id: string, updates: any) => {
    const next = localItems.map((i: any) => i.id === id ? { ...i, ...updates } : i);
    setLocalItems(next);
    lastPropItems.current = next;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange({ ...content, items: next }), 600);
  };

  const viewMode = content.viewMode || 'gallery'; 
  const isCompact = content.isCompact || false;

  if (isCompact) {
    const randomItem = localItems.length > 0 ? localItems[Math.floor(Math.random() * localItems.length)] : null;
    let sparkText = randomItem?.type === 'text' ? randomItem.content : randomItem?.type === 'sensory' ? (randomItem.content.sight || randomItem.content.sound || 'A sensory spark...') : 'A pinned inspiration';
    
    return (
      <div className={styles.researchCompact}>
        <span className={styles.researchSparkIcon}>✨</span>
        <span className={styles.researchSpark}>{sparkText || 'No inspirations found...'}</span>
        <button className={styles.sceneControlCompactToggle} onClick={() => onChange({ ...content, isCompact: false })}>↙️</button>
      </div>
    );
  }

  return (
    <div className={styles.research}>
      <div className={styles.structureHeader}>
        <div className={styles.structureControls}>
          <button className={styles.structureBtn} onClick={() => addItem('image')}>+ Image</button>
          <button className={styles.structureBtn} onClick={() => addItem('text')}>+ Text</button>
          <button className={styles.structureBtn} onClick={() => addItem('sensory')}>+ Sensory</button>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button className={styles.paletteControlBtn} onClick={() => onChange({ ...content, viewMode: viewMode === 'gallery' ? 'list' : 'gallery' })} title="Toggle Layout">
            {viewMode === 'gallery' ? '📋' : '🖼️'}
          </button>
          <button className={styles.sceneControlCompactToggle} onClick={() => onChange({ ...content, isCompact: true })}>↗️</button>
        </div>
      </div>

      <div className={styles.researchScroll}>
        <div className={viewMode === 'gallery' ? styles.moodboardGrid : styles.beatList}>
          {localItems.map((item: any) => (
            <div key={item.id} className={styles.researchCard}>
              <button className={styles.researchRemove} onClick={() => removeItem(item.id)}>×</button>
              
              {item.type === 'image' && (
                <>
                  {item.content ? (
                    <img className={styles.researchImage} src={item.content} alt="Mood" />
                  ) : (
                    <div className={styles.researchImage} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '0.6rem' }}>No URL provided</div>
                  )}
                  <input 
                    className={styles.beatTitleInput} 
                    style={{ padding: '4px 8px', fontSize: '0.65rem' }}
                    placeholder="Image URL..."
                    value={item.content}
                    onChange={e => updateItemDebounced(item.id, { content: e.target.value })}
                  />
                </>
              )}

              {item.type === 'text' && (
                <textarea 
                  className={styles.researchTextItem}
                  placeholder="Paste snippet or sensory note here..."
                  value={item.content}
                  onChange={e => updateItemDebounced(item.id, { content: e.target.value })}
                  rows={4}
                />
              )}

              {item.type === 'sensory' && (
                <div className={styles.researchSensoryGrid}>
                  {[
                    { key: 'sight', icon: '👁️', label: 'Sight' },
                    { key: 'sound', icon: '👂', label: 'Sound' },
                    { key: 'smell', icon: '👃', label: 'Smell' },
                    { key: 'touch', icon: '✋', label: 'Touch' },
                    { key: 'taste', icon: '👅', label: 'Taste' }
                  ].map(s => (
                    <div key={s.key} className={styles.researchSensoryItem}>
                      <span className={styles.researchSensoryIcon} title={s.label}>{s.icon}</span>
                      <input 
                        className={styles.beatTitleInput} 
                        style={{ fontSize: '0.65rem', padding: 0 }}
                        placeholder={`${s.label}...`}
                        value={item.content[s.key] || ''}
                        onChange={e => updateItemDebounced(item.id, { content: { ...item.content, [s.key]: e.target.value } })}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className={styles.researchTags}>
                <input 
                  className={styles.beatTitleInput}
                  style={{ fontSize: '0.55rem', opacity: 0.5 }}
                  placeholder="+ Tag"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const target = e.target as HTMLInputElement;
                      const val = target.value.trim();
                      if (val && !item.tags.includes(val)) {
                        updateItemImmediate(item.id, { tags: [...item.tags, val] });
                        target.value = '';
                      }
                    }
                  }}
                />
                {item.tags.map((tag: string) => (
                  <span key={tag} className={styles.researchTagPill} onClick={() => updateItemImmediate(item.id, { tags: item.tags.filter((t: string) => t !== tag) })}>
                    {tag} ×
                  </span>
                ))}
              </div>
            </div>
          ))}

          {localItems.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)', fontSize: '0.8rem' }}>
              Your creative vault is empty. Pin an image or capture a sensory moment to begin.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProgressRenderer({ content, onChange }: { content: any; onChange: (c: any) => void; }) {
  const activeProjectId = useWorkspaceStore(s => s.activeProjectId);
  const scenes = useWorkspaceStore(s => s.scenes);
  const totalWords = useMemo(() => 
    scenes.filter(s => s.projectId === activeProjectId).reduce((acc, s) => acc + (s.wordCount || 0), 0),
    [scenes, activeProjectId]
  );
  
  // Local state for dailyTarget so the number input doesn't call onChange on every keypress
  const [localTarget, setLocalTarget] = useState(content.dailyTarget || 2000);
  const targetDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPropTarget = useRef(content.dailyTarget);

  useEffect(() => {
    if (content.dailyTarget !== lastPropTarget.current) {
      setLocalTarget(content.dailyTarget || 2000);
      lastPropTarget.current = content.dailyTarget;
    }
  }, [content.dailyTarget]);

  useEffect(() => () => { if (targetDebounceRef.current) clearTimeout(targetDebounceRef.current); }, []);

  const progressPercent = Math.min(100, (totalWords % localTarget / localTarget) * 100);

  // Timer logic
  const [now, setNow] = useState(Date.now());
  const isRunning = content.timerRunning || false;
  const timerStart = content.timerStart || null;
  const timerElapsed = content.timerElapsed || 0;

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  const totalElapsedMs = isRunning ? timerElapsed + (now - (timerStart || now)) : timerElapsed;
  const seconds = Math.floor((totalElapsedMs / 1000) % 60);
  const minutes = Math.floor((totalElapsedMs / (1000 * 60)) % 60);
  const hours = Math.floor(totalElapsedMs / (1000 * 60 * 60));

  const formatTime = (h: number, m: number, s: number) => 
    `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

  const toggleTimer = () => {
    if (isRunning) {
      onChange({ ...content, timerRunning: false, timerElapsed: totalElapsedMs, timerStart: null });
    } else {
      onChange({ ...content, timerRunning: true, timerStart: Date.now(), sessionStartCount: totalWords });
    }
  };

  const resetTimer = () => {
    onChange({ ...content, timerRunning: false, timerElapsed: 0, timerStart: null });
  };

  const sessionWords = totalWords - (content.sessionStartCount || totalWords);
  const pace = totalElapsedMs > 60000 ? Math.round((sessionWords / (totalElapsedMs / 3600000))) : 0;

  const isCompact = content.isCompact || false;

  if (isCompact) {
    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progressPercent / 100) * circumference;
    
    return (
      <div className={styles.progressCompact}>
        <div className={styles.compactRing}>
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
            <circle cx="40" cy="40" r={radius} fill="none" stroke="var(--accent)" strokeWidth="6" 
                    strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" transform="rotate(-90 40 40)" />
          </svg>
          <div className={styles.compactValue}>{totalWords}</div>
        </div>
        <button className={styles.compactToggleBtn} onClick={() => onChange({ ...content, isCompact: false })}>↙️</button>
      </div>
    );
  }

  return (
    <div className={styles.progress}>
      <div className={styles.structureHeader} style={{ marginBottom: '-10px', padding: '0 4px' }}>
        <div className={styles.progressLabel} style={{ marginTop: 0, opacity: 0.6 }}>Momentum Engine</div>
        <button className={styles.sceneControlCompactToggle} onClick={() => onChange({ ...content, isCompact: true })}>↗️</button>
      </div>

      <div className={styles.progressStat}>
        <div className={styles.progressValue}>{totalWords.toLocaleString()}</div>
        <div className={styles.progressLabel}>Total Project Words</div>
      </div>

      <div className={styles.progressBarGroup}>
        <div className={styles.progressBarContainer}>
          <div className={styles.progressBarFill} style={{ width: `${progressPercent}%` }} />
        </div>
        <div className={styles.progressGoals}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>GOAL:</span>
            <input 
              type="number" 
              className={styles.beatTitleInput} 
              style={{ width: '60px', fontSize: '0.65rem', padding: '0 4px', border: 'none', background: 'rgba(255,255,255,0.03)' }} 
              value={localTarget} 
              onChange={e => {
                const val = parseInt(e.target.value) || 0;
                setLocalTarget(val);
                lastPropTarget.current = val;
                if (targetDebounceRef.current) clearTimeout(targetDebounceRef.current);
                targetDebounceRef.current = setTimeout(() => onChange({ ...content, dailyTarget: val }), 600);
              }} 
            />
          </div>
          <span>{Math.round(progressPercent)}%</span>
        </div>
      </div>

      <div className={styles.timer}>
        <div className={styles.timerLabel}>{content.timerMode === 'pomodoro' ? 'POMODORO SPRINT' : 'SESSION CLOCK'}</div>
        <div className={styles.timerDisplay}>{formatTime(hours, minutes, seconds)}</div>
        <div className={styles.timerControls}>
          <button className={`${styles.timerBtn} ${isRunning ? styles.timerBtnActive : ''}`} onClick={toggleTimer}>
            {isRunning ? '⏸️' : '▶️'}
          </button>
          <button className={styles.timerBtn} onClick={resetTimer}>🔄</button>
          <button className={styles.timerBtn} onClick={() => onChange({ ...content, timerMode: content.timerMode === 'pomodoro' ? 'session' : 'pomodoro' })}>
            {content.timerMode === 'pomodoro' ? '🍅' : '⏱️'}
          </button>
        </div>
      </div>

      <div className={styles.progressPace}>
        {pace > 0 ? `🔥 Pacing at ${pace} words/hour` : 'Start writing to measure pace...'}
      </div>

      <div className={styles.motivation}>
        {totalWords === 0 ? "Every masterpiece starts with a single word." : 
         progressPercent > 80 ? "You're in the home stretch!" :
         progressPercent > 50 ? "Past the halfway mark. Keep going!" :
         pace > 1000 ? "You're on fire! Don't stop now." :
         "The ink is flowing. Keep the momentum."}
      </div>
    </div>
  );
}
function RelationshipMapRenderer({ content, onChange }: { content: any; onChange: (c: any) => void; }) {
  const activeProjectId = useWorkspaceStore(s => s.activeProjectId);
  const entities = useWorkspaceStore(s => s.entities);
  const characters = useMemo(() => 
    entities.filter(e => e.projectId === activeProjectId && e.type === 'character'),
    [entities, activeProjectId]
  );

  // Buffer node positions locally during drag; flush to onChange only on drag end.
  // localNodesRef always holds the latest value so flushing on mouseUp/mouseLeave
  // is never stale regardless of React re-render timing.
  const [localNodes, setLocalNodes] = useState(content.nodes || []);
  const localNodesRef = useRef<any[]>(content.nodes || []);
  const lastPropNodes = useRef(content.nodes);

  useEffect(() => {
    if (content.nodes !== lastPropNodes.current) {
      setLocalNodes(content.nodes || []);
      localNodesRef.current = content.nodes || [];
      lastPropNodes.current = content.nodes;
    }
  }, [content.nodes]);

  // Alias so all existing render references keep working unchanged
  const nodes = localNodes;
  const links = content.links || [];

  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleAddChar = (charId: string) => {
    if (localNodesRef.current.find((n: any) => n.charId === charId)) return;
    onChange({ ...content, nodes: [...localNodesRef.current, { charId, x: 50, y: 50 }] });
  };


  // During drag: update local state only — never touches onChange
  const updateNodePos = (id: string, x: number, y: number) => {
    const next = localNodesRef.current.map((n: any) => n.charId === id ? { ...n, x, y } : n);
    localNodesRef.current = next;
    setLocalNodes(next);
  };

  // Flush buffered positions to the store when drag ends
  const flushNodes = () => {
    if (dragNodeId) onChange({ ...content, nodes: localNodesRef.current });
    setDragNodeId(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragNodeId || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(5, Math.min(95, ((e.clientY - rect.top) / rect.height) * 100));
    updateNodePos(dragNodeId, x, y);
  };

  const isCompact = content.isCompact || false;

  if (isCompact) {
    return (
      <div className={styles.relMapCompact}>
        <div className={styles.relCompactStat}>
          <span>Social Hubs</span>
          <span className={styles.relCompactValue}>{nodes.length}</span>
        </div>
        <div className={styles.relCompactStat}>
          <span>Relationship Vectors</span>
          <span className={styles.relCompactValue}>{links.length}</span>
        </div>
        <button className={styles.compactToggleBtn} onClick={() => onChange({ ...content, isCompact: false })}>↙️</button>
      </div>
    );
  }

  return (
    <div className={styles.relMap} onMouseMove={handleMouseMove} onMouseUp={flushNodes} onMouseLeave={flushNodes}>
      <div className={styles.structureHeader}>
        <div className={styles.progressLabel} style={{ marginTop: 0, opacity: 0.6 }}>Relationship Map</div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <select 
            className={styles.relMapInput} 
            style={{ width: '120px' }} 
            onChange={e => { if(e.target.value) { handleAddChar(e.target.value); e.target.value = ''; } }}
          >
            <option value="">+ Character</option>
            {characters.filter(c => !nodes.find((n:any) => n.charId === c.id)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className={styles.sceneControlCompactToggle} onClick={() => onChange({ ...content, isCompact: true })}>↗️</button>
        </div>
      </div>

      <div className={styles.mapCanvas} ref={canvasRef}>
        <svg className={styles.svgLayer}>
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent)" />
            </marker>
          </defs>
          {links.map((link: any) => {
            const from = nodes.find((n: any) => n.charId === link.fromId);
            const to = nodes.find((n: any) => n.charId === link.toId);
            if (!from || !to) return null;
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;
            return (
              <g key={link.id}>
                <line 
                  x1={`${from.x}%`} y1={`${from.y}%`} 
                  x2={`${to.x}%`} y2={`${to.y}%`} 
                  className={styles.relLine} 
                  stroke={link.type === 'trust' ? 'var(--accent)' : '#ef4444'} 
                  opacity="0.6"
                />
                <circle cx={`${midX}%`} cy={`${midY}%`} r="3" fill={link.type === 'trust' ? 'var(--accent)' : '#ef4444'} />
                <text 
                  x={`${midX}%`} y={`${midY}%`} 
                  className={styles.relLabel} 
                  textAnchor="middle" 
                  dy="-8"
                >
                  {link.label}
                </text>
              </g>
            );
          })}
        </svg>

        {nodes.map((node: any) => {
          const char = characters.find(c => c.id === node.charId);
          return (
            <div 
              key={node.charId} 
              className={styles.mapNode} 
              style={{ left: `${node.x}%`, top: `${node.y}%`, transform: 'translate(-50%, -50%)', borderColor: dragNodeId === node.charId ? '#fff' : 'var(--accent)' }}
              onMouseDown={(e) => { e.stopPropagation(); setDragNodeId(node.charId); }}
            >
              {char?.imageUrl ? <img src={char.imageUrl} className={styles.mapNodeAvatar} alt="" /> : <span className={styles.mapNodeIcon}>👤</span>}
              <div className={styles.mapNodeName}>{char?.name || '(Unknown)'}</div>
              <button 
                style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ff4d4d', color: '#fff', border: 'none', borderRadius: '50%', width: '14px', height: '14px', fontSize: '8px', cursor: 'pointer', zIndex: 20 }}
                onClick={(e) => { e.stopPropagation(); onChange({ ...content, nodes: nodes.filter((n:any) => n.charId !== node.charId), links: links.filter((l:any) => l.fromId !== node.charId && l.toId !== node.charId) }); }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      <div className={styles.relMapControls}>
        <div className={styles.relControlRow}>
          <select className={styles.relMapInput} id="rel-from">
             <option value="">Character A...</option>
             {nodes.map((n:any) => <option key={n.charId} value={n.charId}>{characters.find(c => c.id === n.charId)?.name}</option>)}
          </select>
          <span>↔️</span>
          <select className={styles.relMapInput} id="rel-to">
             <option value="">Character B...</option>
             {nodes.map((n:any) => <option key={n.charId} value={n.charId}>{characters.find(c => c.id === n.charId)?.name}</option>)}
          </select>
        </div>
        <div className={styles.relControlRow}>
          <input className={styles.relMapInput} placeholder="Nature of bond (e.g. Rivals, Secrets)..." id="rel-label" />
          <select className={styles.relMapInput} style={{ width: '80px' }} id="rel-type">
             <option value="trust">Trust</option>
             <option value="conflict">Conflict</option>
          </select>
          <button className={styles.structureBtn} onClick={() => {
             const from = (document.getElementById('rel-from') as HTMLSelectElement).value;
             const to = (document.getElementById('rel-to') as HTMLSelectElement).value;
             const label = (document.getElementById('rel-label') as HTMLInputElement).value || 'Linked';
             const type = (document.getElementById('rel-type') as HTMLSelectElement).value;
             if(from && to && from !== to) {
               onChange({ ...content, links: [...links, { id: crypto.randomUUID(), fromId: from, toId: to, label, type }] });
               (document.getElementById('rel-label') as HTMLInputElement).value = '';
             }
          }}>Add Link</button>
        </div>
      </div>
    </div>
  );
}

function DraftNavRenderer({ content, onChange }: { content: any; onChange: (c: any) => void; }) {
  const activeProjectId = useWorkspaceStore(s => s.activeProjectId);
  const activeDocumentId = useWorkspaceStore(s => s.activeDocumentId);
  const activeSceneId = useWorkspaceStore(s => s.activeSceneId);
  const setActiveScene = useWorkspaceStore(s => s.setActiveScene);
  const setActiveDocument = useWorkspaceStore(s => s.setActiveDocument);
  const scenes = useWorkspaceStore(s => s.scenes);
  const documents = useWorkspaceStore(s => s.documents);
  const addDocument = useWorkspaceStore(s => s.addDocument);
  const addScene = useWorkspaceStore(s => s.addScene);
  const sceneControlStatuses = useWorkspaceStore(
    useShallow((s: any) => {
      const state = s.deskStates[activeProjectId || ''];
      if (!state) return {} as Record<string, string>;
      return Object.fromEntries(
        state.widgets
          .filter((w: any) => w.type === 'sceneControl' && w.content.linkedSceneId)
          .map((w: any) => [w.content.linkedSceneId, w.content.status || 'Draft'])
      );
    })
  );

  const projectDocuments = useMemo(() => 
    documents.filter(d => d.projectId === activeProjectId),
    [documents, activeProjectId]
  );
  
  const [search, setSearch] = useState('');

  const filteredScenes = useMemo(() => {
    let base = scenes.filter(s => s.projectId === activeProjectId);
    if (search) {
      base = base.filter(s => s.title.toLowerCase().includes(search.toLowerCase()));
    }
    return base.sort((a,b) => a.order - b.order);
  }, [scenes, activeProjectId, search]);

  const activeSceneRef = useRef<HTMLDivElement>(null);

  const scrollToActive = useCallback(() => {
    if (!activeSceneId) return;
    activeSceneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeSceneId]);

  const handleAddChapter = () => {
    if (!activeProjectId) return;
    const nid = crypto.randomUUID();
    const sid = crypto.randomUUID();
    addDocument({ id: nid, projectId: activeProjectId, title: `Chapter ${projectDocuments.length + 1}`, content: '', createdAt: new Date() });
    addScene({ id: sid, documentId: nid, projectId: activeProjectId, title: 'Scene 1', content: '', order: 0, createdAt: new Date() });
    setActiveDocument(nid);
    setActiveScene(sid);
  };

  const handleAddScene = () => {
    if (!activeProjectId || !activeDocumentId) return;
    const nid = crypto.randomUUID();
    const docScenesCount = scenes.filter(s => s.documentId === activeDocumentId).length;
    addScene({ id: nid, documentId: activeDocumentId, projectId: activeProjectId, title: `New Scene`, content: '', order: docScenesCount, createdAt: new Date() });
    setActiveScene(nid);
  };

  const getSceneStatus = (sceneId: string) => sceneControlStatuses[sceneId] || 'Draft';

  const statusColors: Record<string, string> = {
    'Draft': '#6b7280',
    'Needs Revision': '#ef4444',
    'Locked': '#10b981',
    'Continuity Issue': '#f59e0b'
  };

  const isCompact = content.isCompact || false;

  if (isCompact) {
    return (
      <div className={styles.draftNavCompact}>
        <button className={styles.compactToggleBtn} onClick={() => onChange({ ...content, isCompact: false })}>↙️</button>
        {filteredScenes.filter(s => s.documentId === activeDocumentId).map(s => (
          <div 
            key={s.id} 
            className={`${styles.miniScenePill} ${s.id === activeSceneId ? styles.miniScenePillActive : ''}`} 
            onClick={() => setActiveScene(s.id)}
            title={s.title}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={styles.draftNav}>
      <div className={styles.structureHeader}>
        <div className={styles.progressLabel} style={{ marginTop: 0, opacity: 0.6 }}>Draft Navigator</div>
        <button className={styles.sceneControlCompactToggle} onClick={() => onChange({ ...content, isCompact: true })}>↗️</button>
      </div>

      <div className={styles.draftNavSearch}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input 
            className={styles.relMapInput} 
            placeholder="Search scenes..." 
            style={{ flex: 1 }}
            value={search} 
            onChange={e => setSearch(e.target.value)}
          />
          <button className={styles.addChapterBtn} onClick={handleAddChapter} title="Add Chapter">+</button>
        </div>
      </div>

      <div className={styles.draftNavList}>
        {filteredScenes.filter(s => s.documentId === activeDocumentId).map(scene => (
          <div 
            key={scene.id} 
            ref={scene.id === activeSceneId ? activeSceneRef : null}
            className={`${styles.sceneNavItem} ${scene.id === activeSceneId ? styles.sceneNavItemActive : ''}`}
            onClick={() => setActiveScene(scene.id)}
          >
            <div className={styles.sceneNavTitle}>{scene.title}</div>
            <div className={styles.sceneNavMeta}>
              {scene.wordCount !== undefined && <span className={styles.sceneNavWordCount}>{scene.wordCount}</span>}
              <div className={styles.sceneNavStatus} style={{ backgroundColor: statusColors[getSceneStatus(scene.id)] || '#6b7280' }} />
            </div>
          </div>
        ))}
        <button className={styles.addSceneBtnInline} onClick={handleAddScene}>
          + Add Scene
        </button>
      </div>

      <div className={styles.draftNavFooter}>
         <button className={styles.jumpActiveBtn} onClick={scrollToActive}>📍 Jump to Active</button>
      </div>
    </div>
  );
}

// ============================================================
// EMPTY DESK WELCOME
// ============================================================

function EmptyDeskWelcome() {
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [isLoadOpen, setIsLoadOpen] = useState(false);
  
  const projects = useWorkspaceStore(s => s.projects);
  const setActiveProject = useWorkspaceStore(s => s.setActiveProject);
  const setActiveDocument = useWorkspaceStore(s => s.setActiveDocument);
  const setWorkspaceMode = useWorkspaceStore(s => s.setWorkspaceMode);
  const docs = useWorkspaceStore(s => s.documents);

  const handleSelect = (id: string) => {
    setActiveProject(id);
    const pDocs = docs.filter(d => d.projectId === id).sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    if (pDocs.length > 0) setActiveDocument(pDocs[0].id);
    setWorkspaceMode('desk');
  };

  const handleResume = () => {
    if (projects.length === 0) return;
    const sorted = [...projects].sort((a,b) =>
      new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime()
    );
    handleSelect(sorted[0].id);
  };

  const [isSeeding, setIsSeeding] = useState(false);
  const handleLoadExample = async () => {
    setIsSeeding(true);
    try {
      // Dynamically imported so the 50KB example world stays out of the main bundle.
      const { seedBetaData } = await import('@/lib/betaSeedData');
      seedBetaData(useWorkspaceStore.getState());
      const seeded = useWorkspaceStore.getState().projects;
      if (seeded.length > 0) {
        const newest = [...seeded].sort((a, b) =>
          new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime()
        )[0];
        handleSelect(newest.id);
      }
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className={styles.emptyWelcomeContainer}>
      <div className={styles.emptyWelcomeContent}>
        <div className={styles.emptyWelcomeHeader}>
          <div className={styles.emptyWelcomeIcon}>M</div>
          <div>
            <div className={styles.emptyWelcomeTitle}>MythForge</div>
            <div className={styles.emptyWelcomeSub}>BUILD WORLDS • WRITE STORIES</div>
          </div>
        </div>

        <div className={styles.emptyWelcomeActions}>
          <button className={styles.welcomeActionBtn} onClick={() => setShowNew(true)}>
            <span className={styles.welcomeActionIcon}>✨</span>
            <span className={styles.welcomeActionLabel}>New Writing</span>
          </button>
          
          <button className={styles.welcomeActionBtn} onClick={handleResume} disabled={projects.length === 0}>
            <span className={styles.welcomeActionIcon}>↺</span>
            <span className={styles.welcomeActionLabel}>Resume</span>
          </button>

          <div className={styles.welcomeActionGroup}>
            <button className={styles.welcomeActionBtnSecondary} onClick={() => setIsLoadOpen(!isLoadOpen)}>
              <span className={styles.welcomeActionIcon}>📁</span>
              <span className={styles.welcomeActionLabel}>Load</span>
            </button>
            <button className={styles.welcomeActionBtnSecondary} onClick={() => setShowImport(true)}>
              <span className={styles.welcomeActionIcon}>📥</span>
              <span className={styles.welcomeActionLabel}>Import</span>
            </button>
            <button className={styles.welcomeActionBtnSecondary} onClick={handleLoadExample} disabled={isSeeding}>
              <span className={styles.welcomeActionIcon}>🌍</span>
              <span className={styles.welcomeActionLabel}>{isSeeding ? 'Loading…' : 'Example World'}</span>
            </button>
          </div>
        </div>

        {isLoadOpen && projects.length > 0 && (
          <div className={styles.welcomeProjectList}>
            {projects.sort((a,b) => b.name.localeCompare(a.name)).map(p => (
              <button key={p.id} className={styles.welcomeProjectItem} onClick={() => handleSelect(p.id)}>
                <span className={styles.welcomeProjectColor} style={{ background: p.coverColor }} />
                <span className={styles.welcomeProjectName}>{p.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <NewProjectModal isOpen={showNew} onClose={() => setShowNew(false)} />
      <ImportModal isOpen={showImport} onClose={() => setShowImport(false)} />
    </div>
  );
}

interface WidgetRendererProps {
  widget: DeskWidget;
  updateContentImmediate: (id: string, content: Record<string, any>) => void;
  updateContentSilent: (id: string, content: Record<string, any>) => void;
  handleDragStart: (e: React.MouseEvent, w: DeskWidget) => void;
  deleteWidget: (id: string) => void;
  updateWidgets: (next: DeskWidget[]) => void;
  widgetsRef: React.MutableRefObject<DeskWidget[]>;
  triggerSave: () => void;
  viewportRef: React.RefObject<HTMLDivElement | null>;
  onAddAtCenter: (type: DeskWidgetType) => void;
}

const WidgetRenderer = React.memo(function WidgetRenderer({
  widget, updateContentImmediate, updateContentSilent,
  handleDragStart, deleteWidget, updateWidgets, widgetsRef, triggerSave, viewportRef, onAddAtCenter, onDockChange
}: WidgetRendererProps & { onDockChange: (dock: DeskWidget['dock']) => void }) {
  // Stable per-widget callbacks — recreated only when widget.id changes.
  // widget.content seeds each renderer's local useState on mount / external update.
  // From that point the renderer owns its local state; the store is the persistence
  // layer, updated only after the debounce flush.
  const handleChange = useCallback(
    (c: any) => updateContentSilent(widget.id, c),
    [updateContentSilent, widget.id]
  );
  const handleChangeImmediate = useCallback(
    (c: any) => updateContentImmediate(widget.id, c),
    [updateContentImmediate, widget.id]
  );
  const content = widget.content;
  switch (widget.type) {
    case 'writingZone': return <WritingZoneRenderer content={content} onChange={handleChange} onChangeImmediate={handleChangeImmediate} widget={widget} onDragStart={handleDragStart} onDeleteWidget={deleteWidget} onDockChange={onDockChange} onManualSave={triggerSave} onAddAtCenter={onAddAtCenter} />;
    case 'sticky':      return <StickyNoteRenderer content={content} onChange={handleChange} onChangeImmediate={handleChangeImmediate} />;
    case 'reference':   return <ReferenceCardRenderer content={content} onChange={handleChange} />;
    case 'image':       return <ImagePinRenderer content={content} onChange={handleChange} onChangeImmediate={handleChangeImmediate} />;
    case 'biblePinit':  return <WorldBiblePinRenderer content={content} onChange={handleChange} />;
    case 'sceneControl':return <SceneControlRenderer content={content} onChange={handleChange} />;
    case 'characterState':return <CharacterStateRenderer content={content} onChange={handleChange} />;
    case 'continuity':  return <ContinuityRenderer content={content} onChange={handleChange} />;
    case 'structure':   return <StructureRenderer content={content} onChange={handleChange} />;
    case 'research':    return <ResearchRenderer content={content} onChange={handleChange} />;
    case 'progress':    return <ProgressRenderer content={content} onChange={handleChange} />;
    case 'relMap':      return <RelationshipMapRenderer content={content} onChange={handleChange} />;
    case 'draftNav':    return <DraftNavRenderer content={content} onChange={handleChange} />;
    case 'untyped':     return <UntypedWidgetRenderer />;
    default:            return null;
  }
});

// ============================================================
// MAIN COMPONENT
// ============================================================


export default function WritingDesk() {
  const activeProjectId = useWorkspaceStore(s => s.activeProjectId);
  const activeDocumentId = useWorkspaceStore(s => s.activeDocumentId);
  const activeSceneId = useWorkspaceStore(s => s.activeSceneId);
  const deskState = useWorkspaceStore(s => activeProjectId ? s.deskStates[activeProjectId] : null);
  const updateDeskState = useWorkspaceStore(s => s.updateDeskState);
  const globalWidgets = useWorkspaceStore(s => s.globalWidgets);
  const updateGlobalWidgets = useWorkspaceStore(s => s.updateGlobalWidgets);

  // Derived state from store
  const widgets = useMemo(() => deskState?.widgets || [], [deskState]);
  const zoom = deskState?.zoom ?? 1;
  const canvasOffset = useMemo(() => deskState?.canvasOffset || { x: 0, y: 0 }, [deskState]);

  const widgetsRef = useRef<DeskWidget[]>(widgets);
  const zoomRef = useRef(zoom);
  const canvasOffsetRef = useRef(canvasOffset);
  const offsetRef = useRef(canvasOffset);
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => { setHasMounted(true); }, []);

  // Synchronize refs when store changes (e.g. from World Bible Pin)
  useEffect(() => {
    widgetsRef.current = widgets;
    zoomRef.current = zoom;
    canvasOffsetRef.current = canvasOffset;
    offsetRef.current = canvasOffset;
  }, [widgets, zoom, canvasOffset]);

  // Always ensure a Writing Zone widget is present when a project is active.
  // Fires for new projects (no deskState yet) and existing projects that have
  // no writingZone widget (e.g. user deleted it or it was never seeded).

  const liveContentRef = useRef<Record<string, Record<string, any>>>(
    Object.fromEntries(widgets.map(w => [w.id, w.content]))
  );
  const contentSaveTimers = useRef<Record<string, any>>({});
  const [isPanning, setIsPanning] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [typePickerWidgetId, setTypePickerWidgetId] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isEditingZoom, setIsEditingZoom] = useState(false);
  const [zoomInputValue, setZoomInputValue] = useState("");


  const viewportRef = useRef<HTMLDivElement>(null);

  const updateWidgets = useCallback((next: DeskWidget[], silentUI: boolean = true) => {
    if (!activeProjectId) return;
    widgetsRef.current = next;
    updateDeskState(activeProjectId, { widgets: next });
    if (!silentUI) {
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    }
  }, [activeProjectId, updateDeskState]);

  const updateDock = useCallback((id: string, dock: DeskWidget['dock']) => {
    const all = [...widgetsRef.current, ...globalWidgets];
    const w = all.find(x => x.id === id);
    if (!w) return;

    let nx = w.x;
    let ny = w.y;

    if (dock && viewportRef.current) {
      const vw = viewportRef.current.clientWidth;
      if (dock === 'center') nx = (vw - w.width) / 2;
      else if (dock === 'left') nx = 0;
      else if (dock === 'right') nx = vw - w.width;
      // When docking to center, we usually anchor to top 0 in CSS, 
      // but let's keep ny sane.
      ny = 0;
    }

    const updated = { ...w, dock, x: nx, y: ny };
    const nextArr = widgetsRef.current.map(x => x.id === id ? updated : x);
    
    // Use the primary updateWidgets flow for consistency and re-render triggers
    updateWidgets(nextArr);
  }, [activeProjectId, globalWidgets, updateWidgets]);

  const activeWidgets = useMemo(() => {
    const all = [...widgets, ...globalWidgets];
    return all.filter(w => {
      const scope = w.scope || 'project';
      if (scope === 'global') return true;
      if (scope === 'project') {
         // Project widgets are already project-specific in 'widgets'
         return widgets.some(pw => pw.id === w.id);
      }
      if (scope === 'chapter') return w.scopeId === activeDocumentId;
      if (scope === 'scene') return w.scopeId === activeSceneId;
      return false;
    });
  }, [widgets, globalWidgets, activeDocumentId, activeSceneId]);

  const canvasWidgets = useMemo(() => activeWidgets.filter(w => !w.dock), [activeWidgets]);
  const dockedWidgets = useMemo(() => activeWidgets.filter(w => !!w.dock), [activeWidgets]);

  // New state for creation flow
  const [pendingWidget, setPendingWidget] = useState<{ x: number, y: number, width: number, height: number } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const drawGhostRef = useRef<HTMLDivElement>(null);

  const surfaceCanvasRef = useRef<{ redraw: (off: { x: number; y: number }, z: number) => void }>(null);
  const zoomRafRef = useRef<number | null>(null);

  const setOffset = useCallback((off: { x: number; y: number }) => {
    if (!activeProjectId) return;
    canvasOffsetRef.current = off;
    offsetRef.current = off;
    updateDeskState(activeProjectId, { canvasOffset: off });
  }, [activeProjectId, updateDeskState]);

  const setZoomValue = useCallback((z: number) => {
    if (!activeProjectId) return;
    zoomRef.current = z;
    updateDeskState(activeProjectId, { zoom: z });
  }, [activeProjectId, updateDeskState]);

  // Initial liveContent sync when widgets are added externally
  useEffect(() => {
    widgets.forEach(w => {
      if (!liveContentRef.current[w.id]) {
        liveContentRef.current[w.id] = w.content;
      }
    });
  }, [widgets]);

  const triggerSave = useCallback(() => {
    // Persistence is handled by the store
  }, []);


  useEffect(() => {
    if (!activeProjectId) return;
    const projectWidgets = deskState?.widgets || [];
    const wz = projectWidgets.find(w => w.type === 'writingZone');

    // Seeding: Always ensure a Writing Zone widget is present when a project is active.
    if (wz) return;

    const dw = DEFAULT_DIMS.writingZone.w;
    const nw: DeskWidget = {
      id: crypto.randomUUID(),
      type: 'writingZone',
      x: 0,
      y: 0,
      width: dw,
      height: DEFAULT_DIMS.writingZone.h,
      content: {},
      dock: 'center',
      scope: 'project',
    };

    const current = deskState || { widgets: [], zoom: 1, canvasOffset: { x: 0, y: 0 } };
    updateDeskState(activeProjectId, {
      ...current,
      widgets: [nw, ...current.widgets],
    });
  }, [activeProjectId, deskState, updateDeskState, updateWidgets]);

  const updateContentSilent = useCallback((id: string, content: any) => {
    liveContentRef.current[id] = content;
    if (contentSaveTimers.current[id]) clearTimeout(contentSaveTimers.current[id]);
    contentSaveTimers.current[id] = setTimeout(() => {
      updateWidgets(widgetsRef.current.map(w => w.id === id ? { ...w, content } : w));
    }, 800);
  }, [updateWidgets]);


  const updateContentImmediate = useCallback((id: string, content: any) => {
    liveContentRef.current[id] = content;
    updateWidgets(widgetsRef.current.map(w => w.id === id ? { ...w, content } : w));
  }, [updateWidgets]);

  const deleteWidget = useCallback((id: string) => {
    const next = widgetsRef.current.filter(w => w.id !== id);
    updateWidgets(next);
    setSelectedId(prev => prev === id ? null : prev);
  }, [updateWidgets]);

  const handleDragStart = useCallback((e: React.MouseEvent, widget: DeskWidget) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault(); e.stopPropagation();
    setSelectedId(widget.id);
    const startX = e.clientX, startY = e.clientY, origX = widget.x, origY = widget.y;
    const localZoom = widget.dock ? 1 : zoomRef.current;
    let moved = false;
    const onMove = (mv: MouseEvent) => {
      const dx = (mv.clientX - startX) / localZoom;
      const dy = (mv.clientY - startY) / localZoom;
      if (!moved && Math.abs(mv.clientX - startX) < 4 && Math.abs(mv.clientY - startY) < 4) return;
      moved = true;
      const el = document.getElementById(`widget-${widget.id}`);
      if (el) {
        if (widget.dock) {
          const vw = viewportRef.current?.clientWidth || window.innerWidth;
          const nx = Math.max(0, Math.min(vw - widget.width, origX + (mv.clientX - startX)));
          el.style.left = nx + 'px';
        } else {
          el.style.left = (origX + dx) + 'px';
          el.style.top = (origY + dy) + 'px';
        }
      }
    };
    const onUp = (up: MouseEvent) => {
      document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp);
      if (!moved) return;
      if (widget.dock) {
        const vw = viewportRef.current?.clientWidth || window.innerWidth;
        const nx = Math.max(0, Math.min(vw - widget.width, origX + (up.clientX - startX)));
        updateWidgets(widgetsRef.current.map(w => w.id === widget.id ? { ...w, x: nx } : w));
      } else {
        const nx = origX + (up.clientX - startX) / localZoom, ny = origY + (up.clientY - startY) / localZoom;
        updateWidgets(widgetsRef.current.map(w => w.id === widget.id ? { ...w, x: nx, y: ny } : w));
      }
    };
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
  }, [updateWidgets]);

  const handleResizeStart = useCallback((e: React.MouseEvent, widget: DeskWidget, dir: ResizeDir) => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX, startY = e.clientY, { x: oX, y: oY, width: oW, height: oH } = widget;
    const localZoom = widget.dock ? 1 : zoomRef.current;
    const onMove = (mv: MouseEvent) => {
      const dx = (mv.clientX - startX) / localZoom, dy = (mv.clientY - startY) / localZoom;
      let nx = oX, ny = oY, nw = oW, nh = oH;
      if (dir.includes('e')) nw = Math.max(MIN_W, oW + dx);
      if (dir.includes('s')) nh = Math.max(MIN_H, oH + dy);
      if (dir.includes('w')) { nw = Math.max(MIN_W, oW - dx); nx = oX + (oW - nw); }
      if (dir.includes('n')) { nh = Math.max(MIN_H, oH - dy); ny = oY + (oH - nh); }
      const el = document.getElementById(`widget-${widget.id}`);
      if (el) { 
        el.style.left=nx+'px'; 
        el.style.top=ny+'px';
        el.style.width=nw+'px'; 
        el.style.height=nh+'px'; 
      }
    };
    const onUp = (up: MouseEvent) => {
      document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp);
      const dx = (up.clientX - startX) / localZoom, dy = (up.clientY - startY) / localZoom;
      let nx = oX, ny = oY, nw = oW, nh = oH;
      if (dir.includes('e')) nw = Math.max(MIN_W, oW + dx);
      if (dir.includes('s')) nh = Math.max(MIN_H, oH + dy);
      if (dir.includes('w')) { nw = Math.max(MIN_W, oW - dx); nx = oX + (oW - nw); }
      if (dir.includes('n')) { nh = Math.max(MIN_H, oH - dy); ny = oY + (oH - nh); }
      updateWidgets(widgetsRef.current.map(w => w.id === widget.id ? { ...w, x: nx, y: ny, width: nw, height: nh } : w));
    };
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
  }, [updateWidgets]);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const isMiddle = e.button === 1, isShiftLeft = e.button === 0 && e.shiftKey, isLeft = e.button === 0 && !e.shiftKey;
    if (isMiddle || isShiftLeft) {
      if (isShiftLeft && e.target !== e.currentTarget && (e.target as HTMLElement).className !== styles.rippleCanvas) return;
      e.preventDefault(); setIsPanning(true);
      const startX = e.clientX, startY = e.clientY, origX = canvasOffset.x, origY = canvasOffset.y;
      const onMove = (mv: MouseEvent) => {
        const nx = origX + (mv.clientX - startX);
        const ny = origY + (mv.clientY - startY);
        canvasOffsetRef.current = { x: nx, y: ny };
        if (canvasRef.current) {
          canvasRef.current.style.transform = `translate(${nx}px, ${ny}px) scale(${zoomRef.current})`;
        }
        surfaceCanvasRef.current?.redraw({ x: nx, y: ny }, zoomRef.current);
      };
      const onUp = (up: MouseEvent) => {
        document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp);
        setIsPanning(false);
        const nx = origX + (up.clientX - startX), ny = origY + (up.clientY - startY);
        setOffset({ x: nx, y: ny });
      };
      document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
      return;
    }
    if (isLeft && (e.target === e.currentTarget || (e.target as HTMLElement).className === styles.rippleCanvas)) {
      setSelectedId(null); setPendingWidget(null); // Clear previous if click background
      
      const rect = viewportRef.current?.getBoundingClientRect(); if (!rect) return;
      // World coordinates for the ghost
      const startX = (e.clientX - rect.left - canvasOffsetRef.current.x) / zoomRef.current;
      const startY = (e.clientY - rect.top - canvasOffsetRef.current.y) / zoomRef.current;
      
      const ghost = drawGhostRef.current;
      if (ghost) { 
        ghost.style.display = 'block'; 
        ghost.style.left = startX + 'px'; 
        ghost.style.top = startY + 'px'; 
        ghost.style.width = '0px'; 
        ghost.style.height = '0px'; 
      }

      const onMove = (mv: MouseEvent) => {
        const x = (mv.clientX - rect.left - canvasOffsetRef.current.x) / zoomRef.current;
        const y = (mv.clientY - rect.top - canvasOffsetRef.current.y) / zoomRef.current;
        const w = x - startX, h = y - startY;
        if (ghost) { 
          ghost.style.left = (w >= 0 ? startX : startX + w) + 'px'; 
          ghost.style.top = (h >= 0 ? startY : startY + h) + 'px'; 
          ghost.style.width = Math.abs(w) + 'px'; 
          ghost.style.height = Math.abs(h) + 'px'; 
        }
      };

      const onUp = (up: MouseEvent) => {
        const x = (up.clientX - rect.left - canvasOffsetRef.current.x) / zoomRef.current;
        const y = (up.clientY - rect.top - canvasOffsetRef.current.y) / zoomRef.current;
        const rw = x - startX, rh = y - startY, bw = Math.abs(rw), bh = Math.abs(rh);
        
        if (bw >= 40 && bh >= 30) {
          setPendingWidget({
            x: rw >= 0 ? startX : startX + rw,
            y: rh >= 0 ? startY : startY + rh,
            width: bw,
            height: bh
          });
        } else {
          if (ghost) ghost.style.display = 'none';
        }
        document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const dropX = (e.clientX - rect.left) / zoomRef.current;
    const dropY = (e.clientY - rect.top) / zoomRef.current;

    // Internal widget drag from palette/library
    const type = e.dataTransfer.getData('desk-widget-type') as DeskWidgetType;
    if (type) {
      const dims = DEFAULT_DIMS[type];
      const nw: DeskWidget = { 
        id: crypto.randomUUID(), 
        type, 
        x: dropX - dims.w / 2, 
        y: (e.clientY - rect.top) / zoomRef.current - dims.h / 2, 
        width: dims.w, 
        height: dims.h, 
        content: {}, 
        dock: type === 'writingZone' ? 'center' : null 
      };
      updateWidgets([...widgetsRef.current, nw]);
      setSelectedId(nw.id);
      return;
    }

    // External Files (Local Drop)
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const imageFiles = files.filter(f => f.type.startsWith('image/'));
      let offset = 0;
      
      for (const file of imageFiles) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const src = event.target?.result as string;
          const dims = DEFAULT_DIMS.image;
          const nw: DeskWidget = {
            id: crypto.randomUUID(),
            type: 'image',
            x: dropX - dims.w / 2 + offset,
            y: (e.clientY - rect.top) / zoomRef.current - dims.h / 2 + offset,
            width: dims.w,
            height: dims.h,
            content: { src, label: file.name },
            dock: null
          };
          updateWidgets([...widgetsRef.current, nw]);
          setSelectedId(nw.id);
          offset += 20; // Stagger multiple drops
        };
        reader.readAsDataURL(file);
      }
      if (imageFiles.length > 0) return;
    }

    // External Browser Images (URL/HTML Drop)
    const html = e.dataTransfer.getData('text/html');
    const uriList = e.dataTransfer.getData('text/uri-list');
    let imgSrc = '';

    if (html) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const img = doc.querySelector('img');
      if (img && img.src) imgSrc = img.src;
    }

    if (!imgSrc && uriList) {
      const lines = uriList.split('\n').filter(l => l && !l.startsWith('#'));
      if (lines[0]) imgSrc = lines[0];
    }

    if (imgSrc) {
      const dims = DEFAULT_DIMS.image;
      const nw: DeskWidget = {
        id: crypto.randomUUID(),
        type: 'image',
        x: dropX - dims.w / 2,
        y: (e.clientY - rect.top) / zoomRef.current - dims.h / 2,
        width: dims.w,
        height: dims.h,
        content: { src: imgSrc },
        dock: null
      };
      updateWidgets([...widgetsRef.current, nw]);
      setSelectedId(nw.id);
    }
  };

  const addAtCenter = (type: DeskWidgetType) => {
    if (!viewportRef.current) return;
    const vW = viewportRef.current.clientWidth, vH = viewportRef.current.clientHeight, dims = DEFAULT_DIMS[type];
    const wx = (vW / 2 - canvasOffsetRef.current.x) / zoomRef.current - dims.w / 2, wy = (vH / 2 - canvasOffsetRef.current.y) / zoomRef.current - dims.h / 2;
    const nw: DeskWidget = { id: crypto.randomUUID(), type, x: wx, y: wy, width: dims.w, height: dims.h, content: {}, dock: type === 'writingZone' ? 'center' : null };
    updateWidgets([...widgetsRef.current, nw]); setSelectedId(nw.id);
  };

  const handleFit = () => {
    if (!viewportRef.current || widgetsRef.current.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    widgetsRef.current.forEach(w => { minX = Math.min(minX, w.x); minY = Math.min(minY, w.y); maxX = Math.max(maxX, w.x + w.width); maxY = Math.max(maxY, w.y + w.height); });
    const cw = maxX - minX, ch = maxY - minY, vW = viewportRef.current.clientWidth, vH = viewportRef.current.clientHeight;
    const nextZoom = Math.min(Math.max(0.2, Math.min((vW-100)/cw, (vH-100)/ch)), 1.2);
    const nextOffset = { x: (vW/2) - (minX + cw/2)*nextZoom, y: (vH/2) - (minY + ch/2)*nextZoom };
    if (activeProjectId) {
      updateDeskState(activeProjectId, { zoom: nextZoom, canvasOffset: nextOffset });
    }
  };

  const commitZoomInput = () => {
    const val = parseFloat(zoomInputValue);
    if (!isNaN(val)) {
      const nextZoom = Math.min(2, Math.max(0.2, val / 100));
      setZoomValue(nextZoom);
      if (surfaceCanvasRef.current) surfaceCanvasRef.current.redraw(canvasOffsetRef.current, nextZoom);
    }
    setIsEditingZoom(false);
  };

  useEffect(() => {
    const onKD = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pendingWidget) setPendingWidget(null);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        const t = e.target as HTMLElement;
        if (t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA' && !t.isContentEditable) deleteWidget(selectedId);
      }
    };
    window.addEventListener('keydown', onKD); return () => window.removeEventListener('keydown', onKD);
  }, [selectedId, pendingWidget]);

  // Sync ghost visibility with pendingWidget
  useEffect(() => {
    if (!pendingWidget && drawGhostRef.current) {
      drawGhostRef.current.style.display = 'none';
    }
  }, [pendingWidget]);



  if (!hasMounted) return null;

  if (!activeProjectId) {
    return (
      <div className={styles.deskRoot}>
        <div className={styles.deskViewport}>
          <SurfaceCanvas ref={surfaceCanvasRef} containerRef={viewportRef} zoom={zoom} offset={canvasOffset} />
          <EmptyDeskWelcome />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.deskRoot} onWheel={(e) => {
      if (!e.ctrlKey && !e.shiftKey) return;
      e.preventDefault();
      if (zoomRafRef.current) return;
      zoomRafRef.current = requestAnimationFrame(() => {
        zoomRafRef.current = null;
        const nextZoom = Math.min(2, Math.max(0.2, zoomRef.current - e.deltaY * 0.001));
        setZoomValue(nextZoom);
        if (canvasRef.current) {
          canvasRef.current.style.transform = `translate(${canvasOffsetRef.current.x}px, ${canvasOffsetRef.current.y}px) scale(${nextZoom})`;
        }
        surfaceCanvasRef.current?.redraw(canvasOffsetRef.current, nextZoom);
      });
    }}>
      <div ref={viewportRef} className={`${styles.deskViewport} ${isPanning ? styles.deskViewportPanning : ''}`} onDragOver={e => e.preventDefault()} onDrop={handleDrop} onClick={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).className === styles.rippleCanvas) { setSelectedId(null); } }} onMouseDown={handleCanvasMouseDown}>
        <SurfaceCanvas ref={surfaceCanvasRef} containerRef={viewportRef} zoom={zoom} offset={canvasOffset} />
        
        <div className={`${styles.saveIndicator} ${isSaved ? styles.saveIndicatorActive : ''}`}>✓ Saved</div>
        
        <div ref={canvasRef} className={styles.deskCanvasInner} style={{ transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${zoom})` }}>
          {/* Ghost Box (Now inside scaled layer) */}
          <div ref={drawGhostRef} className={styles.deskDrawGhost} style={{ display: 'none', position: 'absolute', pointerEvents: 'none', zIndex: 9999 }} />
          
          {canvasWidgets.map(w => (
            <div key={w.id} id={`widget-${w.id}`} className={`${styles.deskWidget} ${selectedId === w.id ? styles.deskWidgetSelected : ''}`} style={{ left: w.x, top: w.y, width: w.width, height: w.height, zIndex: selectedId === w.id ? 50 : 1 }} onMouseDown={e => { e.stopPropagation(); setSelectedId(w.id); }}>
                <div className={styles.deskTitleBar} onMouseDown={e => handleDragStart(e, w)}>
                  <div className={styles.deskTitleBarIcon}>{PALETTE_MAP[w.type]?.icon || '❓'}</div>
                  <div className={styles.deskTitleBarLabel}>
                    {w.type === 'writingZone' ? (
                      <div className={styles.headerToolbar}>
                        <button 
                          className={`${styles.headerToolBtn} ${w.content.saveStatus === 'saved' ? styles.headerToolBtnActive : ''}`}
                          onMouseDown={e => e.stopPropagation()}
                          onClick={() => {
                            updateContentImmediate(w.id, { ...w.content, saveStatus: 'saving' });
                            triggerSave();
                            setTimeout(() => {
                              updateContentImmediate(w.id, { ...w.content, saveStatus: 'saved' });
                              setTimeout(() => updateContentImmediate(w.id, { ...w.content, saveStatus: null }), 2000);
                            }, 500);
                          }}
                          title="Save Draft (Ctrl+S)"
                          data-status={w.content.saveStatus}
                        >
                          <span className={styles.headerToolBtnSave} data-status={w.content.saveStatus}>
                            {w.content.saveStatus === 'saved' ? '✔️' : '💾'}
                          </span>
                          Save
                        </button>

                        <button 
                          className={styles.headerToolBtn}
                          onMouseDown={e => e.stopPropagation()}
                          onClick={() => updateContentImmediate(w.id, { ...w.content, showSettings: true })}
                          title="Project Settings"
                        >
                          ⚙️ Settings
                        </button>

                        <button 
                          className={`${styles.headerToolBtn} ${w.content.binderMode !== 'shown' ? styles.headerToolBtnActive : ''}`}
                          onMouseDown={e => e.stopPropagation()}
                          onClick={() => {
                            const modes: BinderMode[] = ['shown', 'smart'];
                            const next = modes[(modes.indexOf(w.content.binderMode || 'shown') + 1) % modes.length];
                            updateContentImmediate(w.id, { ...w.content, binderMode: next });
                          }}
                          title="Cycle Binder Mode"
                        >
                          <span className={styles.headerToolModeLabel}>
                            { (w.content.binderMode || 'shown').charAt(0).toUpperCase() + (w.content.binderMode || 'shown').slice(1) }
                          </span>
                        </button>
                      </div>
                    ) : (
                      <>
                        {PALETTE_MAP[w.type]?.label || 'Untyped'}
                        {w.content.isCollapsed && <span className={styles.headerStateBadge}>Min</span>}
                      </>
                    )}
                  </div>
                  
                  <div className={styles.dockedHandleDots}><span/><span/><span/></div>

                  <div className={styles.deskHeaderControls}>
                    {w.type === 'untyped' && (
                      <button className={styles.deskTypePickerTrigger} onClick={() => setTypePickerWidgetId(w.id)}>Choose</button>
                    )}

                    <button 
                      className={`${styles.deskHeaderBtn} ${w.dock ? styles.deskHeaderBtnActive : ''}`} 
                      title={w.dock ? "Unlock & Move Freely" : "Dock to Center"} 
                      onMouseDown={e => e.stopPropagation()}
                      onClick={() => updateDock(w.id, w.dock ? null : 'center')}
                    >
                      ⚓
                    </button>
                    <button 
                      className={styles.deskHeaderBtn} 
                      title={w.content.isCollapsed ? "Expand" : "Minimize"} 
                      onMouseDown={e => e.stopPropagation()}
                      onClick={() => updateContentImmediate(w.id, { ...w.content, isCollapsed: !w.content.isCollapsed })}
                    >
                      {w.content.isCollapsed ? '□' : '−'}
                    </button>
                    <button 
                      className={`${styles.deskHeaderBtn} ${styles.deskHeaderBtnClose}`} 
                      onMouseDown={e => e.stopPropagation()} 
                      onClick={() => deleteWidget(w.id)}
                      title="Close Widget"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              {!w.content.isCollapsed && (
              <div className={`${styles.deskWidgetContent} ${w.type === 'writingZone' ? styles.deskWidgetContentFull : ''}`}>
                <WidgetRenderer
                  widget={w}
                  updateContentImmediate={updateContentImmediate}
                  updateContentSilent={updateContentSilent}
                  handleDragStart={handleDragStart}
                  deleteWidget={deleteWidget}
                  updateWidgets={updateWidgets}
                  widgetsRef={widgetsRef}
                  triggerSave={triggerSave}
                  viewportRef={viewportRef}
                  onAddAtCenter={addAtCenter}
                  onDockChange={(dock) => updateDock(w.id, dock)}
                />
              </div>
              )}
              {(['n','s','e','w','ne','nw','se','sw'] as ResizeDir[]).map(dir => <div key={dir} className={`${styles.deskResizeHandle} ${styles[`deskResize${dir.toUpperCase()}` as keyof typeof styles]}`} onMouseDown={e => handleResizeStart(e, w, dir)} />)}
            </div>
          ))}
        </div>

        <div className={styles.dockedLayer}>
          <div className={styles.dockedTrack} />
          {dockedWidgets.map(w => (
            <div
              key={w.id}
              id={`widget-${w.id}`}
              className={`${styles.deskWidget} ${styles.dockedWidget} ${styles[`docked${w.dock?.charAt(0).toUpperCase()}${w.dock?.slice(1)}` as keyof typeof styles]} ${selectedId === w.id ? styles.deskWidgetSelected : ''} ${w.content.isCollapsed ? styles.dockedWidgetCollapsed : ''}`}
              style={{ width: w.width, left: w.x, zIndex: selectedId === w.id ? 50 : 5 }}
              onMouseDown={e => { e.stopPropagation(); setSelectedId(w.id); }}
            >
              <div className={styles.dockedWidgetHandle} onMouseDown={e => handleDragStart(e, w)}>
                <div className={styles.dockedHandleLabel}>
                  <span style={{ marginRight: '6px' }}>
                    {w.type !== 'writingZone' && PALETTE_MAP[w.type]?.icon}
                  </span>
                  {w.type === 'writingZone' ? (
                      <div className={styles.headerToolbar}>
                        {/* Cleanup: Settings, Visibility, and Focus icons removed for a cleaner experience */}
                      </div>
                  ) : (

                    <>
                      {PALETTE_MAP[w.type]?.label}
                      {w.content.isCollapsed && <span className={styles.headerStateBadge}>Min</span>}
                    </>
                  )}
                </div>

                <div className={styles.dockedHandleDots}><span/><span/><span/></div>

                <div className={styles.deskHeaderControls}>
                  <button 
                    className={`${styles.deskHeaderBtn} ${w.dock ? styles.deskHeaderBtnActive : ''}`} 
                    title={w.dock ? "Unlock & Move Freely" : "Dock to Center"} 
                    onMouseDown={e => e.stopPropagation()}
                    onClick={() => updateDock(w.id, w.dock ? null : 'center')}
                  >
                    ⚓
                  </button>
                  <button 
                    className={styles.deskHeaderBtn} 
                    title={w.content.isCollapsed ? "Expand" : "Minimize"} 
                    onMouseDown={e => e.stopPropagation()}
                    onClick={() => updateContentImmediate(w.id, { ...w.content, isCollapsed: !w.content.isCollapsed })}
                  >
                    {w.content.isCollapsed ? '□' : '−'}
                  </button>
                  <button 
                    className={`${styles.deskHeaderBtn} ${styles.deskHeaderBtnClose}`} 
                    onMouseDown={e => e.stopPropagation()} 
                    onClick={() => deleteWidget(w.id)}
                    title="Close Widget"
                  >
                    ✕
                  </button>
                </div>
              </div>
              {!w.content.isCollapsed && (
              <div className={`${styles.deskWidgetContent} ${w.type === 'writingZone' ? styles.deskWidgetContentFull : ''}`}>
                <WidgetRenderer
                  widget={w}
                  updateContentImmediate={updateContentImmediate}
                  updateContentSilent={updateContentSilent}
                  handleDragStart={handleDragStart}
                  deleteWidget={deleteWidget}
                  updateWidgets={updateWidgets}
                  widgetsRef={widgetsRef}
                  triggerSave={triggerSave}
                  viewportRef={viewportRef}
                  onAddAtCenter={addAtCenter}
                  onDockChange={(dock) => updateDock(w.id, dock)}
                />
              </div>
              )}
              <div className={`${styles.deskResizeHandle} ${styles.deskResizeE}`} onMouseDown={e => handleResizeStart(e, w, 'e')} />
              <div className={`${styles.deskResizeHandle} ${styles.deskResizeW}`} onMouseDown={e => handleResizeStart(e, w, 'w')} />
            </div>
          ))}
        </div>
        
        <div className={styles.deskZoomControls}>
          <button className={styles.zoomBtn} onClick={() => { setZoomValue(Math.max(0.2, zoom - 0.1)); }}>−</button>
          
          <input 
            type="range" 
            className={styles.zoomSlider} 
            min="0.2" 
            max="2" 
            step="0.01" 
            value={zoom} 
            onChange={(e) => {
              setZoomValue(parseFloat(e.target.value));
            }}
          />

          {isEditingZoom ? (
            <input
              autoFocus
              className={styles.zoomInput}
              value={zoomInputValue}
              onChange={(e) => setZoomInputValue(e.target.value)}
              onBlur={commitZoomInput}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitZoomInput();
                if (e.key === 'Escape') setIsEditingZoom(false);
              }}
            />
          ) : (
            <span 
              className={styles.zoomValue} 
              onClick={() => {
                setZoomInputValue(Math.round(zoom * 100).toString());
                setIsEditingZoom(true);
              }}
              title="Click to type zoom %"
            >
              {Math.round(zoom * 100)}%
            </span>
          )}

          <button className={styles.zoomBtn} onClick={() => { setZoomValue(Math.min(2, zoom + 0.1)); }}>+</button>
          <div className={styles.deskFmtSep} style={{ height: '16px', margin: '0 4px' }} />
          <button className={styles.fitBtn} style={{ background: 'transparent', color: 'var(--muted)', fontSize: '0.65rem' }} onClick={() => { setZoomValue(1); }}>100%</button>
          <button className={styles.fitBtn} onClick={handleFit}>Fit</button>
        </div>
      </div>

      {/* Select-Before-Create (or Upgrade) Picker */}
      {(pendingWidget || typePickerWidgetId) && (() => {
        const pickerWidth = 280;
        const pickerHeight = 240;
        const padding = 20;

        let sx = 0, sy = 0, targetId: string | null = null;

        if (pendingWidget && viewportRef.current) {
          const rect = viewportRef.current.getBoundingClientRect();
          sx = rect.left + canvasOffsetRef.current.x + (pendingWidget.x + pendingWidget.width / 2) * zoomRef.current;
          sy = rect.top + canvasOffsetRef.current.y + (pendingWidget.y + pendingWidget.height / 2) * zoomRef.current;
        } else if (typePickerWidgetId) {
          const el = document.getElementById(`widget-${typePickerWidgetId}`);
          if (el) {
            const rect = el.getBoundingClientRect();
            sx = rect.left + rect.width / 2;
            sy = rect.top + rect.height / 2;
            targetId = typePickerWidgetId;
          }
        }

        if (!sx || !sy) return null;

        // Clamp to screen
        sx = Math.max(padding + pickerWidth / 2, Math.min(window.innerWidth - padding - pickerWidth / 2, sx));
        sy = Math.max(padding + pickerHeight / 2, Math.min(window.innerHeight - padding - pickerHeight / 2, sy));

        const picker = (
          <div className={styles.typePicker} style={{ left: sx, top: sy }} onMouseDown={e => e.stopPropagation()}>
            <div className={styles.typePickerTitle}>Select widget type</div>
            <div className={styles.typePickerGrid}>{PALETTE_ITEMS.map(item => (
              <button key={item.type} className={styles.typePickerBtn} onClick={() => { 
                if (targetId) {
                  updateWidgets(widgetsRef.current.map(w => w.id === targetId ? { ...w, type: item.type } : w));
                } else if (pendingWidget) {
                  const nw: DeskWidget = {
                    id: crypto.randomUUID(),
                    type: item.type,
                    x: pendingWidget.x,
                    y: pendingWidget.y,
                    width: pendingWidget.width,
                    height: pendingWidget.height,
                    content: {},
                  };
                  updateWidgets([...widgetsRef.current, nw]);
                  setSelectedId(nw.id);
                }
                setPendingWidget(null);
                setTypePickerWidgetId(null);
              }}>
                <span className={styles.typePickerIcon}>{item.icon}</span><span className={styles.typePickerLabel}>{item.label}</span>
              </button>
            ))}</div>
            <button className={styles.typePickerCancel} onClick={() => { setPendingWidget(null); setTypePickerWidgetId(null); }}>Cancel</button>
          </div>
        );

        return createPortal(picker, document.body);
      })()}
    </div>
  );
}
