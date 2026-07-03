// src/components/world/WorldBibleFolderTree.tsx
"use client";

import React, { useEffect, useState } from 'react';
import { useWorkspaceStore, EntityType, WorldBibleRootConfig } from '@/store/workspaceStore';
import { getWorldBibleConfig } from '@/lib/worldBibleNav';
import { worldKeyForEntity, STANDALONE_KEY } from '@/lib/worldKey';
import { folderMemberSet } from '@/lib/folderTree';
import styles from './WorldBibleFolderTree.module.css';

const CONFIRM_TIMEOUT_MS = 4000;

const TYPE_ICONS: Record<EntityType, string> = {
    character: '👤', location: '📍', faction: '📦', artifact: '⚔️',
    lore: '🧙', magic: '🔮', religion: '📜', species: '🌿',
};

interface WorldBibleFolderTreeProps {
    /** Draft mode: edits draftHierarchyLayout, folders only (no articles). */
    isDraft?: boolean;
}

/**
 * WorldBibleFolderTree — the Organize view. A standard file-explorer tree:
 * nested folders (add / inline rename / drag to re-nest / two-click delete)
 * with this world's articles filed inside them. Replaces the old free-floating
 * HierarchyCanvas. Drag an article row onto a folder row to re-file it; drag
 * a folder onto another folder to nest it (the store's cycle guard rejects
 * loops). An Unfiled section catches articles without a valid folder.
 */
export default function WorldBibleFolderTree({ isDraft }: WorldBibleFolderTreeProps) {
    const worldBibles = useWorkspaceStore(s => s.worldBibles);
    const activeWorldKey = useWorkspaceStore(s => s.activeWorldKey) ?? STANDALONE_KEY;
    const draftLayout = useWorkspaceStore(s => s.draftHierarchyLayout);
    const entities = useWorkspaceStore(s => s.entities);
    const addWorldBibleRoot = useWorkspaceStore(s => s.addWorldBibleRoot);
    const updateWorldBibleRoot = useWorkspaceStore(s => s.updateWorldBibleRoot);
    const deleteWorldBibleRoot = useWorkspaceStore(s => s.deleteWorldBibleRoot);
    const updateEntity = useWorkspaceStore(s => s.updateEntity);

    const layout = isDraft
        ? (draftLayout ?? { roots: [] })
        : getWorldBibleConfig(worldBibles, activeWorldKey).layout;
    const roots = layout.roots;
    const validIds = new Set(roots.map(r => r.id));

    const worldEntities = isDraft
        ? []
        : entities.filter(e => worldKeyForEntity(e) === activeWorldKey);
    const unfiled = worldEntities.filter(e => !e.categoryId || !validIds.has(e.categoryId));

    // UI state
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const [confirming, setConfirming] = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null); // folder id or '__root__'
    const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

    // Armed deletes auto-disarm (same pattern as the Edit page).
    useEffect(() => {
        if (!confirming) return;
        const t = setTimeout(() => setConfirming(null), CONFIRM_TIMEOUT_MS);
        return () => clearTimeout(t);
    }, [confirming]);

    const toggle = (id: string) =>
        setCollapsed(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });

    const addFolder = (parentId?: string) => {
        addWorldBibleRoot({
            id: crypto.randomUUID(),
            label: 'New Folder',
            icon: '📁',
            entityTypes: [],
            parentId,
        }, isDraft);
        if (parentId) setCollapsed(prev => { const n = new Set(prev); n.delete(parentId); return n; });
    };

    const handleDelete = (id: string) => {
        if (confirming !== id) { setConfirming(id); return; }
        deleteWorldBibleRoot(id, isDraft);
        setConfirming(null);
    };

    /** Shared drop handler for folder rows and the root zone. */
    const handleDrop = (e: React.DragEvent, targetFolderId: string | undefined) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverId(null);
        const entityId = e.dataTransfer.getData('entityId');
        const folderId = e.dataTransfer.getData('folderId');
        if (entityId && targetFolderId !== undefined && !isDraft) {
            updateEntity(entityId, { categoryId: targetFolderId });
        } else if (folderId && folderId !== targetFolderId) {
            // Store cycle guard silently rejects loops.
            updateWorldBibleRoot(folderId, { parentId: targetFolderId }, isDraft);
        }
    };

    /** dragover can't read getData; dataTransfer type keys are lowercased. */
    const acceptsDrag = (e: React.DragEvent, allowArticles: boolean) => {
        const t = e.dataTransfer.types;
        return t.includes('folderid') || (allowArticles && !isDraft && t.includes('entityid'));
    };

    const renderArticleRow = (entity: (typeof worldEntities)[number], depth: number) => (
        <div
            key={entity.id}
            className={`${styles.articleRow} ${selectedArticleId === entity.id ? styles.articleSelected : ''}`}
            style={{ paddingLeft: 34 + depth * 18 }}
            draggable
            onDragStart={(e) => e.dataTransfer.setData('entityId', entity.id)}
            onDragEnd={() => setDragOverId(null)}
            onClick={() => setSelectedArticleId(entity.id)}
        >
            <span className={styles.articleIcon}>{TYPE_ICONS[entity.type]}</span>
            <span className={styles.articleName}>{entity.name}</span>
        </div>
    );

    const renderFolder = (folder: WorldBibleRootConfig, depth: number): React.ReactNode => {
        const children = roots.filter(r => r.parentId === folder.id);
        const articles = worldEntities.filter(e => e.categoryId === folder.id);
        const memberIds = folderMemberSet(roots, folder.id);
        const count = worldEntities.filter(e => e.categoryId && memberIds.has(e.categoryId)).length;
        const isCollapsed = collapsed.has(folder.id);
        const hasContents = children.length > 0 || articles.length > 0;

        return (
            <div key={folder.id}>
                <div
                    className={`${styles.folderRow} ${dragOverId === folder.id ? styles.dropTarget : ''}`}
                    style={{ paddingLeft: 8 + depth * 18 }}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData('folderId', folder.id); }}
                    onDragEnd={() => setDragOverId(null)}
                    onDragOver={(e) => {
                        if (acceptsDrag(e, true)) { e.preventDefault(); e.stopPropagation(); setDragOverId(folder.id); }
                    }}
                    onDragLeave={() => setDragOverId(prev => prev === folder.id ? null : prev)}
                    onDrop={(e) => handleDrop(e, folder.id)}
                >
                    <button
                        className={styles.chevron}
                        onClick={() => toggle(folder.id)}
                        aria-label={isCollapsed ? 'Expand folder' : 'Collapse folder'}
                        disabled={!hasContents}
                    >
                        {hasContents ? (isCollapsed ? '▸' : '▾') : '·'}
                    </button>
                    <span className={styles.folderIcon}>{folder.icon}</span>
                    <input
                        className={styles.folderName}
                        value={folder.label}
                        onChange={(e) => updateWorldBibleRoot(folder.id, { label: e.target.value }, isDraft)}
                        onClick={(e) => e.stopPropagation()}
                    />
                    {!isDraft && <span className={styles.count}>{count}</span>}
                    <div className={styles.rowActions}>
                        <button
                            className={styles.rowBtn}
                            title="Add subfolder"
                            onClick={() => addFolder(folder.id)}
                        >
                            ＋
                        </button>
                        <button
                            className={`${styles.rowBtn} ${confirming === folder.id ? styles.rowBtnDanger : ''}`}
                            title="Delete folder (contents move up)"
                            onClick={() => handleDelete(folder.id)}
                        >
                            {confirming === folder.id ? 'Sure?' : '×'}
                        </button>
                    </div>
                </div>
                {!isCollapsed && (
                    <>
                        {children.map(child => renderFolder(child, depth + 1))}
                        {articles.map(a => renderArticleRow(a, depth))}
                    </>
                )}
            </div>
        );
    };

    const topFolders = roots.filter(r => !r.parentId);

    return (
        <main className={styles.main}>
            <div
                className={`${styles.treePanel} ${dragOverId === '__root__' ? styles.dropTarget : ''}`}
                onDragOver={(e) => {
                    // Root zone accepts folders only (drag out to top level).
                    if (e.dataTransfer.types.includes('folderid')) { e.preventDefault(); setDragOverId('__root__'); }
                }}
                onDragLeave={() => setDragOverId(prev => prev === '__root__' ? null : prev)}
                onDrop={(e) => handleDrop(e, undefined)}
            >
                <div className={styles.header}>
                    <h2 className={styles.title}>{isDraft ? 'Template folders' : 'Organize'}</h2>
                    <button className={styles.newFolderBtn} onClick={() => addFolder(undefined)}>
                        ＋ New folder
                    </button>
                </div>
                <p className={styles.hint}>
                    {isDraft
                        ? 'Design the folder structure — drag folders to nest them.'
                        : 'Drag articles into folders. Drag folders onto each other to nest them.'}
                </p>

                <div className={styles.tree}>
                    {topFolders.map(f => renderFolder(f, 0))}
                    {topFolders.length === 0 && (
                        <p className={styles.empty}>No folders yet — create one to get started.</p>
                    )}
                </div>

                {!isDraft && unfiled.length > 0 && (
                    <div className={styles.unfiled}>
                        <h3 className={styles.unfiledTitle}>Unfiled</h3>
                        <p className={styles.unfiledHint}>Drag these into a folder to file them.</p>
                        {unfiled.map(a => renderArticleRow(a, 0))}
                    </div>
                )}
            </div>
        </main>
    );
}
