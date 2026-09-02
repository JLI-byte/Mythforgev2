"use client";

import React, { useEffect, useRef, useState } from 'react';
import styles from '../WritingDesk.module.css';

interface ChatModelPickerProps {
    provider: 'claude' | 'local';
    /** Ollama model name when provider === 'local'. */
    localModel: string;
    disabled?: boolean;
    onPick: (provider: 'claude' | 'local', model: string) => void;
}

/** Short display name — strips the ':latest' tag Ollama appends. */
function shortName(model: string): string {
    return model.replace(/:latest$/, '');
}

/**
 * Model selector for the composer footer (Claude-style "Opus 5" dropdown).
 * Lists Claude plus whatever models the local Ollama server reports; the list
 * is fetched when the menu opens so a newly-pulled model shows up without a
 * reload. Falls back to a free-text entry when the local server isn't running.
 */
export function ChatModelPicker({ provider, localModel, disabled, onPick }: ChatModelPickerProps) {
    const [open, setOpen] = useState(false);
    const [models, setModels] = useState<string[]>([]);
    const [reachable, setReachable] = useState(true);
    const [loading, setLoading] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    // Close on outside click / Escape.
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    // Refresh the local model list each time the menu opens.
    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setLoading(true);
        fetch('/api/local-models', { cache: 'no-store' })
            .then(r => r.json())
            .then((j: { models?: string[]; reachable?: boolean }) => {
                if (cancelled) return;
                setModels(Array.isArray(j.models) ? j.models : []);
                setReachable(Boolean(j.reachable));
            })
            .catch(() => { if (!cancelled) { setModels([]); setReachable(false); } })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [open]);

    const label = provider === 'claude' ? 'Claude' : (shortName(localModel) || 'Local model');

    const pick = (p: 'claude' | 'local', model: string) => {
        onPick(p, model);
        setOpen(false);
    };

    return (
        <div className={styles.modelPicker} ref={rootRef}>
            <button
                className={styles.modelPickerBtn}
                onClick={() => setOpen(o => !o)}
                disabled={disabled}
                title="Choose the model that answers"
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <span className={`${styles.modelDot} ${provider === 'local' ? styles.modelDotLocal : ''}`} />
                <span className={styles.modelPickerLabel}>{label}</span>
                <span className={styles.modelPickerCaret}>⌄</span>
            </button>

            {open && (
                <div className={styles.modelMenu} role="listbox">
                    <div className={styles.modelMenuGroup}>Cloud</div>
                    <button
                        className={`${styles.modelMenuItem} ${provider === 'claude' ? styles.modelMenuItemActive : ''}`}
                        onClick={() => pick('claude', localModel)}
                        role="option"
                        aria-selected={provider === 'claude'}
                    >
                        <span className={styles.modelDot} />
                        <span className={styles.modelMenuName}>Claude</span>
                        <span className={styles.modelMenuNote}>Max subscription</span>
                    </button>

                    <div className={styles.modelMenuGroup}>Local</div>
                    {loading && <div className={styles.modelMenuEmpty}>Loading…</div>}
                    {!loading && !reachable && (
                        <div className={styles.modelMenuEmpty}>
                            Ollama isn’t running. Pick a local model anyway and it will start on send.
                        </div>
                    )}
                    {!loading && models.map(m => (
                        <button
                            key={m}
                            className={`${styles.modelMenuItem} ${provider === 'local' && localModel === m ? styles.modelMenuItemActive : ''}`}
                            onClick={() => pick('local', m)}
                            role="option"
                            aria-selected={provider === 'local' && localModel === m}
                        >
                            <span className={`${styles.modelDot} ${styles.modelDotLocal}`} />
                            <span className={styles.modelMenuName}>{shortName(m)}</span>
                        </button>
                    ))}
                    {!loading && reachable && models.length === 0 && (
                        <div className={styles.modelMenuEmpty}>No local models installed.</div>
                    )}

                    <div className={styles.modelMenuFooter}>
                        <input
                            className={styles.modelMenuInput}
                            aria-label="Local model name"
                            defaultValue={localModel}
                            placeholder="or type a model name…"
                            onKeyDown={e => {
                                if (e.key !== 'Enter') return;
                                const v = (e.target as HTMLInputElement).value.trim();
                                if (v) pick('local', v);
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
