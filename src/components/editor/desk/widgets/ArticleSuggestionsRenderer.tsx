"use client";

import React from 'react';
import { X } from 'lucide-react';
import {
    useWorkspaceStore,
    selectProjectWorldKey,
    ENTITY_TYPE_LABELS,
    type Entity,
    type EntityType,
} from '@/store/workspaceStore';
import { STANDALONE_KEY } from '@/lib/worldKey';
import { getWorldBibleConfig } from '@/lib/worldBibleNav';
import {
    buildArticleDoc,
    resolveFolderIdByName,
    resolveCategoryId,
    makeCategoryRoot,
} from '@/lib/worldAuthoring';
import type { ArticleSuggestion } from '@/lib/articleSuggestions';
import styles from '../../WritingDesk.module.css';

interface RendererProps {
    content: { suggestions?: ArticleSuggestion[] };
    onChange: (c: { suggestions: ArticleSuggestion[] }) => void;
}

/** A rendered group: an existing folder, a proposed new folder, or Unfiled. */
interface Group {
    key: string;
    label?: string;      // undefined = Unfiled
    icon: string;
    isNew: boolean;
    items: ArticleSuggestion[];
}

const DRAG_MIME = 'application/x-lore-suggestion';

/**
 * Article Suggestions widget — the assistant drops article-worthy entities here
 * as it talks. Each suggestion is grouped under the folder it best fits (or a
 * proposed new folder, or Unfiled), can be dragged between groups to re-file,
 * and created into a real World Bible article on demand.
 */
export function ArticleSuggestionsRenderer({ content, onChange }: RendererProps) {
    const suggestions = content.suggestions ?? [];

    const worldKey = useWorkspaceStore(selectProjectWorldKey);
    const worldBibles = useWorkspaceStore(s => s.worldBibles);
    const activeProjectId = useWorkspaceStore(s => s.activeProjectId);
    const addEntity = useWorkspaceStore(s => s.addEntity);
    const setWorldBibleLayout = useWorkspaceStore(s => s.setWorldBibleLayout);

    const roots = getWorldBibleConfig(worldBibles, worldKey).layout.roots;
    const worldId = worldKey === STANDALONE_KEY ? undefined : worldKey;
    const canCreate = Boolean(activeProjectId);

    // ── Grouping ────────────────────────────────────────────
    const groups: Group[] = [];
    const groupFor = (label: string | undefined, isNew: boolean, icon: string): Group => {
        const key = label ? `${isNew ? 'new:' : 'exist:'}${label.toLowerCase()}` : 'unfiled';
        let g = groups.find(x => x.key === key);
        if (!g) { g = { key, label, icon, isNew, items: [] }; groups.push(g); }
        return g;
    };
    for (const s of suggestions) {
        if (!s.category) { groupFor(undefined, false, '📥').items.push(s); continue; }
        const folder = roots.find(r => r.label.trim().toLowerCase() === s.category!.trim().toLowerCase());
        if (folder) groupFor(folder.label, false, folder.icon).items.push(s);
        else groupFor(s.category, true, '✨').items.push(s);
    }
    // Existing folders with no suggestions yet — still valid drop targets.
    const emptyTargets = roots.filter(
        r => !groups.some(g => !g.isNew && g.label?.toLowerCase() === r.label.toLowerCase()),
    );

    // ── Mutations ───────────────────────────────────────────
    const reassign = (id: string, label: string | undefined, isNew: boolean) => {
        onChange({
            suggestions: suggestions.map(s =>
                s.id === id ? { ...s, category: label, isNewCategory: isNew && Boolean(label) } : s,
            ),
        });
    };
    const dismiss = (id: string) => onChange({ suggestions: suggestions.filter(s => s.id !== id) });

    const buildEntity = (s: ArticleSuggestion, categoryId: string | undefined): Entity => ({
        id: crypto.randomUUID(),
        projectId: activeProjectId ?? '',
        worldId,
        categoryId,
        name: s.name,
        type: s.type as EntityType,
        description: s.reason ?? '',
        articleDoc: buildArticleDoc([{ heading: 'Overview', body: s.reason || `${s.name} — to be written.` }]),
        createdAt: new Date(),
    });

    const createOne = (s: ArticleSuggestion) => {
        if (!canCreate) return;
        let categoryId: string | undefined;
        if (s.category) {
            const existing = resolveFolderIdByName(roots, s.category);
            if (existing) categoryId = existing;
            else {
                const root = makeCategoryRoot(s.category, undefined, undefined);
                setWorldBibleLayout(worldKey, { roots: [...roots, root] });
                categoryId = root.id;
            }
        } else {
            categoryId = resolveCategoryId(roots, undefined, s.type as EntityType);
        }
        addEntity(buildEntity(s, categoryId));
        onChange({ suggestions: suggestions.filter(x => x.id !== s.id) });
    };

    const createAll = () => {
        if (!canCreate || !suggestions.length) return;
        // Resolve folders against a growing working set so several suggestions
        // sharing one new folder create it just once.
        let working = roots;
        const newRoots: typeof roots = [];
        const resolved = suggestions.map(s => {
            if (!s.category) return { s, categoryId: resolveCategoryId(working, undefined, s.type as EntityType) };
            const existing = resolveFolderIdByName(working, s.category);
            if (existing) return { s, categoryId: existing };
            const root = makeCategoryRoot(s.category, undefined, undefined);
            newRoots.push(root);
            working = [...working, root];
            return { s, categoryId: root.id };
        });
        if (newRoots.length) setWorldBibleLayout(worldKey, { roots: [...roots, ...newRoots] });
        resolved.forEach(({ s, categoryId }) => addEntity(buildEntity(s, categoryId)));
        onChange({ suggestions: [] });
    };

    // ── Drag & drop ─────────────────────────────────────────
    const onChipDragStart = (id: string, name: string) => (e: React.DragEvent) => {
        e.dataTransfer.setData(DRAG_MIME, id);
        // Also expose the name as plain text so the chip can be dropped onto the
        // research chat as an attachment, not only re-filed within the widget.
        e.dataTransfer.setData('text/plain', name);
        e.dataTransfer.effectAllowed = 'move';
        e.stopPropagation();
    };
    const onZoneDrop = (label: string | undefined, isNew: boolean) => (e: React.DragEvent) => {
        e.preventDefault();
        const id = e.dataTransfer.getData(DRAG_MIME);
        if (id) reassign(id, label, isNew);
    };
    const allowDrop = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };

    // ── Render ──────────────────────────────────────────────
    const renderChip = (s: ArticleSuggestion) => (
        <div
            key={s.id}
            className={styles.suggestChip}
            draggable
            onDragStart={onChipDragStart(s.id, s.name)}
            onMouseDown={e => e.stopPropagation()}
            title={s.reason || undefined}
        >
            <span className={styles.suggestChipType}>{ENTITY_TYPE_LABELS[s.type as EntityType] ?? s.type}</span>
            <span className={styles.suggestChipName}>{s.name}</span>
            <button className={styles.suggestChipCreate} onClick={() => createOne(s)} disabled={!canCreate} title="Create this article">＋</button>
            <button className={styles.suggestChipDismiss} onClick={() => dismiss(s.id)} title="Dismiss"><X size={13} /></button>
        </div>
    );

    return (
        <div className={styles.suggestWidget}>
            <div className={styles.suggestHeader}>
                <span className={styles.suggestTitle}>Article Suggestions</span>
                <span className={styles.suggestCount}>{suggestions.length}</span>
                {suggestions.length > 0 && (
                    <button className={styles.suggestCreateAll} onClick={createAll} disabled={!canCreate} title="Create every suggestion">
                        Create all
                    </button>
                )}
            </div>

            <div className={styles.suggestBody}>
                {suggestions.length === 0 && (
                    <div className={styles.suggestEmpty}>
                        As you talk with the assistant, article ideas it spots will appear here — grouped by where they’d be filed.
                    </div>
                )}

                {groups.map(g => (
                    <div
                        key={g.key}
                        className={`${styles.suggestGroup} ${g.isNew ? styles.suggestGroupNew : ''}`}
                        onDragOver={allowDrop}
                        onDrop={onZoneDrop(g.label, g.isNew)}
                    >
                        <div className={styles.suggestGroupHead}>
                            <span className={styles.suggestGroupIcon}>{g.icon}</span>
                            <span className={styles.suggestGroupLabel}>{g.label ?? 'Unfiled'}</span>
                            {g.isNew && <span className={styles.suggestNewBadge}>new folder</span>}
                        </div>
                        {g.items.map(renderChip)}
                    </div>
                ))}

                {emptyTargets.length > 0 && suggestions.length > 0 && (
                    <div className={styles.suggestTargets}>
                        <span className={styles.suggestTargetsHint}>Drag onto a folder to file it:</span>
                        <div className={styles.suggestTargetsRow}>
                            {emptyTargets.map(r => (
                                <div
                                    key={r.id}
                                    className={styles.suggestTarget}
                                    onDragOver={allowDrop}
                                    onDrop={onZoneDrop(r.label, false)}
                                >
                                    {r.icon} {r.label}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
