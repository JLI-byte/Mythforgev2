"use client";

import React, { useState } from 'react';
import styles from './SettingsModal.module.css';
import AISettingsSection from './AISettingsSection';
import {
    useWorkspaceStore,
    listDataBackups,
    restoreDataBackup,
    createManualBackup,
} from '@/store/workspaceStore';

interface SettingsModalProps {
    onClose: () => void;
}

function formatBackupTime(ts: number): string {
    if (!ts) return 'Unknown date';
    return new Date(ts).toLocaleString([], {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

/**
 * SettingsModal provides a UI for configuring user preferences,
 * such as the AI Provider configs used for the Consistency Checker.
 */
export default function SettingsModal({ onClose }: SettingsModalProps) {
    const writingGoal = useWorkspaceStore((state) => state.writingGoal);
    const setWritingGoal = useWorkspaceStore((state) => state.setWritingGoal);
    const updateGoalConfig = useWorkspaceStore((state) => state.updateGoalConfig);
    const editorWidth = useWorkspaceStore((state) => state.editorWidth);
    const setEditorWidth = useWorkspaceStore((state) => state.setEditorWidth);
    const isSpellcheckEnabled = useWorkspaceStore((state) => state.isSpellcheckEnabled);
    const setSpellcheckEnabled = useWorkspaceStore((state) => state.setSpellcheckEnabled);
    const themeFamily = useWorkspaceStore((state) => state.themeFamily);
    const setThemeFamily = useWorkspaceStore((state) => state.setThemeFamily);


    const [dailyTarget, setDailyTarget] = useState(writingGoal.dailyTarget);
    const [sessionTarget, setSessionTarget] = useState(writingGoal.sessionTarget);

    const [localWidth, setLocalWidth] = useState(editorWidth);

    const [backups, setBackups] = useState(() => listDataBackups());
    const [backupMsg, setBackupMsg] = useState('');

    const handleCreateBackup = () => {
        const key = createManualBackup();
        setBackups(listDataBackups());
        setBackupMsg(key ? 'Backup created.' : 'Nothing to back up yet.');
        setTimeout(() => setBackupMsg(''), 3000);
    };

    const handleRestore = (key: string) => {
        const ok = window.confirm(
            'Restore this backup? Your current workspace will be replaced and the app will reload.'
        );
        if (!ok) return;
        if (restoreDataBackup(key)) {
            window.location.reload();
        } else {
            setBackupMsg('Restore failed.');
        }
    };

    const handleDownloadBackup = () => {
        const raw = typeof localStorage !== 'undefined'
            ? localStorage.getItem('lorecanvas-workspace')
            : null;
        if (!raw) { setBackupMsg('Nothing to export yet.'); return; }
        const blob = new Blob([raw], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lorecanvas-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleSave = () => {
        setWritingGoal({
            dailyTarget: dailyTarget || 0,
            sessionTarget: sessionTarget || 0
        });
        // Keep the Goals panel's config in lockstep — it reads goalConfig, not
        // writingGoal, and the two previously drifted apart silently.
        if (dailyTarget > 0) {
            updateGoalConfig({ dailyWordTarget: dailyTarget, goalConfigured: true });
        }
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

                    <section className={styles.section}>
                        <div className={styles.providerHeader}>
                            <h3>Appearance</h3>
                        </div>
                        <label className={styles.label} style={{ marginBottom: '0.6rem', display: 'block' }}>
                            Theme
                        </label>
                        <div style={{ display: 'flex', gap: '0.6rem' }}>
                            {([
                                { id: 'default', label: 'Default', hint: 'Clean & minimal' },
                                { id: 'fantasy', label: 'Fantasy', hint: 'Parchment & ink' },
                            ] as const).map((opt) => {
                                const active = themeFamily === opt.id;
                                return (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => setThemeFamily(opt.id)}
                                        style={{
                                            flex: 1,
                                            textAlign: 'left',
                                            padding: '0.7rem 0.8rem',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            background: active ? 'rgba(var(--accent-rgb, 0 91 181), 0.10)' : 'var(--surface)',
                                            border: active
                                                ? '2px solid var(--accent)'
                                                : '1px solid var(--border)',
                                            color: 'var(--foreground)',
                                        }}
                                    >
                                        <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{opt.label}</div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '2px' }}>
                                            {opt.hint}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.6rem' }}>
                            Light and dark mode toggle lives in the top bar.
                        </p>
                    </section>

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

                    <section className={styles.section} style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                        <div className={styles.providerHeader}>
                            <h3>Editor Behavior</h3>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={isSpellcheckEnabled}
                                onChange={(e) => setSpellcheckEnabled(e.target.checked)}
                            />
                            Browser spellcheck (turn off to stop red squiggles under fantasy names)
                        </label>
                    </section>

                    <AISettingsSection />

                    <section className={styles.section} style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                        <div className={styles.providerHeader}>
                            <h3>Backup &amp; Restore</h3>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button type="button" onClick={handleCreateBackup} className={styles.presetBtn}>
                                Create backup now
                            </button>
                            <button type="button" onClick={handleDownloadBackup} className={styles.presetBtn}>
                                Download backup (.json)
                            </button>
                        </div>
                        {backupMsg && (
                            <p style={{ fontSize: '0.8rem', opacity: 0.75, margin: '0.5rem 0 0' }}>{backupMsg}</p>
                        )}
                        {backups.length > 0 && (
                            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                {backups.map(b => (
                                    <div key={b.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.82rem' }}>
                                        <span style={{ opacity: 0.8 }}>{formatBackupTime(b.timestamp)}</span>
                                        <button type="button" onClick={() => handleRestore(b.key)} className={styles.presetBtn}>
                                            Restore
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
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
