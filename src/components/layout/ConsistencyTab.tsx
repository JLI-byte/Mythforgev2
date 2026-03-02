"use client";

import React from 'react';
import styles from './ConsistencyTab.module.css';

interface ConsistencyTabProps {
    isOpen: boolean;
    onOpen: () => void;
}

// ConsistencyTab — fixed right-edge trigger for Consistency Report panel
export function ConsistencyTab({ isOpen, onOpen }: ConsistencyTabProps) {
    return (
        <button
            className={`${styles.tabButton} ${isOpen ? styles.hidden : ''}`}
            onClick={onOpen}
            aria-label="Open Consistency Report"
            title="Open Consistency Report"
        >
            <span className={styles.tabIcon}>✦</span>
        </button>
    );
}
