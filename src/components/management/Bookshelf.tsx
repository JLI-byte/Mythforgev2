"use client";

import React, { useState, useEffect } from 'react';
import { useWorkspaceStore, Project, World, COVER_COLORS, WorldGenre } from '@/store/workspaceStore';
import { STANDALONE_KEY } from '@/lib/worldKey';
import { getWorldBibleConfig } from '@/lib/worldBibleNav';
import WorldBibleBook from './WorldBibleBook';
import styles from './Bookshelf.module.css';

/** Diamond-lattice shelf layout: fixed columns, 3 rows of slots by default. */
const DIAMOND_COLS = 6;
const DEFAULT_ROWS = 3;

/** Monochrome cover fills — the shelf stays black/white/grey. */
const COVER_GREYS = ['#26262b', '#33333a', '#42424a', '#1e1e22', '#4d4d55', '#2c2c31'];

/** Stable grey per project so a cover keeps its shade across renders. */
const greyForId = (id: string): string => {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i)) % 997;
    return COVER_GREYS[h % COVER_GREYS.length];
};

/**
 * Bookshelf Component
 *
 * Provides a high-level overview of all worlds (shelves) and their associated projects.
 * Supports organizing projects via drag-and-drop, and managing shelves via a multi-step wizard.
 */
export function Bookshelf() {
    const projects = useWorkspaceStore(s => s.projects);
    const worlds = useWorkspaceStore(s => s.worlds || []);
    const updateProject = useWorkspaceStore(s => s.updateProject);
    const addWorld = useWorkspaceStore(s => s.addWorld);
    const updateWorld = useWorkspaceStore(s => s.updateWorld);
    const deleteWorld = useWorkspaceStore(s => s.deleteWorld);
    const addProject = useWorkspaceStore(s => s.addProject);
    const addDocument = useWorkspaceStore(s => s.addDocument);
    const addScene = useWorkspaceStore(s => s.addScene);
    const activeProjectId = useWorkspaceStore(s => s.activeProjectId);
    const setActiveProject = useWorkspaceStore(s => s.setActiveProject);
    const setWorkspaceMode = useWorkspaceStore(s => s.setWorkspaceMode);
    const setActiveWorldKey = useWorkspaceStore(s => s.setActiveWorldKey);
    const worldBibles = useWorkspaceStore(s => s.worldBibles);

    // ─── STATE BLOCKS ──────────────────────────────────────────

    /** DND State: Tracks which project is being dragged and which world is the current drop target */
    const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null);
    const [dragOverWorldId, setDragOverWorldId] = useState<string | null | 'standalone'>(null);

    /** Wizard UI State: Controls the visibility and step of the Shelf Wizard modal */
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
    const [editingWorldId, setEditingWorldId] = useState<string | null>(null);
    const [deletingWorldId, setDeletingWorldId] = useState<string | null>(null);

    /** Extra rows added per shelf beyond the default 3 (keyed by world id / 'standalone'). */
    const [extraRows, setExtraRows] = useState<Record<string, number>>({});

    /** Story-creation modal state (replaces the unsupported native prompt()). */
    const [isStoryModalOpen, setIsStoryModalOpen] = useState(false);
    const [storyWorldId, setStoryWorldId] = useState<string | undefined>(undefined);
    const [storyName, setStoryName] = useState('');

    /** Wizard Form Data: Holds transient state for world creation/editing */
    const [wizardData, setWizardData] = useState<Partial<World>>({
        name: '',
        logline: '',
        genre: 'fantasy',
        techLevel: 'medieval',
        timePeriod: '',
        tone: { darkness: 'balanced', scale: 'balanced', humor: 'balanced' },
        magicExists: false, // Hidden but required in type
    });

    // ─── EFFECTS ──────────────────────────────────────────────

    /** Escape key listener for closing the wizard modal */
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') resetWizard();
        };
        if (isWizardOpen) {
            window.addEventListener('keydown', handleEsc);
        }
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isWizardOpen]);

    // ─── HELPERS ──────────────────────────────────────────────

    /** Resets wizard state and form data */
    const resetWizard = () => {
        setIsWizardOpen(false);
        setWizardStep(1);
        setEditingWorldId(null);
        setWizardData({
            name: '',
            logline: '',
            genre: 'fantasy',
            techLevel: 'medieval',
            timePeriod: '',
            tone: { darkness: 'balanced', scale: 'balanced', humor: 'balanced' },
            magicExists: false,
        });
    };

    /** Advances to the next step */
    const handleNext = () => {
        if (wizardStep === 1 && !wizardData.name?.trim()) return;
        setWizardStep((prev) => (prev + 1) as any);
    };

    /** Returns to the previous step */
    const handleBack = () => {
        setWizardStep((prev) => (prev - 1) as any);
    };

    /** Handles Enter key progression within the wizard */
    const handleInputKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (wizardStep < 3) {
                handleNext();
            }
        }
    };

    /** Submits the wizard form to create or update a shelf */
    const handleWizardSubmit = () => {
        if (!wizardData.name?.trim()) return;

        if (editingWorldId) {
            // Update existing shelf
            // @ts-ignore
            updateWorld(editingWorldId, {
                name: wizardData.name,
                logline: wizardData.logline,
                genre: wizardData.genre,
                techLevel: wizardData.techLevel,
                timePeriod: wizardData.timePeriod,
                tone: wizardData.tone,
            });
        } else {
            // Create new shelf
            const newWorld: World = {
                id: crypto.randomUUID(),
                name: wizardData.name.trim(),
                genre: wizardData.genre || 'fantasy',
                tone: wizardData.tone || { darkness: 'balanced', scale: 'balanced', humor: 'balanced' },
                logline: wizardData.logline || '',
                magicExists: false,
                techLevel: wizardData.techLevel || 'medieval',
                timePeriod: wizardData.timePeriod || '',
                coverColor: COVER_COLORS[Math.floor(Math.random() * COVER_COLORS.length)],
                createdAt: new Date()
            };
            addWorld(newWorld);
        }
        resetWizard();
    };

    /** Pre-populates wizard with existing data for editing */
    const handleEditShelf = (world: World) => {
        setEditingWorldId(world.id);
        setWizardData({
            name: world.name,
            logline: world.logline,
            genre: world.genre,
            techLevel: world.techLevel,
            timePeriod: world.timePeriod,
            tone: { ...world.tone },
            magicExists: world.magicExists,
        });
        setWizardStep(1);
        setIsWizardOpen(true);
    };

    // ─── DND LOGIC ──────────────────────────────────────────

    // Group projects by worldId
    const groups: Record<string, Project[]> = { 'standalone': [] };
    worlds.forEach(w => { groups[w.id] = []; });
    
    projects.forEach(p => {
        const key = p.worldId || 'standalone';
        if (groups[key]) {
            groups[key].push(p);
        } else {
            groups['standalone'].push(p);
        }
    });

    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedProjectId(id);
        e.dataTransfer.setData('projectId', id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, worldId: string | 'standalone') => {
        e.preventDefault();
        setDragOverWorldId(worldId);
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, targetWorldId: string | 'standalone') => {
        e.preventDefault();
        const projectId = e.dataTransfer.getData('projectId') || draggedProjectId;
        
        if (projectId) {
            updateProject(projectId, { 
                worldId: targetWorldId === 'standalone' ? undefined : targetWorldId 
            });
        }
        
        setDraggedProjectId(null);
        setDragOverWorldId(null);
    };

    /**
     * Opening a book routes by progress: a story with written scene content
     * goes to the Writing Desk; an unwritten one starts at the Draft Table.
     */
    const handleSelectProject = (id: string) => {
        const { scenes } = useWorkspaceStore.getState();
        const hasWriting = scenes.some(sc =>
            sc.projectId === id &&
            sc.content.replace(/<[^>]*>/g, '').trim() !== ''
        );
        setActiveProject(id);
        setWorkspaceMode(hasWriting ? 'desk' : 'template');
    };

    // ─── STORY CREATION ─────────────────────────────────────

    /** Opens the story-name modal, remembering which shelf to file it under. */
    const handleCreateStory = (worldId?: string) => {
        setStoryWorldId(worldId);
        setStoryName('');
        setIsStoryModalOpen(true);
    };

    /**
     * Creates the story with its first chapter + scene, then routes to the
     * chosen starting point: the Draft Table (outline first) or the Writing
     * Desk (dive straight into prose).
     */
    const confirmCreateStory = (destination: 'template' | 'desk') => {
        const name = storyName.trim();
        if (!name) return;

        const projectId = crypto.randomUUID();
        const docId = crypto.randomUUID();
        const sceneId = crypto.randomUUID();

        addProject({
            id: projectId,
            name,
            writingMode: 'novel',
            coverColor: COVER_COLORS[Math.floor(Math.random() * COVER_COLORS.length)],
            worldId: storyWorldId,
            createdAt: new Date()
        });

        addDocument({
            id: docId,
            projectId,
            title: 'Chapter 1',
            content: '',
            createdAt: new Date()
        });

        addScene({
            id: sceneId,
            documentId: docId,
            projectId,
            title: 'Scene 1',
            content: '',
            order: 0,
            createdAt: new Date()
        });

        setIsStoryModalOpen(false);
        setStoryName('');
        setActiveProject(projectId);
        setWorkspaceMode(destination);
    };

    // ─── RENDERING ─────────────────────────────────────────

    /** A book slot — greyscale cover centered inside its diamond, tilts on hover. */
    const renderDiamondBook = (p: Project) => (
        <div
            key={p.id}
            className={`${styles.slot} ${draggedProjectId === p.id ? styles.dragging : ''}`}
        >
            <div
                draggable
                onDragStart={(e) => handleDragStart(e, p.id)}
                onDragEnd={() => setDraggedProjectId(null)}
                onClick={() => handleSelectProject(p.id)}
                title={p.name}
                className={`${styles.book} ${p.id === activeProjectId ? styles.bookActive : ''}`}
                style={{
                    background: p.coverImageUrl ? undefined : greyForId(p.id),
                    backgroundImage: p.coverImageUrl ? `url(${p.coverImageUrl})` : undefined,
                }}
            >
                {!p.coverImageUrl && (
                    <span className={styles.bookInitials}>
                        {p.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                )}
                <span className={styles.bookLabel}>{p.name}</span>
            </div>
        </div>
    );

    /** Empty slot — click the diamond to stock the shelf with a new story. */
    const renderEmptySlot = (worldId: string | 'standalone', key: string) => (
        <div key={key} className={`${styles.slot} ${styles.slotEmpty}`}>
            <button
                type="button"
                className={styles.slotAdd}
                onClick={() => handleCreateStory(worldId === 'standalone' ? undefined : worldId)}
                aria-label="Add a story to this slot"
            />
        </div>
    );

    const renderShelf = (title: string, worldId: string | 'standalone', projects: Project[], worldObj?: World) => {
        const isUncategorized = worldId === 'standalone';
        const isDeleting = deletingWorldId === worldId;
        const worldKey = isUncategorized ? STANDALONE_KEY : worldId;
        const bibleCfg = getWorldBibleConfig(worldBibles, worldKey);

        // Rows alternate 6 / 5 slots (even / odd) so the half-cell-offset odd
        // rows nest symmetrically inside the wider rows. At least 3 rows by
        // default (+ any the user added), growing to fit all the books.
        const minRows = DEFAULT_ROWS + (extraRows[worldId] || 0);
        const rowChunks: (Project | null)[][] = [];
        let idx = 0;
        for (let r = 0; r < minRows || idx < projects.length; r++) {
            const cols = DIAMOND_COLS - (r % 2); // 6, 5, 6, 5, …
            const row: (Project | null)[] = [];
            for (let c = 0; c < cols; c++) row.push(projects[idx++] ?? null);
            rowChunks.push(row);
        }

        return (
            <div 
                key={worldId}
                className={`${styles.shelf} ${dragOverWorldId === worldId ? styles.shelfActive : ''}`}
                onDragOver={(e) => handleDragOver(e, worldId)}
                onDragLeave={() => setDragOverWorldId(null)}
                onDrop={(e) => handleDrop(e, worldId)}
            >
                <div className={styles.shelfHeader}>
                    <span className={styles.shelfLabel}>{title}</span>
                    <span className={styles.shelfCount}>{projects.length}</span>
                    
                    {!isUncategorized && worldObj && !isDeleting && (
                        <>
                            <button className={styles.editBtn} onClick={() => handleEditShelf(worldObj)} title="Edit Shelf">✏️</button>
                            <button 
                                className={styles.deleteBtn} 
                                onClick={() => setDeletingWorldId(worldId)}
                                disabled={worlds.length <= 1}
                                title={worlds.length <= 1 ? "Cannot delete your only shelf" : "Delete Shelf"}
                            >
                                🗑️
                            </button>
                        </>
                    )}

                    {isDeleting && (
                        <div className={styles.shelfDeleteConfirm}>
                            <span>Delete this shelf? Stories will move to Uncategorized.</span>
                            <button className={styles.wizardBtnSecondary} onClick={() => setDeletingWorldId(null)}>Cancel</button>
                            <button className={styles.wizardBtnPrimary} onClick={() => { deleteWorld(worldId); setDeletingWorldId(null); }}>Delete</button>
                        </div>
                    )}

                    {!isDeleting && (
                        <button 
                            className={styles.addStoryBtn} 
                            onClick={() => handleCreateStory(isUncategorized ? undefined : worldId)}
                        >
                            + Add Story
                        </button>
                    )}
                </div>
                <div className={styles.shelfBody}>
                    <WorldBibleBook
                        title={bibleCfg.coverTitle ?? (isUncategorized ? 'Standalones' : title)}
                        subtitle={bibleCfg.coverSub}
                        tint={bibleCfg.tint}
                        onAction={(action) => {
                            setActiveWorldKey(worldKey);
                            if (action === 'open') setWorkspaceMode('worldBible');
                            else if (action === 'edit') setWorkspaceMode('worldBibleEdit');
                            else setWorkspaceMode('hierarchy');
                        }}
                    />
                    <div className={styles.books}>
                        {rowChunks.map((row, ri) => (
                            <div
                                key={ri}
                                className={`${styles.dRow} ${ri % 2 === 1 ? styles.dRowOffset : ''}`}
                            >
                                {row.map((p, ci) =>
                                    p
                                        ? renderDiamondBook(p)
                                        : renderEmptySlot(worldId, `e-${ri}-${ci}`),
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className={styles.rowControls}>
                    <button
                        type="button"
                        className={styles.addRowBtn}
                        onClick={() =>
                            setExtraRows(prev => ({
                                ...prev,
                                [worldId]: (prev[worldId] || 0) + 1,
                            }))
                        }
                    >
                        + Add row
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>Your Bookshelf</h1>
                <button className={styles.actionBtn} onClick={() => { setEditingWorldId(null); setIsWizardOpen(true); }}>
                    <span>+ New Shelf</span>
                </button>
            </div>

            {/* Real World Shelves */}
            {worlds.map(w => renderShelf(w.name, w.id, groups[w.id], w))}

            {/* Standalone Shelf */}
            {renderShelf('Uncategorized Standalones', 'standalone', groups['standalone'])}

            {/* ─── WIZARD MODAL ─────────────────────────────────────── */}
            {isWizardOpen && (
                <div className={styles.wizardBackdrop} onClick={resetWizard}>
                    <div className={styles.wizardModal} onClick={e => e.stopPropagation()}>
                        <div className={styles.wizardStep}>Step {wizardStep} of 3</div>
                        <h2 className={styles.wizardTitle}>{editingWorldId ? 'Edit Shelf' : 'Create New Shelf'}</h2>
                        
                        {/* Step 1: Identity */}
                        {wizardStep === 1 && (
                            <>
                                <div style={{ marginBottom: '16px' }}>
                                    <label className={styles.shelfLabel}>Shelf Name</label>
                                    <input 
                                        className={styles.wizardInput}
                                        value={wizardData.name}
                                        onChange={e => setWizardData({...wizardData, name: e.target.value})}
                                        onKeyDown={handleInputKeyDown}
                                        placeholder="e.g. My Epic Saga"
                                        autoFocus
                                    />
                                </div>
                                <div style={{ marginBottom: '16px' }}>
                                    <label className={styles.shelfLabel}>What is this world about?</label>
                                    <textarea 
                                        className={styles.wizardTextarea}
                                        value={wizardData.logline}
                                        onChange={e => setWizardData({...wizardData, logline: e.target.value})}
                                        placeholder="Optional description..."
                                    />
                                </div>
                            </>
                        )}

                        {/* Step 2: Genre & Tech */}
                        {wizardStep === 2 && (
                            <>
                                <label className={styles.shelfLabel}>Genre</label>
                                <div className={styles.pillGroup}>
                                    {(['fantasy', 'sci-fi', 'real-world', 'alternate-history', 'horror', 'contemporary'] as WorldGenre[]).map(g => (
                                        <button 
                                            key={g} 
                                            className={`${styles.pill} ${wizardData.genre === g ? styles.pillActive : ''}`}
                                            onClick={() => setWizardData({...wizardData, genre: g})}
                                        >
                                            {g.replace('-', ' ')}
                                        </button>
                                    ))}
                                </div>

                                <label className={styles.shelfLabel}>Tech Level</label>
                                <div className={styles.pillGroup}>
                                    {(['primitive', 'medieval', 'modern', 'futuristic', 'post-apocalyptic'] as World['techLevel'][]).map(tl => (
                                        <button 
                                            key={tl} 
                                            className={`${styles.pill} ${wizardData.techLevel === tl ? styles.pillActive : ''}`}
                                            onClick={() => setWizardData({...wizardData, techLevel: tl})}
                                        >
                                            {tl.replace('-', ' ')}
                                        </button>
                                    ))}
                                </div>

                                <label className={styles.shelfLabel}>Time Period</label>
                                <input 
                                    className={styles.wizardInput}
                                    value={wizardData.timePeriod}
                                    onChange={e => setWizardData({...wizardData, timePeriod: e.target.value})}
                                    onKeyDown={handleInputKeyDown}
                                    placeholder="e.g. 1920s Paris, Far Future"
                                />
                            </>
                        )}

                        {/* Step 3: Tone & Confirm */}
                        {wizardStep === 3 && (
                            <>
                                <div className={styles.toneRow}>
                                    <span className={styles.toneLabel}>Darkness</span>
                                    <div className={styles.pillGroup} style={{ margin: 0 }}>
                                        {['dark', 'balanced', 'light'].map(v => (
                                            <button 
                                                key={v} 
                                                className={`${styles.pill} ${wizardData.tone?.darkness === v ? styles.pillActive : ''}`}
                                                onClick={() => setWizardData({...wizardData, tone: {...wizardData.tone!, darkness: v as any}})}
                                            >
                                                {v}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className={styles.toneRow}>
                                    <span className={styles.toneLabel}>Scale</span>
                                    <div className={styles.pillGroup} style={{ margin: 0 }}>
                                        {['grounded', 'balanced', 'epic'].map(v => (
                                            <button 
                                                key={v} 
                                                className={`${styles.pill} ${wizardData.tone?.scale === v ? styles.pillActive : ''}`}
                                                onClick={() => setWizardData({...wizardData, tone: {...wizardData.tone!, scale: v as any}})}
                                            >
                                                {v}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className={styles.toneRow}>
                                    <span className={styles.toneLabel}>Humor</span>
                                    <div className={styles.pillGroup} style={{ margin: 0 }}>
                                        {['serious', 'balanced', 'comedic'].map(v => (
                                            <button 
                                                key={v} 
                                                className={`${styles.pill} ${wizardData.tone?.humor === v ? styles.pillActive : ''}`}
                                                onClick={() => setWizardData({...wizardData, tone: {...wizardData.tone!, humor: v as any}})}
                                            >
                                                {v}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        <div className={styles.wizardActions}>
                            {wizardStep > 1 && (
                                <button className={styles.wizardBtnSecondary} onClick={handleBack}>← Back</button>
                            )}
                            <button className={styles.wizardBtnSecondary} onClick={resetWizard} style={{ marginLeft: wizardStep === 1 ? 0 : 'auto' }}>Cancel</button>
                            {wizardStep < 3 ? (
                                <button 
                                    className={`${styles.wizardBtn} ${styles.wizardBtnPrimary}`} 
                                    onClick={handleNext}
                                    disabled={wizardStep === 1 && !wizardData.name?.trim()}
                                >
                                    Next →
                                </button>
                            ) : (
                                <button 
                                    className={`${styles.wizardBtn} ${styles.wizardBtnPrimary}`} 
                                    onClick={handleWizardSubmit}
                                >
                                    {editingWorldId ? 'Save Changes' : '✓ Create Shelf'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ─── NEW STORY MODAL ─────────────────────────────────── */}
            {isStoryModalOpen && (
                <div className={styles.wizardBackdrop} onClick={() => setIsStoryModalOpen(false)}>
                    <div className={styles.wizardModal} onClick={e => e.stopPropagation()}>
                        <h2 className={styles.wizardTitle}>New Story</h2>
                        <div style={{ marginBottom: '16px' }}>
                            <label className={styles.shelfLabel}>Story Name</label>
                            <input
                                className={styles.wizardInput}
                                value={storyName}
                                onChange={e => setStoryName(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') { e.preventDefault(); confirmCreateStory('template'); }
                                    if (e.key === 'Escape') setIsStoryModalOpen(false);
                                }}
                                placeholder="e.g. The Long Winter"
                                autoFocus
                            />
                        </div>
                        <label className={styles.shelfLabel}>How do you want to begin?</label>
                        <div className={styles.beginOptions}>
                            <button
                                className={styles.beginOption}
                                onClick={() => confirmCreateStory('template')}
                                disabled={!storyName.trim()}
                            >
                                <span className={styles.beginOptionTitle}>🗺️ Draft First</span>
                                <span className={styles.beginOptionDesc}>Outline on the Draft Table with a writing method</span>
                            </button>
                            <button
                                className={styles.beginOption}
                                onClick={() => confirmCreateStory('desk')}
                                disabled={!storyName.trim()}
                            >
                                <span className={styles.beginOptionTitle}>✍️ Start Writing</span>
                                <span className={styles.beginOptionDesc}>Jump straight into prose on the Writing Desk</span>
                            </button>
                        </div>
                        <div className={styles.wizardActions}>
                            <button className={styles.wizardBtnSecondary} onClick={() => setIsStoryModalOpen(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
