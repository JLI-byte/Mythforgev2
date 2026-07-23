"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useWorkspaceStore, EntityType, WorldBibleRootConfig } from '@/store/workspaceStore';
import { getWorldBibleConfig, SUBCATEGORY_LABELS, SUBCATEGORY_ICONS } from '@/lib/worldBibleNav';
import { sanitizeLabel } from '@/lib/sanitize';
import { worldKeyForEntity, STANDALONE_KEY } from '@/lib/worldKey';
import { folderMemberSet } from '@/lib/folderTree';
import ArticleView from './ArticleView';

import styles from './WorldBibleCenter.module.css';

/**
 * WorldBibleCenter — Recursive folder browser for the center column.
 *
 * SPRINT 73 REDESIGN — alternating drill-down:
 * Every folder level renders its child folders as strips. The strip
 * orientation flips each level (vertical → horizontal → vertical …) until
 * a folder holds no more sub-folders, at which point its articles show as
 * cards. Loose articles filed directly beside sub-folders collect into an
 * auto "Uncategorized" strip (only when some exist). A breadcrumb along the
 * top replaces the level as you drill; there is no pinned rail.
 *
 * A folder commits to one kind of child on first creation: add a folder and
 * it becomes a sub-category level (article creation hidden); add an article
 * and it becomes an article leaf (folder creation hidden). An empty folder
 * offers both.
 *
 * Drill transition — one choreography, two orientations (matching the
 * clicked strip's shape, so it alternates with depth):
 *   1. grow — a clean white-frost clone lifts from the clicked strip
 *             (which hides) and fills the level WHILE its charcoal corner
 *             pieces sweep back in from top-left and bottom-right. Both
 *             land together: card full size, pieces sealed on the skewed
 *             seam (near-vertical on column levels, near-horizontal on
 *             row levels).
 *   2. split — the sealed card cracks along that seam; the solid halves
 *              retreat toward their corners, revealing the next level
 *              rising from behind. The viewer descends one layer per drill.
 */

/** Sentinel path segment for the auto "Uncategorized" strip. */
const UNCAT = '__uncat__';

/** Fixed hues for the default top-level folders; deeper folders cycle the palette. */
const KNOWN_STRIP_COLORS: Record<string, string> = {
    people: '#2f5075',
    places: '#2f6b4a',
    things: '#8c3d33',
    world: '#5b4483',
};
const STRIP_PALETTE = ['#2f5075', '#2f6b4a', '#8c3d33', '#5b4483', '#7a5a2e', '#356b6b', '#803a5b', '#4a5568'];

const UNCAT_COLOR = '#3a3a44';

type CreateMode = 'none' | 'folder' | 'article';

/** Drill transition: paint clone at strip size → grow to fill while the
 *  corner pieces close on the seam → commit the navigation and split. */
interface ZoomState {
    path: string[];
    icon: string;
    label: string;
    sourceId: string;
    /** Seam orientation — 'v' on column levels, 'h' on row levels. */
    dir: 'v' | 'h';
    tx: number;
    ty: number;
    sx: number;
    sy: number;
    phase: 'init' | 'grow' | 'split';
}

export default function WorldBibleCenter() {
    const entities = useWorkspaceStore(state => state.entities);
    const activeProjectId = useWorkspaceStore(state => state.activeProjectId);
    const worldBibles = useWorkspaceStore(state => state.worldBibles);
    const activeWorldKey = useWorkspaceStore(state => state.activeWorldKey) ?? STANDALONE_KEY;
    const addWorldBibleRoot = useWorkspaceStore(state => state.addWorldBibleRoot);
    const addEntity = useWorkspaceStore(state => state.addEntity);

    const layout = getWorldBibleConfig(worldBibles, activeWorldKey).layout;

    // Drill-down stack. [] = top categories. Each entry is a folder id (or the
    // UNCAT sentinel for an auto "Uncategorized" leaf).
    const [folderPath, setFolderPath] = useState<string[]>([]);
    const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

    // Inline creation, scoped to the folder being viewed.
    const [createMode, setCreateMode] = useState<CreateMode>('none');
    const [draftName, setDraftName] = useState('');
    const [draftType, setDraftType] = useState<EntityType>('lore');

    // A folder can carry several entity types; custom folders carry none, so
    // fall back to a generic 'lore' article.
    const effectiveTypes = (folder: WorldBibleRootConfig): EntityType[] =>
        folder.entityTypes.length ? folder.entityTypes : ['lore'];

    const drillTo = (path: string[]) => {
        setFolderPath(path);
        setCreateMode('none');
        setDraftName('');
    };

    // The wrapper (levelRef) persists across level swaps so the clone/halves
    // keep covering the screen while the new level mounts beneath them.
    // `phase` walks init → grow → close → split; the init frame paints the
    // clone at strip size before the grow starts.
    const levelRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState<ZoomState | null>(null);

    useEffect(() => {
        if (zoom?.phase !== 'init') return;
        const id = requestAnimationFrame(() =>
            requestAnimationFrame(() => setZoom(z => (z ? { ...z, phase: 'grow' } : z)))
        );
        return () => cancelAnimationFrame(id);
    }, [zoom?.phase]);

    const zoomInto = (
        e: React.MouseEvent<HTMLElement>,
        path: string[],
        icon: string,
        label: string,
        sourceId: string,
    ) => {
        if (zoom) return; // ignore clicks mid-transition
        const container = levelRef.current;
        if (!container) { drillTo(path); return; }
        const cRect = container.getBoundingClientRect();
        const sRect = e.currentTarget.getBoundingClientRect();
        setZoom({
            path, icon, label, sourceId,
            dir: folderPath.length % 2 === 0 ? 'v' : 'h', // seam matches the strip's shape
            tx: sRect.left - cRect.left,
            ty: sRect.top - cRect.top,
            sx: sRect.width / cRect.width,
            sy: sRect.height / cRect.height,
            phase: 'init',
        });
    };

    const handleGrowEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
        if (e.target !== e.currentTarget || !zoom) return;
        if (e.propertyName === 'transform' && zoom.phase === 'grow') {
            // Card is full size and the pieces have sealed the seam:
            // swap the level underneath, then crack it open.
            drillTo(zoom.path);
            setZoom({ ...zoom, phase: 'split' });
        }
    };

    const handleSplitEnd = () => setZoom(null);

    const openCreate = (mode: 'folder' | 'article', folder?: WorldBibleRootConfig) => {
        setDraftName('');
        if (mode === 'article' && folder) setDraftType(effectiveTypes(folder)[0]);
        setCreateMode(mode);
    };
    const cancelCreate = () => { setCreateMode('none'); setDraftName(''); };

    const handleCreateArticle = (folder: WorldBibleRootConfig) => {
        const name = sanitizeLabel(draftName);
        if (!name) return;
        const types = effectiveTypes(folder);
        const type = types.includes(draftType) ? draftType : types[0];
        const id = crypto.randomUUID();
        addEntity({
            id,
            projectId: activeProjectId ?? '',
            worldId: activeWorldKey === STANDALONE_KEY ? undefined : activeWorldKey,
            categoryId: folder.id,
            name,
            type,
            description: '',
            createdAt: new Date(),
        });
        cancelCreate();
        setSelectedEntityId(id); // drop straight into the new article
    };

    const handleCreateFolder = (parentId: string | undefined) => {
        const label = sanitizeLabel(draftName);
        if (!label) return;
        addWorldBibleRoot({
            id: crypto.randomUUID(),
            label,
            icon: '📂',
            entityTypes: [],
            parentId,
        });
        cancelCreate();
    };

    // Filter entities for the active world (shelf).
    const worldEntities = entities.filter(e => worldKeyForEntity(e) === activeWorldKey);
    const validIds = new Set(layout.roots.map(r => r.id));

    const stripColor = (id: string, index: number) =>
        KNOWN_STRIP_COLORS[id] ?? STRIP_PALETTE[index % STRIP_PALETTE.length];

    // ---- Article view (leaf entity) — unified gallery-hero for all types ----
    if (selectedEntityId) {
        return (
            <ArticleView
                entityId={selectedEntityId}
                onBack={() => setSelectedEntityId(null)}
                onOpenEntity={setSelectedEntityId}
            />
        );
    }

    // ---- Breadcrumb ----
    const crumbs = [
        { label: 'World Bible', icon: '📖' },
        ...folderPath.map(seg => {
            if (seg === UNCAT) return { label: 'Uncategorized', icon: '🗂️' };
            const f = layout.roots.find(r => r.id === seg);
            return { label: f?.label ?? 'Unknown', icon: f?.icon ?? '📁' };
        }),
    ];

    const breadcrumb = (
        <nav className={styles.breadcrumb} aria-label="World Bible location">
            {crumbs.map((crumb, i) => {
                const isCurrent = i === crumbs.length - 1;
                return (
                    <React.Fragment key={i}>
                        {i > 0 && <span className={styles.crumbSep}>›</span>}
                        {isCurrent ? (
                            <span className={`${styles.crumb} ${styles.crumbCurrent}`}>
                                <span className={styles.crumbIcon}>{crumb.icon}</span>
                                {crumb.label}
                            </span>
                        ) : (
                            <button className={styles.crumb} onClick={() => drillTo(folderPath.slice(0, i))}>
                                <span className={styles.crumbIcon}>{crumb.icon}</span>
                                {crumb.label}
                            </button>
                        )}
                    </React.Fragment>
                );
            })}
        </nav>
    );

    // Frosted-glass preview card: full-bleed art, bottom-frost overlay where
    // the text sits, category / title / one-line description with a chevron.
    const renderCard = (entity: (typeof worldEntities)[number], color: string) => {
        const img = entity.imageUrl || entity.galleryImages?.find(g => g.url)?.url;
        return (
            <div
                key={entity.id}
                className={styles.previewCard}
                onClick={() => setSelectedEntityId(entity.id)}
                style={img ? undefined : { background: `linear-gradient(160deg, ${color} 0%, #17171a 100%)` }}
            >
                {img
                    ? <img src={img} alt={entity.name} className={styles.backdrop} />
                    : <span className={styles.backdropIcon}>{SUBCATEGORY_ICONS[entity.type]}</span>}
                <div className={styles.previewContent}>
                    <div className={styles.previewCategory}>{SUBCATEGORY_LABELS[entity.type]}</div>
                    <div className={styles.previewTitle}>{entity.name}</div>
                    <div className={styles.previewDesc}>
                        <p>{entity.description?.trim() || 'Open article'}</p>
                        <span className={styles.previewArrow}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" aria-hidden="true">
                                <path d="M504-480 348-636q-11-11-11-28t11-28q11-11 28-11t28 11l184 184q6 6 8.5 13t2.5 15q0 8-2.5 15t-8.5 13L404-268q-11 11-28 11t-28-11q-11-11-11-28t11-28l156-156Z" />
                            </svg>
                        </span>
                    </div>
                </div>
            </div>
        );
    };

    const current = folderPath[folderPath.length - 1];
    const isUncat = current === UNCAT;

    const currentFolder = !isUncat && current ? layout.roots.find(r => r.id === current) : undefined;
    const childFolders = isUncat
        ? []
        : current
            ? layout.roots.filter(r => r.parentId === current)
            : layout.roots.filter(r => !r.parentId);

    // Articles filed directly at this level (not inside a child folder). At the
    // top level, "direct" means unfiled — no category or a dangling one.
    const directArticles = isUncat
        ? []
        : current
            ? worldEntities.filter(e => e.categoryId === current)
            : worldEntities.filter(e => !e.categoryId || !validIds.has(e.categoryId));

    const depth = folderPath.length;
    const isVertical = depth % 2 === 0; // level 0 vertical, then alternate
    const isLeaf = !isUncat && childFolders.length === 0;

    // What can be created here? A level commits to one kind on first child.
    //  - folder-type (has sub-folders) or empty → can add a folder
    //  - article-type (leaf with articles) or empty → can add an article
    // Articles can only live inside a real folder, never at the top level.
    const canAddFolder = !isUncat && (!isLeaf || directArticles.length === 0);
    const canAddArticle = Boolean(currentFolder) && isLeaf;

    // The "New Article" card that sits at the end of the article-leaf grid,
    // matching the frosted preview cards. Expands into an inline form.
    const newArticlePreviewCard = canAddArticle && currentFolder ? (
        createMode === 'article' ? (
            <div className={`${styles.previewCard} ${styles.previewNew} ${styles.previewNewActive}`}>
                <div className={styles.previewNewForm}>
                    <input
                        className={styles.newFolderInput}
                        autoFocus
                        placeholder="Article title…"
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCreateArticle(currentFolder);
                            if (e.key === 'Escape') cancelCreate();
                        }}
                    />
                    {effectiveTypes(currentFolder).length > 1 && (
                        <select
                            className={styles.newFolderSelect}
                            value={draftType}
                            onChange={(e) => setDraftType(e.target.value as EntityType)}
                        >
                            {effectiveTypes(currentFolder).map(t => (
                                <option key={t} value={t}>{SUBCATEGORY_LABELS[t]}</option>
                            ))}
                        </select>
                    )}
                    <div className={styles.previewNewBtns}>
                        <button
                            className={styles.newFolderCreate}
                            onClick={() => handleCreateArticle(currentFolder)}
                            disabled={!draftName.trim()}
                        >
                            Create
                        </button>
                        <button className={styles.newFolderCancel} onClick={cancelCreate}>Cancel</button>
                    </div>
                </div>
            </div>
        ) : (
            <button className={`${styles.previewCard} ${styles.previewNew}`} onClick={() => openCreate('article', currentFolder)}>
                <span className={styles.previewNewInner}>
                    <span className={styles.previewNewPlus}>＋</span>
                    <span>New Article</span>
                </span>
            </button>
        )
    ) : null;

    // The "New Folder" card that sits at the end of the strip grid.
    const newFolderCard = canAddFolder ? (
        createMode === 'folder' ? (
            <div className={`${styles.strip} ${styles.stripNew} ${styles.stripNewActive}`}>
                <div className={styles.newFolderForm}>
                    <input
                        className={styles.newFolderInput}
                        autoFocus
                        placeholder="Folder name…"
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCreateFolder(current);
                            if (e.key === 'Escape') cancelCreate();
                        }}
                    />
                    <button
                        className={styles.newFolderCreate}
                        onClick={() => handleCreateFolder(current)}
                        disabled={!draftName.trim()}
                    >
                        Create
                    </button>
                    <button className={styles.newFolderCancel} onClick={cancelCreate}>Cancel</button>
                </div>
            </div>
        ) : (
            <button className={`${styles.strip} ${styles.stripNew}`} onClick={() => openCreate('folder')}>
                <span className={styles.stripBody}>
                    <span className={styles.stripIcon}>＋</span>
                    <span className={styles.stripName}>New Folder</span>
                </span>
            </button>
        )
    ) : null;

    // The "New Article" card — shown beside New Folder in EMPTY folders only.
    // (Folders already holding articles keep the compact top-bar button.)
    const newArticleCard = canAddArticle && directArticles.length === 0 && currentFolder ? (
        createMode === 'article' ? (
            <div className={`${styles.strip} ${styles.stripNew} ${styles.stripNewActive}`}>
                <div className={styles.newFolderForm}>
                    <input
                        className={styles.newFolderInput}
                        autoFocus
                        placeholder="Article title…"
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCreateArticle(currentFolder);
                            if (e.key === 'Escape') cancelCreate();
                        }}
                    />
                    {effectiveTypes(currentFolder).length > 1 && (
                        <select
                            className={styles.newFolderSelect}
                            value={draftType}
                            onChange={(e) => setDraftType(e.target.value as EntityType)}
                        >
                            {effectiveTypes(currentFolder).map(t => (
                                <option key={t} value={t}>{SUBCATEGORY_LABELS[t]}</option>
                            ))}
                        </select>
                    )}
                    <button
                        className={styles.newFolderCreate}
                        onClick={() => handleCreateArticle(currentFolder)}
                        disabled={!draftName.trim()}
                    >
                        Create
                    </button>
                    <button className={styles.newFolderCancel} onClick={cancelCreate}>Cancel</button>
                </div>
            </div>
        ) : (
            <button className={`${styles.strip} ${styles.stripNew}`} onClick={() => openCreate('article', currentFolder)}>
                <span className={styles.stripBody}>
                    <span className={styles.stripIcon}>📄</span>
                    <span className={styles.stripName}>New Article</span>
                </span>
            </button>
        )
    ) : null;

    // ---- Level content: article leaf or alternating folder strips ----
    let content: React.ReactNode;

    if (isUncat) {
        const parentId = folderPath[folderPath.length - 2];
        const looseArticles = parentId
            ? worldEntities.filter(e => e.categoryId === parentId)
            : worldEntities.filter(e => !e.categoryId || !validIds.has(e.categoryId));
        content = (
            <div className={styles.leaf} key={folderPath.join('/')}>
                {looseArticles.length > 0 ? (
                    <div className={styles.entityGrid}>
                        {looseArticles.map(entity => renderCard(entity, UNCAT_COLOR))}
                    </div>
                ) : (
                    <div className={styles.emptyState}>
                        <p className={styles.emptyText}>Nothing here.</p>
                    </div>
                )}
            </div>
        );
    } else if (isLeaf && directArticles.length > 0) {
        // Article leaf — a folder committed to holding articles.
        content = (
            <div className={styles.leaf} key={folderPath.join('/')}>
                <div className={styles.entityGrid}>
                    {directArticles.map(entity => renderCard(entity, currentFolder ? stripColor(currentFolder.id, 0) : UNCAT_COLOR))}
                    {newArticlePreviewCard}
                </div>
            </div>
        );
    } else {
        // Folder layer or empty folder — child strips plus the New Folder card.
        content = (
            <div
                key={folderPath.join('/')}
                className={`${styles.level} ${isVertical ? styles.levelVertical : styles.levelHorizontal}`}
            >
                {childFolders.map(child => {
                    const memberIds = folderMemberSet(layout.roots, child.id);
                    const count = worldEntities.filter(e => e.categoryId && memberIds.has(e.categoryId)).length;
                    return (
                        <button
                            key={child.id}
                            className={styles.strip}
                            style={{
                                // The clone replaces the clicked strip while it travels
                                visibility: zoom?.sourceId === child.id ? 'hidden' : undefined,
                            }}
                            onClick={(e) => zoomInto(e, [...folderPath, child.id], child.icon, child.label, child.id)}
                        >
                            <span className={styles.stripBody}>
                                <span className={styles.stripIcon}>{child.icon}</span>
                                <span className={styles.stripName}>{child.label}</span>
                                <span className={styles.stripMeta}>
                                    {count > 0 ? `${count} ${count === 1 ? 'entry' : 'entries'}` : 'No entries yet'}
                                </span>
                            </span>
                        </button>
                    );
                })}

                {/* Auto "Uncategorized" strip — only when loose articles exist here */}
                {directArticles.length > 0 && (
                    <button
                        className={styles.strip}
                        style={{
                            visibility: zoom?.sourceId === UNCAT ? 'hidden' : undefined,
                        }}
                        onClick={(e) => zoomInto(e, [...folderPath, UNCAT], '🗂️', 'Uncategorized', UNCAT)}
                    >
                        <span className={styles.stripBody}>
                            <span className={styles.stripIcon}>🗂️</span>
                            <span className={styles.stripName}>Uncategorized</span>
                            <span className={styles.stripMeta}>
                                {directArticles.length} {directArticles.length === 1 ? 'entry' : 'entries'}
                            </span>
                        </span>
                    </button>
                )}

                {newFolderCard}
                {newArticleCard}
            </div>
        );
    }

    // Orientation-matched class pairs for the sheens and split halves
    const sheenClasses = zoom?.dir === 'v'
        ? [styles.sheenLeftV, styles.sheenRightV]
        : [styles.sheenTopH, styles.sheenBottomH];
    const halfClasses = zoom?.dir === 'v'
        ? [styles.halfLeftV, styles.halfRightV]
        : [styles.halfTopH, styles.halfBottomH];

    return (
        <div className={styles.browserContainer}>
            {/* Redundant at the root (the tab already says World Bible); show it
                only once you've drilled in, for navigating back up. */}
            {folderPath.length > 0 && breadcrumb}
            {/* levelWrap persists across drills so the transition can cover the swap */}
            <div ref={levelRef} className={styles.levelWrap}>
                {content}

                {/* Beat 1 — the white-frost card grows to fill while its charcoal
                    corner pieces sweep in and seal the seam, landing together */}
                {zoom && zoom.phase !== 'split' && (
                    <div
                        className={styles.zoomClone}
                        style={{
                            transform: zoom.phase === 'init'
                                ? `translate(${zoom.tx}px, ${zoom.ty}px) scale(${zoom.sx}, ${zoom.sy})`
                                : 'none',
                        }}
                        onTransitionEnd={handleGrowEnd}
                    >
                        <span className={styles.stripBody}>
                            <span className={styles.stripIcon}>{zoom.icon}</span>
                            <span className={styles.stripName}>{zoom.label}</span>
                        </span>
                        {zoom.phase === 'grow' && sheenClasses.map((cls, i) => (
                            <div key={i} className={`${styles.zoomSheen} ${cls}`} />
                        ))}
                    </div>
                )}

                {/* Beat 3 — the sealed charcoal card cracks along the seam and the
                    solid halves retreat toward the corners their pieces came from */}
                {zoom && zoom.phase === 'split' && halfClasses.map((cls, i) => (
                    <div
                        key={i}
                        className={`${styles.zoomHalf} ${cls}`}
                        onAnimationEnd={i === 0 ? handleSplitEnd : undefined}
                    />
                ))}
            </div>
        </div>
    );
}
