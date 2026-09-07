"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, X } from 'lucide-react';
import styles from './WritingGoalsPanel.module.css';
import GoalsContent from '@/components/goals/GoalsContent';

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
                        top: 178,
                        transition: 'right 280ms ease-in-out',
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

            {mounted && isOpen && createPortal(
                <button
                    className={styles.ghostTab}
                    style={{ 
                        width: tabWidth, 
                        height: 130, // matches standardized sideTab height
                        top: 178, // matches .sideTab { top: 178px } in WritingGoalsPanel.module.css
                        right: 0, // stays static at the screen edge
                    }}
                    onClick={onClose}
                    title="Close Goals"
                >
                    <span className={styles.ghostTabArrow} aria-hidden="true"><ChevronRight size={12} /></span>
                </button>,
                document.body
            )}

            <div
                className={`${styles.panel} ${isOpen ? styles.open : ''}`}
                style={{ width: panelWidth }}
                // A closed panel is only pushed off-screen, not unmounted — without this it
                // keeps its tab stops and stays in the accessibility tree.
                inert={!isOpen}
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
                <div className={styles.header} style={{ paddingRight: tabWidth }}>
                    <h2 className={styles.title}>Writing Goals</h2>
                    <button
                        className={styles.closeButton}
                        onClick={onClose}
                        aria-label="Close"
                        title="Close"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className={styles.contentWrapper} style={{ paddingRight: tabWidth }}>
                    <GoalsContent />
                </div>
            </div>
        </div>
        </>
    );
}
