"use client";

import React, { useEffect, useId, useState } from 'react';
import { X } from 'lucide-react';
import styles from './SettingsModal.module.css';
import {
    useWorkspaceStore,
    listDataBackups,
    restoreDataBackup,
    createManualBackup,
    partializeWorkspace,
    cancelPendingPersist,
} from '@/store/workspaceStore';
import { useModalDialog } from '@/lib/useModalDialog';
import {
    WORKSPACE_SCHEMA_VERSION,
    buildWorkspaceExport,
    exportFileName,
} from '@/lib/workspaceExport';
import { describeDeleteFailure, isDeleteConfirmed } from '@/lib/accountDeletion';
import { createClient } from '@/lib/supabase/client';

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
    const exampleDataOn = useWorkspaceStore(s => s.exampleDataOn);
    const setExampleData = useWorkspaceStore(s => s.setExampleData);
    const ownerUserId = useWorkspaceStore(s => s.ownerUserId);
    const resetWorkspace = useWorkspaceStore(s => s.resetWorkspace);


    const [dailyTarget, setDailyTarget] = useState(writingGoal.dailyTarget);
    const [sessionTarget, setSessionTarget] = useState(writingGoal.sessionTarget);

    const [localWidth, setLocalWidth] = useState(editorWidth);

    const [backups, setBackups] = useState(() => listDataBackups(ownerUserId));
    const [backupMsg, setBackupMsg] = useState('');
    const fieldId = useId();

    // The signed-in account, read from the session rather than from the store,
    // because the delete path below must act on whoever Supabase says is signed
    // in and never on an id this component could be talked into holding.
    const [account, setAccount] = useState<{ id: string; email?: string } | null>(null);

    useEffect(() => {
        let cancelled = false;
        createClient().auth.getUser().then(({ data }) => {
            if (cancelled || !data.user) return;
            setAccount({ id: data.user.id, email: data.user.email ?? undefined });
        });
        return () => { cancelled = true; };
    }, []);

    const [deleteInput, setDeleteInput] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    const canDelete = isDeleteConfirmed(deleteInput, account?.email);

    const handleCreateBackup = () => {
        const key = createManualBackup();
        setBackups(listDataBackups(ownerUserId));
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

    // Serialises the live store rather than reading localStorage, which could be
    // one persist debounce stale and produced nothing at all when the key was
    // missing. The envelope states the format, the account, what is in the file
    // and — the part usually left out — what is not.
    const handleDownloadBackup = () => {
        const workspace = partializeWorkspace(useWorkspaceStore.getState()) as Record<string, unknown>;
        const exportedAt = new Date().toISOString();
        const payload = buildWorkspaceExport(workspace, {
            schemaVersion: WORKSPACE_SCHEMA_VERSION,
            exportedAt,
            userId: account?.id,
            email: account?.email,
        });
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = exportFileName(exportedAt);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setBackupMsg('Downloaded everything in your workspace.');
        setTimeout(() => setBackupMsg(''), 3000);
    };

    /**
     * Deletes the signed-in account. Irreversible, with no grace period.
     *
     * The RPC takes no arguments: it deletes auth.uid() and nothing else, so
     * there is no id here that could point somewhere it should not.
     * public.workspaces cascades off auth.users, so the cloud copy goes with it.
     */
    const handleDeleteAccount = async () => {
        if (!canDelete || isDeleting) return;
        setIsDeleting(true);
        setDeleteError('');

        const supabase = createClient();
        const { error } = await supabase.rpc('delete_own_account');
        if (error) {
            setDeleteError(describeDeleteFailure(error));
            setIsDeleting(false);
            return;
        }

        // The account is gone. Clear this device before the redirect, or the
        // next person to open this browser rehydrates a deleted user's work.
        //
        // cancelPendingPersist is load-bearing, not tidiness: the local save is
        // debounced and flushes on pagehide, which the redirect below fires. A
        // queued write would otherwise rewrite lorecanvas-workspace on the way
        // out, putting the deleted account's manuscript straight back.
        resetWorkspace();
        cancelPendingPersist();
        try {
            localStorage.removeItem('lorecanvas-workspace');
            Object.keys(localStorage)
                .filter(k => k.startsWith('lorecanvas-backup-'))
                .forEach(k => localStorage.removeItem(k));
        } catch {
            // localStorage unavailable — the sign-out below still ends the session.
        }
        await supabase.auth.signOut();
        window.location.href = '/welcome';
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

    const dialogRef = useModalDialog<HTMLDivElement>(onClose);

    return (
        <div className={styles.backdrop} onClick={onClose} role="presentation">
            <div
                ref={dialogRef}
                className={styles.panel}
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="settings-dialog-title"
                tabIndex={-1}
            >
                <div className={styles.header}>
                    <h2 id="settings-dialog-title">Settings</h2>
                    <button className={styles.closeBtn} onClick={onClose} aria-label="Close settings"><X size={18} /></button>
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
                            <label className={styles.label} htmlFor={`${fieldId}-daily-target`}>Daily Word Target</label>
                            <input
                                type="number"
                                id={`${fieldId}-daily-target`}
                                value={dailyTarget || ''}
                                onChange={(e) => setDailyTarget(Number(e.target.value))}
                                className={styles.input}
                                placeholder="0 (disabled)"
                                min="0"
                            />
                        </div>
                        <div className={styles.inputGroup}>
                            <label className={styles.label} htmlFor={`${fieldId}-session-target`}>Session Word Target</label>
                            <input
                                type="number"
                                id={`${fieldId}-session-target`}
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
                            <label className={styles.label} htmlFor={`${fieldId}-editor-width`}>Editor width: {localWidth}px</label>
                            <input
                                id={`${fieldId}-editor-width`}
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

                    <section className={styles.section} style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                        <div className={styles.providerHeader}>
                            <h3>Example Data</h3>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={exampleDataOn}
                                onChange={(e) => setExampleData(e.target.checked)}
                            />
                            Show example data (a sample world with three projects, so you can see a populated workspace)
                        </label>
                        <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--muted)' }}>
                            Turning this off puts the example away without deleting it. Anything you
                            wrote inside it comes back when you turn it on again.
                        </p>
                    </section>

                    <section className={styles.section} style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                        <div className={styles.providerHeader}>
                            <h3>Backup &amp; Restore</h3>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button type="button" onClick={handleCreateBackup} className={styles.presetBtn}>
                                Create backup now
                            </button>
                            <button type="button" onClick={handleDownloadBackup} className={styles.presetBtn}>
                                Download everything (.json)
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

                    {account && (
                        <section className={`${styles.section} ${styles.dangerZone}`}>
                            <div className={styles.providerHeader}>
                                <h3>Delete your account</h3>
                            </div>
                            <p className={styles.dangerLead}>
                                This removes, permanently and immediately:
                            </p>
                            <ul className={styles.dangerList}>
                                <li>your sign-in — <strong>{account.email}</strong> will no longer work</li>
                                <li>your cloud workspace — every world, project, document, scene and article stored on our servers</li>
                                <li>the copy in this browser</li>
                            </ul>
                            <p className={styles.dangerNote}>
                                It does <strong>not</strong> remove copies in other browsers you
                                have signed in on (those clear when you next open them), files you
                                have already exported, or beta feedback you sent — that stays, with
                                your account detached from it.
                            </p>
                            <p className={styles.dangerNote}>
                                There is no undo and no grace period. Take your writing with you
                                first — the button below is the same one as under Backup &amp;
                                Restore, and it writes every word you have.
                            </p>
                            <button
                                type="button"
                                onClick={handleDownloadBackup}
                                className={`${styles.presetBtn} ${styles.dangerExportBtn}`}
                            >
                                Download everything (.json)
                            </button>
                            <label className={styles.label} htmlFor={`${fieldId}-delete`}>
                                Type <strong>{account.email}</strong> to confirm.
                            </label>
                            <input
                                id={`${fieldId}-delete`}
                                type="text"
                                value={deleteInput}
                                autoComplete="off"
                                autoCapitalize="none"
                                spellCheck={false}
                                onChange={(e) => setDeleteInput(e.target.value)}
                                className={styles.deleteInput}
                            />
                            <button
                                type="button"
                                className={styles.deleteBtn}
                                disabled={!canDelete || isDeleting}
                                onClick={handleDeleteAccount}
                                aria-describedby={`${fieldId}-delete-status`}
                            >
                                {isDeleting ? 'Deleting…' : 'Delete my account permanently'}
                            </button>
                            <p
                                id={`${fieldId}-delete-status`}
                                role="status"
                                className={deleteError ? styles.deleteError : styles.dangerNote}
                            >
                                {deleteError
                                    || (canDelete
                                        ? 'Confirmed. Pressing the button deletes your account.'
                                        : 'The button stays disabled until the address above matches exactly.')}
                            </p>
                        </section>
                    )}

                </div>

                <div className={styles.footer}>
                    <button className={styles.clearBtn} onClick={handleClear}>Clear</button>
                    <button className={styles.saveBtn} onClick={handleSave}>Save</button>
                </div>
            </div>
        </div>
    );
}
