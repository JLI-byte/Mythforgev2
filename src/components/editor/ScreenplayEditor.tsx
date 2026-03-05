/**
 * ScreenplayEditor.tsx
 * Dedicated editor for screenplay mode. Renders a realistic script page
 * with proper element types (scene heading, action, character, etc.)
 * Replaces the standard SceneEditor when project.writingMode === 'screenplay'.
 */
import React, { useEffect, useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { ScreenplayNodes } from '@/lib/screenplay/ScreenplayNodes';
import { ScreenplayKeymap } from '@/lib/screenplay/ScreenplayKeymap';
import styles from './ScreenplayEditor.module.css';
import { useWorkspaceStore, Scene } from '@/store/workspaceStore';

export default function ScreenplayEditor({ scene }: { scene: Scene }) {
    const updateScene = useWorkspaceStore((state) => state.updateScene);

    const [currentType, setCurrentType] = useState<string>('sceneHeading');
    const [estimatedPages, setEstimatedPages] = useState<number>(1);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({}),
            ...ScreenplayNodes,
            ScreenplayKeymap
        ],
        content: scene.content || '<div data-screenplay-type="sceneHeading"></div>',
        onSelectionUpdate: ({ editor }) => {
            const { selection } = editor.state;
            const parentType = selection.$anchor.parent.type.name;
            setCurrentType(parentType);
        },
        onUpdate: ({ editor }) => {
            const text = editor.getText();
            setEstimatedPages(Math.max(1, Math.ceil(text.length / 1600)));

            const currentText = text;
            const wordCount = currentText.split(/\s+/).filter(w => w.length > 0).length;

            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = setTimeout(() => {
                const rawContent = editor.getHTML();
                updateScene(scene.id, { content: rawContent, wordCount });
            }, 300);
        }
    }, [scene.id]);

    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            if (editor) editor.destroy();
        };
    }, [editor]);

    return (
        <div>
            <div className={styles.toolbar}>
                <select
                    className={styles.toolbarSelect}
                    value={currentType}
                    onChange={(e) => {
                        const val = e.target.value;
                        editor?.chain().focus().setNode(val).run();
                    }}
                >
                    <option value="sceneHeading">Scene Heading</option>
                    <option value="action">Action</option>
                    <option value="character">Character</option>
                    <option value="parenthetical">Parenthetical</option>
                    <option value="dialogue">Dialogue</option>
                    <option value="transition">Transition</option>
                </select>
                <span className={styles.hint}>Tab to cycle &bull; Enter to advance</span>
                <span className={styles.pageCount}>~{estimatedPages} pg</span>
            </div>

            <div className={styles.canvas}>
                <div className={styles.page}>
                    <EditorContent editor={editor} className={styles.editor} />
                </div>
            </div>
        </div>
    );
}
