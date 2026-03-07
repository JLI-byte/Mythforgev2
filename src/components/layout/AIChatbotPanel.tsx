"use client";

import React from 'react';
import { createPortal } from 'react-dom';
import styles from './AIChatbotPanel.module.css';

interface AIChatbotPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onTabClick: () => void;
    tabWidth: number;
    onTabWidthChange: (width: number) => void;
    panelWidth: number;
    onPanelWidthChange: (width: number) => void;
}

const MessageIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
);

export function AIChatbotPanel({ isOpen, onClose, onTabClick, tabWidth, onTabWidthChange, panelWidth, onPanelWidthChange }: AIChatbotPanelProps) {
    return (
        <>
            {typeof document !== 'undefined' && createPortal(
                <button
                    className={styles.sideTab}
                    style={{ width: tabWidth }}
                    onClick={onTabClick}
                    title="AI Assistant"
                    aria-label="Toggle AI Assistant"
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
                    <MessageIcon />
                    <span className={styles.sideTabLabel}>AI Chat</span>
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
                    <h2 className={styles.title}>AI Assistant</h2>
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
