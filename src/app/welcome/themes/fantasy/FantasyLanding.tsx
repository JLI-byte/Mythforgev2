"use client";

import React, { useEffect } from 'react';
import styles from './fantasy.module.css';
import './fantasy-scroll.css';
import { imFell, ebGaramond } from './fonts';
import MapHero from './art/MapHero';
import QuillMark from './art/QuillMark';

function reveal(delay: number) {
    return { '--d': `${delay}s` } as React.CSSProperties;
}

export default function FantasyLanding() {
    useEffect(() => {
        document.documentElement.dataset.lcLanding = 'fantasy';
        return () => {
            delete document.documentElement.dataset.lcLanding;
        };
    }, []);

    return (
        <div className={`${styles.page} ${imFell.variable} ${ebGaramond.variable}`}>
            <nav className={styles.nav}>
                <div className={styles.navBrand}>
                    <QuillMark />
                    LoreCanvas
                </div>
                <a href="/login" className={styles.navSignIn}>Beta tester sign in</a>
            </nav>

            <header className={styles.hero}>
                <div className={styles.heroMap}><MapHero /></div>
                <span className={`${styles.heroBadge} heroReveal`} style={reveal(0.3)}>
                    Private beta
                </span>
                <h1 className={`${styles.heroTitle} heroReveal`} style={reveal(0.55)}>
                    Every legend begins with a <em>blank map.</em>
                </h1>
                <p className={`${styles.heroSub} heroReveal`} style={reveal(0.85)}>
                    LoreCanvas is the cartographer&apos;s desk for fiction writers —
                    chart your manuscript, your lore, and your momentum in one place.
                </p>
                <div className={`${styles.heroCtas} heroReveal`} style={reveal(1.1)}>
                    <a href="#letter" className={styles.ctaPrimary}>Begin your journey</a>
                    <a href="/login" className={styles.ctaSecondary}>I carry an invitation</a>
                </div>
                <div className={styles.heroScrollHint} aria-hidden="true">
                    scroll to chart your course
                    <svg className="scrollHintArrow" width="14" height="18" viewBox="0 0 14 18" fill="none">
                        <path d="M7 1 v14 M2 11 l5 5 5 -5" stroke="currentColor" strokeWidth="1.4"
                            strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>
            </header>

            <footer className={styles.footer}>
                Charted with care · LoreCanvas © {new Date().getFullYear()} ·{' '}
                <a href="/login" className={styles.footerLink}>Beta tester sign in</a>
            </footer>
        </div>
    );
}
