"use client";

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import styles from './welcome.module.css';

/**
 * MythForge public beta landing page.
 *
 * Unauthenticated visitors land here (see middleware.ts). Sells the product,
 * collects beta access requests into public.beta_requests (write-only for
 * clients), and links invited testers to /login.
 */

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
            <div className={styles.glow} />

            <nav className={styles.nav}>
                <div className={styles.navBrand}>
                    <span className={styles.navBrandMark}>📖</span>
                    MythForge
                </div>
                <a href="/login" className={styles.navSignIn}>Beta tester sign in</a>
            </nav>

            <header className={styles.hero}>
                <span className={styles.heroBadge}>Private Beta</span>
                <h1 className={styles.heroTitle}>
                    Forge worlds.<br />
                    <span className={styles.heroTitleAccent}>Write legends.</span>
                </h1>
                <p className={styles.heroSub}>
                    MythForge is a writing studio for fiction authors and worldbuilders —
                    manuscript, lore, and momentum in one beautiful desk.
                </p>
                <div className={styles.heroCtas}>
                    <a href="#request" className={styles.ctaPrimary}>Request beta access</a>
                    <a href="/login" className={styles.ctaSecondary}>I have an invite</a>
                </div>
            </header>

            <section className={styles.features} aria-label="Features">
                {FEATURES.map((f) => (
                    <div key={f.title} className={styles.featureCard}>
                        <span className={styles.featureIcon}>{f.icon}</span>
                        <h2 className={styles.featureTitle}>{f.title}</h2>
                        <p className={styles.featureBody}>{f.body}</p>
                    </div>
                ))}
            </section>

            <section id="request" className={styles.request} aria-label="Request beta access">
                <div className={styles.requestPanel}>
                    {done ? (
                        <div className={styles.requestSuccess}>
                            <span className={styles.requestSuccessIcon}>✨</span>
                            <h2 className={styles.requestTitle}>Request received</h2>
                            <p className={styles.requestSub}>
                                You&apos;re on the list. If you&apos;re selected, an invite
                                lands in your inbox — keep an eye out.
                            </p>
                        </div>
                    ) : (
                        <>
                            <h2 className={styles.requestTitle}>Request beta access</h2>
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

            <footer className={styles.footer}>
                MythForge © {new Date().getFullYear()} ·{' '}
                <a href="/login" className={styles.footerLink}>Beta tester sign in</a>
            </footer>
        </div>
    );
}
