"use client";

import { useState, useMemo } from 'react';
import { useWorkspaceStore, ENTITY_TYPE_LABELS } from '@/store/workspaceStore';
import styles from '../../WritingDesk.module.css';

function formatRelative(date: Date | string): string {
  if (!date) return 'Unknown';
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  if (diff < 172800) return 'Yesterday';
  return d.toLocaleDateString();
}

export function WorldBiblePinRenderer({ content, onChange }: { content: any; onChange: (c: any) => void; }) {
  const entities = useWorkspaceStore(s => s.entities);
  const activeProjectId = useWorkspaceStore(s => s.activeProjectId);
  const [searchTerm, setSearchTerm] = useState('');

  const entityId = content.entityId;
  const entity = useMemo(() => entities.find(e => e.id === entityId), [entities, entityId]);

  const filtered = useMemo(() => {
    if (entityId) return [];
    return entities
      .filter(e => e.projectId === activeProjectId && e.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .slice(0, 15);
  }, [entities, activeProjectId, searchTerm, entityId]);

  if (!entityId) {
    return (
      <div className={styles.biblePinCard}>
        <div className={styles.biblePinSearchWrap}>
          <input
            className={styles.biblePinSearch}
            placeholder="Search entities..."
            autoFocus
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className={styles.biblePinResultList}>
          {filtered.map(e => (
            <button 
              key={e.id} 
              className={styles.biblePinResultItem} 
              onMouseDown={e => e.stopPropagation()}
              onClick={() => onChange({ entityId: e.id, lastUpdatedAt: new Date().toISOString() })}
            >
              <span className={styles.biblePinResultName}>{e.name}</span>
              <span className={styles.biblePinResultType}>{ENTITY_TYPE_LABELS[e.type]}</span>
            </button>
          ))}
          {searchTerm && filtered.length === 0 && <div className={styles.biblePinEmpty}>No matches found.</div>}
          {!searchTerm && filtered.length === 0 && <div className={styles.biblePinEmpty}>Start typing to search...</div>}
        </div>
      </div>
    );
  }

  if (!entity) {
    return (
      <div className={styles.biblePinCard}>
        <div className={styles.biblePinEmpty}>
          <p>Entity deleted or not found.</p>
          <button className={styles.biblePinChangeBtn} 
            onMouseDown={e => e.stopPropagation()}
            onClick={() => onChange({ entityId: null, lastUpdatedAt: null })}
          >
            Clear pin
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.biblePinCard}>
      <div className={styles.biblePinHeader}>
        {entity.imageUrl ? (
          <img src={entity.imageUrl} className={styles.biblePinThumb} />
        ) : (
          <div className={styles.biblePinThumbPlaceholder}>📖</div>
        )}
        <div className={styles.biblePinName}>{entity.name}</div>
        <div className={styles.biblePinBadge}>{ENTITY_TYPE_LABELS[entity.type]}</div>
      </div>
      {entity.subcategory && <div className={styles.biblePinSub}>{entity.subcategory}</div>}
      <div className={styles.biblePinBody}>
        {entity.description && <div className={styles.biblePinDesc}>{entity.description}</div>}
        {entity.customFields && entity.customFields.length > 0 && (
          <div className={styles.biblePinFields}>
            {entity.customFields.slice(0, 5).map((f: any, i: number) => (
              <div key={i} className={styles.biblePinFieldRow}>
                <span className={styles.biblePinFieldLabel}>{f.label}:</span>
                <span className={styles.biblePinFieldValue}>{f.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className={styles.biblePinFooter}>
        <span>Last updated: {formatRelative(entity.updatedAt || entity.createdAt)}</span>
        <button className={styles.biblePinChangeBtn} 
          onMouseDown={e => e.stopPropagation()}
          onClick={() => onChange({ entityId: null, lastUpdatedAt: null })}
        >
          Change
        </button>
      </div>
    </div>
  );
}
