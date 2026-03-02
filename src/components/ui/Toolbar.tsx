"use client";

import React, { useState } from 'react';
import { ThemeToggle } from './ThemeToggle';
import { SidebarToggle } from './SidebarToggle';
import { useWorkspaceStore } from '@/store/workspaceStore';
import SettingsModal from './SettingsModal';
import ExportModal from './ExportModal';

/**
 * Toolbar
 *
 * A single grouped frosted glass pill holding global interface toggles.
 * Pinned to the top right of the application layout.
 */
export function Toolbar() {
    const isSidebarOpen = useWorkspaceStore(state => state.isSidebarOpen);
    const isTypewriterMode = useWorkspaceStore(state => state.isTypewriterMode);
    const toggleTypewriterMode = useWorkspaceStore(state => state.toggleTypewriterMode);
    const isFullscreen = useWorkspaceStore(state => state.isFullscreen);
    const toggleFullscreen = useWorkspaceStore(state => state.toggleFullscreen);
    const [showSettings, setShowSettings] = useState(false);
    const [showExport, setShowExport] = useState(false);

    return (
        <>
            <div style={{
                position: 'fixed',
                top: '0.75rem',
                right: isSidebarOpen ? 'calc(360px + 1rem)' : '1rem',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                background: 'rgba(var(--background-rgb), 0.8)',
                backdropFilter: 'blur(8px)',
                border: '1px solid var(--border)',
                borderRadius: '24px',
                padding: '0.25rem 0.5rem'
            }}>
                <SidebarToggle />
                <button
                    onClick={() => setShowExport(true)}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        fontSize: '1.25rem',
                        cursor: 'pointer',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0.7,
                        transition: 'opacity 0.2s',
                    }}
                    title="Export"
                    aria-label="Export Document or Bible"
                >
                    ↓
                </button>
                <button
                    onClick={() => setShowSettings(true)}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        fontSize: '1.25rem',
                        cursor: 'pointer',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0.7,
                        transition: 'opacity 0.2s',
                    }}
                    title="Settings"
                    aria-label="Open Settings"
                >
                    ⚙
                </button>
                <button
                    onClick={toggleTypewriterMode}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        fontSize: '1.25rem',
                        cursor: 'pointer',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: isTypewriterMode ? 1 : 0.7,
                        color: isTypewriterMode ? 'var(--accent)' : 'inherit',
                        transition: 'opacity 0.2s, color 0.2s',
                    }}
                    title="Typewriter Mode"
                    aria-label="Toggle Typewriter Mode"
                >
                    ¶
                </button>
                <button
                    onClick={toggleFullscreen}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        fontSize: '1.25rem',
                        cursor: 'pointer',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: isFullscreen ? 1 : 0.7,
                        color: isFullscreen ? 'var(--accent)' : 'inherit',
                        transition: 'opacity 0.2s, color 0.2s',
                    }}
                    title="Fullscreen Mode (F11)"
                    aria-label="Toggle Fullscreen Mode"
                >
                    ⛶
                </button>
                <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 0.25rem' }} />
                <ThemeToggle />
            </div>

            {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
            {showExport && <ExportModal onClose={() => setShowExport(false)} />}
        </>
    );
}
