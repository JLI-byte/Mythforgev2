"use client";

import React, { useState } from 'react';
import styles from './SpotifyPlayer.module.css';
import { useWorkspaceStore } from '@/store/workspaceStore';

export function SpotifyPlayer() {
    const spotifyUrl = useWorkspaceStore((state) => state.spotifyUrl);
    const isSpotifyOpen = useWorkspaceStore((state) => state.isSpotifyOpen);
    const setSpotifyUrl = useWorkspaceStore((state) => state.setSpotifyUrl);
    const setSpotifyOpen = useWorkspaceStore((state) => state.setSpotifyOpen);

    const [isEditing, setIsEditing] = useState(false);
    const [draftUrl, setDraftUrl] = useState(spotifyUrl || "");

    // We only want to show the input if the user is explicitly editing,
    // or if they haven't set a URL yet but they've opened the player.
    const showInput = isEditing || !spotifyUrl;

    // Parse the Spotify URL into an embedable iframe src
    // Example: https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M
    // Embed: https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M?utm_source=generator
    const getEmbedUrl = (url: string) => {
        if (!url) return null;
        try {
            const urlObj = new URL(url);
            if (urlObj.hostname !== 'open.spotify.com') return null;

            const path = urlObj.pathname; // e.g. /playlist/12345
            return `https://open.spotify.com/embed${path}?utm_source=generator&theme=0`;
        } catch {
            return null; // Invalid URL string
        }
    };

    const handleSaveUrl = () => {
        const embed = getEmbedUrl(draftUrl);
        if (embed || draftUrl.trim() === "") {
            setSpotifyUrl(draftUrl.trim() === "" ? null : draftUrl);
            setIsEditing(false);
        } else {
            alert("Please paste a valid open.spotify.com link (Playlist, Album, or Track).");
        }
    };

    if (!isSpotifyOpen) {
        return (
            <button
                className={styles.collapsedBtn}
                onClick={() => setSpotifyOpen(true)}
                title="Open Spotify Player"
            >
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.84.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.6.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.56.3z" />
                </svg>
            </button>
        );
    }

    const embedUrl = spotifyUrl ? getEmbedUrl(spotifyUrl) : null;

    return (
        <div className={styles.playerContainer}>
            <div className={styles.playerHeader}>
                <div className={styles.headerControls}>
                    <button
                        className={styles.iconBtn}
                        onClick={() => setSpotifyOpen(false)}
                        title="Minimize"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </button>
                    <span className={styles.headerTitle}>Spotify</span>
                </div>
                {spotifyUrl && !isEditing && (
                    <button
                        className={styles.editBtn}
                        onClick={() => setIsEditing(true)}
                    >
                        Edit URL
                    </button>
                )}
            </div>

            <div className={styles.playerContent}>
                {showInput ? (
                    <div className={styles.inputState}>
                        <p className={styles.helpText}>Paste a Spotify Playlist, Album, or Track link:</p>
                        <input
                            type="text"
                            value={draftUrl}
                            onChange={(e) => setDraftUrl(e.target.value)}
                            placeholder="https://open.spotify.com/playlist/..."
                            className={styles.urlInput}
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveUrl();
                            }}
                        />
                        <div className={styles.actions}>
                            {spotifyUrl && (
                                <button className={styles.cancelBtn} onClick={() => {
                                    setIsEditing(false);
                                    setDraftUrl(spotifyUrl);
                                }}>
                                    Cancel
                                </button>
                            )}
                            <button className={styles.saveBtn} onClick={handleSaveUrl}>
                                Save
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className={styles.iframeWrapper}>
                        {embedUrl ? (
                            <iframe
                                src={embedUrl}
                                width="100%"
                                height="352"
                                frameBorder="0"
                                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                                loading="lazy"
                            ></iframe>
                        ) : (
                            <div className={styles.errorState}>Invalid Spotify URL</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
