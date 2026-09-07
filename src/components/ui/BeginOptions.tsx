"use client";

import React from 'react';
import styles from './BeginOptions.module.css';

import type { DeskStage } from '@/lib/deskStages';

/** The three ways into a new book are the Workshop's three stages. */
export type BeginDestination = DeskStage;

interface BeginOptionsProps {
    onChoose: (destination: BeginDestination) => void;
    disabled?: boolean;
}

/**
 * The three ways into a new book. Shown twice: on step three of the Bookshelf's
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
                onClick={() => onChoose('research')}
                disabled={disabled}
            >
                <span className={styles.beginOptionTitle}>🔎 Research First</span>
                <span className={styles.beginOptionDesc}>
                    Gather notes, clippings and links on a board before you write a word
                </span>
            </button>
            <button
                className={styles.beginOption}
                onClick={() => onChoose('draft')}
                disabled={disabled}
            >
                <span className={styles.beginOptionTitle}>🗺️ Draft First</span>
                <span className={styles.beginOptionDesc}>
                    Outline on the Draft Table with a writing method
                </span>
            </button>
            <button
                className={styles.beginOption}
                onClick={() => onChoose('write')}
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
