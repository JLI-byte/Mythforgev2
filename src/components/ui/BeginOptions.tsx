"use client";

import React from 'react';
import styles from './BeginOptions.module.css';

export type BeginDestination = 'template' | 'desk';

interface BeginOptionsProps {
    onChoose: (destination: BeginDestination) => void;
    disabled?: boolean;
}

/**
 * The two ways into a new book. Shown twice: on step three of the Bookshelf's
 * new-work wizard, and on Home when the workspace is empty. It is the only
 * place in the app that maps the modes onto what a writer actually wants to do
 * next, which is exactly why a newcomer should not have to find it inside a
 * modal.
 */
export function BeginOptions({ onChoose, disabled = false }: BeginOptionsProps) {
    return (
        <div className={styles.beginOptions}>
            <button
                className={styles.beginOption}
                onClick={() => onChoose('template')}
                disabled={disabled}
            >
                <span className={styles.beginOptionTitle}>🗺️ Draft First</span>
                <span className={styles.beginOptionDesc}>
                    Outline on the Draft Table with a writing method
                </span>
            </button>
            <button
                className={styles.beginOption}
                onClick={() => onChoose('desk')}
                disabled={disabled}
            >
                <span className={styles.beginOptionTitle}>✍️ Start Writing</span>
                <span className={styles.beginOptionDesc}>
                    Jump straight in on the Writing Desk
                </span>
            </button>
        </div>
    );
}
