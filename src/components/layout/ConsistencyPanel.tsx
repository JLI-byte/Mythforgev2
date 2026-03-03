"use client";

import React from 'react';
import styles from './ConsistencyPanel.module.css';
import ConsistencyChecker from '../checker/ConsistencyChecker';

interface ConsistencyPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onTabClick: () => void;
    tabWidth: number;
    onTabWidthChange: (width: number) => void;
}

const CheckIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
);

// ConsistencyPanel — slide-out panel for AI consistency checker, fixed right edge
export function ConsistencyPanel({ isOpen, onClose, onTabClick, tabWidth, onTabWidthChange }: ConsistencyPanelProps) {
    return (
        <div className={`${styles.panel} ${isOpen ? styles.open : ''}`}>
            {/* Tab that sticks out the left side of the panel — moves with the panel */}
            <button
                className={styles.sideTab}
                style={{ width: tabWidth, left: -tabWidth }}
                onClick={onTabClick}
                title="Consistency Report"
                aria-label="Toggle Consistency Report"
            >
                <div
                    className={styles.dragHandle}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const startX = e.clientX;
                        const startWidth = tabWidth;
                        const onMouseMove = (moveEvent: MouseEvent) => {
                            // Dragging left increases width, dragging right decreases
                            const delta = startX - moveEvent.clientX;
                            const newWidth = Math.min(120, Math.max(44, startWidth + delta));
                            onTabWidthChange(newWidth);
                        };
                        const onMouseUp = () => {
                            document.removeEventListener('mousemove', onMouseMove);
                            document.removeEventListener('mouseup', onMouseUp);
                        };
                        document.addEventListener('mousemove', onMouseMove);
                        document.addEventListener('mouseup', onMouseUp);
                    }}
                    title="Drag to resize tab"
                />
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
