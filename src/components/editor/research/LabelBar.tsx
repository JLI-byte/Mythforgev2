"use client";

import React from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import type { Label } from '@/lib/research/labels';
import styles from './LabelBar.module.css';

interface Props {
    projectId: string;
    /** The card the canvas has selected, if any. */
    selectedLabelIds: string[] | null;
    activeFilter: string[];
    onFilterChange: (labelIds: string[]) => void;
    onApplyToSelection: (labelId: string) => void;
}

/**
 * The project's labels, as a strip under the breadcrumbs.
 *
 * One control, two jobs, decided by whether a card is selected: with a
 * selection, clicking a label puts it on that card; without one, clicking
 * filters the board. The bar says which mode it is in, because a control that
 * silently changes meaning is worse than two controls.
 */
export function LabelBar({
    projectId, selectedLabelIds, activeFilter, onFilterChange, onApplyToSelection,
}: Props) {
    const labels: Label[] = useWorkspaceStore(s => s.researchLabels[projectId]) ?? [];
    const createResearchLabel = useWorkspaceStore(s => s.createResearchLabel);

    const applying = selectedLabelIds !== null;

    const toggleFilter = (id: string) => {
        onFilterChange(
            activeFilter.includes(id)
                ? activeFilter.filter(x => x !== id)
                : [...activeFilter, id],
        );
    };

    const isOn = (id: string) => (applying ? selectedLabelIds!.includes(id) : activeFilter.includes(id));

    return (
        <div className={styles.bar}>
            <span className={styles.mode}>
                {applying ? 'Label this card' : 'Filter'}
            </span>

            {labels.map(label => (
                <button
                    key={label.id}
                    className={`${styles.label} ${isOn(label.id) ? styles.labelOn : ''}`}
                    style={{ color: isOn(label.id) ? label.color : undefined }}
                    aria-pressed={isOn(label.id)}
                    onClick={() => (applying ? onApplyToSelection(label.id) : toggleFilter(label.id))}
                >
                    <span className={styles.dot} style={{ background: label.color }} aria-hidden="true" />
                    {label.name}
                </button>
            ))}

            <button
                className={styles.add}
                onClick={() => {
                    const name = window.prompt('Label name');
                    if (name?.trim()) createResearchLabel(projectId, name.trim());
                }}
            >
                + Label
            </button>

            {labels.length === 0 && (
                <span className={styles.hint}>Labels mark cards as verified, contradictory, or worth chasing.</span>
            )}
        </div>
    );
}
