"use client";

import React from 'react';
import styles from './WorldBibleBook.module.css';

interface WorldBibleBookProps {
    /** World name shown on the cover. */
    title: string;
    /** Opens the World Bible for this shelf. */
    onOpen: () => void;
}

/**
 * WorldBibleBook — a 3D hardcover book (ported from codepen.io/fivera/pen/kQJzxP)
 * that fronts each shelf. Hovering swings the cover open and fans the pages;
 * clicking opens the World Bible. Greyscale to match the bookshelf.
 */
export default function WorldBibleBook({ title, onOpen }: WorldBibleBookProps) {
    return (
        <div className={styles.wrap}>
            <figure
                className={styles.book}
                role="button"
                tabIndex={0}
                aria-label={`Open the ${title} World Bible`}
                onClick={onOpen}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpen();
                    }
                }}
            >
                {/* Front */}
                <ul className={styles.hardcoverFront}>
                    <li>
                        <div className={styles.coverDesign}>
                            <h2 className={styles.coverTitle}>{title}</h2>
                            <p className={styles.coverSub}>World Bible</p>
                        </div>
                    </li>
                    <li></li>
                </ul>

                {/* Pages */}
                <ul className={styles.page}>
                    <li></li>
                    <li>
                        <span className={styles.pageHint}>Open the lore</span>
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
