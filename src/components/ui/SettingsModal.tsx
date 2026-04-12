"use client";

import React, { useState } from 'react';
import styles from './SettingsModal.module.css';
import { useWorkspaceStore } from '@/store/workspaceStore';

interface SettingsModalProps {
    onClose: () => void;
}

/**
 * SettingsModal provides a UI for configuring user preferences,
 * such as the AI Provider configs used for the Consistency Checker.
 */
export default function SettingsModal({ onClose }: SettingsModalProps) {
    const writingGoal = useWorkspaceStore((state) => state.writingGoal);
    const setWritingGoal = useWorkspaceStore((state) => state.setWritingGoal);
    const editorWidth = useWorkspaceStore((state) => state.editorWidth);
    const setEditorWidth = useWorkspaceStore((state) => state.setEditorWidth);


    const [dailyTarget, setDailyTarget] = useState(writingGoal.dailyTarget);
    const [sessionTarget, setSessionTarget] = useState(writingGoal.sessionTarget);

    const [localWidth, setLocalWidth] = useState(editorWidth);



    const handleSave = () => {
        setWritingGoal({
            dailyTarget: dailyTarget || 0,
            sessionTarget: sessionTarget || 0
        });
        setEditorWidth(localWidth);
        onClose();
    };

    const handleClear = () => {
        setDailyTarget(0);
        setSessionTarget(0);
        setLocalWidth(800);
    };

    return (
        <div className={styles.backdrop} onClick={onClose}>
            <div className={styles.panel} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>Settings</h2>
                    <button className={styles.closeBtn} onClick={onClose}>×</button>
                </div>

                <div className={styles.content}>

                    <section className={styles.section} style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                        <div className={styles.providerHeader}>
                            <h3>Writing Goals</h3>
                        </div>
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Daily Word Target</label>
                            <input
                                type="number"
                                value={dailyTarget || ''}
                                onChange={(e) => setDailyTarget(Number(e.target.value))}
                                className={styles.input}
                                placeholder="0 (disabled)"
                                min="0"
                            />
                        </div>
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Session Word Target</label>
                            <input
                                type="number"
                                value={sessionTarget || ''}
                                onChange={(e) => setSessionTarget(Number(e.target.value))}
                                className={styles.input}
                                placeholder="0 (disabled)"
                                min="0"
                            />
                        </div>
                    </section>

                    <section className={styles.section} style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                        <div className={styles.providerHeader}>
                            <h3>Editor Layout</h3>
                        </div>
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Editor width: {localWidth}px</label>
                            <input
                                type="range"
                                min="500"
                                max="1400"
                                step="50"
                                value={localWidth}
                                onChange={(e) => setLocalWidth(Number(e.target.value))}
                                className={styles.rangeInput}
                            />
                            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.25rem' }}>
                                <button type="button" onClick={() => setLocalWidth(600)} className={styles.presetBtn}>Narrow (600px)</button>
                                <button type="button" onClick={() => setLocalWidth(800)} className={styles.presetBtn}>Default (800px)</button>
                                <button type="button" onClick={() => setLocalWidth(1000)} className={styles.presetBtn}>Wide (1000px)</button>
                                <button type="button" onClick={() => setLocalWidth(1200)} className={styles.presetBtn}>Full (1200px)</button>
                            </div>
                        </div>
                    </section>

                </div>

                <div className={styles.footer}>
                    <button className={styles.clearBtn} onClick={handleClear}>Clear</button>
                    <button className={styles.saveBtn} onClick={handleSave}>Save</button>
                </div>
            </div>
        </div>
    );
}
