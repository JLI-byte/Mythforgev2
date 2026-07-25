"use client";

import React from 'react';
import styles from './fantasyLogin.module.css';
import { imFell, ebGaramond } from '../welcome/themes/fantasy/fonts';
import QuillMark from '../welcome/themes/fantasy/art/QuillMark';
import type { LoginFormState } from './useLoginForm';

/**
 * Login — Fantasy Storybook theme ("The Cartographer's Desk").
 * Parchment background, ink serif type, a letter-style card sealed with wax.
 * Only rendered when the visitor has picked the fantasy landing theme.
 */
export default function FantasyLogin({ form }: { form: LoginFormState }) {
    const {
        email, setEmail, isLoading, isDevLoading,
        message, error, notInvited, isDev,
        handleLogin, handleDevLogin,
    } = form;

    return (
        <div className={`${styles.page} ${imFell.variable} ${ebGaramond.variable}`}>
            <div className={styles.panel}>
                <div className={styles.brand}>
                    <span className={styles.brandMark}><QuillMark size={36} /></span>
                    <h1 className={styles.brandName}>LoreCanvas</h1>
                    <p className={styles.brandSub}>The cartographer&apos;s gate</p>
                </div>

                <form onSubmit={handleLogin} className={styles.form}>
                    <div>
                        <label htmlFor="email" className={styles.fieldLabel}>
                            Where ravens may find you
                        </label>
                        <input
                            id="email"
                            type="email"
                            placeholder="name@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className={styles.fieldInput}
                        />
                    </div>

                    <button type="submit" disabled={isLoading} className={styles.submit}>
                        {isLoading ? 'Sending…' : 'Send magic link'}
                    </button>
                </form>

                {message && (
                    <div className={`${styles.notice} ${styles.noticeSuccess}`}>
                        {message}
                    </div>
                )}

                {notInvited && (
                    <div className={`${styles.notice} ${styles.noticeInvite}`}>
                        This name isn&apos;t in the ledger yet.{' '}
                        <a href="/welcome#letter" className={styles.noticeLink}>
                            Request access here
                        </a>
                        .
                    </div>
                )}

                {error && (
                    <div className={`${styles.notice} ${styles.noticeError}`}>
                        {error}
                    </div>
                )}

                <p className={styles.footnote}>
                    Not a tester yet?{' '}
                    <a href="/welcome" className={styles.footnoteLink}>
                        Request beta access
                    </a>
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
        </div>
    );
}
