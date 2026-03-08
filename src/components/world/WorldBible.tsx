/**
 * WorldBible — Router Shell
 *
 * Sprint 46A: Rewrote from a flat entity list into a navigation router.
 * Owns the history stack and renders the correct view component
 * based on the current navigation position.
 *
 * Hierarchy: Home → Root Category → Subcategory → Entry
 * (Subcategory and Entry views are placeholders until Sprint 46B)
 */
"use client";

import React, { useState } from 'react';
import styles from './WorldBible.module.css';
import { WBView } from '@/lib/worldBibleNav';
import WorldBibleNav from './WorldBibleNav';
import WorldBibleHome from './WorldBibleHome';
import WorldBibleRoot from './WorldBibleRoot';

export default function WorldBible() {
    // Navigation history stack — starts at home
    const [history, setHistory] = useState<WBView[]>([{ level: 'home' }]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const currentView = history[historyIndex];

    /** Push a new view onto the history stack, trimming any forward history */
    const navigateTo = (view: WBView) => {
        const newHistory = [...history.slice(0, historyIndex + 1), view];
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    };

    /** Go back one step in the history stack */
    const goBack = () => {
        if (historyIndex > 0) setHistoryIndex(i => i - 1);
    };

    /** Go forward one step in the history stack */
    const goForward = () => {
        if (historyIndex < history.length - 1) setHistoryIndex(i => i + 1);
    };

    /** Navigate to home and clear forward history */
    const goHome = () => {
        navigateTo({ level: 'home' });
    };

    const canGoBack = historyIndex > 0;
    const canGoForward = historyIndex < history.length - 1;

    return (
        <aside className={styles.bibleContainer}>
            {/* Navigation bar — always visible */}
            <WorldBibleNav
                currentView={currentView}
                canGoBack={canGoBack}
                canGoForward={canGoForward}
                onBack={goBack}
                onForward={goForward}
                onHome={goHome}
            />

            {/* Route to the correct view based on current navigation level */}
            <div className={styles.bibleContent}>
                {currentView.level === 'home' && (
                    <WorldBibleHome onNavigate={navigateTo} />
                )}
                {currentView.level === 'root' && (
                    <WorldBibleRoot root={currentView.root} onNavigate={navigateTo} />
                )}
                {currentView.level === 'subcategory' && (
                    <div className={styles.placeholder}>Coming in 46B</div>
                )}
                {currentView.level === 'entry' && (
                    <div className={styles.placeholder}>Coming in 46B</div>
                )}
            </div>
        </aside>
    );
}
