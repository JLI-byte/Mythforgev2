"use client";

import React, { useEffect, useState } from 'react';
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
    fantasy: dynamic(() => import('./themes/fantasy/FantasyLanding')),
};

export default function WelcomePage() {
    const [themeId, setThemeId] = useState(DEFAULT_THEME_ID);

    useEffect(() => {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        if (saved) setThemeId(getTheme(saved).id);
    }, []);

    const handleSelect = (id: string) => {
        const resolved = getTheme(id).id;
        setThemeId(resolved);
        localStorage.setItem(THEME_STORAGE_KEY, resolved);
    };

    const ActiveTheme = THEME_COMPONENTS[themeId] ?? THEME_COMPONENTS[DEFAULT_THEME_ID];

    return (
        <>
            <ActiveTheme />
            <ThemeSwitcher activeId={themeId} onSelect={handleSelect} />
        </>
    );
}
