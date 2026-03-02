"use client";

import React from 'react';
import styles from './ConsistencyPanel.module.css';
import ConsistencyChecker from '../checker/ConsistencyChecker';

interface ConsistencyPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

// ConsistencyPanel — slide-out panel for AI consistency checker, fixed right edge
export function ConsistencyPanel({ isOpen, onClose }: ConsistencyPanelProps) {
    return (
        <div className={`${styles.panel} ${isOpen ? styles.open : ''}`}>
            <div className={styles.header}>
                <h2 className={styles.title}>Consistency Report</h2>
                <button
                    className={styles.closeButton}
                    onClick={onClose}
                    aria-label="Close"
                    title="Close"
                >
                    &times;
                </button>
            </div>
            <div className={styles.contentWrapper}>
                <ConsistencyChecker />
            </div>
        </div>
    );
}
