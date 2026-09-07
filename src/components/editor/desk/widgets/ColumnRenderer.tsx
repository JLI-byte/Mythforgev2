"use client";

import React from 'react';
import { childrenOfColumn } from '@/lib/research/columns';
import type { DeskWidget } from '@/store/workspaceStore';
import styles from './ColumnRenderer.module.css';

interface Props {
    widget: DeskWidget;
    allWidgets: DeskWidget[];
    content: { title?: string; collapsed?: boolean };
    onChange: (c: Record<string, unknown>) => void;
    onSelectChild: (id: string) => void;
}

/** A titled stack with a live count. Columns cannot nest. */
export function ColumnRenderer({ widget, allWidgets, content, onChange, onSelectChild }: Props) {
    const children = childrenOfColumn(allWidgets, widget.id);
    const collapsed = Boolean(content.collapsed);

    return (
        <div className={styles.column}>
            <header className={styles.head}>
                <input
                    className={styles.title}
                    value={content.title ?? ''}
                    placeholder="Untitled"
                    aria-label="Column title"
                    onChange={e => onChange({ ...content, title: e.target.value })}
                />
                <span className={styles.count}>{children.length}</span>
                <button
                    className={styles.collapse}
                    onClick={() => onChange({ ...content, collapsed: !collapsed })}
                    aria-expanded={!collapsed}
                    aria-label={collapsed ? 'Expand column' : 'Collapse column'}
                >
                    {collapsed ? '+' : '–'}
                </button>
            </header>

            {!collapsed && (
                <ul className={styles.list}>
                    {children.length === 0 ? (
                        <li className={styles.empty}>Drag cards here</li>
                    ) : children.map(child => (
                        <li key={child.id}>
                            <button className={styles.item} onClick={() => onSelectChild(child.id)}>
                                {String(child.content?.text ?? child.content?.title ?? child.type)}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
