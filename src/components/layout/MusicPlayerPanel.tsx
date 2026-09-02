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

interface SavedPlaylist {
    id: string;
    name: string;
    url: string;
    service: string;
    createdAt: number;
}

const CURATED: { name: string; url: string; service: string; description: string }[] = [
    { name: 'Lo-Fi Hip Hop', url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk', service: 'YouTube', description: 'Beats to study/write to' },
    { name: 'Ambient Writing', url: 'https://open.spotify.com/playlist/37i9dQZF1DWZeKCadgRdKQ', service: 'Spotify', description: 'Calm focus music' },
    { name: 'Cinematic Epic', url: 'https://open.spotify.com/playlist/37i9dQZF1DX7EF8wVxBWW0', service: 'Spotify', description: 'Film scores for worldbuilding' },
    { name: 'Dark Ambient', url: 'https://open.spotify.com/playlist/37i9dQZF1DX5trt9i14X7j', service: 'Spotify', description: 'For dark fiction and horror' },
    { name: 'Coffee Shop Noise', url: 'https://www.youtube.com/watch?v=h2zkV-l_TbY', service: 'YouTube', description: 'Background café ambience' },
    { name: 'Medieval Fantasy', url: 'https://open.spotify.com/playlist/37i9dQZF1DX1s9knjP51Oa', service: 'Spotify', description: 'For fantasy worldbuilding' },
    { name: 'Focus Flow', url: 'https://open.spotify.com/playlist/37i9dQZF1DWZZbwlv3Vmtr', service: 'Spotify', description: 'Deep concentration' },
    { name: 'Rain Sounds', url: 'https://www.youtube.com/watch?v=mPZkdNFkNps', service: 'YouTube', description: 'Rainfall for writing sessions' },
];

function detectService(url: string): string {
    if (url.includes('spotify.com')) return 'Spotify';
    if (url.includes('apple.com')) return 'Apple Music';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube';
    if (url.includes('soundcloud.com')) return 'SoundCloud';
    if (url.includes('pandora.com')) return 'Pandora';
    if (url.includes('tidal.com')) return 'Tidal';
    if (url.includes('deezer.com')) return 'Deezer';
    return 'Music';
}

const SERVICE_EMOJI: Record<string, string> = {
    Spotify: '🟢',
    'Apple Music': '🍎',
    YouTube: '▶️',
    SoundCloud: '☁️',
    Pandora: '🎵',
    Tidal: '🌊',
    Deezer: '🎶',
    Music: '🎵',
};

export function MusicPlayerPanel({
    isOpen, onClose, onTabClick,
    tabWidth, onTabWidthChange,
    panelWidth, onPanelWidthChange
}: MusicPlayerPanelProps) {
    const [mounted, setMounted] = useState(false);
    const tabRef = React.useRef<HTMLButtonElement>(null);


    const [library, setLibrary] = useState<SavedPlaylist[]>([]);
    const [view, setView] = useState<'library' | 'curated' | 'add'>('library');
    const [newUrl, setNewUrl] = useState('');
    const [newName, setNewName] = useState('');
    const [toast, setToast] = useState('');

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        try {
            const saved = localStorage.getItem('lorecanvas-music-library-v2');
            if (saved) setLibrary(JSON.parse(saved));
        } catch { setLibrary([]); }
    }, []);

    const saveLibrary = (next: SavedPlaylist[]) => {
        setLibrary(next);
        localStorage.setItem('lorecanvas-music-library-v2', JSON.stringify(next));
    };

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(''), 2500);
    };

    const openUrl = (url: string, name: string) => {
        // SECURITY: only open http(s) links. User-saved entries are untrusted,
        // so reject javascript:/file:/data: schemes that could run code or read
        // local files (especially inside the Electron shell). noopener prevents
        // the opened tab from reaching back through window.opener.
        try {
            const parsed = new URL(url);
            if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
                showToast('Only http(s) links can be opened');
                return;
            }
        } catch {
            showToast('That doesn’t look like a valid link');
            return;
        }
        window.open(url, '_blank', 'noopener,noreferrer');
        showToast(`Opening ${name}...`);
    };

    const addToLibrary = () => {
        if (!newUrl.trim()) return;
        const service = detectService(newUrl);
        const entry: SavedPlaylist = {
            id: crypto.randomUUID(),
            name: newName.trim() || service + ' Playlist',
            url: newUrl.trim(),
            service,
            createdAt: Date.now(),
        };
        saveLibrary([entry, ...library]);
        setNewUrl('');
        setNewName('');
        setView('library');
        showToast('Saved to library!');
    };

    const removeFromLibrary = (id: string) => {
        saveLibrary(library.filter(p => p.id !== id));
    };

    return (
        <>
            {mounted && createPortal(
                <button
                    className={`${styles.sideTab} ${isOpen ? styles.sideTabActive : ''}`}
                    style={{
                        width: tabWidth,
                        right: isOpen ? panelWidth : 0,
                        top: 438,
                        transition: 'right 280ms ease-in-out',
                    }}
                    onClick={onTabClick}
                    title="Music"
                >
                    <div
                        className={styles.dragHandle}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const startX = e.clientX;
                            const startWidth = tabWidth;
                            const onMove = (me: MouseEvent) => {
                                onTabWidthChange(Math.min(120, Math.max(44, startWidth + (startX - me.clientX))));
                            };
                            const onUp = () => {
                                document.removeEventListener('mousemove', onMove);
                                document.removeEventListener('mouseup', onUp);
                            };
                            document.addEventListener('mousemove', onMove);
                            document.addEventListener('mouseup', onUp);
                        }}
                    />
                    <span className={styles.tabIcon}>♪</span>
                    <span className={styles.tabText}>Music</span>
                </button>,
                document.body
            )}

            {mounted && isOpen && createPortal(
                <button
                    className={styles.ghostTab}
                    style={{ 
                        width: tabWidth, 
                        height: 130,
                        top: 438,
                        right: 0, // stays static at the screen edge
                    }}
                    onClick={onClose}
                    title="Close Music"
                >
                    <span className={styles.ghostTabArrow}>▸</span>
                </button>,
                document.body
            )}

            <div
                className={`${styles.panel} ${isOpen ? styles.open : ''}`}
                style={{ width: panelWidth }}
                // A closed panel is only pushed off-screen, not unmounted — without this it
                // keeps its tab stops and stays in the accessibility tree.
                inert={!isOpen}
            >
                <div className={styles.panelInner} style={{ paddingRight: tabWidth }}>
                    {/* Resize handle */}
                    <div
                        className={styles.panelResizeHandle}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            const startX = e.clientX;
                            const startW = panelWidth;
                            const onMove = (me: MouseEvent) => {
                                onPanelWidthChange(Math.max(280, Math.min(800, startW + (startX - me.clientX))));
                            };
                            const onUp = () => {
                                document.removeEventListener('mousemove', onMove);
                                document.removeEventListener('mouseup', onUp);
                            };
                            document.addEventListener('mousemove', onMove);
                            document.addEventListener('mouseup', onUp);
                        }}
                    />

                    {/* Header */}
                    <div className={styles.header} style={{ paddingRight: tabWidth }}>
                        <h2 className={styles.title}>Music & Soundscapes</h2>
                        <button className={styles.closeBtn} onClick={onClose}>×</button>
                    </div>

                    {/* Nav tabs */}
                    <div className={styles.navTabs} style={{ paddingRight: tabWidth }}>
                        <button
                            className={`${styles.navTab} ${view === 'library' ? styles.navTabActive : ''}`}
                            onClick={() => setView('library')}
                        >
                            My Library
                        </button>
                        <button
                            className={`${styles.navTab} ${view === 'curated' ? styles.navTabActive : ''}`}
                            onClick={() => setView('curated')}
                        >
                            ✨ Curated
                        </button>
                        <button
                            className={`${styles.navTab} ${view === 'add' ? styles.navTabActive : ''}`}
                            onClick={() => setView('add')}
                        >
                            + Add
                        </button>
                    </div>

                    {/* Toast */}
                    {toast && <div className={styles.toast}>{toast}</div>}

                    {/* Content */}
                    <div className={styles.content} style={{ paddingRight: tabWidth }}>

                        {/* ── MY LIBRARY ── */}
                        {view === 'library' && (
                            <div className={styles.listView}>
                                {library.length === 0 ? (
                                    <div className={styles.emptyState}>
                                        <span className={styles.emptyIcon}>🎵</span>
                                        <p>No playlists saved yet.</p>
                                        <button
                                            className={styles.emptyAction}
                                            onClick={() => setView('add')}
                                        >
                                            Add your first playlist
                                        </button>
                                        <span className={styles.emptyOr}>or browse</span>
                                        <button
                                            className={styles.emptyAction}
                                            onClick={() => setView('curated')}
                                        >
                                            Curated writing playlists
                                        </button>
                                    </div>
                                ) : (
                                    library.map(p => (
                                        <div key={p.id} className={styles.playlistRow}>
                                            <span className={styles.playlistEmoji}>
                                                {SERVICE_EMOJI[p.service] ?? '🎵'}
                                            </span>
                                            <div className={styles.playlistInfo}>
                                                <span className={styles.playlistName}>{p.name}</span>
                                                <span className={styles.playlistService}>{p.service}</span>
                                            </div>
                                            <button
                                                className={styles.playBtn}
                                                onClick={() => openUrl(p.url, p.name)}
                                                title="Open in browser"
                                            >
                                                ▶
                                            </button>
                                            <button
                                                className={styles.deleteBtn}
                                                onClick={() => removeFromLibrary(p.id)}
                                                title="Remove"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* ── CURATED ── */}
                        {view === 'curated' && (
                            <div className={styles.listView}>
                                <p className={styles.curatedHint}>
                                    Writer-picked playlists. Click ▶ to open, or + to save to your library.
                                </p>
                                {CURATED.map((p, i) => (
                                    <div key={i} className={styles.playlistRow}>
                                        <span className={styles.playlistEmoji}>
                                            {SERVICE_EMOJI[p.service] ?? '🎵'}
                                        </span>
                                        <div className={styles.playlistInfo}>
                                            <span className={styles.playlistName}>{p.name}</span>
                                            <span className={styles.playlistService}>{p.description}</span>
                                        </div>
                                        <button
                                            className={styles.playBtn}
                                            onClick={() => openUrl(p.url, p.name)}
                                            title="Open in browser"
                                        >
                                            ▶
                                        </button>
                                        <button
                                            className={styles.addBtn}
                                            onClick={() => {
                                                const entry: SavedPlaylist = {
                                                    id: crypto.randomUUID(),
                                                    name: p.name,
                                                    url: p.url,
                                                    service: p.service,
                                                    createdAt: Date.now(),
                                                };
                                                saveLibrary([entry, ...library]);
                                                showToast(`"${p.name}" saved to library!`);
                                            }}
                                            title="Save to library"
                                        >
                                            +
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ── ADD ── */}
                        {view === 'add' && (
                            <div className={styles.addView}>
                                <p className={styles.addHint}>
                                    Paste any playlist, album, or track link from Spotify,
                                    YouTube, Apple Music, SoundCloud, or anywhere else.
                                    It opens in your music app — no restrictions.
                                </p>
                                <label className={styles.addLabel}>URL</label>
                                <input
                                    className={styles.addInput}
                                    type="text"
                                    placeholder="https://open.spotify.com/playlist/..."
                                    value={newUrl}
                                    onChange={e => setNewUrl(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') addToLibrary(); }}
                                />
                                <label className={styles.addLabel}>Name (optional)</label>
                                <input
                                    className={styles.addInput}
                                    type="text"
                                    placeholder="My writing playlist"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') addToLibrary(); }}
                                />
                                {newUrl && (
                                    <p className={styles.detectedService}>
                                        Detected: {detectService(newUrl)}
                                    </p>
                                )}
                                <div className={styles.addActions}>
                                    <button className={styles.saveBtn} onClick={addToLibrary}>
                                        Save to Library
                                    </button>
                                    {newUrl && (
                                        <button
                                            className={styles.openNowBtn}
                                            onClick={() => openUrl(newUrl, newName || 'playlist')}
                                        >
                                            Open Now ↗
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
