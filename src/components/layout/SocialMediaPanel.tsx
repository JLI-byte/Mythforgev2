"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import styles from './SocialMediaPanel.module.css';
import { useWorkspaceStore, SocialPost } from '@/store/workspaceStore';

interface SocialMediaPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onTabClick: () => void;
    tabWidth: number;
    onTabWidthChange: (width: number) => void;
    panelWidth: number;
    onPanelWidthChange: (width: number) => void;
}

type SocialPlatform = 'x' | 'bluesky' | 'threads' | 'facebook' | 'instagram' | 'reddit' | 'wattpad' | 'royalroad' | 'substack' | 'patreon';

interface PlatformConfig {
    id: SocialPlatform;
    name: string;
    charLimit?: number;
    type: 'social' | 'writing';
    intentUrl?: (text: string) => string;
}

const PLATFORMS: PlatformConfig[] = [
    { id: 'x', name: 'X / Twitter', charLimit: 280, type: 'social', intentUrl: (t) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}` },
    { id: 'bluesky', name: 'Bluesky', charLimit: 300, type: 'social', intentUrl: (t) => `https://bsky.app/intent/compose?text=${encodeURIComponent(t)}` },
    { id: 'threads', name: 'Threads', charLimit: 500, type: 'social', intentUrl: (t) => `https://www.threads.net/intent/post?text=${encodeURIComponent(t)}` },
    { id: 'facebook', name: 'Facebook', type: 'social', intentUrl: () => `https://www.facebook.com/sharer/sharer.php` },
    { id: 'instagram', name: 'Instagram', type: 'social' },
    { id: 'reddit', name: 'Reddit', type: 'social', intentUrl: (t) => `https://www.reddit.com/submit?text=${encodeURIComponent(t)}` },
    { id: 'wattpad', name: 'Wattpad', type: 'writing' },
    { id: 'royalroad', name: 'Royal Road', type: 'writing' },
    { id: 'substack', name: 'Substack', type: 'writing' },
    { id: 'patreon', name: 'Patreon', type: 'writing' },
];

const SocialIcon = ({ id }: { id: SocialPlatform }) => {
    switch (id) {
        case 'x': return <svg viewBox="0 0 24 24" className={styles.serviceIcon}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>;
        case 'bluesky': return <svg viewBox="0 0 24 24" className={styles.serviceIcon}><path d="M12 10.8c-1.087-2.114-4.046-5.053-6.098-5.053C3.402 5.047 2 6.465 2 8.5c0 1.9.8 4.2 4.9 8.2l.2.2c2.022 2.022 3.1 3.1 4.9 3.1 1.8 0 2.878-1.078 4.9-3.1l.2-.2c4.1-4 4.9-6.3 4.9-8.2 0-2.035-1.402-3.453-3.902-3.453-2.052 0-5.011 2.939-6.098 5.053z"/></svg>;
        case 'threads': return <svg viewBox="0 0 24 24" className={styles.serviceIcon}><path d="M14.886 11.011c0 1.054-.367 1.802-.916 2.261-.532.443-1.258.647-1.95.647-.954 0-1.742-.321-2.222-.924-.469-.586-.689-1.428-.689-2.5 0-1.071.21-1.921.681-2.497.48-.588 1.258-.9 2.23-.9 1.481 0 2.866.745 2.866 3.913zm2.502 0c0-6.195-2.062-6.195-5.385-6.195-2.607 0-4.636.568-6.027 1.691-1.391 1.118-2.091 2.812-2.091 5.045 0 2.227.7 3.913 2.091 5.041 1.391 1.123 3.42 1.693 6.027 1.693.308 0 .61-.009.907-.024a10.352 10.352 0 001.272-.11v2.179c-.068.032-.132.065-.194.093l-.403.17c-4.887 1.313-10.158.468-10.158-6.108 0-6.529 5.342-6.529 10.158-6.529.566 0 1.117.012 1.65.034 2.894.133 4.673 1.144 5.293 3.011z"/></svg>;
        case 'facebook': return <svg viewBox="0 0 24 24" className={styles.serviceIcon}><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>;
        case 'instagram': return <svg viewBox="0 0 24 24" className={styles.serviceIcon}><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>;
        case 'reddit': return <svg viewBox="0 0 24 24" className={styles.serviceIcon}><path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm6.67 15.39c.1.4.1.8.1 1.1 0 2.8-3.3 5.1-7.3 5.1s-7.3-2.3-7.3-5.1c0-.4 0-.7.1-1.1-1.1-.4-1.8-1.3-1.8-2.4 0-1.2.9-2.2 2.1-2.5.2-1.7 1.3-3.2 3-4.1l-1-2.4c-.1-.1 0-.3.1-.4.1-.1.2 0 .3.1l2.5 1c.5-.2 1.1-.4 1.7-.5l.4-2.2c0-.1.1-.2.2-.2s.2.1.2.2l.4 2.2c.6 0 1.2.2 1.7.5l2.5-1c.1-.1.2-.1.3-.1.1.1.1.3.1.4l-1 2.4c1.7.9 2.8 2.4 3 4.1 1.2.3 2.1 1.3 2.1 2.5 0 1.1-.7 2-1.8 2.4zm-11.2-3.4c-.8 0-1.5.7-1.5 1.5s.7 1.5 1.5 1.5 1.5-.7 1.5-1.5-.7-1.5-1.5-1.5zm8.4 4.5c-.7.7-1.8 1.2-3.1 1.2s-2.4-.4-3.1-1.2c-.2-.2-.2-.4 0-.6.2-.2.4-.2.6 0 .5.5 1.4.9 2.5.9s2-.4 2.5-.9c.2-.2.4-.2.6 0 .2.2.2.4 0 .6zm-1.5-3c-.8 0-1.5.7-1.5 1.5s.7 1.5 1.5 1.5 1.5-.7 1.5-1.5-.7-1.5-1.5-1.5z"/></svg>;
        case 'wattpad': return <svg viewBox="0 0 24 24" className={styles.serviceIcon}><path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm.23 18.23c-3.18-.08-5.36-1.56-5.36-4.63v-3.79h2.38v3.66c0 1.91 1 2.55 2.16 2.55s1.95-.62 1.95-1.99v-4.22h2.38v4.36c0 2.2-.66 4.06-3.51 4.06zM9.25 6.04h5.5v2.38h-5.5V6.04z"/></svg>;
        case 'royalroad': return <svg viewBox="0 0 24 24" className={styles.serviceIcon}><path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm6.2 16h-12.4l.6-1.4 1.4-1.6v-5l2-2h4.4l2 2v5l1.4 1.6.6 1.4zm-6.2-13.4c-.6 0-1.1.5-1.1 1.1s.5 1.1 1.1 1.1 1.1-.5 1.1-1.1-.5-1.1-1.1-1.1z"/></svg>;
        case 'substack': return <svg viewBox="0 0 24 24" className={styles.serviceIcon}><path d="M22.539 8.242H1.46V5.406h21.078v2.836zM1.46 10.812V24l10.539-6.035L22.539 24V10.812H1.46zM22.539 0H1.46v2.836h21.078V0z"/></svg>;
        case 'patreon': return <svg viewBox="0 0 24 24" className={styles.serviceIcon}><path d="M22.957 7.21c-.004-3.046-2.47-5.512-5.517-5.516-3.046 0-5.512 2.47-5.516 5.516 0 3.047 2.47 5.512 5.516 5.517 3.047 0 5.512-2.47 5.517-5.516zm-17.433-5.517h-2.14v19.462h2.14V1.693z"/></svg>;
        default: return null;
    }
}

export function SocialMediaPanel({ isOpen, onClose, onTabClick, tabWidth, onTabWidthChange, panelWidth, onPanelWidthChange }: SocialMediaPanelProps) {
    const [mounted, setMounted] = useState(false);
    const tabRef = React.useRef<HTMLButtonElement>(null);
    const [tabHeight, setTabHeight] = useState(0);

    const [activeTab, setActiveTab] = useState<SocialPlatform>('x');
    const [draftText, setDraftText] = useState('');
    const [toastMsg, setToastMsg] = useState('');

    const showToast = (msg: string) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(''), 2500);
    };
    
    const socialHistory = useWorkspaceStore(state => state.socialHistory);
    const addSocialPost = useWorkspaceStore(state => state.addSocialPost);
    const streakState = useWorkspaceStore(state => state.streakState);
    const sessionWordCount = useWorkspaceStore(state => state.sessionWordCount);
    const projects = useWorkspaceStore(state => state.projects);
    const activeProjectId = useWorkspaceStore(state => state.activeProjectId);

    const activeProject = projects.find(p => p.id === activeProjectId);
    const platform = PLATFORMS.find(p => p.id === activeTab)!;

    useEffect(() => { setMounted(true); }, []);

    const charCount = draftText.length;
    const isOverLimit = platform.charLimit ? charCount > platform.charLimit : false;

    const generateTemplate = (type: 'milestone' | 'streak' | 'session') => {
        let text = "";
        const projectName = activeProject?.name || "my project";
        
        if (type === 'milestone') {
            text = `Milestone reached! Just hit ${streakState.totalWordsAllTime.toLocaleString()} words in ${projectName}! 🚀 #LoreCanvas #Writing`;
        } else if (type === 'streak') {
            text = `Writing streak: ${streakState.currentStreak} days! 🔥 Keeping the momentum going in ${projectName}. #WritingCommunity`;
        } else if (type === 'session') {
            text = `Just finished a writing session! Added ${sessionWordCount} words to ${projectName}. Feeling productive! ✍️`;
        }
        setDraftText(text);
    };

    const handlePost = () => {
        if (!draftText.trim()) return;

        // Record locally
        addSocialPost({ platform: activeTab, content: draftText });

        // Bridge to platform
        if (platform.intentUrl) {
            window.open(platform.intentUrl(draftText), '_blank');
        } else {
            // Copy and open base site
            navigator.clipboard.writeText(draftText);
            const urls: Record<string, string> = {
                instagram: 'https://instagram.com',
                wattpad: 'https://wattpad.com',
                royalroad: 'https://royalroad.com',
                substack: 'https://substack.com',
                patreon: 'https://patreon.com'
            };
            if (urls[activeTab]) window.open(urls[activeTab], '_blank');
            showToast(`Copied! Opening ${platform.name}...`);
        }
    };

    const copyMarkdown = () => {
        const markdown = `### Project Update: ${activeProject?.name || 'LoreCanvas Project'}\n\n${draftText}\n\n*Sent via LoreCanvas*`;
        navigator.clipboard.writeText(markdown);
        showToast("Markdown update copied!");
    };

    return (
        <>
            {mounted && createPortal(
                <button
                    className={`${styles.sideTab} ${isOpen ? styles.sideTabActive : ''}`}
                    style={{
                        width: tabWidth,
                        right: isOpen ? panelWidth : 0,
                        top: 308,
                        transition: 'right 280ms cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                    onClick={onTabClick}
                    title="Social Media Hub"
                >
                    <div className={styles.dragHandle} onMouseDown={(e) => {
                        e.preventDefault();
                        const startX = e.clientX;
                        const startWidth = tabWidth;
                        const onMouseMove = (moveEvent: MouseEvent) => {
                            const delta = startX - moveEvent.clientX;
                            onTabWidthChange(Math.min(120, Math.max(44, startWidth + delta)));
                        };
                        const onMouseUp = () => {
                            document.removeEventListener('mousemove', onMouseMove);
                            document.removeEventListener('mouseup', onMouseUp);
                        };
                        document.addEventListener('mousemove', onMouseMove);
                        document.addEventListener('mouseup', onMouseUp);
                    }} />
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                        <polyline points="16 6 12 2 8 6" />
                        <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                    <span className={styles.sideTabLabel}>Social</span>
                </button>,
                document.body
            )}

            {mounted && isOpen && createPortal(
                <button
                    className={styles.ghostTab}
                    style={{ 
                        width: tabWidth, 
                        height: 130,
                        top: 308,
                        right: 0,
                    }}
                    onClick={onClose}
                    title="Close Panel"
                >
                    <span className={styles.ghostTabArrow}>▸</span>
                </button>,
                document.body
            )}

            <div className={`${styles.panel} ${isOpen ? styles.open : ''}`} style={{ width: panelWidth }} // A closed panel is only pushed off-screen, not unmounted — without this it
                // keeps its tab stops and stays in the accessibility tree.
                inert={!isOpen}>
                <div className={styles.panelInner}>
                    <div className={styles.panelResizeHandle} onMouseDown={(e) => {
                        e.preventDefault();
                        const startX = e.clientX;
                        const startWidth = panelWidth;
                        const onMouseMove = (moveEvent: MouseEvent) => {
                            onPanelWidthChange(Math.max(300, startWidth + (startX - moveEvent.clientX)));
                        };
                        const onMouseUp = () => {
                            document.removeEventListener('mousemove', onMouseMove);
                            document.removeEventListener('mouseup', onMouseUp);
                        };
                        document.addEventListener('mousemove', onMouseMove);
                        document.addEventListener('mouseup', onMouseUp);
                    }} />
                    
                    <div className={styles.header} style={{ paddingRight: tabWidth }}>
                        <h2 className={styles.title}>
                            Social Media Hub
                        </h2>
                        <button className={styles.closeBtn} onClick={onClose}>&times;</button>
                    </div>

                    <div className={styles.serviceBar} style={{ paddingRight: tabWidth }}>
                        {PLATFORMS.map(p => (
                            <button 
                                key={p.id}
                                className={`${styles.serviceTab} ${activeTab === p.id ? styles.serviceTabActive : ''}`}
                                onClick={() => setActiveTab(p.id)}
                            >
                                <SocialIcon id={p.id} />
                                {p.name}
                            </button>
                        ))}
                    </div>

                    <div className={styles.content} style={{ paddingRight: tabWidth }}>
                        <div className={styles.composeArea}>
                            <div className={styles.composeHeader}>
                                <span className={styles.composeTitle}>Draft Update for {platform.name}</span>
                                {platform.charLimit && (
                                    <span className={`${styles.charCount} ${isOverLimit ? styles.error : (charCount > platform.charLimit * 0.9 ? styles.warning : '')}`}>
                                        {charCount} / {platform.charLimit}
                                    </span>
                                )}
                            </div>

                            <textarea 
                                className={styles.textArea}
                                placeholder="What's happening in your story?..."
                                value={draftText}
                                onChange={(e) => setDraftText(e.target.value)}
                            />

                            <div className={styles.templateBar}>
                                <button className={styles.templateBtn} onClick={() => generateTemplate('milestone')}>Milestone</button>
                                <button className={styles.templateBtn} onClick={() => generateTemplate('streak')}>Streak</button>
                                <button className={styles.templateBtn} onClick={() => generateTemplate('session')}>Session</button>
                            </div>

                            <div className={styles.actionRow}>
                                <button className={styles.primaryAction} onClick={handlePost}>
                                    Open & Post
                                </button>
                                <button className={styles.secondaryAction} title="Copy as Markdown" onClick={copyMarkdown}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h10"/></svg>
                                </button>
                                <button className={styles.secondaryAction} title="Copy Text" onClick={() => { navigator.clipboard.writeText(draftText); showToast("Draft copied!"); }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                </button>
                            </div>
                        </div>

                        {toastMsg && (
                            <div className={styles.toast}>
                                {toastMsg}
                            </div>
                        )}

                        <div className={styles.loginBridge}>
                            <span className={styles.bridgeHint}>Not signed in to {platform.name}?</span>
                            <button className={styles.secondaryAction} onClick={() => window.open(`https://www.${activeTab === 'x' ? 'twitter' : activeTab}.com`, '_blank')}>
                                Go to {platform.name}
                            </button>
                        </div>

                        <div className={styles.historySection}>
                            <h3 className={styles.historyTitle}>Recent Updates</h3>
                            {socialHistory.length === 0 ? (
                                <div className={styles.bridgeHint}>No posts shared yet.</div>
                            ) : (
                                socialHistory.map(post => (
                                    <div key={post.id} className={styles.historyItem}>
                                        <div className={styles.historyHeader}>
                                            <span className={styles.historyPlatform}>{post.platform}</span>
                                            <span className={styles.historyDate}>{new Date(post.timestamp).toLocaleDateString()}</span>
                                        </div>
                                        <div className={styles.historyContent}>{post.content}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
