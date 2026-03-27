/**
 * Sprint 48B extraction — shared between WorldBibleEntry and ArticleReadView
 */
import React from 'react';
import { ArticleBlock } from '@/store/workspaceStore';
import styles from './WorldBibleEntry.module.css';

/**
 * ArticleViewer — Read-only renderer for article blocks.
 */
export function ArticleViewer({ blocks }: { blocks: ArticleBlock[] }) {
    return (
        <div className={styles.articleViewer}>
            {blocks.slice().sort((a, b) => (a.y ?? 0) - (b.y ?? 0)).map(block => (
                <div key={block.id} className={styles.viewerBlock}>
                    <ViewerBlockRenderer block={block} />
                </div>
            ))}
        </div>
    );
}

/** 
 * Routes read-only block rendering
 */
export function ViewerBlockRenderer({ block }: { block: ArticleBlock }) {
    const { type, content } = block;

    switch (type) {
        case 'richtext':
            return (
                <div 
                    className={styles.viewerRichtext}
                    dangerouslySetInnerHTML={{ __html: content.html || '' }} 
                />
            );
        case 'image':
            return (
                <figure className={styles.viewerFigure}>
                    {content.src && <img src={content.src} alt={content.caption || ''} />}
                    {content.caption && <figcaption className={styles.viewerCaption}>{content.caption}</figcaption>}
                </figure>
            );
        case 'statrow':
            return (
                <div className={styles.viewerStatRow}>
                    <span className={styles.viewerStatLabel}>{content.label}</span>
                    <span className={styles.viewerStatValue}>{content.value}</span>
                </div>
            );
        case 'divider':
            return <hr className={styles.viewerDivider} />;
        case 'quote':
            return (
                <blockquote className={styles.viewerQuote}>
                    <p>{content.text}</p>
                    {content.attribution && <cite>— {content.attribution}</cite>}
                </blockquote>
            );
        case 'timeline':
            return (
                <div className={styles.viewerTimeline}>
                    {(content.events || []).map((event: any, i: number) => (
                        <div key={i} className={styles.viewerTimelineEvent}>
                            <div className={styles.viewerTimelineSidebar}>
                                <div className={styles.viewerTimelineDot} />
                                <div className={styles.viewerTimelineLine} />
                            </div>
                            <div className={styles.viewerEventContent}>
                                <div className={styles.viewerEventHeader}>
                                    <span className={styles.viewerEventDate}>{event.date}</span>
                                    <span className={styles.viewerEventLabel}>{event.label}</span>
                                </div>
                                {event.detail && <p className={styles.viewerEventDetail}>{event.detail}</p>}
                            </div>
                        </div>
                    ))}
                </div>
            );
        default:
            return null;
    }
}
