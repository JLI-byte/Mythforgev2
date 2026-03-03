"use client";

import React from 'react';
import styles from './ConsistencyPanel.module.css';
import ConsistencyChecker from '../checker/ConsistencyChecker';

interface ConsistencyPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onTabClick: () => void;
}

const CheckIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
);

// ConsistencyPanel — slide-out panel for AI consistency checker, fixed right edge
export function ConsistencyPanel({ isOpen, onClose, onTabClick }: ConsistencyPanelProps) {
    return (
        <div className={`${styles.panel} ${isOpen ? styles.open : ''}`}>
            {/* Tab that sticks out the left side of the panel — moves with the panel */}
            <button
                className={styles.sideTab}
                onClick={onTabClick}
                title="Consistency Report"
                aria-label="Toggle Consistency Report"
            >
                <CheckIcon />
                <span className={styles.sideTabLabel}>Consistency</span>
            </button>

            {/* panelInner clips content so it doesn't bleed when panel is closed */}
            <div className={styles.panelInner}>
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
        </div>
    );
}
