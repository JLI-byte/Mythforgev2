"use client";

import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import styles from './DocumentRenderer.module.css';

interface DocumentContent {
    html?: string;
}

interface Props {
    content: DocumentContent;
    onChange: (c: Record<string, unknown>) => void;
}

/**
 * A long-form text card — the research board's answer to "this needs more than
 * a sticky note".
 *
 * Deliberately a small subset of the Writing Zone's editor: headings, lists and
 * basic marks. A research note is not a manuscript, and the full desk toolbar
 * on a 360px card would be unusable.
 */
export function DocumentRenderer({ content, onChange }: Props) {
    const editor = useEditor({
        extensions: [StarterKit],
        content: content.html ?? '',
        // The board renders on the server first; without this React logs a
        // hydration mismatch for every document card on the canvas.
        immediatelyRender: false,
        onUpdate: ({ editor }) => onChange({ ...content, html: editor.getHTML() }),
        editorProps: {
            attributes: { 'aria-label': 'Document body', 'data-placeholder': 'Write…' },
        },
    });

    // An external change — an undo, a board switch, a cloud sync — has to reach
    // the editor. Guarded on equality, or every local keystroke would round-trip
    // back through setContent and collapse the caret to the start.
    useEffect(() => {
        if (!editor) return;
        const incoming = content.html ?? '';
        if (incoming !== editor.getHTML()) {
            editor.commands.setContent(incoming, { emitUpdate: false });
        }
    }, [content.html, editor]);

    if (!editor) return <div className={styles.doc} />;

    const mark = (name: string, run: () => void, label: string, active: boolean) => (
        <button
            key={name}
            className={`${styles.btn} ${active ? styles.btnOn : ''}`}
            onClick={run}
            aria-pressed={active}
            aria-label={label}
        >
            {name}
        </button>
    );

    return (
        <div className={styles.doc}>
            <div className={styles.bar}>
                {mark('B', () => editor.chain().focus().toggleBold().run(), 'Bold', editor.isActive('bold'))}
                {mark('I', () => editor.chain().focus().toggleItalic().run(), 'Italic', editor.isActive('italic'))}
                {mark('H2', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), 'Heading', editor.isActive('heading', { level: 2 }))}
                {mark('•', () => editor.chain().focus().toggleBulletList().run(), 'Bullet list', editor.isActive('bulletList'))}
                {mark('1.', () => editor.chain().focus().toggleOrderedList().run(), 'Numbered list', editor.isActive('orderedList'))}
            </div>
            <div className={styles.body}>
                <EditorContent editor={editor} />
            </div>
        </div>
    );
}
