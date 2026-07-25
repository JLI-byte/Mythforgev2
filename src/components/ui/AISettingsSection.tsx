"use client";

import React, { useCallback, useEffect, useState } from 'react';
import styles from './SettingsModal.module.css';
import type { RedactedAISettings } from '@/lib/aiSettings';

/**
 * AI settings — models, defaults and API keys.
 *
 * Keys are held server-side in a file outside the repo; this panel only ever
 * receives `{ configured, hint }` per secret and posts a new value when the
 * user types one. Nothing secret is kept in the workspace store, which matters
 * because the backup export writes localStorage verbatim to a download.
 */

type TestTarget = 'anthropic' | 'openrouter' | 'ollama' | 'comfyui';
type TestState = Partial<Record<TestTarget, { ok: boolean; detail: string } | 'running'>>;

/** Input for a write-only secret: shows status, accepts a new value, can clear. */
function SecretField({
    label, status, placeholder, value, onChange, onClear, help,
}: {
    label: string;
    status: { configured: boolean; hint: string; fromEnv?: boolean };
    placeholder: string;
    value: string;
    onChange: (v: string) => void;
    onClear: () => void;
    help?: string;
}) {
    return (
        <div className={styles.aiField}>
            <div className={styles.aiFieldHead}>
                <label className={styles.label}>{label}</label>
                {status.configured ? (
                    <span className={styles.aiBadgeOk}>
                        {status.fromEnv ? 'Set via .env' : `Saved ${status.hint}`}
                    </span>
                ) : (
                    <span className={styles.aiBadgeOff}>Not set</span>
                )}
            </div>
            <div className={styles.aiRow}>
                <input
                    type="password"
                    className={styles.aiInput}
                    placeholder={status.configured ? 'Enter a new key to replace' : placeholder}
                    value={value}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={e => onChange(e.target.value)}
                />
                {status.configured && !status.fromEnv && (
                    <button type="button" className={styles.aiClearBtn} onClick={onClear}>Clear</button>
                )}
            </div>
            {help && <p className={styles.aiHelp}>{help}</p>}
        </div>
    );
}

export default function AISettingsSection() {
    const [settings, setSettings] = useState<RedactedAISettings | null>(null);
    const [path, setPath] = useState('');
    const [secrets, setSecrets] = useState<{ anthropicApiKey: string; openrouterApiKey: string }>({
        anthropicApiKey: '', openrouterApiKey: '',
    });
    const [tests, setTests] = useState<TestState>({});
    const [status, setStatus] = useState('');
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        try {
            const r = await fetch('/api/ai-settings', { cache: 'no-store' });
            const j = await r.json();
            if (j.settings) { setSettings(j.settings); setPath(j.path ?? ''); }
        } catch {
            setStatus('Could not load AI settings.');
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    /** Patch a plain field locally and persist it. */
    const update = async (patch: Record<string, unknown>) => {
        setSettings(prev => (prev ? { ...prev, ...patch } as RedactedAISettings : prev));
        setSaving(true);
        try {
            const r = await fetch('/api/ai-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patch),
            });
            const j = await r.json();
            if (j.settings) setSettings(j.settings);
            setStatus(j.error ? j.error : 'Saved.');
        } catch {
            setStatus('Save failed.');
        }
        setSaving(false);
        setTimeout(() => setStatus(''), 2500);
    };

    const saveSecret = async (key: 'anthropicApiKey' | 'openrouterApiKey', value: string) => {
        await update({ [key]: value });
        setSecrets(s => ({ ...s, [key]: '' }));
    };

    const runTest = async (target: TestTarget) => {
        setTests(t => ({ ...t, [target]: 'running' }));
        try {
            const r = await fetch('/api/ai-settings/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target }),
            });
            const j = await r.json();
            setTests(t => ({ ...t, [target]: { ok: Boolean(j.ok), detail: j.detail || j.error || '' } }));
        } catch {
            setTests(t => ({ ...t, [target]: { ok: false, detail: 'Test failed to run.' } }));
        }
    };

    const TestLine = ({ target }: { target: TestTarget }) => {
        const t = tests[target];
        return (
            <div className={styles.aiTestRow}>
                <button type="button" className={styles.aiTestBtn} onClick={() => runTest(target)}>
                    Test connection
                </button>
                {t === 'running' && <span className={styles.aiHelp}>Testing…</span>}
                {t && t !== 'running' && (
                    <span className={t.ok ? styles.aiTestOk : styles.aiTestBad}>
                        {t.ok ? '✓' : '✕'} {t.detail}
                    </span>
                )}
            </div>
        );
    };

    if (!settings) {
        return (
            <section className={styles.section} style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                <div className={styles.providerHeader}><h3>AI</h3></div>
                <p className={styles.aiHelp}>Loading…</p>
            </section>
        );
    }

    return (
        <section className={styles.section} style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
            <div className={styles.providerHeader}>
                <h3>AI</h3>
                {status && <span className={styles.aiStatus}>{saving ? 'Saving…' : status}</span>}
            </div>

            {/* ── Assistant defaults ── */}
            <h4 className={styles.aiGroupTitle}>Assistant</h4>

            <label className={styles.label}>Default backend</label>
            <div className={styles.aiSegmented}>
                {(['claude', 'local'] as const).map(p => (
                    <button
                        key={p}
                        type="button"
                        className={settings.defaultProvider === p ? styles.aiSegActive : styles.aiSeg}
                        onClick={() => update({ defaultProvider: p })}
                    >
                        {p === 'claude' ? '🧠 Claude' : '💻 Local model'}
                    </button>
                ))}
            </div>
            <p className={styles.aiHelp}>Which backend a new chat opens with. You can still switch per conversation.</p>

            <label className={styles.label} style={{ marginTop: '0.9rem' }}>Claude model</label>
            <input
                className={styles.aiInput}
                value={settings.claudeModel}
                spellCheck={false}
                onChange={e => setSettings({ ...settings, claudeModel: e.target.value })}
                onBlur={e => update({ claudeModel: e.target.value })}
            />

            {/* ── Claude auth ── */}
            <h4 className={styles.aiGroupTitle}>Claude account</h4>
            <div className={styles.aiSegmented}>
                <button
                    type="button"
                    className={settings.claudeAuth === 'subscription' ? styles.aiSegActive : styles.aiSeg}
                    onClick={() => update({ claudeAuth: 'subscription' })}
                >
                    My Claude subscription
                </button>
                <button
                    type="button"
                    className={settings.claudeAuth === 'apiKey' ? styles.aiSegActive : styles.aiSeg}
                    onClick={() => update({ claudeAuth: 'apiKey' })}
                >
                    Anthropic API key
                </button>
            </div>

            {settings.claudeAuth === 'subscription' ? (
                <p className={styles.aiHelp}>
                    Runs through the Claude Code you&apos;re signed in to, so chats use your
                    Pro/Max plan instead of API credit. Install Claude Code and run{' '}
                    <code className={styles.aiCode}>claude</code> once to sign in.
                </p>
            ) : (
                <>
                    <SecretField
                        label="Anthropic API key"
                        status={settings.anthropicApiKey}
                        placeholder="sk-ant-…"
                        value={secrets.anthropicApiKey}
                        onChange={v => setSecrets(s => ({ ...s, anthropicApiKey: v }))}
                        onClear={() => saveSecret('anthropicApiKey', '')}
                        help="Billed per token to your API account, not your subscription."
                    />
                    {secrets.anthropicApiKey && (
                        <button
                            type="button"
                            className={styles.aiSaveBtn}
                            onClick={() => saveSecret('anthropicApiKey', secrets.anthropicApiKey)}
                        >
                            Save key
                        </button>
                    )}
                    <TestLine target="anthropic" />
                </>
            )}

            {/* ── Local model ── */}
            <h4 className={styles.aiGroupTitle}>Local model (Ollama)</h4>

            <label className={styles.label}>Server URL</label>
            <input
                className={styles.aiInput}
                value={settings.ollamaBaseUrl}
                spellCheck={false}
                onChange={e => setSettings({ ...settings, ollamaBaseUrl: e.target.value })}
                onBlur={e => update({ ollamaBaseUrl: e.target.value })}
            />

            <label className={styles.label} style={{ marginTop: '0.9rem' }}>Default model</label>
            <input
                className={styles.aiInput}
                value={settings.defaultLocalModel}
                placeholder="e.g. mistral"
                spellCheck={false}
                onChange={e => setSettings({ ...settings, defaultLocalModel: e.target.value })}
                onBlur={e => update({ defaultLocalModel: e.target.value })}
            />

            <label className={styles.aiCheckRow}>
                <input
                    type="checkbox"
                    checked={settings.autoLaunchOllama}
                    onChange={e => update({ autoLaunchOllama: e.target.checked })}
                />
                <span>Start Ollama automatically when it isn&apos;t running</span>
            </label>
            <TestLine target="ollama" />

            {/* ── Images ── */}
            <h4 className={styles.aiGroupTitle}>Image generation</h4>

            <div className={styles.aiSegmented}>
                {(['openrouter', 'comfyui'] as const).map(p => (
                    <button
                        key={p}
                        type="button"
                        className={settings.imageProvider === p ? styles.aiSegActive : styles.aiSeg}
                        onClick={() => update({ imageProvider: p })}
                    >
                        {p === 'openrouter' ? 'OpenRouter' : 'Local ComfyUI'}
                    </button>
                ))}
            </div>

            {settings.imageProvider === 'openrouter' ? (
                <>
                    <SecretField
                        label="OpenRouter API key"
                        status={settings.openrouterApiKey}
                        placeholder="sk-or-…"
                        value={secrets.openrouterApiKey}
                        onChange={v => setSecrets(s => ({ ...s, openrouterApiKey: v }))}
                        onClear={() => saveSecret('openrouterApiKey', '')}
                        help="Used for image generation and the credit balance in the chat."
                    />
                    {secrets.openrouterApiKey && (
                        <button
                            type="button"
                            className={styles.aiSaveBtn}
                            onClick={() => saveSecret('openrouterApiKey', secrets.openrouterApiKey)}
                        >
                            Save key
                        </button>
                    )}

                    <label className={styles.label} style={{ marginTop: '0.9rem' }}>Image model</label>
                    <input
                        className={styles.aiInput}
                        value={settings.imageModel}
                        spellCheck={false}
                        onChange={e => setSettings({ ...settings, imageModel: e.target.value })}
                        onBlur={e => update({ imageModel: e.target.value })}
                    />
                    <TestLine target="openrouter" />
                </>
            ) : (
                <>
                    <label className={styles.label}>ComfyUI URL</label>
                    <input
                        className={styles.aiInput}
                        value={settings.comfyuiUrl}
                        spellCheck={false}
                        onChange={e => setSettings({ ...settings, comfyuiUrl: e.target.value })}
                        onBlur={e => update({ comfyuiUrl: e.target.value })}
                    />
                    <p className={styles.aiHelp}>
                        Renders on your own GPU with no per-image cost. Slower than the hosted
                        provider, and ComfyUI must be running.
                    </p>

                    <label className={styles.label} style={{ marginTop: '0.9rem' }}>Diffusion model</label>
                    <input
                        className={styles.aiInput}
                        value={settings.comfyModel}
                        spellCheck={false}
                        onChange={e => setSettings({ ...settings, comfyModel: e.target.value })}
                        onBlur={e => update({ comfyModel: e.target.value })}
                    />

                    <label className={styles.label} style={{ marginTop: '0.9rem' }}>Text encoder</label>
                    <input
                        className={styles.aiInput}
                        value={settings.comfyClip}
                        spellCheck={false}
                        onChange={e => setSettings({ ...settings, comfyClip: e.target.value })}
                        onBlur={e => update({ comfyClip: e.target.value })}
                    />
                    <p className={styles.aiHelp}>Must match the model family — a FLUX.2 model needs a FLUX.2 encoder.</p>

                    <label className={styles.label} style={{ marginTop: '0.9rem' }}>VAE</label>
                    <input
                        className={styles.aiInput}
                        value={settings.comfyVae}
                        spellCheck={false}
                        onChange={e => setSettings({ ...settings, comfyVae: e.target.value })}
                        onBlur={e => update({ comfyVae: e.target.value })}
                    />

                    <label className={styles.label} style={{ marginTop: '0.9rem' }}>Steps</label>
                    <input
                        className={styles.aiInput}
                        type="number"
                        min={1}
                        max={60}
                        value={settings.comfySteps}
                        onChange={e => setSettings({ ...settings, comfySteps: Number(e.target.value) })}
                        onBlur={e => update({ comfySteps: Number(e.target.value) })}
                    />

                    <label className={styles.label} style={{ marginTop: '0.9rem' }}>Negative prompt</label>
                    <textarea
                        className={styles.aiInput}
                        rows={2}
                        value={settings.comfyNegative}
                        spellCheck={false}
                        onChange={e => setSettings({ ...settings, comfyNegative: e.target.value })}
                        onBlur={e => update({ comfyNegative: e.target.value })}
                    />
                    <p className={styles.aiHelp}>Applied to every local render — the main lever against the plastic AI look.</p>

                    <TestLine target="comfyui" />
                </>
            )}

            {path && (
                <p className={styles.aiHelp} style={{ marginTop: '1rem' }}>
                    Keys are stored on this machine at <code className={styles.aiCode}>{path}</code> — never in
                    the browser, and never included in workspace backups.
                </p>
            )}
        </section>
    );
}
