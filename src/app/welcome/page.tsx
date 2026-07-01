"use client";

import React, { useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import { getTheme, DEFAULT_THEME_ID, THEME_STORAGE_KEY } from './themes/registry';
import ThemeSwitcher from './shared/ThemeSwitcher';

/**
 * LoreCanvas public beta landing — theme shell.
 *
 * Unauthenticated visitors land here (see middleware.ts). The actual page is
 * a self-contained theme component picked from the registry; the visitor's
 * choice persists in localStorage. Fantasy Storybook is the default.
 */

const THEME_COMPONENTS: Record<string, React.ComponentType> = {
    standard: dynamic(() => import('./themes/standard/StandardLanding')),
    fantasy: dynamic(() => import('./themes/fantasy/FantasyLanding')),
};

const THEME_CHANGE_EVENT = 'lc-theme-change';

function subscribe(callback: () => void) {
    window.addEventListener(THEME_CHANGE_EVENT, callback);
    window.addEventListener('storage', callback);
    return () => {
        window.removeEventListener(THEME_CHANGE_EVENT, callback);
        window.removeEventListener('storage', callback);
    };
}

function getStoredThemeId() {
    return localStorage.getItem(THEME_STORAGE_KEY) ?? DEFAULT_THEME_ID;
}

export default function WelcomePage() {
    const stored = useSyncExternalStore(subscribe, getStoredThemeId, () => DEFAULT_THEME_ID);
    const themeId = getTheme(stored).id;

    const handleSelect = (id: string) => {
        localStorage.setItem(THEME_STORAGE_KEY, getTheme(id).id);
        window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
    };

    const ActiveTheme = THEME_COMPONENTS[themeId] ?? THEME_COMPONENTS[DEFAULT_THEME_ID];

    return (
        <>
            <ActiveTheme />
            <ThemeSwitcher activeId={themeId} onSelect={handleSelect} />
        </>
    );
}
