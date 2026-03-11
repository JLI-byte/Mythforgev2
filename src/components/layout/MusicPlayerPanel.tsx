"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './MusicPlayerPanel.module.css';

interface MusicPlayerPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onTabClick: () => void;
    tabWidth: number;
    onTabWidthChange: (width: number) => void;
    panelWidth: number;
    onPanelWidthChange: (width: number) => void;
}

function processUrl(url: string): string {
    // Spotify playlist/album/track
    // https://open.spotify.com/playlist/xxx → https://open.spotify.com/embed/playlist/xxx
    if (url.includes('open.spotify.com')) {
        return url.replace('open.spotify.com/', 'open.spotify.com/embed/');
    }
    // YouTube playlist or video
    // https://www.youtube.com/watch?v=xxx → https://www.youtube.com/embed/xxx
    // https://www.youtube.com/playlist?list=xxx → https://www.youtube.com/embed/videoseries?list=xxx
    if (url.includes('youtube.com/watch')) {
        // safely parse
        try {
            const videoId = new URL(url).searchParams.get('v');
            if (videoId) return `https://www.youtube.com/embed/${videoId}`;
        } catch { }
    }
    if (url.includes('youtube.com/playlist')) {
        try {
            const listId = new URL(url).searchParams.get('list');
            if (listId) return `https://www.youtube.com/embed/videoseries?list=${listId}`;
        } catch { }
    }
    // SoundCloud — use oEmbed iframe approach
    if (url.includes('soundcloud.com')) {
        return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&visual=true`;
    }
    // Fallback — return as-is and let the iframe try
    return url;
}

export function MusicPlayerPanel({ isOpen, onClose, onTabClick, tabWidth, onTabWidthChange, panelWidth, onPanelWidthChange }: MusicPlayerPanelProps) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    const [embedUrl, setEmbedUrl] = useState('');
    const [inputUrl, setInputUrl] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        // Run asynchronously to avoid Next.js "setState synchronously within effect" warning
        Promise.resolve().then(() => {
            const savedUrl = localStorage.getItem('mythforge-music-url');
            if (savedUrl) {
                setEmbedUrl(savedUrl);
            } else {
                setIsEditing(true);
            }
        });
    }, []);

    const handleLoad = () => {
        if (inputUrl.trim()) {
            const processed = processUrl(inputUrl.trim());
            setEmbedUrl(processed);
            localStorage.setItem('mythforge-music-url', processed);
            setIsEditing(false);
        }
    };

    return (
        <>
            {mounted && createPortal(
                <button
                    className={`${styles.sideTab} ${isOpen ? styles.sideTabActive : ''}`}
                    style={{
                        width: tabWidth,
                        right: isOpen ? panelWidth : 0,
                        transition: 'right 280ms ease-in-out'
                    }}
                    onClick={onTabClick}
                    title="Music Player"
                    aria-label="Toggle Music Player"
                >
                    <div 
                        className={styles.dragHandle} 
                        onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const startX = e.clientX;
                            const startWidth = tabWidth;
                            const onMouseMove = (moveEvent: MouseEvent) => {
                                const delta = startX - moveEvent.clientX;
                                const newWidth = Math.min(120, Math.max(44, startWidth + delta));
                                onTabWidthChange(newWidth);
                            };
                            const onMouseUp = () => {
                                document.removeEventListener('mousemove', onMouseMove);
                                document.removeEventListener('mouseup', onMouseUp);
                            };
                            document.addEventListener('mousemove', onMouseMove);
                            document.addEventListener('mouseup', onMouseUp);
                        }}
                    />
                    <span className={styles.tabLabel}>♪</span>
                    <span className={styles.tabText}>Music</span>
                </button>,
                document.body
            )}

            <div className={`${styles.panel} ${isOpen ? styles.open : ''}`} style={{ width: panelWidth }}>
                {/* Panel content */}
            <div className={styles.panelInner} style={{ paddingRight: tabWidth }}>
                <header className={styles.header}>
                    <span className={styles.title}>Music Player</span>
                    <button className={styles.editBtn} onClick={() => setIsEditing(!isEditing)} title="Change source">
                        {isEditing ? '✕' : '✎'}
                    </button>
                    <button className={styles.closeBtn} onClick={onClose}>×</button>
                </header>

                {isEditing || !embedUrl ? (
                    /* URL input state */
                    <div className={styles.urlInputState}>
                        <p className={styles.hint}>Paste a link from Spotify, YouTube, SoundCloud, or any music service</p>
                        <input
                            type="text"
                            className={styles.urlInput}
                            value={inputUrl}
                            onChange={e => setInputUrl(e.target.value)}
                            placeholder="https://open.spotify.com/playlist/..."
                            onKeyDown={e => {
                                if (e.key === 'Enter' && inputUrl.trim()) {
                                    handleLoad();
                                }
                            }}
                        />
                        <button
                            className={styles.loadBtn}
                            onClick={handleLoad}
                        >Load</button>
                        <p className={styles.supportedServices}>
                            Works with Spotify, YouTube, SoundCloud, and more
                        </p>
                    </div>
                ) : (
                    /* Embed state */
                    <iframe
                        src={embedUrl}
                        className={styles.embed}
                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                        loading="lazy"
                        title="Music Player"
                    />
                )}
            </div>
            {/* Optional resize handle for the panel itself */}
            <div 
                className={styles.panelResizeHandle} 
                style={{ cursor: 'ew-resize' }}
                onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const startX = e.clientX;
                    const startWidth = panelWidth;
                    const onMouseMove = (moveEvent: MouseEvent) => {
                        const delta = startX - moveEvent.clientX;
                        const newWidth = Math.max(300, Math.min(800, startWidth + delta));
                        onPanelWidthChange(newWidth);
                    };
                    const onMouseUp = () => {
                        document.removeEventListener('mousemove', onMouseMove);
                        document.removeEventListener('mouseup', onMouseUp);
                    };
                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                }}
            />
        </div>
        </>
    );
}
