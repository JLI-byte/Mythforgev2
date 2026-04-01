"use client";

import React from 'react';
import { useWorkspaceStore, EntityType } from '@/store/workspaceStore';
import { SUBCATEGORY_LABELS, SUBCATEGORY_ICONS } from '@/lib/worldBibleNav';
import { ArticleTabViewer } from './ArticleViewerShared';
import styles from './ArticleReadView.module.css';

interface ArticleReadViewProps {
  entityId: string;
  onBack: () => void;
}

const ENTITY_TYPE_COLORS: Record<EntityType, string> = {
  character: '#4A6FA5',
  faction: '#6B4C9A',
  location: '#2E8B57',
  artifact: '#C0392B',
  lore: '#D46A1A',
  magic: '#9B59B6',
  religion: '#F1C40F',
  species: '#27AE60',
};

export default function ArticleReadView({ entityId, onBack }: ArticleReadViewProps) {
  const entities = useWorkspaceStore(state => state.entities);
  const toggleEntityFavorite = useWorkspaceStore(state => state.toggleEntityFavorite);
  const setSelectedEntity = useWorkspaceStore(state => state.setSelectedEntity);

  const entity = entities.find(e => e.id === entityId);

  if (!entity) {
    return (
      <div className={styles.readContainer}>
        <button className={styles.backBtn} onClick={onBack}>← Back</button>
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>Entity not found.</p>
        </div>
      </div>
    );
  }

  const typeColor = ENTITY_TYPE_COLORS[entity.type];
  const typeIcon = SUBCATEGORY_ICONS[entity.type];
  const typeLabel = SUBCATEGORY_LABELS[entity.type];
  const hasArticle = !!entity.articleDoc;
  const hasDescription = !!entity.description;

  return (
    <div className={styles.readContainer}>
      {/* ── Back bar ── */}
      <div className={styles.backBar}>
        <button className={styles.backBtn} onClick={onBack}>← World Bible</button>
        <div className={styles.backBarActions}>
          <button
            className={`${styles.actionBtn} ${entity.isFavorite ? styles.actionBtnActive : ''}`}
            onClick={() => toggleEntityFavorite(entity.id)}
            title={entity.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            {entity.isFavorite ? '⭐' : '☆'}
          </button>
          <button
            className={styles.actionBtn}
            onClick={() => setSelectedEntity(entity.id)}
            title="Edit entity details"
          >
            ✏️ Edit Details
          </button>
        </div>
      </div>

      {/* ── Hero area ── */}
      <div
        className={styles.heroArea}
        style={entity.imageUrl
          ? { backgroundImage: `url(${entity.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { backgroundColor: typeColor }
        }
      >
        {!entity.imageUrl && (
          <span className={styles.heroIcon}>{typeIcon}</span>
        )}
        <div className={styles.heroOverlay}>
          <div className={styles.heroMeta}>
            <span className={styles.typeBadge} style={{ backgroundColor: `${typeColor}cc` }}>
              {typeIcon} {typeLabel}
            </span>
            <h1 className={styles.heroName}>{entity.name}</h1>
            {entity.subcategory && (
              <span className={styles.heroSubcategory}>{entity.subcategory}</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Article content ── */}
      <div className={styles.contentArea}>
        {hasArticle ? (
          <ArticleTabViewer articleDoc={entity.articleDoc} />
        ) : hasDescription ? (
          <div className={styles.fallbackContent}>
            <p className={styles.description}>{entity.description}</p>
            {(entity.customFields ?? []).length > 0 && (
              <div className={styles.customFields}>
                {(entity.customFields ?? []).map((field, i) => (
                  <div key={i} className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>{field.label}</span>
                    <span className={styles.fieldValue}>{field.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📄</div>
            <p className={styles.emptyText}>No article yet</p>
            <p className={styles.emptyHint}>Use the Template Designer to create a layout, then apply it to this entity.</p>
          </div>
        )}
      </div>

      {/* ── Metadata footer ── */}
      <footer className={styles.metaFooter}>
        <span>Created {new Date(entity.createdAt).toLocaleDateString()}</span>
        {entity.updatedAt && <span>· Updated {new Date(entity.updatedAt).toLocaleDateString()}</span>}
      </footer>
    </div>
  );
}
