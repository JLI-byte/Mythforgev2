"use client";

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import styles from './PersistQuotaBanner.module.css';
import { useWorkspaceStore } from '@/store/workspaceStore';

/**
 * Tells the writer when this browser stopped saving their work.
 *
 * Dismissing only hides the current message. If saving is still failing the
 * next distinct failure raises it again, because the store only clears
 * persistError on a save that actually succeeded.
 */
export default function PersistQuotaBanner() {
    const persistError = useWorkspaceStore(s => s.persistError);
    const setPersistError = useWorkspaceStore(s => s.setPersistError);

    if (!persistError) return null;

    return (
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
    );
}
