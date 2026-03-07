"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './WritingGoalsPanel.module.css';

interface WritingGoalsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onTabClick: () => void;
    tabWidth: number;
    onTabWidthChange: (width: number) => void;
    panelWidth: number;
    onPanelWidthChange: (width: number) => void;
}

const TargetIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
    </svg>
);

export function WritingGoalsPanel({ isOpen, onClose, onTabClick, tabWidth, onTabWidthChange, panelWidth, onPanelWidthChange }: WritingGoalsPanelProps) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    return (
        <>
            {mounted && createPortal(
                <button
                    className={`${styles.sideTab} ${isOpen ? styles.sideTabActive : ''}`}
                    style={{
                        width: tabWidth,
                        right: isOpen ? panelWidth : 0,
                        transition: 'right 280ms ease-in-out'
                    }}
                    onClick={onTabClick}
                    title="Writing Goals"
                    aria-label="Toggle Writing Goals"
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
                    <TargetIcon />
                    <span className={styles.sideTabLabel}>Goals</span>
                </button>,
                document.body
            )}

            <div
                className={`${styles.panel} ${isOpen ? styles.open : ''}`}
                style={{ width: panelWidth }}
            >
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
                    <h2 className={styles.title}>Writing Goals</h2>
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
        </>
    );
}
