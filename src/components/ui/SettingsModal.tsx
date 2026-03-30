"use client";

import React, { useState } from 'react';
import styles from './SettingsModal.module.css';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { detectProvider, getProviderLabel, getProviderDocsUrl } from '@/lib/aiProvider';
import { AIProvider } from '@/types';

interface SettingsModalProps {
    onClose: () => void;
}

/**
 * SettingsModal provides a UI for configuring user preferences,
 * such as the AI Provider configs used for the Consistency Checker.
 */
export default function SettingsModal({ onClose }: SettingsModalProps) {
    const aiConfig = useWorkspaceStore((state) => state.aiConfig);
    const setAIConfig = useWorkspaceStore((state) => state.setAIConfig);
    const writingGoal = useWorkspaceStore((state) => state.writingGoal);
    const setWritingGoal = useWorkspaceStore((state) => state.setWritingGoal);
    const editorWidth = useWorkspaceStore((state) => state.editorWidth);
    const setEditorWidth = useWorkspaceStore((state) => state.setEditorWidth);


    const [inputKey, setInputKey] = useState(aiConfig.apiKey);
    const [showKey, setShowKey] = useState(false);
    const [ollamaEndpoint, setOllamaEndpoint] = useState(aiConfig.ollamaEndpoint);
    const [ollamaModel, setOllamaModel] = useState(aiConfig.ollamaModel);

    const [dailyTarget, setDailyTarget] = useState(writingGoal.dailyTarget);
    const [sessionTarget, setSessionTarget] = useState(writingGoal.sessionTarget);

    const [localWidth, setLocalWidth] = useState(editorWidth);


    // Auto-detect provider based on key format immediately
    const detectedProvider: AIProvider = detectProvider(inputKey);

    const handleSave = () => {
        setAIConfig({
            provider: detectedProvider,
            apiKey: inputKey.trim(),
            ollamaEndpoint: ollamaEndpoint.trim(),
            ollamaModel: ollamaModel.trim()
        });
        setWritingGoal({
            dailyTarget: dailyTarget || 0,
            sessionTarget: sessionTarget || 0
        });
        setEditorWidth(localWidth);
        onClose();
    };

    const handleClear = () => {
        setInputKey('');
        setOllamaEndpoint('http://localhost:11434');
        setOllamaModel('llama3');
        setDailyTarget(0);
        setSessionTarget(0);
        setLocalWidth(800);
    };

    return (
        <div className={styles.backdrop} onClick={onClose}>
            <div className={styles.panel} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>Settings</h2>
                    <button className={styles.closeBtn} onClick={onClose}>×</button>
                </div>

                <div className={styles.content}>
                    <section className={styles.section}>
                        <div className={styles.providerHeader}>
                            <h3>AI Provider</h3>
                            <span className={`${styles.badge} ${styles['provider' + detectedProvider.charAt(0).toUpperCase() + detectedProvider.slice(1)]}`}>
                                {getProviderLabel(detectedProvider)}
                            </span>
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.label}>API Key</label>

                            {detectedProvider === 'ollama' && !inputKey ? (
                                <p className={styles.ollamaHelper}>
                                    No API key needed for Ollama.
                                </p>
                            ) : null}

                            <div className={styles.inputWrapper}>
                                <input
                                    type={showKey ? 'text' : 'password'}
                                    value={inputKey}
                                    onChange={(e) => setInputKey(e.target.value)}
                                    className={styles.input}
                                    placeholder="sk-ant-... or sk-... or AIza..."
                                />
                                <button
                                    className={styles.toggleBtn}
                                    onClick={() => setShowKey(!showKey)}
                                >
                                    {showKey ? 'Hide' : 'Show'}
                                </button>
                            </div>

                            {/* Masked Preview if stored securely matching currently typed string */}
                            {aiConfig.apiKey && aiConfig.apiKey === inputKey.trim() && detectedProvider !== 'ollama' && (
                                <p className={styles.previewText}>
                                    Currently saved: {aiConfig.apiKey.slice(0, 8)}...{aiConfig.apiKey.slice(-4)}
                                </p>
                            )}

                            {detectedProvider !== 'ollama' && (
                                <a
                                    href={getProviderDocsUrl(detectedProvider)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={styles.docsLink}
                                >
                                    Get your API key &rarr;
                                </a>
                            )}
                        </div>

                        {/* Rendering Ollama Specific Configs  */}
                        {detectedProvider === 'ollama' && (
                            <>
                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>Ollama Endpoint</label>
                                    <input
                                        type="text"
                                        value={ollamaEndpoint}
                                        onChange={(e) => setOllamaEndpoint(e.target.value)}
                                        className={styles.input}
                                        placeholder="http://localhost:11434"
                                    />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>Model Name</label>
                                    <input
                                        type="text"
                                        value={ollamaModel}
                                        onChange={(e) => setOllamaModel(e.target.value)}
                                        className={styles.input}
                                        placeholder="llama3"
                                    />
                                </div>
                            </>
                        )}
                    </section>

                    <section className={styles.section} style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                        <div className={styles.providerHeader}>
                            <h3>Writing Goals</h3>
                        </div>
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Daily Word Target</label>
                            <input
                                type="number"
                                value={dailyTarget || ''}
                                onChange={(e) => setDailyTarget(Number(e.target.value))}
                                className={styles.input}
                                placeholder="0 (disabled)"
                                min="0"
                            />
                        </div>
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Session Word Target</label>
                            <input
                                type="number"
                                value={sessionTarget || ''}
                                onChange={(e) => setSessionTarget(Number(e.target.value))}
                                className={styles.input}
                                placeholder="0 (disabled)"
                                min="0"
                            />
                        </div>
                    </section>

                    <section className={styles.section} style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                        <div className={styles.providerHeader}>
                            <h3>Editor Layout</h3>
                        </div>
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Editor width: {localWidth}px</label>
                            <input
                                type="range"
                                min="500"
                                max="1400"
                                step="50"
                                value={localWidth}
                                onChange={(e) => setLocalWidth(Number(e.target.value))}
                                className={styles.rangeInput}
                            />
                            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.25rem' }}>
                                <button type="button" onClick={() => setLocalWidth(600)} className={styles.presetBtn}>Narrow (600px)</button>
                                <button type="button" onClick={() => setLocalWidth(800)} className={styles.presetBtn}>Default (800px)</button>
                                <button type="button" onClick={() => setLocalWidth(1000)} className={styles.presetBtn}>Wide (1000px)</button>
                                <button type="button" onClick={() => setLocalWidth(1200)} className={styles.presetBtn}>Full (1200px)</button>
                            </div>
                        </div>
                    </section>

                </div>

                <div className={styles.footer}>
                    <button className={styles.clearBtn} onClick={handleClear}>Clear</button>
                    <button className={styles.saveBtn} onClick={handleSave}>Save</button>
                </div>
            </div>
        </div>
    );
}
