"use client";

import React, { useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import { getTheme, DEFAULT_THEME_ID, THEME_STORAGE_KEY } from '../welcome/themes/registry';
import { useLoginForm } from './useLoginForm';

/**
 * Login Page — beta testers only. Theme shell.
 *
 * The sign-in form is themed to match whichever landing theme the visitor
 * picked on /welcome (same localStorage key), so the parchment "cartographer's
 * desk" styling only appears alongside the Fantasy Storybook landing. Everyone
 * else — including first-time visitors — gets the default Minimalist theme.
 *
 * Auth behaviour itself is theme-independent and lives in useLoginForm.
 */

const LOGIN_THEMES: Record<string, React.ComponentType<{ form: ReturnType<typeof useLoginForm> }>> = {
    standard: dynamic(() => import('./StandardLogin')),
    fantasy: dynamic(() => import('./FantasyLogin')),
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

export default function LoginPage() {
    const stored = useSyncExternalStore(subscribe, getStoredThemeId, () => DEFAULT_THEME_ID);
    const themeId = getTheme(stored).id;
    const form = useLoginForm();

    const ActiveLogin = LOGIN_THEMES[themeId] ?? LOGIN_THEMES[DEFAULT_THEME_ID];

    return <ActiveLogin form={form} />;
}
