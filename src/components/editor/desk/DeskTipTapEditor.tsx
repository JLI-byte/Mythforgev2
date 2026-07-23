"use client";

import { useRef, useEffect, useState } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import Highlight from '@tiptap/extension-highlight';
import Color from '@tiptap/extension-color';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useWritingSession } from '@/lib/useWritingSession';
import { FontSize } from './extensions';
import { GlassDropdown } from './GlassDropdown';
import styles from '../WritingDesk.module.css';

export function DeskTipTapEditor({ sceneId, content, onUpdate, onFocus }: {
  sceneId: string;
  content: string;
  onUpdate: (html: string, wordCount: number) => void;
  onFocus: (editor: Editor) => void;
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

  // TipTap v3's useEditor no longer re-renders on transactions, so toolbar
  // state (dropdown values, active format buttons) would go stale. Re-render
  // on every transaction to keep the toolbar live.
  const [, forceRender] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const rerender = () => forceRender(x => x + 1);
    editor.on('transaction', rerender);
    return () => { editor.off('transaction', rerender); };
  }, [editor]);

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
          <GlassDropdown
            title="Block style"
            options={[
              { value: 'p', label: 'Paragraph' },
              { value: 'h1', label: 'Heading 1' },
              { value: 'h2', label: 'Heading 2' },
              { value: 'h3', label: 'Heading 3' },
              { value: 'blockquote', label: 'Quote' },
            ]}
            value={
              editor.isActive('heading', { level: 1 }) ? 'h1' :
              editor.isActive('heading', { level: 2 }) ? 'h2' :
              editor.isActive('heading', { level: 3 }) ? 'h3' :
              editor.isActive('blockquote') ? 'blockquote' : 'p'
            }
            onChange={val => {
              if (val === 'p') editor.chain().focus().setParagraph().run();
              if (val === 'h1') editor.chain().focus().toggleHeading({ level: 1 }).run();
              if (val === 'h2') editor.chain().focus().toggleHeading({ level: 2 }).run();
              if (val === 'h3') editor.chain().focus().toggleHeading({ level: 3 }).run();
              if (val === 'blockquote') editor.chain().focus().toggleBlockquote().run();
            }}
          />
          <GlassDropdown
            title="Font family"
            width={110}
            options={[
              { value: 'Inter', label: 'Sans (Inter)' },
              { value: 'Georgia', label: 'Serif (Georgia)' },
              { value: "'Times New Roman'", label: 'Serif (TNR)' },
              { value: 'Arial', label: 'Sans (Arial)' },
              { value: "'Courier New'", label: 'Mono (Courier)' },
            ]}
            value={editor.getAttributes('textStyle').fontFamily || 'Inter'}
            onChange={val => editor.chain().focus().setFontFamily(val).run()}
          />
          <GlassDropdown
            title="Font size"
            width={60}
            options={['12px', '14px', '16px', '18px', '20px', '24px', '32px', '40px'].map(size => (
              { value: size, label: size.replace('px', '') }
            ))}
            value={editor.getAttributes('textStyle').fontSize || '16px'}
            onChange={val => editor.commands.setFontSize(val)}
          />
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
