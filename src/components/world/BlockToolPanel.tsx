/**
 * BlockToolPanel — Left sidebar tool palette for ArticleCanvas.
 * Sprint 50: Provides draggable block type nodes for the Figma-style canvas editor.
 * Drag a tool onto the canvas to insert a new block at that position.
 */
"use client";

import React from 'react';
import styles from './BlockToolPanel.module.css';
import { BlockType } from '@/store/workspaceStore';

/** Tool definitions — icon, label, block type */
const TOOLS: { type: BlockType; icon: string; label: string; description: string }[] = [
  { type: 'richtext', icon: '📝', label: 'Text',      description: 'Write lore' },
  { type: 'image',    icon: '🖼️', label: 'Image',     description: 'Upload visual' },
  { type: 'statrow',  icon: '📊', label: 'Stat Row',  description: 'Label + value' },
  { type: 'quote',    icon: '💬', label: 'Quote',     description: 'Attributed text' },
  { type: 'timeline', icon: '⏳', label: 'Timeline',  description: 'Event sequence' },
  { type: 'divider',  icon: '➖', label: 'Divider',   description: 'Visual break' },
];

export default function BlockToolPanel() {
  /** Set block-type on dataTransfer so the canvas drop handler can read it */
  const handleDragStart = (e: React.DragEvent, type: BlockType) => {
    e.dataTransfer.setData('block-type', type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <aside className={styles.panel}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>Blocks</span>
        <span className={styles.panelSubtitle}>Drag onto canvas</span>
      </div>

      <div className={styles.toolList}>
        {TOOLS.map(tool => (
          <div
            key={tool.type}
            className={styles.toolCard}
            draggable
            onDragStart={(e) => handleDragStart(e, tool.type)}
            title={tool.description}
          >
            <span className={styles.toolIcon}>{tool.icon}</span>
            <div className={styles.toolInfo}>
              <span className={styles.toolLabel}>{tool.label}</span>
              <span className={styles.toolDesc}>{tool.description}</span>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
