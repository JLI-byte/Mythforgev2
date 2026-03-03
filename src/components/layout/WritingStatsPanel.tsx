"use client";

import React from 'react';
import styles from './WritingStatsPanel.module.css';

interface WritingStatsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onTabClick: () => void;
    tabWidth: number;
    onTabWidthChange: (width: number) => void;
    panelWidth: number;
    onPanelWidthChange: (width: number) => void;
}

const ChartIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
);

export function WritingStatsPanel({ isOpen, onClose, onTabClick, tabWidth, onTabWidthChange, panelWidth, onPanelWidthChange }: WritingStatsPanelProps) {
    return (
        <div
            className={`${styles.panel} ${isOpen ? styles.open : ''}`}
            style={{ width: panelWidth }}
        >
            <button
                className={styles.sideTab}
                style={{ width: tabWidth, left: -tabWidth }}
                onClick={onTabClick}
                title="Writing Stats"
                aria-label="Toggle Writing Stats"
            >
                <div
                    className={styles.dragHandle}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const startX = e.clientX;
                        const startWidth = tabWidth;
                        const onMouseMove = (moveEvent: MouseEvent) => {
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
                <ChartIcon />
                <span className={styles.sideTabLabel}>Stats</span>
            </button>

            <div className={styles.panelInner}>
                <div
                    className={styles.panelResizeHandle}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        const startX = e.clientX;
                        const startWidth = panelWidth;
                        const onMouseMove = (moveEvent: MouseEvent) => {
                            const delta = startX - moveEvent.clientX;
                            const newWidth = Math.min(1600, Math.max(300, startWidth + delta));
                            onPanelWidthChange(newWidth);
                        };
                        const onMouseUp = () => {
                            document.removeEventListener('mousemove', onMouseMove);
                            document.removeEventListener('mouseup', onMouseUp);
                        };
                        document.addEventListener('mousemove', onMouseMove);
                        document.addEventListener('mouseup', onMouseUp);
                    }}
                    title="Drag to resize panel"
                />
                <div className={styles.header}>
                    <h2 className={styles.title}>Writing Stats</h2>
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
                    {/* Empty placeholder */}
                </div>
            </div>
        </div>
    );
}
