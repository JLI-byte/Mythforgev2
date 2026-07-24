"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useWorkspaceStore, selectProjectWorldKey } from '@/store/workspaceStore';
import styles from '../../WritingDesk.module.css';

/**
 * "What I Understand" widget — the assistant's living summary of the active
 * world plus preferences it has learned, both editable by the user. The data
 * lives in the store keyed by world (not in the widget), so it persists and is
 * fed back to the assistant each turn as memory. The user can correct it here.
 */
export function UnderstandingRenderer() {
    const worldKey = useWorkspaceStore(selectProjectWorldKey);
    const stored = useWorkspaceStore(s => s.worldUnderstanding[worldKey]);
    const setWorldUnderstanding = useWorkspaceStore(s => s.setWorldUnderstanding);

    const [summary, setSummary] = useState(stored?.summary ?? '');
    const [preferences, setPreferences] = useState(stored?.preferences ?? '');
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Re-sync when the assistant updates the store (but not on our own edits).
    const lastStored = useRef(stored);

    useEffect(() => {
        if (stored !== lastStored.current) {
            lastStored.current = stored;
            setSummary(stored?.summary ?? '');
            setPreferences(stored?.preferences ?? '');
        }
    }, [stored]);

    useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

    const persist = (nextSummary: string, nextPrefs: string) => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            const data = { summary: nextSummary, preferences: nextPrefs };
            lastStored.current = data;
            setWorldUnderstanding(worldKey, data);
        }, 600);
    };

    return (
        <div className={styles.suggestWidget}>
            <div className={styles.suggestHeader}>
                <span className={styles.suggestTitle}>What I Understand</span>
            </div>
            <div className={styles.understandBody}>
                <label className={styles.understandLabel}>The world so far</label>
                <textarea
                    className={styles.understandArea}
                    value={summary}
                    placeholder="The assistant will keep a running summary of your world here."
                    onChange={e => { setSummary(e.target.value); persist(e.target.value, preferences); }}
                    onMouseDown={e => e.stopPropagation()}
                />
                <label className={styles.understandLabel}>What you like</label>
                <textarea
                    className={`${styles.understandArea} ${styles.understandPrefs}`}
                    value={preferences}
                    placeholder="Preferences it has picked up (tone, taste, what to avoid)."
                    onChange={e => { setPreferences(e.target.value); persist(summary, e.target.value); }}
                    onMouseDown={e => e.stopPropagation()}
                />
            </div>
        </div>
    );
}
