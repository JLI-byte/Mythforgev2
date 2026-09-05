"use client";

import React, { useState, useSyncExternalStore } from 'react';
import { AlertTriangle, CloudOff, X } from 'lucide-react';
import styles from './PersistQuotaBanner.module.css';
import { useWorkspaceStore } from '@/store/workspaceStore';
import {
    getServerWorkspaceSizeNotice,
    getWorkspaceSizeNotice,
    subscribeWorkspaceSizeNotice,
} from '@/lib/supabase/workspaceSync';
import type { SizeNotice } from '@/lib/workspaceSize';

/**
 * Tells the writer when this browser stopped saving their work, and when the
 * cloud stopped accepting it.
 *
 * Two independent layers, two independent messages. The local one comes from
 * the persist adapter through the store; the cloud one comes from the save path
 * through a module subscription, because that path has no React in it. A hard
 * size limit that refused a write silently would be worse than no limit at all
 * — the writer would believe they were synced — so the refusal is rendered here
 * with the reassurance that local saving never stopped.
 *
 * Dismissing only hides the current message. If local saving is still failing
 * the next distinct failure raises it again, because the store only clears
 * persistError on a save that actually succeeded; and a dismissed size warning
 * comes back the moment it turns into a size refusal.
 */
export default function PersistQuotaBanner() {
    const persistError = useWorkspaceStore(s => s.persistError);
    const setPersistError = useWorkspaceStore(s => s.setPersistError);
    const notice = useSyncExternalStore(
        subscribeWorkspaceSizeNotice,
        getWorkspaceSizeNotice,
        getServerWorkspaceSizeNotice,
    );

    // A dismissal covers one tone and no more. Crossing from warn to blocked is
    // new information and has to be allowed to interrupt again, which falls out
    // of comparing tones rather than needing a reset.
    const [dismissedTone, setDismissedTone] = useState<SizeNotice['tone'] | null>(null);

    const sizeNotice = notice && notice.tone !== dismissedTone ? notice : null;
    if (!persistError && !sizeNotice) return null;

    return (
        <div className={styles.stack}>
            {persistError && (
                <div className={styles.banner} role="alert">
                    <AlertTriangle size={18} className={styles.icon} aria-hidden="true" />
                    <p className={styles.text}>{persistError}</p>
                    <button
                        type="button"
                        className={styles.dismiss}
                        onClick={() => setPersistError(null)}
                        aria-label="Dismiss save warning"
                    >
                        <X size={16} aria-hidden="true" />
                    </button>
                </div>
            )}

            {sizeNotice && (
                <div
                    className={
                        sizeNotice.tone === 'blocked'
                            ? `${styles.notice} ${styles.blocked}`
                            : `${styles.notice} ${styles.warn}`
                    }
                    role={sizeNotice.tone === 'blocked' ? 'alert' : 'status'}
                >
                    <CloudOff size={18} className={styles.icon} aria-hidden="true" />
                    <div className={styles.text}>
                        <p className={styles.headline}>{sizeNotice.headline}</p>
                        <p className={styles.detail}>{sizeNotice.detail}</p>
                    </div>
                    <button
                        type="button"
                        className={styles.dismiss}
                        onClick={() => setDismissedTone(sizeNotice.tone)}
                        aria-label="Dismiss workspace size notice"
                    >
                        <X size={16} aria-hidden="true" />
                    </button>
                </div>
            )}
        </div>
    );
}
