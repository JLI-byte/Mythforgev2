"use client";

import React from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { variantForStage } from '@/lib/deskStages';
import { StageRail } from './StageRail';
import WritingDesk from './WritingDesk';
import ResearchTab from './ResearchTab';
import styles from './StageRail.module.css';

/**
 * The Workshop — one tab that moves Research -> Drafting -> Writing.
 *
 * It replaced two tabs (Draft Table, Writing Desk) and absorbed a third
 * (Research). No canvas changed: those three surfaces were already the same
 * WritingDesk component under three `variant` values, each with its own board
 * slice, so this is the shell that puts a stage rail above them.
 *
 * The Research stage keeps its own shell because it has more than a canvas —
 * a scope bar, a board switcher, and the rail hosting the interviews launcher
 * and the Lore Check.
 */
export default function Workshop() {
    const stage = useWorkspaceStore(s => s.deskStage);
    const setDeskStage = useWorkspaceStore(s => s.setDeskStage);

    return (
        <div className={styles.workshop}>
            <StageRail active={stage} onChange={setDeskStage} />
            <div
                className={styles.panel}
                id="stage-panel"
                role="tabpanel"
                aria-labelledby={`stage-tab-${stage}`}
            >
                {stage === 'research'
                    ? <ResearchTab />
                    : <WritingDesk variant={variantForStage(stage)} />}
            </div>
        </div>
    );
}
