"use client";

import React from 'react';
import styles from '../WritingDesk.module.css';

interface ContextRingProps {
    /** Estimated tokens the next request will carry. */
    usedTokens: number;
    /** The model's usable context window in tokens. */
    windowTokens: number;
}

const SIZE = 18;
const STROKE = 2.5;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

function formatTokens(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
    return String(n);
}

/**
 * Claude-style context ring: a small dial showing how much of the model's
 * context window the next request will use (conversation + board + World Bible).
 * The count is an estimate (~4 chars per token), so the tooltip says so rather
 * than implying an exact measurement.
 */
export function ContextRing({ usedTokens, windowTokens }: ContextRingProps) {
    const pct = windowTokens > 0 ? Math.min(1, usedTokens / windowTokens) : 0;
    const level = pct >= 0.9 ? 'critical' : pct >= 0.7 ? 'warn' : 'ok';
    const dash = CIRC * pct;

    const title = `Context: about ${formatTokens(usedTokens)} of ${formatTokens(windowTokens)} tokens (${Math.round(pct * 100)}%)`
        + '\nEstimated from the conversation, the board, and the World Bible.';

    return (
        <span className={`${styles.contextRing} ${styles[`contextRing_${level}`]}`} title={title}>
            <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
                <circle
                    className={styles.contextRingTrack}
                    cx={SIZE / 2} cy={SIZE / 2} r={R}
                    fill="none" strokeWidth={STROKE}
                />
                <circle
                    className={styles.contextRingFill}
                    cx={SIZE / 2} cy={SIZE / 2} r={R}
                    fill="none" strokeWidth={STROKE} strokeLinecap="round"
                    strokeDasharray={`${dash} ${CIRC - dash}`}
                    transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                />
            </svg>
            <span className={styles.contextRingPct}>{Math.round(pct * 100)}%</span>
        </span>
    );
}
