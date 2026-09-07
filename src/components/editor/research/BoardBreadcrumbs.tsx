"use client";

import React from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { breadcrumbFor } from '@/lib/research/boardTree';
import styles from './BoardBreadcrumbs.module.css';

interface Props {
    boardId: string;
    onNavigate: (boardId: string) => void;
}

/** The path from the project's root board down to the one on screen. */
export function BoardBreadcrumbs({ boardId, onNavigate }: Props) {
    const registry = useWorkspaceStore(s => s.researchBoards);
    const trail = breadcrumbFor(registry, boardId);
    if (trail.length === 0) return null;

    return (
        <nav className={styles.crumbs} aria-label="Board path">
            {trail.map((node, i) => {
                const isLast = i === trail.length - 1;
                return (
                    <React.Fragment key={node.id}>
                        {i > 0 && <span className={styles.sep} aria-hidden="true">›</span>}
                        {isLast ? (
                            <span className={styles.current} aria-current="page">{node.name}</span>
                        ) : (
                            <button className={styles.crumb} onClick={() => onNavigate(node.id)}>
                                {node.name}
                            </button>
                        )}
                    </React.Fragment>
                );
            })}
        </nav>
    );
}
