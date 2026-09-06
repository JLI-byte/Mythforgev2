"use client";

import React, { useMemo } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { collectDossier, type Dossier } from '@/lib/research/dossier';
import { rootBoardIdFor } from '@/lib/research/boardTree';
import { DossierRenderer } from './DossierRenderer';
import styles from './DossierPanel.module.css';

/** Stable empty list: a fresh [] from a selector would re-render on every tick. */
const NO_DOSSIERS: Dossier[] = [];

interface Props {
    projectId: string;
}

/**
 * The dossier docked beside the manuscript. A dossier is a saved query, so this
 * panel re-reads the boards live rather than showing a copy taken earlier.
 */
export function DossierPanel({ projectId }: Props) {
    const registry = useWorkspaceStore(s => s.researchBoards);
    const states = useWorkspaceStore(s => s.researchStates);
    const dossiers = useWorkspaceStore(s => s.researchDossiers[projectId]) ?? NO_DOSSIERS;
    const activeDossierId = useWorkspaceStore(s => s.activeDossierId);
    const createDossier = useWorkspaceStore(s => s.createDossier);
    const updateDossier = useWorkspaceStore(s => s.updateDossier);
    const setActiveDossierId = useWorkspaceStore(s => s.setActiveDossierId);

    // An id can outlive the dossier it named — a deleted one falls back rather
    // than blanking the panel.
    const active = dossiers.find(d => d.id === activeDossierId) ?? dossiers[0] ?? null;

    const rootBoardId = rootBoardIdFor(registry, projectId);

    const sections = useMemo(
        () => (active ? collectDossier({ registry, states }, active) : []),
        [registry, states, active],
    );

    const onNew = () => {
        if (!rootBoardId) return;
        const id = createDossier(projectId, 'Research', rootBoardId);
        setActiveDossierId(id);
    };

    return (
        <aside className={styles.panel} aria-label="Dossier">
            <header className={styles.head}>
                <span className={styles.title}>Dossier</span>
                <button
                    type="button"
                    className={styles.newButton}
                    onClick={onNew}
                    disabled={!rootBoardId}
                >
                    ＋ New
                </button>
            </header>

            {!rootBoardId && (
                <p className={styles.hint}>No research board yet to point a dossier at.</p>
            )}

            {dossiers.length === 0 ? (
                <p className={styles.hint}>
                    Make a dossier to keep your research beside you while you write.
                </p>
            ) : (
                <>
                    <div className={styles.controls}>
                        <select
                            className={styles.select}
                            aria-label="Choose a dossier"
                            value={active ? active.id : ''}
                            onChange={e => setActiveDossierId(e.target.value)}
                        >
                            {dossiers.map(d => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>

                        <label className={styles.checkbox}>
                            <input
                                type="checkbox"
                                aria-label="Include nested boards"
                                checked={active ? active.includeNested : false}
                                disabled={!active}
                                onChange={e => {
                                    if (!active) return;
                                    updateDossier(projectId, active.id, { includeNested: e.target.checked });
                                }}
                            />
                            Nested boards
                        </label>
                    </div>

                    <div className={styles.body}>
                        <DossierRenderer sections={sections} />
                    </div>
                </>
            )}
        </aside>
    );
}
