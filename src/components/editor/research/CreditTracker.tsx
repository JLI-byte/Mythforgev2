"use client";

import React, { useCallback, useEffect, useState } from 'react';
import styles from '../WritingDesk.module.css';

interface CreditState {
    loading: boolean;
    remaining?: number;
    usage?: number;
    error?: string;
}

/**
 * OpenRouter credit tracker for the chat toolbar. Shows the remaining balance,
 * refetches whenever `refreshSignal` changes (bumped after each assistant turn,
 * which may have spent credits on image generation), and on click. Hides itself
 * entirely when OpenRouter isn't configured.
 */
export function CreditTracker({ refreshSignal }: { refreshSignal: number }) {
    const [state, setState] = useState<CreditState>({ loading: true });

    const load = useCallback(async () => {
        setState(s => ({ ...s, loading: true }));
        try {
            const res = await fetch('/api/openrouter-credits', { cache: 'no-store' });
            const json = await res.json();
            if (typeof json.remaining === 'number') {
                setState({ loading: false, remaining: json.remaining, usage: json.usage });
            } else {
                setState({ loading: false, error: json.error || 'error' });
            }
        } catch {
            setState({ loading: false, error: 'error' });
        }
    }, []);

    useEffect(() => { load(); }, [load, refreshSignal]);

    // Not configured — show nothing rather than a broken chip.
    if (state.error === 'not_configured') return null;

    const label = state.loading && state.remaining === undefined
        ? '…'
        : state.remaining !== undefined
            ? `$${state.remaining.toFixed(2)}`
            : '—';
    const title = state.remaining !== undefined
        ? `OpenRouter credits remaining${state.usage !== undefined ? ` (used $${state.usage.toFixed(2)})` : ''} — click to refresh`
        : 'OpenRouter credits unavailable — click to retry';

    return (
        <button
            className={`${styles.creditTracker} ${state.loading ? styles.creditTrackerLoading : ''}`}
            onClick={load}
            title={title}
        >
            💳 {label}
        </button>
    );
}
