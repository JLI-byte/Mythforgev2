"use client";

import React from 'react';
import type { ConsistencyFlag } from '@/lib/consistencyFlags';
import styles from '../../WritingDesk.module.css';

interface RendererProps {
    content: { flags?: ConsistencyFlag[] };
    onChange: (c: { flags: ConsistencyFlag[] }) => void;
}

const KIND_META: Record<ConsistencyFlag['kind'], { icon: string; label: string }> = {
    contradiction: { icon: '⚠️', label: 'Contradiction' },
    gap: { icon: '🕳️', label: 'Gap' },
};

/**
 * Consistency & Gaps widget — everything the lore rules found on the last run:
 * empty descriptions, unfiled articles, articles nothing references, lonely
 * folders, broken links and duplicate names. Each can be dismissed; running
 * the check again rebuilds the list from the world as it stands.
 */
export function ConsistencyFlagsRenderer({ content, onChange }: RendererProps) {
    const flags = content.flags ?? [];

    const dismiss = (id: string) => onChange({ flags: flags.filter(f => f.id !== id) });

    return (
        <div className={styles.suggestWidget}>
            <div className={styles.suggestHeader}>
                <span className={styles.suggestTitle}>Consistency & Gaps</span>
                <span className={styles.suggestCount}>{flags.length}</span>
            </div>

            <div className={styles.suggestBody}>
                {flags.length === 0 && (
                    <div className={styles.suggestEmpty}>
                        Nothing flagged. Run the lore check (🔍) to look for empty descriptions, unfiled articles, broken links and duplicate names.
                    </div>
                )}

                {flags.map(f => (
                    <div key={f.id} className={`${styles.flagRow} ${f.kind === 'contradiction' ? styles.flagRowContradiction : ''}`}>
                        <div className={styles.flagHead}>
                            <span className={styles.flagIcon}>{KIND_META[f.kind].icon}</span>
                            <span className={styles.flagSummary}>{f.summary}</span>
                        </div>
                        {f.detail && <div className={styles.flagDetail}>{f.detail}</div>}
                        <div className={styles.flagActions}>
                            <button className={styles.flagDismiss} onClick={() => dismiss(f.id)} title="Dismiss">Dismiss</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
