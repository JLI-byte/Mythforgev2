"use client";

import React, { useState } from 'react';
import styles from './AtmosphereEditor.module.css';
import { useWorkspaceStore, Atmosphere } from '@/store/workspaceStore';

const SUGGESTED_EMOJIS = [
    '🕯️', '⚡', '🌫️', '🌄', '🌧️', '💨', '🌸', '🕸️', '✨', '🌑',
    '🔥', '🌌', '🎯', '🌲', '❄️', '🩸', '🎵', '🕊️', '💀', '🕰️'
];

interface AtmosphereEditorProps {
    atmosphere?: Atmosphere;
    onClose: () => void;
}

/**
 * AtmosphereEditor
 * 
 * A modal form for creating and editing granular parameters of custom scene atmospheres.
 */
export function AtmosphereEditor({ atmosphere, onClose }: AtmosphereEditorProps) {
    const activeProjectId = useWorkspaceStore(state => state.activeProjectId);
    const addCustomAtmosphere = useWorkspaceStore(state => state.addCustomAtmosphere);
    const updateCustomAtmosphere = useWorkspaceStore(state => state.updateCustomAtmosphere);

    const [name, setName] = useState(atmosphere?.name || '');
    const [icon, setIcon] = useState(atmosphere?.icon || '🕯️');
    const [lightBg, setLightBg] = useState(atmosphere?.lightBackground || '#F0F0F0');
    const [darkBg, setDarkBg] = useState(atmosphere?.darkBackground || '#101010');
    const [soundType, setSoundType] = useState<Atmosphere['soundType']>(atmosphere?.soundType || 'silence');
    const [lineHeightChange, setLineHeightChange] = useState(atmosphere?.lineHeightShift?.toString() || '0');
    const [letterSpacingChange, setLetterSpacingChange] = useState(atmosphere?.letterSpacingShift?.toString() || '0');

    const handleSave = () => {
        if (!name.trim()) return;

        const lhNum = parseFloat(lineHeightChange);
        const lsNum = parseFloat(letterSpacingChange);

        if (atmosphere) {
            updateCustomAtmosphere(atmosphere.id, {
                name: name.trim(),
                icon,
                lightBackground: lightBg,
                darkBackground: darkBg,
                soundType,
                lineHeightShift: lhNum,
                letterSpacingShift: lsNum
            });
        } else {
            const newAtm: Atmosphere = {
                id: crypto.randomUUID(),
                name: name.trim(),
                icon,
                lightBackground: lightBg,
                darkBackground: darkBg,
                soundType,
                soundVolume: 0.35, // Default safely
                lineHeightShift: lhNum,
                letterSpacingShift: lsNum,
                isPreset: false,
                projectId: activeProjectId,
                createdAt: new Date()
            };
            addCustomAtmosphere(newAtm);
        }

        onClose();
    };

    // Calculate live preview properties
    const sampleLineHeight = 1.6 + parseFloat(lineHeightChange || '0');
    const sampleLetterSpacing = parseFloat(letterSpacingChange || '0') + 'em';

    return (
        <div className={styles.backdrop} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>{atmosphere ? 'Edit Atmosphere' : 'Create Atmosphere'}</h2>
                    <button className={styles.closeButton} onClick={onClose} aria-label="Close">×</button>
                </div>

                <div className={styles.content}>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Name</label>
                        <input
                            type="text"
                            className={styles.input}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Tense Standoff"
                            autoFocus
                        />
                        {!name.trim() && <span className={styles.errorText}>Name is required</span>}
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Emoji Icon</label>
                        <input
                            type="text"
                            className={styles.input}
                            value={icon}
                            onChange={(e) => setIcon(e.target.value)}
                            maxLength={2}
                            style={{ width: '4rem', textAlign: 'center', fontSize: '1.2rem' }}
                        />
                        <div className={styles.emojiGrid}>
                            {SUGGESTED_EMOJIS.map(em => (
                                <button
                                    key={em}
                                    className={styles.emojiBtn}
                                    onClick={() => setIcon(em)}
                                    type="button"
                                >
                                    {em}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className={styles.colorPickers}>
                        <div className={styles.colorGroup}>
                            <label className={styles.label}>Light Mode Tint</label>
                            <input
                                type="color"
                                className={styles.colorInput}
                                value={lightBg}
                                onChange={(e) => setLightBg(e.target.value)}
                            />
                            <span className={styles.hexValue}>{lightBg.toUpperCase()}</span>
                        </div>
                        <div className={styles.colorGroup}>
                            <label className={styles.label}>Dark Mode Tint</label>
                            <input
                                type="color"
                                className={styles.colorInput}
                                value={darkBg}
                                onChange={(e) => setDarkBg(e.target.value)}
                            />
                            <span className={styles.hexValue}>{darkBg.toUpperCase()}</span>
                        </div>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Soundscape (Sprint 23 feature)</label>
                        <select
                            className={styles.input}
                            value={soundType}
                            onChange={(e) => setSoundType(e.target.value as Atmosphere['soundType'])}
                        >
                            <option value="silence">Silence</option>
                            <option value="brown-noise">Brown Noise</option>
                            <option value="white-noise">White Noise</option>
                            <option value="pink-noise">Pink Noise</option>
                            <option value="dark-ambient">Dark Ambient</option>
                            <option value="warm-loop">Warm Instrumental</option>
                            <option value="energetic-loop">Energetic</option>
                            <option value="cafe-ambient">Café Ambient</option>
                        </select>
                    </div>

                    <div className={styles.formGroup}>
                        <div className={styles.sliderGroup}>
                            <div className={styles.sliderHeader}>
                                <label className={styles.label}>Line Height Shift</label>
                                <span className={styles.valueLabel}>
                                    {parseFloat(lineHeightChange) === 0 ? '0 (default)' : (parseFloat(lineHeightChange) > 0 ? `+${lineHeightChange}` : lineHeightChange)}
                                </span>
                            </div>
                            <input
                                type="range"
                                className={styles.slider}
                                min="-0.15"
                                max="0.15"
                                step="0.05"
                                value={lineHeightChange}
                                onChange={(e) => setLineHeightChange(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className={styles.formGroup}>
                        <div className={styles.sliderGroup}>
                            <div className={styles.sliderHeader}>
                                <label className={styles.label}>Letter Spacing Shift</label>
                                <span className={styles.valueLabel}>
                                    {parseFloat(letterSpacingChange) === 0 ? '0 (default)' : `+${letterSpacingChange}em`}
                                </span>
                            </div>
                            <input
                                type="range"
                                className={styles.slider}
                                min="0"
                                max="0.05"
                                step="0.01"
                                value={letterSpacingChange}
                                onChange={(e) => setLetterSpacingChange(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Live Preview Pane */}
                    <div
                        className={styles.previewPane}
                        style={{
                            backgroundColor: 'var(--surface)',
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                    >
                        {/* Simulate light/dark background tint overlay behind text */}
                        <div
                            style={{
                                position: 'absolute',
                                top: 0, left: 0, right: 0, bottom: 0,
                                backgroundColor: window.matchMedia('(prefers-color-scheme: dark)').matches ? darkBg : lightBg,
                                opacity: 0.15, // slightly exaggerated for preview visibility
                                zIndex: 0
                            }}
                        />
                        <h3 style={{ position: 'relative', zIndex: 1 }}>Live Preview</h3>
                        <p
                            className={styles.previewText}
                            style={{
                                lineHeight: sampleLineHeight,
                                letterSpacing: sampleLetterSpacing,
                                position: 'relative',
                                zIndex: 1
                            }}
                        >
                            The quick brown fox jumps over the lazy dog.
                            Writing feels atmospheric when subtle colors and typography shifts guide the mood.
                        </p>
                    </div>
                </div>

                <div className={styles.footer}>
                    <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
                    <button
                        className={styles.saveBtn}
                        onClick={handleSave}
                        disabled={!name.trim()}
                    >
                        Save Atmosphere
                    </button>
                </div>
            </div>
        </div>
    );
}
