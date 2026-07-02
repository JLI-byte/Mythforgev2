"use client";

import React, { useEffect, useRef, useState } from 'react';
import { BOOK_VERBS, BookAction, nextVerb } from './bookVerbs';
import styles from './WorldBibleBook.module.css';

/** One wheel notch per step; tames trackpad delta storms. */
const WHEEL_COOLDOWN_MS = 200;

interface WorldBibleBookProps {
    /** Cover title (bible coverTitle, falling back to the world name). */
    title: string;
    /** Cover subtitle — defaults to "World Bible". */
    subtitle?: string;
    /** Cover accent color (hex) — overrides the greyscale cover when set. */
    tint?: string;
    /** Fires the verb currently showing on the open page. */
    onAction: (action: BookAction) => void;
}

/**
 * WorldBibleBook — a 3D hardcover book (ported from codepen.io/fivera/pen/kQJzxP)
 * that fronts each shelf. Hovering swings the cover open; scrolling while
 * hovered rolls the page verb (Open → Edit → Organize, wrapping); clicking
 * fires the visible verb.
 */
export default function WorldBibleBook({ title, subtitle, tint, onAction }: WorldBibleBookProps) {
    const [verbIndex, setVerbIndex] = useState(0);
    const bookRef = useRef<HTMLElement>(null);
    const cooldownRef = useRef(0);

    // React's JSX onWheel is passive at the root — preventDefault is ignored
    // there. Attach a non-passive listener so scrolling the book doesn't
    // scroll the bookshelf underneath.
    useEffect(() => {
        const el = bookRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const now = Date.now();
            if (now - cooldownRef.current < WHEEL_COOLDOWN_MS) return;
            cooldownRef.current = now;
            setVerbIndex(i => nextVerb(i, e.deltaY > 0 ? 1 : -1, BOOK_VERBS.length));
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, []);

    const verb = BOOK_VERBS[verbIndex];

    return (
        <div className={styles.wrap}>
            <figure
                ref={bookRef}
                className={styles.book}
                role="button"
                tabIndex={0}
                aria-label={`${verb.label} the ${title} World Bible`}
                onClick={() => onAction(verb.id)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onAction(verb.id);
                    } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setVerbIndex(i => nextVerb(i, 1, BOOK_VERBS.length));
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setVerbIndex(i => nextVerb(i, -1, BOOK_VERBS.length));
                    }
                }}
            >
                {/* Front */}
                <ul className={styles.hardcoverFront}>
                    <li>
                        <div
                            className={styles.coverDesign}
                            style={tint ? { backgroundColor: tint, backgroundImage: 'none' } : undefined}
                        >
                            <h2 className={styles.coverTitle}>{title}</h2>
                            <p className={styles.coverSub}>{subtitle ?? 'World Bible'}</p>
                        </div>
                    </li>
                    <li></li>
                </ul>

                {/* Pages */}
                <ul className={styles.page}>
                    <li></li>
                    <li>
                        <div className={styles.pageAction} aria-live="polite">
                            <span key={verbIndex} className={styles.pageVerb}>{verb.label}</span>
                            <span className={styles.pageHint}>the lore</span>
                            <span className={styles.pageScrollHint}>scroll ↕</span>
                        </div>
                    </li>
                    <li></li>
                    <li></li>
                    <li></li>
                </ul>

                {/* Back */}
                <ul className={styles.hardcoverBack}>
                    <li></li>
                    <li></li>
                </ul>
                <ul className={styles.bookSpine}>
                    <li></li>
                    <li></li>
                </ul>
            </figure>
            <span className={styles.label}>World Bible</span>
        </div>
    );
}
