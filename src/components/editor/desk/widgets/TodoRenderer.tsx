"use client";

import React from 'react';
import { addItem, toggleItem, removeItem, editItem, todoProgress } from '@/lib/research/todo';
import type { TodoItem } from '@/lib/research/todo';
import styles from './TodoRenderer.module.css';

interface Props {
    content: { items?: TodoItem[] };
    onChange: (c: Record<string, unknown>) => void;
}

/**
 * A to-do list on the desk.
 *
 * All the list arithmetic lives in lib/research/todo — this file only wires
 * events to those pure functions and hands the new array back to the caller,
 * which owns the debouncing.
 */
export function TodoRenderer({ content, onChange }: Props) {
    const items = content.items ?? [];
    const { done, total, percent } = todoProgress(items);
    const [draft, setDraft] = React.useState('');

    const commit = (next: TodoItem[]) => onChange({ ...content, items: next });

    const submitDraft = () => {
        commit(addItem(items, draft, crypto.randomUUID()));
        setDraft('');
    };

    return (
        <div className={styles.todo}>
            <header className={styles.head}>
                <span className={styles.label}>To do</span>
                <span className={styles.count}>{done}/{total}</span>
                <span className={styles.track} aria-hidden="true">
                    <span className={styles.fill} style={{ width: `${percent}%` }} />
                </span>
            </header>

            <ul className={styles.list}>
                {items.map(item => (
                    <li key={item.id} className={item.done ? styles.rowDone : styles.row}>
                        <input
                            type="checkbox"
                            className={styles.check}
                            checked={item.done}
                            aria-label={item.text}
                            onChange={() => commit(toggleItem(items, item.id))}
                        />
                        <input
                            className={styles.text}
                            value={item.text}
                            aria-label={`Edit ${item.text}`}
                            onChange={e => commit(editItem(items, item.id, e.target.value))}
                        />
                        <button
                            className={styles.remove}
                            aria-label={`Remove ${item.text}`}
                            onClick={() => commit(removeItem(items, item.id))}
                        >
                            ×
                        </button>
                    </li>
                ))}
            </ul>

            <footer className={styles.foot}>
                <input
                    className={styles.add}
                    value={draft}
                    aria-label="Add a to-do"
                    placeholder="Add an item…"
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => {
                        if (e.key !== 'Enter') return;
                        e.preventDefault();
                        submitDraft();
                    }}
                />
            </footer>
        </div>
    );
}
