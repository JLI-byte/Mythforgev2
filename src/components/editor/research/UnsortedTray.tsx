"use client";

import React from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { trayCount } from '@/lib/research/unsorted';
import styles from './UnsortedTray.module.css';

interface Props {
    boardId: string;
    onDragOut: (widgetId: string, at: { x: number; y: number }) => void;
}

/**
 * The board's inbox. Anything dropped on the board lands here first, so
 * capturing something never requires deciding where it belongs.
 */
export function UnsortedTray({ boardId, onDragOut }: Props) {
    const state = useWorkspaceStore(s => s.researchStates[boardId]);
    const cards = state?.unsorted ?? [];
    const count = trayCount(state ?? {});

    return (
        <aside className={styles.tray} aria-label="Unsorted notes">
            <header className={styles.head}>
                Unsorted <span className={styles.count}>{count}</span>
            </header>

            {cards.length === 0 ? (
                <p className={styles.empty}>
                    Nothing waiting. Drop a clipping or a note here and sort it later.
                </p>
            ) : (
                <ul className={styles.list}>
                    {cards.map(card => (
                        <li
                            key={card.id}
                            className={styles.card}
                            draggable
                            onDragEnd={e => onDragOut(card.id, { x: e.clientX, y: e.clientY })}
                        >
                            {String(card.content?.text ?? card.type)}
                        </li>
                    ))}
                </ul>
            )}
        </aside>
    );
}
