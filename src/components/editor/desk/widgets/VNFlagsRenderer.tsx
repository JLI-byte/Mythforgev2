"use client";

/**
 * VNFlagsRenderer — the declared state a branch map tracks.
 *
 * Flags are declared here and chosen from dropdowns everywhere else, so no
 * free text ever reaches the generated Ren'Py. A boolean remembers whether
 * something happened; a counter accumulates, which is what affection routes
 * are built from.
 */

import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useWorkspaceStore } from '@/store/workspaceStore';
import type { VNFlag } from '@/lib/vnFlags';
import styles from '../../WritingDesk.module.css';

export function VNFlagsRenderer() {
    const activeProjectId = useWorkspaceStore(s => s.activeProjectId);
    const updateProject = useWorkspaceStore(s => s.updateProject);
    const flags = useWorkspaceStore(useShallow(s =>
        s.projects.find(p => p.id === activeProjectId)?.vnFlags ?? [],
    ));

    if (!activeProjectId) return null;

    const setFlags = (next: VNFlag[]) => updateProject(activeProjectId, { vnFlags: next });

    const addFlag = () => setFlags([...flags, {
        id: crypto.randomUUID(),
        name: `flag_${flags.length + 1}`,
        kind: 'bool',
        initial: 0,
    }]);

    const updateFlag = (id: string, patch: Partial<VNFlag>) =>
        setFlags(flags.map(f => (f.id === id ? { ...f, ...patch } : f)));

    const removeFlag = (id: string) => setFlags(flags.filter(f => f.id !== id));

    return (
        <div className={styles.vnFlagsPanel} onMouseDown={e => e.stopPropagation()}>
            {flags.length === 0 && (
                <p className={styles.vnBlockEmpty}>
                    No flags yet. A flag is what the story remembers.
                </p>
            )}

            {flags.map(flag => (
                <div key={flag.id} className={styles.vnFlagRow}>
                    <input
                        aria-label="Flag name"
                        className={styles.vnFlagName}
                        value={flag.name}
                        onChange={e => updateFlag(flag.id, { name: e.target.value })}
                    />
                    <select
                        aria-label={`Kind of flag ${flag.name}`}
                        value={flag.kind}
                        onChange={e => updateFlag(flag.id, {
                            kind: e.target.value as VNFlag['kind'],
                            initial: 0,
                        })}
                    >
                        <option value="bool">on / off</option>
                        <option value="counter">counter</option>
                    </select>
                    <input
                        type="number"
                        aria-label={`Starting value for ${flag.name}`}
                        className={styles.vnStateNumber}
                        value={flag.initial}
                        title="Starting value"
                        onChange={e => updateFlag(flag.id, { initial: Number(e.target.value) })}
                    />
                    <button
                        type="button"
                        className={styles.vnChoiceRemove}
                        onClick={() => removeFlag(flag.id)}
                        aria-label={`Remove ${flag.name}`}
                    >
                        ×
                    </button>
                </div>
            ))}

            <button type="button" className={styles.vnAddChoice} onClick={addFlag}>
                + flag
            </button>
        </div>
    );
}
