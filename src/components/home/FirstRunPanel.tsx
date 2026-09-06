"use client";

import React, { useState } from 'react';
import { useWorkspaceStore, COVER_COLORS } from '@/store/workspaceStore';
import { planNewStory } from '@/lib/newStory';
import { BeginOptions, type BeginDestination } from '@/components/ui/BeginOptions';
import styles from './FirstRunPanel.module.css';

/**
 * Home, for a writer who has never made a book.
 *
 * The three intents below are the app's own map of itself: a research board, a
 * draft table, a writing desk, each described by what you would want it for.
 * Until now that map lived on step three of a modal you could only open from
 * the Bookshelf — visible only to people who no longer needed it.
 */
export default function FirstRunPanel() {
    const addProject = useWorkspaceStore(s => s.addProject);
    const addDocument = useWorkspaceStore(s => s.addDocument);
    const addScene = useWorkspaceStore(s => s.addScene);
    const updateDraftState = useWorkspaceStore(s => s.updateDraftState);
    const setActiveProject = useWorkspaceStore(s => s.setActiveProject);
    const setWorkspaceMode = useWorkspaceStore(s => s.setWorkspaceMode);
    const setDeskStage = useWorkspaceStore(s => s.setDeskStage);
    const setExampleData = useWorkspaceStore(s => s.setExampleData);
    const completeOnboarding = useWorkspaceStore(s => s.completeOnboarding);

    const [name, setName] = useState('');

    const begin = (destination: BeginDestination) => {
        const plan = planNewStory({
            name,
            workTypeId: 'story',
            coverColor: COVER_COLORS[Math.floor(Math.random() * COVER_COLORS.length)],
            ids: {
                projectId: crypto.randomUUID(),
                documentId: crypto.randomUUID(),
                sceneId: crypto.randomUUID(),
            },
            now: new Date(),
        });
        if (!plan) return;

        addProject(plan.project);
        if (plan.draftState) updateDraftState(plan.project.id, plan.draftState);
        addDocument(plan.document);
        addScene(plan.scene);

        setActiveProject(plan.project.id);
        setWorkspaceMode('desk');
        setDeskStage(destination);
    };

    return (
        <div className={styles.firstRun}>
            <div className={styles.inner}>
                <h1 className={styles.title}>Let&apos;s start a book</h1>
                <p className={styles.sub}>
                    The Workshop moves through three stages around one manuscript: a
                    board for what you find out, a table for how it is shaped, and a
                    desk for the writing itself. Pick where you want to begin — you can
                    move between them whenever you like.
                </p>

                <label className={styles.nameLabel} htmlFor="first-run-name">
                    What are you calling it?
                </label>
                <input
                    id="first-run-name"
                    className={styles.nameInput}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && name.trim()) begin('write'); }}
                    placeholder="e.g. The Long Winter"
                    autoFocus
                />

                <p className={styles.beginLabel}>Where do you want to begin?</p>
                <BeginOptions onChoose={begin} disabled={!name.trim()} />

                <div className={styles.escapeRow}>
                    <button
                        className={styles.escapeBtn}
                        onClick={() => setExampleData(true)}
                    >
                        Show me a finished example instead
                    </button>
                    <button
                        className={styles.escapeBtn}
                        onClick={completeOnboarding}
                    >
                        I&apos;ll look around first
                    </button>
                </div>
            </div>
        </div>
    );
}
