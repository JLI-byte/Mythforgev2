"use client";

import React from 'react';
import styles from './WorldBiblePanel.module.css';
import WorldBible from '../world/WorldBible';

interface WorldBiblePanelProps {
    isOpen: boolean;
    onClose: () => void;
}

// WorldBiblePanel — slide-out reference panel, fixed right edge
export function WorldBiblePanel({ isOpen, onClose }: WorldBiblePanelProps) {
    return (
        <div className={`${styles.panel} ${isOpen ? styles.open : ''}`}>
            <div className={styles.header}>
                <h2 className={styles.title}>World Bible</h2>
                <button
                    className={styles.closeButton}
                    onClick={onClose}
                    aria-label="Close World Bible"
                    title="Close"
                >
                    &times;
                </button>
            </div>
            <div className={styles.contentWrapper}>
                <WorldBible />
            </div>
        </div>
    );
}
