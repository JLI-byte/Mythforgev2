"use client";

import React from 'react';
import { X } from 'lucide-react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { nextHintFor, HINTS_ALL_DISMISSED, type HintSurface } from '@/lib/hints';
import styles from './HintBubble.module.css';

interface HintBubbleProps {
    surface: HintSurface;
}

/**
 * One dismissible hint, or nothing. Mounted on each surface that has something
 * to teach; src/lib/hints.ts decides which of them is allowed to render, so
 * two bubbles cannot appear at once.
 */
export function HintBubble({ surface }: HintBubbleProps) {
    const hasOnboarded = useWorkspaceStore(s => s.hasOnboarded);
    const dismissedHints = useWorkspaceStore(s => s.dismissedHints);
    const dismissHint = useWorkspaceStore(s => s.dismissHint);

    const hint = nextHintFor(surface, dismissedHints, { hasOnboarded });
    if (!hint) return null;

    return (
        <aside className={styles.bubble} role="note" aria-label="Tip">
            <div className={styles.head}>
                <span className={styles.title}>{hint.title}</span>
                <button
                    className={styles.close}
                    onClick={() => dismissHint(hint.id)}
                    aria-label={`Dismiss tip: ${hint.title}`}
                >
                    <X size={13} aria-hidden="true" />
                </button>
            </div>
            <p className={styles.body}>{hint.body}</p>
            <button
                className={styles.optOut}
                onClick={() => dismissHint(HINTS_ALL_DISMISSED)}
            >
                Don&apos;t show tips
            </button>
        </aside>
    );
}
