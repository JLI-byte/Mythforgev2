"use client";

import React, { useState, useEffect, useRef } from 'react';
import styles from './ShareModal.module.css';
import { ShareCardOptions, generateShareCard } from '@/lib/shareCard';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    shareData: ShareCardOptions;
}

export default function ShareModal({ isOpen, onClose, shareData }: ShareModalProps) {
    const [imageBlob, setImageBlob] = useState<Blob | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [caption, setCaption] = useState('');
    const [isGenerating, setIsGenerating] = useState(true);
    const [copySuccess, setCopySuccess] = useState(false);
    const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 1. Generate the initial caption based on milestone type
    useEffect(() => {
        let initialCaption = '';
        const url = 'https://mythforge.app';

        switch (shareData.milestoneType) {
            case 'badge':
                initialCaption = `Just earned the '${shareData.milestoneValue}' badge! #writing #amwriting`;
                break;
            case 'streak':
                initialCaption = `On a ${shareData.milestoneValue}-day writing streak! #writing #amwriting`;
                break;
            case 'word_count':
                initialCaption = `Hit ${Number(shareData.milestoneValue).toLocaleString()} words on my novel! #writing #amwriting`;
                break;
            case 'session':
                initialCaption = `Just wrote ${Number(shareData.milestoneValue).toLocaleString()} words in one session! #writing #amwriting`;
                break;
            default:
                initialCaption = `Tracking my writing progress on MythForge! #writing #amwriting`;
        }

        setCaption(initialCaption + '\n' + url);
    }, [shareData]);

    // 2. Generate the share card image
    useEffect(() => {
        if (!isOpen) return;

        async function createCard() {
            setIsGenerating(true);
            try {
                const blob = await generateShareCard(shareData);
                setImageBlob(blob);
                const url = URL.createObjectURL(blob);
                setImageUrl(url);
            } catch (err) {
                console.error('Error generating share card:', err);
            } finally {
                setIsGenerating(false);
            }
        }

        createCard();

        return () => {
            if (imageUrl) URL.revokeObjectURL(imageUrl);
        };
    }, [isOpen, shareData]);

    if (!isOpen) return null;

    const handleDownload = () => {
        if (!imageUrl) return;
        const link = document.createElement('a');
        const filename = `mythforge-${shareData.milestoneType}-${shareData.milestoneValue}.png`.toLowerCase().replace(/\s+/g, '-');
        link.href = imageUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleShareTwitter = () => {
        const text = encodeURIComponent(caption);
        window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
    };

    const handleShareBluesky = () => {
        const text = encodeURIComponent(caption);
        window.open(`https://bsky.app/intent/compose?text=${text}`, '_blank');
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText('https://mythforge.app').then(() => {
            setCopySuccess(true);
            if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
            feedbackTimerRef.current = setTimeout(() => setCopySuccess(false), 2000);
        });
    };

    return (
        <div className={styles.backdrop} onClick={onClose}>
            <div className={styles.panel} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>Share Milestone</h2>
                    <button className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>
                </div>

                <div className={styles.content}>
                    <section className={styles.previewSection}>
                        <h3>Card Preview</h3>
                        <div className={styles.previewContainer}>
                            {isGenerating ? (
                                <div className={styles.spinner} />
                            ) : imageUrl ? (
                                <img src={imageUrl} alt="Share Card Preview" className={styles.previewImage} />
                            ) : (
                                <span style={{ color: 'var(--text-muted)' }}>Failed to generate preview</span>
                            )}
                        </div>
                    </section>

                    <section className={styles.captionSection}>
                        <h3>Caption</h3>
                        <textarea
                            className={styles.captionArea}
                            value={caption}
                            onChange={(e) => setCaption(e.target.value)}
                            placeholder="Add a caption..."
                        />
                    </section>

                    <div className={styles.actionGrid}>
                        <button 
                            className={`${styles.actionBtn} ${styles.downloadBtn}`} 
                            onClick={handleDownload}
                            disabled={isGenerating || !imageUrl}
                        >
                            <span>↓</span> Download Image
                        </button>
                        
                        <button 
                            className={`${styles.actionBtn} ${styles.shareBtnX}`}
                            onClick={handleShareTwitter}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                            </svg>
                            Share to X
                        </button>

                        <button 
                            className={`${styles.actionBtn} ${styles.shareBtnBluesky}`}
                            onClick={handleShareBluesky}
                        >
                            <svg width="16" height="16" viewBox="0 0 512 512" fill="currentColor">
                                <path d="M111.8 62.2C170.2 105.9 233.4 186.6 256 241.6c22.6-55 85.8-135.7 144.2-179.4c31.1-23.2 87-43.1 87 14.2c0 11.2-5.4 153.7-8.6 170.2c-12.2 62.9-76 78.1-131.2 66.3c151 32.1 184 125 90.6 182.2c-151.2 89.6-180.8-63.5-182.4-73.4c-0.1 0.4-0.1 0.8-0.2 1.2c-1.7 9.9-31.2 163-182.4 73.4c-93.5-57.2-60.4-150.1 90.6-182.2c-55.2 11.8-119-3.4-131.2-66.3c-3.2-16.5-8.6-159-8.6-170.2c0-57.2 55.9-37.4 87-14.2z"/>
                            </svg>
                            Share to Bluesky
                        </button>

                        <button 
                            className={styles.actionBtn}
                            onClick={handleCopyLink}
                        >
                            <span>🔗</span> Copy Link
                        </button>
                    </div>
                </div>

                <div className={`${styles.copyFeedback} ${copySuccess ? styles.copyFeedbackActive : ''}`}>
                    Link copied to clipboard!
                </div>
            </div>
        </div>
    );
}
