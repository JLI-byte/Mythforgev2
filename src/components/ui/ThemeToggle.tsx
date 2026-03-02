"use client";

import React, { useEffect, useState } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';

/**
 * ThemeToggle
 * 
 * A fixed, unobtrusive icon button allowing users to manually override the
 * application's theme. State is persisted in `workspaceStore`.
 * 
 * Flow: system -> light -> dark -> system
 */
export function ThemeToggle() {
    const theme = useWorkspaceStore((state) => state.theme);
    const setTheme = useWorkspaceStore((state) => state.setTheme);

    // Prevent hydration mismatches by ensuring we only render the toggle 
    // icon once the client state has mounted.
    const [mounted, setMounted] = useState(false);

    // Watch the theme preference and explicitly mutate the document root `data-theme`
    // to drive our globals.css CSS variable definitions.
    useEffect(() => {
        /* eslint-disable */
        setMounted(true);
        /* eslint-enable */

        const root = document.documentElement;

        if (theme === 'system') {
            // Unset manual overrides and let the `@media (prefers-color-scheme: dark)` handle it
            root.removeAttribute('data-theme');
        } else {
            // Force light or dark mode vars
            root.setAttribute('data-theme', theme);
        }
    }, [theme]);

    if (!mounted) {
        return <div style={toggleStyles} />; // Placeholder to prevent layout shift
    }

    const cycleTheme = () => {
        if (theme === 'system') setTheme('light');
        else if (theme === 'light') setTheme('dark');
        else setTheme('system');
    };

    let icon = '⚙️';
    let title = 'System Theme';
    if (theme === 'light') {
        icon = '☀️';
        title = 'Light Theme';
    } else if (theme === 'dark') {
        icon = '🌙';
        title = 'Dark Theme';
    }

    return (
        <button
            onClick={cycleTheme}
            style={toggleStyles}
            title={`Current theme: ${title}`}
            aria-label="Toggle theme"
        >
            {icon}
        </button>
    );
}

// Minimal inline styling to keep the control tucked away in the Toolbar.
const toggleStyles: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    fontSize: '1.25rem',
    cursor: 'pointer',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.7,
    transition: 'opacity 0.2s',
};
