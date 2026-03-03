"use client";

import React from 'react';
import styles from './RightTabRail.module.css';

export type RightPanelId = 'worldBible' | 'consistency';

interface Tab {
    id: RightPanelId;
    label: string;
    icon: React.ReactNode;
}

interface RightTabRailProps {
    activePanel: RightPanelId | null;
    onToggle: (id: RightPanelId) => void;
}

// Filing cabinet tab icons — use currentColor so they respond to light/dark theme automatically
const BookIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
);

const CheckIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
);

const TABS: Tab[] = [
    { id: 'worldBible', label: 'World Bible', icon: <BookIcon /> },
    { id: 'consistency', label: 'Consistency', icon: <CheckIcon /> },
];

// RightTabRail — unified filing cabinet tab strip, fixed to top-right edge
// Add new tabs to the TABS array above — no other changes needed
export function RightTabRail({ activePanel, onToggle }: RightTabRailProps) {
    return (
        <div className={styles.rail}>
            {TABS.map((tab) => {
                const isActive = activePanel === tab.id;
                return (
                    <button
                        key={tab.id}
                        className={`${styles.tab} ${isActive ? styles.active : ''}`}
                        onClick={() => onToggle(tab.id)}
                        title={tab.label}
                        aria-pressed={isActive}
                    >
                        <span className={styles.icon}>{tab.icon}</span>
                        <span className={styles.label}>{tab.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
