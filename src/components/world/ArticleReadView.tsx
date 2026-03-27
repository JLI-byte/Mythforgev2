/**
 * ArticleReadView — Full-width article viewer for the main column.
 * Sprint 48B: Enables reading lore articles in a focused, document-like layout.
 */
"use client";

import { useWorkspaceStore } from '@/store/workspaceStore';
import { ArticleViewer } from './ArticleViewerShared';
import styles from './ArticleReadView.module.css';

interface ArticleReadViewProps {
    entityId: string;
}


export default function ArticleReadView({ entityId }: ArticleReadViewProps) {
    // Store reads
    const entities = useWorkspaceStore(state => state.entities);
    
    // Find the entity
    const entity = entities.find(e => e.id === entityId);
    
    if (!entity) {
        return (
            <div className={styles.readContainer}>
                <div className={styles.emptyState}>
                    <p className={styles.emptyText}>Entity not found.</p>
                </div>
            </div>
        );
    }

    const hasBlocks = entity.articleBlocks && entity.articleBlocks.length > 0;

    return (
        <div className={styles.readContainer}>
            {/* Article Content */}
            <div className={styles.contentArea}>
                {hasBlocks ? (
                    <ArticleViewer blocks={entity.articleBlocks!} />
                ) : (
                    <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>📄</div>
                        <p className={styles.emptyText}>No article yet.</p>
                        <p className={styles.emptyHint}>Switch to Document or World Bible mode to create one.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
