"use client";

import { useState } from 'react';
import { sendMagicLink } from '@/lib/supabase/signIn';
import { useRouter } from 'next/navigation';

/**
 * Sign-in logic shared by every login theme.
 *
 * Magic-link authentication with shouldCreateUser disabled: only emails the
 * developer has invited (Supabase dashboard → Auth → Invite) can sign in.
 * Everyone else is pointed at /welcome to request access.
 *
 * In development builds a one-click "Sign in as developer" button hits
 * /api/dev-login (password from .env.local, never shipped to production).
 */
export function useLoginForm() {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isDevLoading, setIsDevLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notInvited, setNotInvited] = useState(false);
    const router = useRouter();
    // Development only. The opt-in build flag is gone: the API route is gated
    // on NODE_ENV alone, so showing the button anywhere else would offer a
    // control that always 404s.
    const isDev = process.env.NODE_ENV === 'development';

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);
        setError(null);
        setNotInvited(false);

        const result = await sendMagicLink(email);

        if (result.notInvited) {
            setNotInvited(true);
        } else if (!result.ok) {
            setError(result.message);
        } else {
            setMessage(result.message);
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
                router.replace('/?view=home');
                router.refresh();
            }
        } catch {
            setError('Dev login failed — is the dev server running?');
        }
        setIsDevLoading(false);
    };

    return {
        email, setEmail,
        isLoading, isDevLoading,
        message, error, notInvited,
        isDev,
        handleLogin, handleDevLogin,
    };
}

export type LoginFormState = ReturnType<typeof useLoginForm>;
