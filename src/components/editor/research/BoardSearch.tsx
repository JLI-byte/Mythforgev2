"use client";

import React, { useMemo, useState } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { searchBoards } from '@/lib/research/boardSearch';
import { useModalDialog } from '@/lib/useModalDialog';
import styles from './BoardSearch.module.css';

interface Props {
    projectId: string;
    onClose: () => void;
    onGo: (boardId: string) => void;
}

/** Find a card anywhere in the project's board tree. */
export function BoardSearch({ projectId, onClose, onGo }: Props) {
    const [query, setQuery] = useState('');
    const registry = useWorkspaceStore(s => s.researchBoards);
    const states = useWorkspaceStore(s => s.researchStates);
    const dialogRef = useModalDialog<HTMLDivElement>(onClose);

    const hits = useMemo(
        () => searchBoards({ registry, states, projectId }, query).slice(0, 40),
        [registry, states, projectId, query],
    );

    return (
        <div className={styles.backdrop}>
            <div
                ref={dialogRef}
                className={styles.panel}
                role="dialog"
                aria-modal="true"
                aria-label="Search research boards"
            >
                <input
                    className={styles.input}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search every board…"
                    aria-label="Search every board"
                    autoFocus
                />

                {query.trim() && hits.length === 0 && (
                    <p className={styles.none}>Nothing matches “{query.trim()}”.</p>
                )}

                <ul className={styles.hits}>
                    {hits.map((h, i) => (
                        <li key={`${h.boardId}-${h.widgetId ?? 'board'}-${i}`}>
                            <button
                                className={styles.hit}
                                onClick={() => { onGo(h.boardId); onClose(); }}
                            >
                                <span className={styles.where}>{h.boardName}</span>
                                <span className={styles.what}>{h.snippet}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
