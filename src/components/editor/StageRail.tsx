"use client";

import React from 'react';
import { Telescope, LayoutTemplate, NotebookPen } from 'lucide-react';
import { DESK_STAGES, STAGE_LABELS, STAGE_HINTS, type DeskStage } from '@/lib/deskStages';
import styles from './StageRail.module.css';

const STAGE_ICONS: Record<DeskStage, React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }>> = {
    research: Telescope,
    draft: LayoutTemplate,
    write: NotebookPen,
};

interface StageRailProps {
    active: DeskStage;
    onChange: (stage: DeskStage) => void;
}

/**
 * The Workshop's stage switcher: Research -> Drafting -> Writing.
 *
 * A tablist rather than three buttons, because that is what it is — the stages
 * are peers and any of them is reachable at any time. The arrow-key handling
 * comes with the role, so it is implemented here rather than left to the
 * browser, which does not move focus inside a tablist on its own.
 */
export function StageRail({ active, onChange }: StageRailProps) {
    const onKeyDown = (e: React.KeyboardEvent) => {
        const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!delta) return;
        e.preventDefault();
        const i = DESK_STAGES.indexOf(active);
        const next = DESK_STAGES[(i + delta + DESK_STAGES.length) % DESK_STAGES.length];
        onChange(next);
        // Selection and focus travel together, or the roving tabindex strands
        // focus on a tab that just became unreachable by Tab.
        requestAnimationFrame(() => document.getElementById(`stage-tab-${next}`)?.focus());
    };

    return (
        <div className={styles.rail} role="tablist" aria-label="Workshop stage" onKeyDown={onKeyDown}>
            {DESK_STAGES.map(stage => {
                const Icon = STAGE_ICONS[stage];
                const isActive = stage === active;
                return (
                    <button
                        key={stage}
                        role="tab"
                        id={`stage-tab-${stage}`}
                        aria-selected={isActive}
                        aria-controls="stage-panel"
                        tabIndex={isActive ? 0 : -1}
                        className={`${styles.stage} ${isActive ? styles.stageActive : ''}`}
                        onClick={() => onChange(stage)}
                        title={STAGE_HINTS[stage]}
                    >
                        <Icon size={14} aria-hidden={true} />
                        <span>{STAGE_LABELS[stage]}</span>
                    </button>
                );
            })}
        </div>
    );
}
