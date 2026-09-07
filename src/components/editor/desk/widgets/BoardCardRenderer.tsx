"use client";

import React from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import styles from './BoardCardRenderer.module.css';

interface BoardCardContent {
    boardId?: string;
}

interface Props {
    content: BoardCardContent;
    onOpenBoard?: (boardId: string) => void;
}

/**
 * A nested board, as it appears on its parent's canvas.
 *
 * The preview is a count and a few coloured slots rather than a live thumbnail:
 * rendering the child's widgets here would mean subscribing this card to every
 * keystroke on a board the writer is not even looking at.
 */
export function BoardCardRenderer({ content, onOpenBoard }: Props) {
    const boardId = content.boardId ?? null;
    const node = useWorkspaceStore(s => (boardId ? s.researchBoards[boardId] : undefined));
    const count = useWorkspaceStore(s => (boardId ? s.researchStates[boardId]?.widgets?.length ?? 0 : 0));

    if (!boardId || !node) {
        return <div className={styles.missing}>This board was deleted.</div>;
    }

    return (
        <button
            className={styles.card}
            onDoubleClick={() => onOpenBoard?.(boardId)}
            aria-label={`Open board ${node.name}, ${count} item${count === 1 ? '' : 's'}`}
        >
            <span className={styles.name}>{node.name}</span>
            <span className={styles.slots} aria-hidden="true">
                {Array.from({ length: Math.min(count, 4) }).map((_, i) => (
                    <i key={i} className={styles.slot} />
                ))}
            </span>
            <span className={styles.count}>{count} item{count === 1 ? '' : 's'}</span>
        </button>
    );
}
