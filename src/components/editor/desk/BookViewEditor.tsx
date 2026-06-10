"use client";

import { useRef, useEffect, useCallback } from 'react';
import { useEditor, EditorContent, ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import Highlight from '@tiptap/extension-highlight';
import Color from '@tiptap/extension-color';
import { useShallow } from 'zustand/react/shallow';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { ChapterSeparator, SceneSeparator, ChapterTitleNodeView, SceneTitleNodeView } from './extensions';
import styles from '../WritingDesk.module.css';

export function BookViewEditor({ activeSceneId }: { activeSceneId?: string }) {
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
