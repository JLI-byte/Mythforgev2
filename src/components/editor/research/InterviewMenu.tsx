"use client";

import React, { useEffect, useRef, useState } from 'react';
import type { Interview } from '@/lib/interviews';
import styles from '../WritingDesk.module.css';

interface InterviewMenuProps {
    /** Built-ins first, then the user's custom interviews. */
    interviews: Interview[];
    /** Disabled while a message is streaming. */
    disabled?: boolean;
    /** 'rail' renders a square icon button whose menu opens to the side. */
    variant?: 'button' | 'rail';
    onLaunch: (interview: Interview) => void;
    onNew: () => void;
    onEdit: (interview: Interview) => void;
}

/**
 * The "Interviews" launcher: a dropdown listing every interview skill. Clicking
 * a row launches it; the pencil opens it in the editor (built-ins open as an
 * editable copy). A footer button creates a new one.
 */
export function InterviewMenu({ interviews, disabled, variant = 'button', onLaunch, onNew, onEdit }: InterviewMenuProps) {
    const isRail = variant === 'rail';
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    // Close on outside click or Escape.
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    return (
        <div className={styles.interviewMenuRoot} ref={rootRef}>
            <button
                className={isRail
                    ? `${styles.chatTrayTab} ${open ? styles.chatTrayTabActive : ''}`
                    : styles.researchBuildWorldBtn}
                onClick={() => setOpen(o => !o)}
                disabled={disabled}
                title="Launch a guided interview to build part of your world"
                aria-haspopup="menu"
                aria-expanded={open}
            >
                {isRail ? <span className={styles.chatTrayTabIcon}>🧭</span> : '🧭 Interviews ▾'}
            </button>

            {open && (
                <div
                    className={`${styles.interviewMenuPopover} ${isRail ? styles.interviewMenuPopoverRail : ''}`}
                    role="menu"
                >
                    {interviews.map(iv => (
                        <div key={iv.id} className={styles.interviewMenuRow}>
                            <button
                                className={styles.interviewMenuLaunch}
                                onClick={() => { setOpen(false); onLaunch(iv); }}
                                title={iv.tagline || `Build a ${iv.title}`}
                            >
                                <span className={styles.interviewMenuIcon}>{iv.icon}</span>
                                <span className={styles.interviewMenuText}>
                                    <span className={styles.interviewMenuTitle}>{iv.title}</span>
                                    {iv.tagline && <span className={styles.interviewMenuTagline}>{iv.tagline}</span>}
                                </span>
                            </button>
                            <button
                                className={styles.interviewMenuEdit}
                                onClick={() => { setOpen(false); onEdit(iv); }}
                                title={iv.builtIn ? 'Duplicate & edit' : 'Edit interview'}
                            >
                                {iv.builtIn ? '⧉' : '✎'}
                            </button>
                        </div>
                    ))}

                    <button
                        className={styles.interviewMenuNew}
                        onClick={() => { setOpen(false); onNew(); }}
                    >
                        ＋ New interview
                    </button>
                </div>
            )}
        </div>
    );
}
