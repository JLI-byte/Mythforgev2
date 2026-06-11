"use client";

import React, { useState } from 'react';
import { LANDING_THEMES } from '../themes/registry';
import styles from './switcher.module.css';

interface ThemeSwitcherProps {
    activeId: string;
    onSelect: (id: string) => void;
}

export default function ThemeSwitcher({ activeId, onSelect }: ThemeSwitcherProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className={styles.switcher}>
            {isOpen && (
                <ul className={styles.menu} role="listbox" aria-label="Landing theme">
                    {LANDING_THEMES.map((theme) => (
                        <li key={theme.id}>
                            <button
                                type="button"
                                role="option"
                                aria-selected={theme.id === activeId}
                                className={theme.id === activeId ? styles.itemActive : styles.item}
                                onClick={() => {
                                    onSelect(theme.id);
                                    setIsOpen(false);
                                }}
                            >
                                <span className={styles.itemName}>{theme.name}</span>
                                <span className={styles.itemTagline}>{theme.tagline}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <button
                type="button"
                className={styles.toggle}
                aria-label="Change landing theme"
                aria-expanded={isOpen}
                onClick={() => setIsOpen((v) => !v)}
            >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M12 5 L13.4 10.6 L19 12 L13.4 13.4 L12 19 L10.6 13.4 L5 12 L10.6 10.6 Z"
                        stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
            </button>
        </div>
    );
}
