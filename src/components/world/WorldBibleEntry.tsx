/**
 * WorldBibleEntry — Article view for a single entity
 *
 * Sprint 46B: Full-width entry view with hero image area,
 * favorite/edit controls, description, custom fields,
 * image upload, and metadata footer.
 */
"use client";

import React, { useState, useRef } from 'react';
import styles from './WorldBibleEntry.module.css';
import { useWorkspaceStore, EntityType } from '@/store/workspaceStore';
import { WBView, SUBCATEGORY_LABELS, SUBCATEGORY_ICONS } from '@/lib/worldBibleNav';
import { ArticleViewer } from './ArticleViewerShared';

interface WorldBibleEntryProps {
    entityId: string;
    onNavigate: (view: WBView) => void;
}

/** Background colors per entity type for hero area fallback */
const ENTITY_TYPE_COLORS: Record<EntityType, string> = {
    character: '#4A6FA5',
    faction: '#6B4C9A',
    location: '#2E8B57',
    artifact: '#C0392B',
    lore: '#D46A1A',
};

export default function WorldBibleEntry({ entityId, onNavigate }: WorldBibleEntryProps) {
    const entities = useWorkspaceStore(state => state.entities);
    const toggleEntityFavorite = useWorkspaceStore(state => state.toggleEntityFavorite);
    const updateEntityImage = useWorkspaceStore(state => state.updateEntityImage);
    const updateEntity = useWorkspaceStore(state => state.updateEntity);
    const setSelectedEntity = useWorkspaceStore(state => state.setSelectedEntity);
    const setFocusedArticleEntity = useWorkspaceStore(state => state.setFocusedArticleEntity);

    // Custom field inline form state
    const [addingField, setAddingField] = useState(false);
    const [fieldLabel, setFieldLabel] = useState('');
    const [fieldValue, setFieldValue] = useState('');

    // Hidden file input ref for image upload
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Derive entity from store
    const entity = entities.find(e => e.id === entityId);

    // Not found fallback
    if (!entity) {
        return (
            <div className={styles.notFound}>
                <p>Entry not found</p>
                <button
                    className={styles.backBtn}
                    onClick={() => onNavigate({ level: 'home' })}
                >
                    ← Back to Home
                </button>
            </div>
        );
    }

    const typeColor = ENTITY_TYPE_COLORS[entity.type];
    const typeIcon = SUBCATEGORY_ICONS[entity.type];
    const typeLabel = SUBCATEGORY_LABELS[entity.type];

    /** Handle image file selection — read as base64 and persist */
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                updateEntityImage(entity.id, reader.result);
            }
        };
        reader.readAsDataURL(file);
    };

    /** Add a custom field to the entity */
    const handleAddField = () => {
        if (!fieldLabel.trim() || !fieldValue.trim()) return;
        const existing = entity.customFields ?? [];
        updateEntity(entity.id, {
            customFields: [...existing, { label: fieldLabel.trim(), value: fieldValue.trim() }],
        });
        setFieldLabel('');
        setFieldValue('');
        setAddingField(false);
    };

    /** Remove a custom field by index */
    const handleRemoveField = (index: number) => {
        const existing = entity.customFields ?? [];
        updateEntity(entity.id, {
            customFields: existing.filter((_, i) => i !== index),
        });
    };

    return (
        <div className={styles.entryContainer}>

            {/* === Hero image area (200px tall) === */}
            <div
                className={styles.heroImage}
                style={entity.imageUrl
                    ? {
                        backgroundImage: `url(${entity.imageUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                    }
                    : { backgroundColor: typeColor }
                }
            >
                {/* Fallback icon when no image */}
                {!entity.imageUrl && (
                    <span className={styles.heroIcon}>{typeIcon}</span>
                )}

                {/* Gradient overlay with entity name */}
                <div className={styles.heroOverlay}>
                    <span className={styles.heroName}>{entity.name}</span>
                </div>

                {/* Top-right controls: favorite + edit */}
                <div className={styles.heroControls}>
                    <button
                        className={`${styles.heroBtn} ${entity.isFavorite ? styles.heroBtnFavActive : ''}`}
                        onClick={() => toggleEntityFavorite(entity.id)}
                        title={entity.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                        ⭐
                    </button>
                    <button
                        className={styles.heroBtn}
                        onClick={() => setSelectedEntity(entity.id)}
                        title="Edit entity"
                    >
                        ✏️
                    </button>
                    {/* Opens article in the center column — editing happens in ArticleReadView, not inline */}
                    <button
                        className={styles.heroBtn}
                        onClick={() => setFocusedArticleEntity(entity.id)}
                        title={entity.articleBlocks && entity.articleBlocks.length > 0 ? "Edit article in main view" : "Open article editor in main view"}
                    >
                        📄 {entity.articleBlocks && entity.articleBlocks.length > 0 ? "Edit Article" : "Write Article"}
                    </button>
                </div>
            </div>

            {/* === Image upload button === */}
            <button
                className={styles.uploadBtn}
                onClick={() => fileInputRef.current?.click()}
            >
                📷 Change image
            </button>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className={styles.hiddenInput}
                onChange={handleImageUpload}
            />

            {/* === Info section === */}
            <div className={styles.infoSection}>
                {/* Type badge */}
                <span
                    className={styles.typeBadge}
                    style={{ backgroundColor: `${typeColor}33`, color: typeColor }}
                >
                    {typeLabel}
                </span>

                {/* --- Conditional Content: Article vs Summary --- */}
                {entity.articleBlocks && entity.articleBlocks.length > 0 ? (
                    <ArticleViewer blocks={entity.articleBlocks} />
                ) : (
                    <>
                        {/* Description */}
                        {entity.description ? (
                            <p className={styles.description}>{entity.description}</p>
                        ) : (
                            <p className={styles.descriptionEmpty}>No description yet</p>
                        )}
                    </>
                )}
            </div>

            {/* --- Custom fields section (only if no article) --- */}
            {(!entity.articleBlocks || entity.articleBlocks.length === 0) && (
                <div className={styles.fieldsSection}>
                <div className={styles.fieldsHeader}>
                    <span className={styles.fieldsTitle}>Details</span>
                    <button
                        className={styles.addFieldBtn}
                        onClick={() => setAddingField(true)}
                    >
                        + Add Field
                    </button>
                </div>

                {/* Existing custom fields */}
                {(entity.customFields ?? []).map((field, index) => (
                    <div key={index} className={styles.fieldRow}>
                        <span className={styles.fieldLabel}>{field.label}</span>
                        <span className={styles.fieldValue}>{field.value}</span>
                        <button
                            className={styles.fieldRemoveBtn}
                            onClick={() => handleRemoveField(index)}
                            title="Remove field"
                        >
                            ×
                        </button>
                    </div>
                ))}

                {/* Inline add field form */}
                {addingField && (
                    <div className={styles.addFieldForm}>
                        <input
                            type="text"
                            placeholder="Label"
                            value={fieldLabel}
                            onChange={e => setFieldLabel(e.target.value)}
                            className={styles.addFieldInput}
                            autoFocus
                        />
                        <input
                            type="text"
                            placeholder="Value"
                            value={fieldValue}
                            onChange={e => setFieldValue(e.target.value)}
                            className={styles.addFieldInput}
                        />
                        <button className={styles.addFieldConfirm} onClick={handleAddField}>✓</button>
                        <button className={styles.addFieldCancel} onClick={() => { setAddingField(false); setFieldLabel(''); setFieldValue(''); }}>×</button>
                    </div>
                )}
            </div>
            )}

            {/* === Metadata footer === */}
            <footer className={styles.metaFooter}>
                <span>Created {entity.createdAt.toLocaleDateString()}</span>
                {entity.updatedAt && (
                    <span>Updated {entity.updatedAt.toLocaleDateString()}</span>
                )}
            </footer>

        </div>
    );
}


