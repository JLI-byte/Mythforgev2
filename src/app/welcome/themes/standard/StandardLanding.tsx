"use client";

import React, { useEffect, useState } from "react";
import DottedSurface from "./DottedSurface";
import RequestAccessModal from "./RequestAccessModal";
import styles from "./standard.module.css";

/**
 * StandardLanding — minimal dark hero-only landing.
 * Animated dotted-surface background + centered hero. The primary CTA opens a
 * beta-request modal; the secondary CTA links to /login.
 */
export default function StandardLanding() {
    const [showRequest, setShowRequest] = useState(false);

    useEffect(() => {
        document.documentElement.dataset.lcLanding = "standard";
        return () => {
            delete document.documentElement.dataset.lcLanding;
        };
    }, []);

    return (
        <div className={styles.page}>
            <div className={styles.lamp} aria-hidden="true">
                <div className={styles.lampConeLeft} />
                <div className={styles.lampConeRight} />
                <div className={styles.lampGlow} />
                <div className={styles.lampBar} />
            </div>

            <DottedSurface />

            <nav className={styles.nav}>
                <div className={styles.brand}>LoreCanvas</div>
                <a href="/login" className={styles.navSignIn}>
                    Beta tester sign in
                </a>
            </nav>

            <main className={styles.hero}>
                <div className={styles.heroInner}>
                    <h1 className={styles.title}>Write your world into existence.</h1>
                    <p className={styles.sub}>
                        The writing desk for novelists and worldbuilders — manuscript,
                        lore, and momentum in one place.
                    </p>
                    <div className={styles.ctas}>
                        <button
                            type="button"
                            className={styles.ctaPrimary}
                            onClick={() => setShowRequest(true)}
                        >
                            Request beta access
                        </button>
                        <a href="/login" className={styles.ctaSecondary}>
                            Beta tester sign in
                        </a>
                    </div>
                </div>
            </main>

            <footer className={styles.footer}>
                © {new Date().getFullYear()} LoreCanvas ·{" "}
                <a href="/login" className={styles.footerLink}>
                    Sign in
                </a>
            </footer>

            {showRequest && (
                <RequestAccessModal onClose={() => setShowRequest(false)} />
            )}
        </div>
    );
}
