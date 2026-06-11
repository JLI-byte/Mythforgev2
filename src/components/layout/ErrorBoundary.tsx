"use client";

import React from 'react';
import { logger } from '@/lib/logger';

interface ErrorBoundaryProps {
    children: React.ReactNode;
    /** Optional label shown in the fallback, e.g. "the editor". */
    label?: string;
    /** Optional custom fallback renderer. */
    fallback?: (error: Error, reset: () => void) => React.ReactNode;
}

interface ErrorBoundaryState {
    error: Error | null;
}

/**
 * Catches render/runtime errors in its subtree so a single failing widget
 * (e.g. a malformed canvas widget or editor node) degrades to a recoverable
 * message instead of taking the whole writing surface to a blank screen.
 *
 * The user's work lives in the store/localStorage, so "Try again" re-mounts
 * the subtree without a full reload.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        logger.error('LoreCanvas ErrorBoundary caught:', error, info?.componentStack);
    }

    reset = () => this.setState({ error: null });

    render() {
        if (this.state.error) {
            if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);
            return (
                <div
                    role="alert"
                    style={{
                        margin: '2rem auto',
                        maxWidth: 460,
                        padding: '1.5rem',
                        borderRadius: 12,
                        border: '1px solid var(--border, #3a3a3a)',
                        background: 'var(--surface, #1e1e1e)',
                        color: 'var(--foreground, #eee)',
                        textAlign: 'center',
                    }}
                >
                    <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>😵</div>
                    <h2 style={{ margin: '0 0 6px', fontSize: '1.05rem' }}>
                        Something broke in {this.props.label ?? 'this view'}
                    </h2>
                    <p style={{ margin: '0 0 14px', fontSize: '0.85rem', opacity: 0.75 }}>
                        Your work is saved. You can try again without losing anything.
                    </p>
                    <button
                        onClick={this.reset}
                        style={{
                            padding: '8px 18px',
                            borderRadius: 8,
                            border: 'none',
                            cursor: 'pointer',
                            background: 'var(--accent, #6b4c9a)',
                            color: '#fff',
                            fontSize: '0.85rem',
                        }}
                    >
                        Try again
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
