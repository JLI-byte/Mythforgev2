"use client";

/**
 * VNEpisodeBox — one episode, drawn for the tier the canvas is showing.
 *
 * Zoomed out it is a card with counts; zoomed in it lists its decisions. The
 * same box, more or less of it — no separate views to keep in step.
 */

import React from 'react';
import type { VNDecision, VNTier } from '@/lib/vnTimeline';
import styles from './VNTimeline.module.css';

interface VNEpisodeBoxProps {
    title: string;
    decisions: VNDecision[];
    tier: VNTier;
    collapsed: boolean;
    onTitleChange: (title: string) => void;
}

export function VNEpisodeBox({ title, decisions, tier, collapsed, onTitleChange }: VNEpisodeBoxProps) {
    const major = decisions.filter(d => d.kind === 'major').length;
    const minor = decisions.length - major;

    if (collapsed || tier === 'story') {
        return <div className={styles.boxTitle}>{title}</div>;
    }

    if (tier === 'season') {
        return (
            <>
                <div className={styles.boxTitle}>{title}</div>
                <div className={styles.counts}>
                    <span className={styles.major}>◆ {major}</span>
                    <span className={styles.minor}>◇ {minor}</span>
                </div>
            </>
        );
    }

    return (
        <>
            <input
                className={styles.titleInput}
                aria-label="Episode title"
                value={title}
                onClick={e => e.stopPropagation()}
                onChange={e => onTitleChange(e.target.value)}
            />
            <div className={styles.decisionList}>
                {decisions.length === 0 && (
                    <p className={styles.empty}>No decisions yet.</p>
                )}
                {[...decisions].sort((a, b) => a.order - b.order).map(d => (
                    <div key={d.id} className={styles.decisionRow}>
                        <span className={d.kind === 'major' ? styles.major : styles.minor}>
                            {d.kind === 'major' ? '◆' : '◇'}
                        </span>
                        <span className={styles.decisionPrompt}>{d.prompt || 'Untitled decision'}</span>
                        <span className={styles.optionCount}>{d.options.length} options</span>
                    </div>
                ))}
            </div>
        </>
    );
}
