"use client";

import { Extension, Node as TiptapNode, mergeAttributes, CommandProps } from '@tiptap/core';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import styles from '../WritingDesk.module.css';

// ============================================================
// CUSTOM TIPTAP EXTENSIONS
// ============================================================

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (fontSize: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

export const FontSize = Extension.create({
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
            renderHTML: (attributes: Record<string, string | null>) => {
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
      setFontSize: (fontSize: string) => ({ chain }: CommandProps) => {
        return chain().setMark('textStyle', { fontSize }).run();
      },
      unsetFontSize: () => ({ chain }: CommandProps) => {
        return chain().setMark('textStyle', { fontSize: null }).run();
      },
    };
  },
});

export const ChapterSeparator = TiptapNode.create({
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

export const SceneSeparator = TiptapNode.create({
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

export const ChapterTitleNodeView = (props: NodeViewProps) => {
  const updateDocument = useWorkspaceStore(s => s.updateDocument);
  const { node, updateAttributes } = props;

  return (
    <NodeViewWrapper className={styles.bookViewChapterSeparator}>
      <div className={styles.bookViewSeparatorLine} onMouseDown={e => e.stopPropagation()}>
        <span>--- CHAPTER: </span>
        <input 
          className={styles.bookViewSeparatorInput}
          aria-label="Chapter title"
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

export const SceneTitleNodeView = (props: NodeViewProps) => {
  const updateScene = useWorkspaceStore(s => s.updateScene);
  const { node, updateAttributes } = props;

  return (
    <NodeViewWrapper className={styles.bookViewSceneSeparator}>
      <div className={styles.bookViewSeparatorLine} onMouseDown={e => e.stopPropagation()}>
        <span>--- Scene: </span>
        <input 
          className={styles.bookViewSeparatorInput}
          aria-label="Scene title"
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
