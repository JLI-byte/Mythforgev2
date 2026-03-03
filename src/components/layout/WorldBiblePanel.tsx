"use client";

import React from 'react';
import styles from './WorldBiblePanel.module.css';
import WorldBible from '../world/WorldBible';

interface WorldBiblePanelProps {
    isOpen: boolean;
    onClose: () => void;
    onTabClick: () => void;
    tabWidth: number;
    onTabWidthChange: (width: number) => void;
}

const BookIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
);

// WorldBiblePanel — slide-out reference panel, fixed right edge
export function WorldBiblePanel({ isOpen, onClose, onTabClick, tabWidth, onTabWidthChange }: WorldBiblePanelProps) {
    return (
        <div className={`${styles.panel} ${isOpen ? styles.open : ''}`}>
            {/* Tab that sticks out the left side of the panel — moves with the panel */}
            <button
                className={styles.sideTab}
                style={{ width: tabWidth, left: -tabWidth }}
                onClick={onTabClick}
                title="World Bible"
                aria-label="Toggle World Bible"
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
                <BookIcon />
                <span className={styles.sideTabLabel}>World Bible</span>
            </button>

            {/* panelInner clips content so it doesn't bleed when panel is closed */}
            <div className={styles.panelInner}>
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
        </div>
    );
}
