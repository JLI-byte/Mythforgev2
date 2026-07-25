"use client";

import React from 'react';
import ShaderSurface from '../welcome/themes/standard/ShaderSurface';
import styles from './standardLogin.module.css';
import type { LoginFormState } from './useLoginForm';

/**
 * Login — Minimalist theme (the default).
 * Dark surface with the landing's animated dot field and lamp glow, a centered
 * sign-in card, and the same pill CTA and sans type as StandardLanding.
 */
export default function StandardLogin({ form }: { form: LoginFormState }) {
    const {
        email, setEmail, isLoading, isDevLoading,
        message, error, notInvited, isDev,
        handleLogin, handleDevLogin,
    } = form;

    return (
        <div className={styles.page}>
            <ShaderSurface />

            <div className={styles.lamp} aria-hidden="true">
                <div className={styles.lampConeLeft} />
                <div className={styles.lampConeRight} />
                <div className={styles.lampGlow} />
                <div className={styles.lampBar} />
            </div>

            <nav className={styles.nav}>
                <a href="/welcome" className={styles.brand}>LoreCanvas</a>
                <a href="/welcome" className={styles.navBack}>← Back</a>
            </nav>

            <main className={styles.main}>
                <div className={styles.card}>
                    <h1 className={styles.title}>Sign in</h1>
                    <p className={styles.sub}>Beta testers only — we&apos;ll email you a magic link.</p>

                    <form onSubmit={handleLogin} className={styles.form}>
                        <label htmlFor="email" className={styles.fieldLabel}>Email</label>
                        <input
                            id="email"
                            type="email"
                            placeholder="name@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className={styles.fieldInput}
                        />

                        <button type="submit" disabled={isLoading} className={styles.submit}>
                            {isLoading ? 'Sending…' : 'Send magic link'}
                        </button>
                    </form>

                    {message && (
                        <div className={`${styles.notice} ${styles.noticeSuccess}`}>{message}</div>
                    )}

                    {notInvited && (
                        <div className={`${styles.notice} ${styles.noticeInvite}`}>
                            This email isn&apos;t on the beta list yet.{' '}
                            <a href="/welcome" className={styles.noticeLink}>Request access</a>.
                        </div>
                    )}

                    {error && (
                        <div className={`${styles.notice} ${styles.noticeError}`}>{error}</div>
                    )}

                    <p className={styles.footnote}>
                        Not a tester yet?{' '}
                        <a href="/welcome" className={styles.footnoteLink}>Request beta access</a>
                    </p>

                    {isDev && (
                        <button
                            onClick={handleDevLogin}
                            disabled={isDevLoading}
                            className={styles.devButton}
                        >
                            {isDevLoading ? 'Signing in…' : 'Sign in as developer (dev only)'}
                        </button>
                    )}
                </div>
            </main>

            <footer className={styles.footer}>
                © {new Date().getFullYear()} LoreCanvas
            </footer>
        </div>
    );
}
