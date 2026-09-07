"use client";

import React from 'react';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
    /** What is absent, as a noun phrase: "No snapshots yet". */
    title: React.ReactNode;
    /** One sentence saying how to make the first one. Optional. */
    hint?: React.ReactNode;
    /** A decorative emoji or icon element. Optional. */
    icon?: React.ReactNode;
    /** The one thing to do about it. Optional. */
    action?: { label: string; onClick: () => void };
    /** 'inline' fits inside a panel or widget; 'page' centres in a view. */
    size?: 'inline' | 'page';
    /** Extra positioning from the caller. Layout only — no colours or type. */
    className?: string;
}

/**
 * The single empty state. Two dozen bespoke ones existed across as many
 * stylesheets, each with its own padding, muted grey and hint size, so the
 * app said "nothing here" in two dozen visual dialects.
 */
export function EmptyState({ title, hint, icon, action, size = 'inline', className }: EmptyStateProps) {
    const sizeClass = size === 'page' ? styles.page : styles.inline;
    return (
        <div className={`${styles.root} ${sizeClass}${className ? ` ${className}` : ''}`}>
            {icon && <div className={styles.icon} aria-hidden="true">{icon}</div>}
            <p className={styles.title}>{title}</p>
            {hint && <p className={styles.hint}>{hint}</p>}
            {action && (
                <button type="button" className={styles.action} onClick={action.onClick}>
                    {action.label}
                </button>
            )}
        </div>
    );
}

export default EmptyState;
