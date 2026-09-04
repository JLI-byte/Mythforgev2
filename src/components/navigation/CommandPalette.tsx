/**
 * Global Command Palette
 *
 * Provides ultra-fast keyboard-first navigation across all projects and documents.
 *
 * INVARIANTS:
 * - Always accessible via Cmd/Ctrl+K globally.
 * - Resets its search state upon opening to prevent stale context.
 * - If a search yields no results, provides inline quick-creation actions.
 */
"use client";

import React, { useState } from 'react';
import { useWorkspaceStore, COVER_COLORS } from '@/store/workspaceStore';
import { sanitizeLabel } from '@/lib/sanitize';
import { useModalDialog } from '@/lib/useModalDialog';
import styles from './CommandPalette.module.css';

interface SearchItem {
    id: string;
    type: 'project' | 'document';
    title: string;
    subtitle?: string;
    projectId?: string;
}

/**
 * The palette itself, which assumes it is open. Split out from the exported
 * component because `useModalDialog` runs on mount, and a hook cannot sit below
 * the `return null` that hides a closed palette. Mounting fresh on each open is
 * also what resets the search back to empty.
 */
function CommandPaletteContent() {
    const setCommandPaletteOpen = useWorkspaceStore(state => state.setCommandPaletteOpen);

    const projects = useWorkspaceStore(state => state.projects);
    const documents = useWorkspaceStore(state => state.documents);
    const activeProjectId = useWorkspaceStore(state => state.activeProjectId);
    const setActiveProject = useWorkspaceStore(state => state.setActiveProject);
    const setActiveDocument = useWorkspaceStore(state => state.setActiveDocument);
    const addProject = useWorkspaceStore(state => state.addProject);
    const addDocument = useWorkspaceStore(state => state.addDocument);

    const [search, setSearch] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);

    const closePalette = () => setCommandPaletteOpen(false);
    const dialogRef = useModalDialog<HTMLDivElement>(closePalette);

    // Build flat searchable list
    const items: SearchItem[] = React.useMemo(() => {
        const flatList: SearchItem[] = [];

        projects.forEach(p => {
            flatList.push({
                id: p.id,
                type: 'project',
                title: `${p.name} ✦`,
                subtitle: 'Project'
            });

            const pDocs = documents.filter(d => d.projectId === p.id);
            pDocs.forEach(d => {
                flatList.push({
                    id: d.id,
                    type: 'document',
                    title: d.title || 'Untitled Chapter',
                    subtitle: p.name,
                    projectId: p.id
                });
            });
        });

        return flatList;
    }, [projects, documents]);

    const filteredItems = React.useMemo(() => {
        if (!search.trim()) return items;
        const lowerSearch = search.toLowerCase();
        return items.filter(item =>
            item.title.toLowerCase().includes(lowerSearch) ||
            (item.subtitle && item.subtitle.toLowerCase().includes(lowerSearch))
        );
    }, [items, search]);

    const handleSelect = (item: SearchItem) => {
        if (item.type === 'project') {
            setActiveProject(item.id);
            const firstDoc = documents.find(d => d.projectId === item.id);
            setActiveDocument(firstDoc ? firstDoc.id : null);
        } else {
            if (item.projectId) setActiveProject(item.projectId);
            setActiveDocument(item.id);
        }
        closePalette();
    };

    const handleCreateQuick = (type: 'project' | 'document') => {
        const trimmed = sanitizeLabel(search);
        if (!trimmed) return;

        if (type === 'project') {
            const newProjectId = crypto.randomUUID();
            const newDocId = crypto.randomUUID();
            addProject({
                id: newProjectId,
                name: trimmed,
                createdAt: new Date(),
                writingMode: 'novel',
                coverColor: COVER_COLORS[projects.length % COVER_COLORS.length]
            });
            addDocument({
                id: newDocId,
                projectId: newProjectId,
                title: 'Untitled Chapter',
                content: '',
                createdAt: new Date(),
            });
            setActiveProject(newProjectId);
            setActiveDocument(newDocId);
        } else if (type === 'document' && activeProjectId) {
            const newDocId = crypto.randomUUID();
            addDocument({
                id: newDocId,
                projectId: activeProjectId,
                title: trimmed,
                content: '',
                createdAt: new Date(),
            });
            setActiveDocument(newDocId);
        }
        closePalette();
    };

    // Escape belongs to the dialog, not the input: useModalDialog answers it
    // from anywhere inside the palette, including after tabbing to a result.
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev < filteredItems.length - 1 ? prev + 1 : 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : filteredItems.length - 1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredItems[selectedIndex]) {
                handleSelect(filteredItems[selectedIndex]);
            }
        }
    };

    return (
        <div className={styles.backdrop} onClick={closePalette} onContextMenu={e => e.preventDefault()} role="presentation">
            <div
                ref={dialogRef}
                className={styles.modal}
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Command palette"
                tabIndex={-1}
            >
                <div className={styles.searchHeader}>
                    <input
                        type="text"
                        data-autofocus
                        aria-label="Search projects and chapters"
                        className={styles.searchInput}
                        placeholder="Search projects and chapters..."
                        value={search}
                        onChange={e => {
                            setSearch(e.target.value);
                            setSelectedIndex(0);
                        }}
                        onKeyDown={handleKeyDown}
                    />
                </div>

                <div className={styles.list}>
                    {filteredItems.length === 0 ? (
                        search.trim() ? (
                            <div className={styles.quickCreateOptions}>
                                <button
                                    className={styles.listItem}
                                    onClick={() => handleCreateQuick('project')}
                                >
                                    <div className={styles.itemMain}>Create project: &quot;{search}&quot;</div>
                                    <div className={styles.itemSub}>New Project</div>
                                </button>
                                {activeProjectId && (
                                    <button
                                        className={styles.listItem}
                                        onClick={() => handleCreateQuick('document')}
                                    >
                                        <div className={styles.itemMain}>Create chapter: &quot;{search}&quot;</div>
                                        <div className={styles.itemSub}>In {projects.find(p => p.id === activeProjectId)?.name || 'Current Project'}</div>
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className={styles.emptyState}>No results found</div>
                        )
                    ) : (
                        filteredItems.map((item, index) => (
                            <button
                                key={`${item.type}-${item.id}`}
                                className={`${styles.listItem} ${index === selectedIndex ? styles.selected : ''}`}
                                onClick={() => handleSelect(item)}
                                onMouseEnter={() => setSelectedIndex(index)}
                            >
                                <div className={styles.itemMain}>{item.title}</div>
                                <div className={styles.itemSub}>{item.subtitle}</div>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

export function CommandPalette() {
    const isCommandPaletteOpen = useWorkspaceStore(state => state.isCommandPaletteOpen);
    if (!isCommandPaletteOpen) return null;
    return <CommandPaletteContent />;
}
