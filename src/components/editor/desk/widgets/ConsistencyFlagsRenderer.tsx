"use client";

import React from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
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
 * Consistency & Gaps widget — the assistant drops flagged contradictions and
 * gaps here as it reviews the world. Each flag can be sent to the chat as a
 * question ("how do I fix this?") or dismissed.
 */
export function ConsistencyFlagsRenderer({ content, onChange }: RendererProps) {
    const flags = content.flags ?? [];
    const setChatAttachment = useWorkspaceStore(s => s.setChatAttachment);

    const dismiss = (id: string) => onChange({ flags: flags.filter(f => f.id !== id) });

    const ask = (f: ConsistencyFlag) => {
        const content = `${KIND_META[f.kind].label}: ${f.summary}${f.detail ? `\n${f.detail}` : ''}`;
        setChatAttachment({ kind: 'text', label: f.summary, content });
    };

    return (
        <div className={styles.suggestWidget}>
            <div className={styles.suggestHeader}>
                <span className={styles.suggestTitle}>Consistency & Gaps</span>
                <span className={styles.suggestCount}>{flags.length}</span>
            </div>

            <div className={styles.suggestBody}>
                {flags.length === 0 && (
                    <div className={styles.suggestEmpty}>
                        Contradictions and gaps the assistant spots as it reviews your world will appear here. Ask it to “review my world”.
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
                            <button className={styles.flagAsk} onClick={() => ask(f)} title="Ask the assistant about this in chat">Ask</button>
                            <button className={styles.flagDismiss} onClick={() => dismiss(f.id)} title="Dismiss">Dismiss</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
