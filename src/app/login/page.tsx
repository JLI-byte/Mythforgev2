"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Login Page — beta testers only.
 *
 * Magic-link authentication with shouldCreateUser disabled: only emails the
 * developer has invited (Supabase dashboard → Auth → Invite) can sign in.
 * Everyone else is pointed at /welcome to request access.
 *
 * In development builds a one-click "Sign in as developer" button hits
 * /api/dev-login (password from .env.local, never shipped to production).
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
  const isDev = process.env.NODE_ENV === 'development';

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
      setMessage('Check your email for a magic link.');
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
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-[#2a2a2a] rounded-2xl flex items-center justify-center text-3xl mb-4 border border-[#3a3a3a]">
            📖
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">MythForge</h1>
          <p className="text-zinc-500 text-sm mt-2">Beta tester sign in</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-zinc-400 uppercase tracking-widest mb-2">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors shadow-lg shadow-emerald-900/10"
          >
            {isLoading ? 'Sending...' : 'Send Magic Link'}
          </button>
        </form>

        {message && (
          <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-sm text-center">
            {message}
          </div>
        )}

        {notInvited && (
          <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300 text-sm text-center">
            This email isn&apos;t on the beta list yet.{' '}
            <a href="/welcome#request" className="underline text-amber-200 hover:text-white">
              Request access here
            </a>
            .
          </div>
        )}

        {error && (
          <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <p className="mt-8 text-center text-sm text-zinc-500">
          Not a tester yet?{' '}
          <a href="/welcome" className="text-emerald-400 hover:text-emerald-300 underline">
            Request beta access
          </a>
        </p>

        {isDev && (
          <button
            onClick={handleDevLogin}
            disabled={isDevLoading}
            className="mt-6 w-full border border-dashed border-purple-500/40 text-purple-300 hover:bg-purple-500/10 disabled:opacity-50 text-sm font-medium py-2.5 rounded-lg transition-colors"
          >
            {isDevLoading ? 'Signing in…' : '⚡ Sign in as developer (dev only)'}
          </button>
        )}
      </div>
    </div>
  );
}
