"use client";

import React, { useEffect, useState } from 'react';
import styles from './fantasy.module.css';
import './fantasy-scroll.css';
import { imFell, ebGaramond } from './fonts';
import { submitBetaRequest, type BetaRequestResult } from '../../shared/betaRequest';
import MapHero from './art/MapHero';
import QuillMark from './art/QuillMark';
import { DeskIcon, ArchiveIcon, HearthIcon, VaultIcon } from './art/LandmarkIcons';
import SeaSerpent from './art/SeaSerpent';
import WaxSeal from './art/WaxSeal';

function reveal(delay: number) {
    return { '--d': `${delay}s` } as React.CSSProperties;
}

const STOPS = [
    {
        name: 'The Desk',
        feature: 'The Writing Desk',
        body: 'An infinite canvas around your manuscript. Pin research, sticky notes, character sheets, and story beats right beside the words.',
        Icon: DeskIcon,
    },
    {
        name: 'The Archive',
        feature: 'World Bible',
        body: 'Characters, places, factions, and lore in linked articles. Type [[ while writing to bind an entity to the page without breaking stride.',
        Icon: ArchiveIcon,
    },
    {
        name: 'The Hearth',
        feature: 'Goals & Streaks',
        body: 'Daily word targets, a writing heatmap, and streaks that survive your busiest weeks. Keep the fire lit.',
        Icon: HearthIcon,
    },
    {
        name: 'The Vault',
        feature: 'Export & Backups',
        body: 'Markdown, Word, and EPUB export, plus local backups and version history. Your words leave with you — no lock-in, ever.',
        Icon: VaultIcon,
    },
] as const;

export default function FantasyLanding() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<BetaRequestResult | null>(null);

    useEffect(() => {
        document.documentElement.dataset.lcLanding = 'fantasy';
        return () => {
            delete document.documentElement.dataset.lcLanding;
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setResult(null);
        const outcome = await submitBetaRequest({ name, email, reason });
        setResult(outcome);
        setIsSubmitting(false);
    };

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

            <main>
                <section className={styles.journey} aria-label="Features">
                    <p className={styles.journeyKicker}>The journey ahead</p>
                    <h2 className={styles.journeyTitle}>Four landmarks on the road to a finished tale</h2>

                    <div className={styles.routeWrap} aria-hidden="true">
                        <svg viewBox="0 0 160 1200" preserveAspectRatio="none" fill="none">
                            <mask id="lc-journey-mask">
                                <path
                                    className="routeDraw"
                                    d="M80 0 C140 150 20 280 80 420 C140 560 20 700 80 840 C130 960 50 1080 80 1200"
                                    stroke="#fff" strokeWidth="12" pathLength={1} strokeLinecap="round"
                                />
                            </mask>
                            <path
                                d="M80 0 C140 150 20 280 80 420 C140 560 20 700 80 840 C130 960 50 1080 80 1200"
                                stroke="currentColor" strokeWidth="2.5"
                                strokeDasharray="10 9" strokeLinecap="round"
                                mask="url(#lc-journey-mask)"
                            />
                        </svg>
                    </div>

                    <ol className={styles.stops}>
                        {STOPS.map(({ name, feature, body, Icon }) => (
                            <li key={name} className={`${styles.stop} stopReveal`}>
                                <div className={styles.stopText}>
                                    <p className={styles.stopFeature}>{feature}</p>
                                    <h3 className={styles.stopName}>{name}</h3>
                                    <p className={styles.stopBody}>{body}</p>
                                </div>
                                <div className={styles.stopScene}><Icon /></div>
                            </li>
                        ))}
                    </ol>
                </section>

                <aside className={styles.marginalia} aria-hidden="true">
                    <div className={styles.marginaliaInner}>
                        <SeaSerpent />
                        <span className={styles.marginaliaNote}>here be dragons</span>
                    </div>
                </aside>

                <section id="letter" className={styles.letter} aria-label="Request beta access">
                    <h2 className={styles.letterHeading}>A letter to the Cartographer</h2>
                    <div className={styles.letterScrollTarget}>
                        <svg
                            className={styles.letterLoop}
                            viewBox="0 0 600 800"
                            preserveAspectRatio="none"
                            fill="none"
                            aria-hidden="true"
                        >
                            <mask id="lc-loop-mask">
                                <path
                                    className="loopDraw"
                                    d="M300 16 C 268 54 332 82 302 112 C 470 116 566 240 562 408 C 556 600 458 728 298 736 C 138 728 36 590 36 400 C 36 232 140 120 286 114 C 306 113 320 120 334 132"
                                    stroke="#fff" strokeWidth="16" pathLength={1}
                                    strokeLinecap="round" fill="none"
                                />
                            </mask>
                            <path
                                d="M300 16 C 268 54 332 82 302 112 C 470 116 566 240 562 408 C 556 600 458 728 298 736 C 138 728 36 590 36 400 C 36 232 140 120 286 114 C 306 113 320 120 334 132"
                                stroke="currentColor" strokeWidth="2.5"
                                strokeDasharray="10 9" strokeLinecap="round"
                                mask="url(#lc-loop-mask)"
                            />
                        </svg>
                        <div className={styles.letterPanel}>
                        {result === 'done' ? (
                            <div className={styles.letterSuccess}>
                                <WaxSeal size={64} />
                                <h3 className={styles.letterSuccessTitle}>Your letter is sealed.</h3>
                                <p className={styles.letterIntro}>
                                    Watch the skies for a raven — if you&apos;re chosen for the
                                    beta, your invitation will arrive by post (well, email).
                                </p>
                            </div>
                        ) : (
                            <>
                                <p className={styles.letterSalutation}>Dear Cartographer,</p>
                                <p className={styles.letterIntro}>
                                    The beta is invite-only while we chart these waters.
                                    Send word of your tale and we&apos;ll dispatch a raven.
                                </p>
                                <form onSubmit={handleSubmit}>
                                    <div className={styles.field}>
                                        <label htmlFor="lname" className={styles.fieldLabel}>
                                            Your name, traveler
                                        </label>
                                        <input
                                            id="lname"
                                            className={styles.fieldInput}
                                            type="text"
                                            maxLength={120}
                                            placeholder="optional, but politer"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                        />
                                    </div>
                                    <div className={styles.field}>
                                        <label htmlFor="lemail" className={styles.fieldLabel}>
                                            Where ravens may find you
                                        </label>
                                        <input
                                            id="lemail"
                                            className={styles.fieldInput}
                                            type="email"
                                            required
                                            placeholder="name@example.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                        />
                                    </div>
                                    <div className={styles.field}>
                                        <label htmlFor="lreason" className={styles.fieldLabel}>
                                            What tale are you charting?
                                        </label>
                                        <textarea
                                            id="lreason"
                                            className={styles.fieldTextarea}
                                            maxLength={2000}
                                            placeholder="A fantasy trilogy, a screenplay, a sprawling sci-fi universe…"
                                            value={reason}
                                            onChange={(e) => setReason(e.target.value)}
                                        />
                                    </div>
                                    <div className={styles.sealRow}>
                                        <button
                                            type="submit"
                                            className={styles.sealButton}
                                            disabled={isSubmitting || !email.trim()}
                                        >
                                            <WaxSeal />
                                            {isSubmitting ? 'Sealing…' : 'Seal & send'}
                                        </button>
                                    </div>
                                </form>
                                {result === 'duplicate' && (
                                    <p className={styles.letterNote}>
                                        This address is already in the Cartographer&apos;s ledger —
                                        you&apos;re on the list.
                                    </p>
                                )}
                                {result === 'error' && (
                                    <p className={styles.letterError}>
                                        The raven was lost to a storm — please try again in a minute.
                                    </p>
                                )}
                            </>
                        )}
                        </div>
                    </div>
                </section>
            </main>

            <footer className={styles.footer}>
                Charted with care · LoreCanvas © {new Date().getFullYear()} ·{' '}
                <a href="/login" className={styles.footerLink}>Beta tester sign in</a>
            </footer>
        </div>
    );
}
