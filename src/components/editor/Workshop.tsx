"use client";

import React from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { variantForStage } from '@/lib/deskStages';
import { StageRail } from './StageRail';
import WritingDesk from './WritingDesk';
import ResearchTab from './ResearchTab';
import { DossierPanel } from '../research/DossierPanel';
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
    const activeProjectId = useWorkspaceStore(s => s.activeProjectId);
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
                {stage === 'research' ? (
                    <ResearchTab />
                ) : (
                    // The research the writer gathered, beside the writing. Not
                    // shown on the Research stage itself: a dossier of the board
                    // you are looking at is noise.
                    <div className={styles.withDossier}>
                        <WritingDesk variant={variantForStage(stage)} />
                        {activeProjectId && <DossierPanel projectId={activeProjectId} />}
                    </div>
                )}
            </div>
        </div>
    );
}
