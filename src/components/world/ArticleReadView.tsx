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

interface MentionResult {
  sceneId: string;
  documentId: string;
  documentTitle: string;
  sceneTitle: string;
  excerpt: string;          // ~120 chars of surrounding plain text
  matchIndex: number;       // character offset in plain text for highlight
  matchLength: number;      // length of matched name
}

/**
 * Scans all scenes in a project for mentions of an entity.
 * Checks both EntityMark spans (data-entity-id) and plain text name matches.
 * Returns up to 50 results sorted by document order.
 */
function findEntityMentions(
  entityId: string,
  entityName: string,
  projectId: string,
  scenes: import('@/store/workspaceStore').Scene[],
  documents: import('@/store/workspaceStore').Document[]
): MentionResult[] {
  const results: MentionResult[] = [];
  const projectScenes = scenes.filter(s => s.projectId === projectId);
  const docMap = new Map(documents.map(d => [d.id, d]));

  for (const scene of projectScenes) {
    if (!scene.content) continue;
    const doc = docMap.get(scene.documentId);
    if (!doc) continue;

    // Parse HTML using a temporary div (DOM-based, runs client-side only)
    const parser = typeof window !== 'undefined'
      ? new DOMParser()
      : null;
    if (!parser) continue;

    const dom = parser.parseFromString(scene.content, 'text/html');

    // METHOD A: EntityMark spans
    const taggedSpans = dom.querySelectorAll(`[data-entity-id="${entityId}"]`);
    if (taggedSpans.length > 0) {
      taggedSpans.forEach(span => {
        // Get surrounding text context from the parent paragraph
        const para = span.closest('p, h1, h2, h3, li') || span.parentElement;
        const paraText = para?.textContent || '';
        const spanText = span.textContent || entityName;
        const idx = paraText.indexOf(spanText);
        const start = Math.max(0, idx - 60);
        const end = Math.min(paraText.length, idx + spanText.length + 60);
        const excerpt = (start > 0 ? '…' : '') +
          paraText.slice(start, end) +
          (end < paraText.length ? '…' : '');

        results.push({
          sceneId: scene.id,
          documentId: scene.documentId,
          documentTitle: doc.title,
          sceneTitle: scene.title,
          excerpt,
          matchIndex: idx - start + (start > 0 ? 1 : 0), // account for ellipsis
          matchLength: spanText.length,
        });
      });
    } else {
      // METHOD B: Plain text name search (fallback for untagged mentions)
      const bodyText = dom.body?.textContent || '';
      const nameLower = entityName.toLowerCase();
      const textLower = bodyText.toLowerCase();
      let searchFrom = 0;

      while (searchFrom < textLower.length) {
        const idx = textLower.indexOf(nameLower, searchFrom);
        if (idx === -1) break;
        const start = Math.max(0, idx - 60);
        const end = Math.min(bodyText.length, idx + entityName.length + 60);
        const excerpt = (start > 0 ? '…' : '') +
          bodyText.slice(start, end) +
          (end < bodyText.length ? '…' : '');

        results.push({
          sceneId: scene.id,
          documentId: scene.documentId,
          documentTitle: doc.title,
          sceneTitle: scene.title,
          excerpt,
          matchIndex: idx - start + (start > 0 ? 1 : 0),
          matchLength: entityName.length,
        });
        searchFrom = idx + entityName.length;
        // Cap at 3 plain-text results per scene to avoid flooding
        if (results.filter(r => r.sceneId === scene.id).length >= 3) break;
      }
    }
  }

  return results.slice(0, 50);
}

export default function ArticleReadView({ entityId, onBack }: ArticleReadViewProps) {
  const entities = useWorkspaceStore(state => state.entities);
  const toggleEntityFavorite = useWorkspaceStore(state => state.toggleEntityFavorite);
  const setSelectedEntity = useWorkspaceStore(state => state.setSelectedEntity);
  const scenes = useWorkspaceStore(state => state.scenes);
  const documents = useWorkspaceStore(state => state.documents);
  const setActiveScene = useWorkspaceStore(state => state.setActiveScene);
  const setActiveDocument = useWorkspaceStore(state => state.setActiveDocument);
  const setWorkspaceMode = useWorkspaceStore(state => state.setWorkspaceMode);
  const projects = useWorkspaceStore(state => state.projects);
  const setActiveProject = useWorkspaceStore(state => state.setActiveProject);

  const [activeTab, setActiveTab] = React.useState<'article' | 'mentions'>('article');

  const mentions = React.useMemo(() => {
    if (activeTab !== 'mentions') return [];
    const entity = entities.find(e => e.id === entityId);
    if (!entity) return [];
    return findEntityMentions(
      entity.id,
      entity.name,
      entity.projectId,
      scenes,
      documents
    );
  }, [activeTab, entityId, entities, scenes, documents]);

  const entity = entities.find(e => e.id === entityId);

  const attributedWorks = React.useMemo(() =>
    projects.filter(p => p.attributedEntityId === entityId),
    [projects, entityId]
  );

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

      {/* ── Tab bar ── */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'article' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('article')}
        >
          Article
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'mentions' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('mentions')}
        >
          Mentions
          {mentions.length > 0 && (
            <span className={styles.tabCount}>{mentions.length}</span>
          )}
        </button>
      </div>

      {/* ── Content area ── */}
      {activeTab === 'article' ? (
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
              <p className={styles.emptyHint}>Use the Designer to create a layout, then apply it to this entity.</p>
            </div>
          )}

          {attributedWorks.length > 0 && (
            <div className={styles.worksSection}>
              <h3 className={styles.worksSectionTitle}>Works</h3>
              <div className={styles.worksList}>
                {attributedWorks.map(work => (
                  <button
                    key={work.id}
                    className={styles.workCard}
                    onClick={() => {
                      setActiveProject(work.id);
                      setWorkspaceMode('writing');
                    }}
                  >
                    <div
                      className={styles.workCardStripe}
                      style={{ background: work.coverColor || 'var(--accent)' }}
                    />
                    <div className={styles.workCardInfo}>
                      <span className={styles.workCardName}>{work.name}</span>
                      <span className={styles.workCardMode}>
                        {work.writingMode === 'poetry' ? '✍️ Poetry & Music'
                          : work.writingMode === 'novel' ? '📖 Novel'
                          : work.writingMode === 'screenplay' ? '🎬 Screenplay'
                          : work.writingMode === 'markdown' ? '📝 Markdown'
                          : '📄'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Mentions panel */
        <div className={styles.mentionsPanel}>
          {mentions.length === 0 ? (
            <div className={styles.mentionsEmpty}>
              <span className={styles.mentionsEmptyIcon}>🔍</span>
              <p className={styles.mentionsEmptyText}>
                No mentions of <strong>{entity.name}</strong> found in any scene.
              </p>
              <p className={styles.mentionsEmptyHint}>
                Start writing to see where this entity appears.
              </p>
            </div>
          ) : (
            <div className={styles.mentionsList}>
              <p className={styles.mentionsCount}>
                {mentions.length} mention{mentions.length !== 1 ? 's' : ''} found
              </p>
              {mentions.map((mention, i) => (
                <button
                  key={i}
                  className={styles.mentionCard}
                  onClick={() => {
                    // Navigate to this scene in the writing editor
                    setActiveDocument(mention.documentId);
                    setActiveScene(mention.sceneId);
                    setWorkspaceMode('writing');
                  }}
                >
                  <div className={styles.mentionCardHeader}>
                    <span className={styles.mentionDocTitle}>{mention.documentTitle}</span>
                    <span className={styles.mentionSep}>›</span>
                    <span className={styles.mentionSceneTitle}>{mention.sceneTitle}</span>
                  </div>
                  <p className={styles.mentionExcerpt}>
                    {mention.excerpt.slice(0, mention.matchIndex)}
                    <mark className={styles.mentionHighlight}>
                      {mention.excerpt.slice(
                        mention.matchIndex,
                        mention.matchIndex + mention.matchLength
                      )}
                    </mark>
                    {mention.excerpt.slice(mention.matchIndex + mention.matchLength)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Metadata footer ── */}
      <footer className={styles.metaFooter}>
        <span>Created {new Date(entity.createdAt).toLocaleDateString()}</span>
        {entity.updatedAt && <span>· Updated {new Date(entity.updatedAt).toLocaleDateString()}</span>}
      </footer>
    </div>
  );
}
