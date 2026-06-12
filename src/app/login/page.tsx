"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import styles from './login.module.css';
import { imFell, ebGaramond } from '../welcome/themes/fantasy/fonts';
import QuillMark from '../welcome/themes/fantasy/art/QuillMark';

/**
 * Login Page — beta testers only.
 *
 * Magic-link authentication with shouldCreateUser disabled: only emails the
 * developer has invited (Supabase dashboard → Auth → Invite) can sign in.
 * Everyone else is pointed at /welcome to request access.
 *
 * In development builds a one-click "Sign in as developer" button hits
 * /api/dev-login (password from .env.local, never shipped to production).
 *
 * Styled to match the fantasy landing — parchment, ink serif, wax-red CTA.
 */
export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDevLoading, setIsDevLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notInvited, setNotInvited] = useState(false);
  const router = useRouter();

  const supabase = createClient();
  // Dev login also shows in local production builds when explicitly opted in
  // at build time (NEXT_PUBLIC_ALLOW_DEV_LOGIN=1) — the API route still 404s
  // unless the server is started with ALLOW_DEV_LOGIN=1.
  const isDev =
    process.env.NODE_ENV === 'development' ||
    process.env.NEXT_PUBLIC_ALLOW_DEV_LOGIN === '1';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);
    setError(null);
    setNotInvited(false);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Invite-only beta: never create accounts from the login form
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      // GoTrue surfaces unknown emails as a signup-disallowed error
      if (/signup|not allowed|not found/i.test(error.message)) {
        setNotInvited(true);
      } else {
        setError(error.message);
      }
    } else {
      setMessage('A magic link is on its way — check your inbox.');
    }

    setIsLoading(false);
  };

  const handleDevLogin = async () => {
    setIsDevLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/dev-login', { method: 'POST' });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || 'Dev login failed');
      } else {
        router.replace('/');
        router.refresh();
      }
    } catch {
      setError('Dev login failed — is the dev server running?');
    }
    setIsDevLoading(false);
  };

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
