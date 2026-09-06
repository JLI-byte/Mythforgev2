"use client";

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import styles from '../WritingDesk.module.css';

interface ResearchBoardBarProps {
    /** Base scope key of the active scope (`project:<id>` | `world:<worldKey>`). */
    baseScopeKey: string;
    /** null = the scope's default "Main" board. */
    activeBoardId: string | null;
    onSelect: (boardId: string | null) => void;
}

/**
 * The board switcher for a research scope. "Main" is the scope's default board;
 * the user can add named boards beside it (chapters, sections, whatever), rename
 * them in place (double-click), and delete them. Each board is its own canvas.
 */
export function ResearchBoardBar({ baseScopeKey, activeBoardId, onSelect }: ResearchBoardBarProps) {
    const boards = useWorkspaceStore(s => s.customBoards[baseScopeKey]) ?? [];
    const addResearchBoard = useWorkspaceStore(s => s.addResearchBoard);
    const renameResearchBoard = useWorkspaceStore(s => s.renameResearchBoard);
    const deleteResearchBoard = useWorkspaceStore(s => s.deleteResearchBoard);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [draftName, setDraftName] = useState('');

    const startRename = (id: string, name: string) => {
        setEditingId(id);
        setDraftName(name);
    };

    const commitRename = () => {
        if (!editingId) return;
        const name = draftName.trim() || 'Untitled Board';
        renameResearchBoard(baseScopeKey, editingId, name);
        setEditingId(null);
    };

    const addBoard = () => {
        const name = 'Untitled Board';
        const id = addResearchBoard(baseScopeKey, name);
        onSelect(id);
        startRename(id, name);
    };

    const removeBoard = (id: string, name: string) => {
        if (!window.confirm(`Delete board “${name}”? Its canvas will be removed.`)) return;
        deleteResearchBoard(baseScopeKey, id);
        if (activeBoardId === id) onSelect(null);
    };

    return (
        <div className={styles.boardBar}>
            <button
                className={`${styles.boardTab} ${activeBoardId === null ? styles.boardTabActive : ''}`}
                onClick={() => onSelect(null)}
            >
                Main
            </button>

            {boards.map(b => (
                <div
                    key={b.id}
                    className={`${styles.boardTab} ${activeBoardId === b.id ? styles.boardTabActive : ''}`}
                    onClick={() => editingId !== b.id && onSelect(b.id)}
                    onDoubleClick={() => startRename(b.id, b.name)}
                    title="Double-click to rename"
                >
                    {editingId === b.id ? (
                        <input
                            className={styles.boardNameInput}
                            aria-label="Board name"
                            value={draftName}
                            autoFocus
                            onFocus={e => e.currentTarget.select()}
                            onChange={e => setDraftName(e.target.value)}
                            onBlur={commitRename}
                            onKeyDown={e => {
                                if (e.key === 'Enter') commitRename();
                                if (e.key === 'Escape') setEditingId(null);
                            }}
                            onClick={e => e.stopPropagation()}
                        />
                    ) : (
                        <>
                            <span className={styles.boardTabName}>{b.name}</span>
                            <span
                                className={styles.boardTabDelete}
                                onClick={e => { e.stopPropagation(); removeBoard(b.id, b.name); }}
                                title="Delete board"
                                role="button"
                            >
                                <X size={13} />
                            </span>
                        </>
                    )}
                </div>
            ))}

            <button className={styles.boardAddBtn} onClick={addBoard} title="New board">+</button>
        </div>
    );
}
