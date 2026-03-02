"use client";

import React from 'react';
import styles from './WorldBibleTab.module.css';

interface WorldBibleTabProps {
    isOpen: boolean;
    onOpen: () => void;
}

// WorldBibleTab — fixed right-edge trigger tab for the World Bible panel
export function WorldBibleTab({ isOpen, onOpen }: WorldBibleTabProps) {
    return (
        <button
            className={`${styles.tabButton} ${isOpen ? styles.hidden : ''}`}
            onClick={onOpen}
            aria-label="Open World Bible"
            title="Open World Bible"
        >
            <span className={styles.tabIcon}>📖</span>
        </button>
    );
}
