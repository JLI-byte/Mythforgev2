"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import styles from './welcome.module.css';
import HeroMesh from './HeroMesh';
import './welcome-effect.css';

/**
 * LoreCanvas public beta landing page.
 *
 * Unauthenticated visitors land here (see middleware.ts). Sells the product,
 * collects beta access requests into public.beta_requests (write-only for
 * clients), and links invited testers to /login.
 *
 * Scrollytelling design ported from jh3y's "you can scroll."
 * (codepen.io/jh3y/pen/MYgaaem): a sticky "you can" lead with OKLCH
 * rainbow words that brighten as they cross the viewport center, driven by
 * CSS scroll-driven animations (see welcome-effect.css).
 */

const WORDS = [
    'plot.',
    'draft.',
    'worldbuild.',
    'revise.',
    'plan.',
    'export.',
    'write legends.',
];

const FEATURES = [
    {
        icon: '🗺️',
        title: 'The Writing Desk',
        body: 'An infinite canvas around your manuscript. Pin research, sticky notes, character sheets, and story beats right next to the words.',
    },
    {
        icon: '📖',
        title: 'World Bible',
        body: 'Characters, places, factions, and lore in linked articles. Type [[ while writing to connect an entity without leaving the page.',
    },
    {
        icon: '🔥',
        title: 'Goals & Streaks',
        body: 'Daily word targets, a writing heatmap, badges, and streaks that survive your busiest weeks.',
    },
    {
        icon: '📦',
        title: 'Your words, exportable',
        body: 'Markdown, Word, and EPUB export plus local backups and version history. No lock-in, ever.',
    },
];

export default function WelcomePage() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [done, setDone] = useState(false);
    const [alreadyRequested, setAlreadyRequested] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Scrollbar hue sync, scroll snap, and dark color-scheme live on <html>,
    // so welcome-effect.css scopes them to this attribute for this route only.
    useEffect(() => {
        document.documentElement.dataset.lcLanding = 'true';
        return () => {
            delete document.documentElement.dataset.lcLanding;
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        setAlreadyRequested(false);

        const supabase = createClient();
        const { error } = await supabase.from('beta_requests').insert({
            email: email.trim().toLowerCase(),
            name: name.trim() || null,
            reason: reason.trim() || null,
        });

        if (error) {
            // 23505 = unique_violation: this email already requested access
            if (error.code === '23505') {
                setAlreadyRequested(true);
            } else {
                setError('Something went wrong — please try again in a minute.');
            }
        } else {
            setDone(true);
        }
        setIsSubmitting(false);
    };

    return (
        <div className={styles.page}>
            <nav className={styles.nav}>
                <div className={styles.navBrand}>
                    <span>📖</span>
                    LoreCanvas
                </div>
                <a href="/login" className={styles.navSignIn}>Beta tester sign in</a>
            </nav>

            <header className={styles.hero}>
                <HeroMesh />
                <span className={styles.heroBadge}>Private Beta</span>
                <h1 className={styles.heroTitle}>forge worlds.</h1>
                <p className={styles.heroSub}>
                    LoreCanvas is a writing studio for fiction authors and worldbuilders —
                    manuscript, lore, and momentum in one beautiful desk.
                </p>
                <div className={styles.heroCtas}>
                    <a href="#request" className={styles.ctaPrimary}>Request beta access</a>
                    <a href="/login" className={styles.ctaSecondary}>I have an invite</a>
                </div>
            </header>

            <main>
                <section className={styles.scrolly}>
                    <h2 className={styles.scrollyLead}>
                        <span aria-hidden="true">you can&nbsp;</span>
                        <span className={styles.srOnly}>you can write legends.</span>
                    </h2>
                    <ul
                        className="lc-words"
                        aria-hidden="true"
                        style={{ '--count': WORDS.length } as React.CSSProperties}
                    >
                        {WORDS.map((word, i) => (
                            <li key={word} style={{ '--i': i } as React.CSSProperties}>
                                {word}
                            </li>
                        ))}
                    </ul>
                </section>

                <section className={styles.features} aria-label="Features">
                    <div className={styles.featuresGrid}>
                        {FEATURES.map((f) => (
                            <div key={f.title} className={styles.featureCard}>
                                <span className={styles.featureIcon}>{f.icon}</span>
                                <h2 className={styles.featureTitle}>{f.title}</h2>
                                <p className={styles.featureBody}>{f.body}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section id="request" className={styles.request} aria-label="Request beta access">
                    <h2 className={styles.requestHeading}>join the beta.</h2>
                    <div className={styles.requestPanel}>
                        {done ? (
                            <div className={styles.requestSuccess}>
                                <span className={styles.requestSuccessIcon}>✨</span>
                                <h3 className={styles.requestTitle}>Request received</h3>
                                <p className={styles.requestSub}>
                                    You&apos;re on the list. If you&apos;re selected, an invite
                                    lands in your inbox — keep an eye out.
                                </p>
                            </div>
                        ) : (
                            <>
                                <h3 className={styles.requestTitle}>Request beta access</h3>
                                <p className={styles.requestSub}>
                                    The beta is invite-only while we polish the forge.
                                    Tell us a little about your writing and we&apos;ll be in touch.
                                </p>
                                <form onSubmit={handleSubmit}>
                                    <div className={styles.field}>
                                        <label htmlFor="wname" className={styles.fieldLabel}>Name</label>
                                        <input
                                            id="wname"
                                            className={styles.fieldInput}
                                            type="text"
                                            maxLength={120}
                                            placeholder="Your name (optional)"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                        />
                                    </div>
                                    <div className={styles.field}>
                                        <label htmlFor="wemail" className={styles.fieldLabel}>Email</label>
                                        <input
                                            id="wemail"
                                            className={styles.fieldInput}
                                            type="email"
                                            required
                                            placeholder="name@example.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                        />
                                    </div>
                                    <div className={styles.field}>
                                        <label htmlFor="wreason" className={styles.fieldLabel}>
                                            What are you writing?
                                        </label>
                                        <textarea
                                            id="wreason"
                                            className={styles.fieldTextarea}
                                            maxLength={2000}
                                            placeholder="A fantasy trilogy, a screenplay, a sprawling sci-fi universe… (optional)"
                                            value={reason}
                                            onChange={(e) => setReason(e.target.value)}
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        className={styles.requestSubmit}
                                        disabled={isSubmitting || !email.trim()}
                                    >
                                        {isSubmitting ? 'Sending…' : 'Request access'}
                                    </button>
                                </form>
                                {alreadyRequested && (
                                    <div className={styles.requestNote}>
                                        This email is already on the waitlist — you&apos;re all set.
                                    </div>
                                )}
                                {error && <div className={styles.requestError}>{error}</div>}
                            </>
                        )}
                    </div>
                </section>
            </main>

            <footer className={styles.footer}>
                LoreCanvas © {new Date().getFullYear()} ·{' '}
                <a href="/login" className={styles.footerLink}>Beta tester sign in</a>
            </footer>
        </div>
    );
}
