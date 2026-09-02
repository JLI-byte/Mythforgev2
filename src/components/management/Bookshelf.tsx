"use client";

import React, { useState, useEffect } from 'react';
import { useWorkspaceStore, Project, World, COVER_COLORS, WorldGenre } from '@/store/workspaceStore';
import { STANDALONE_KEY } from '@/lib/worldKey';
import { getWorldBibleConfig } from '@/lib/worldBibleNav';
import { WORK_TYPES, getWorkType, getWorkTypeByWritingMode } from '@/lib/workTypes';
import { getSubTypesFor, getWorkSubType, type ProjectBrief } from '@/lib/workSubTypes';
import { getDraftType } from '@/lib/writingMethods';
import WorldBibleBook from './WorldBibleBook';
import WorkTypeArtwork from './WorkTypeArtwork';
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
    const createWorld = useWorkspaceStore(s => s.createWorld);
    const updateWorld = useWorkspaceStore(s => s.updateWorld);
    const deleteWorld = useWorkspaceStore(s => s.deleteWorld);
    const addProject = useWorkspaceStore(s => s.addProject);
    const deleteProject = useWorkspaceStore(s => s.deleteProject);
    const addDocument = useWorkspaceStore(s => s.addDocument);
    const addScene = useWorkspaceStore(s => s.addScene);
    const updateDraftState = useWorkspaceStore(s => s.updateDraftState);
    const activeProjectId = useWorkspaceStore(s => s.activeProjectId);
    const setActiveProject = useWorkspaceStore(s => s.setActiveProject);
    const setWorkspaceMode = useWorkspaceStore(s => s.setWorkspaceMode);
    const setActiveWorldKey = useWorkspaceStore(s => s.setActiveWorldKey);
    const worldBibles = useWorkspaceStore(s => s.worldBibles);
    const pendingNewStoryWorldKey = useWorkspaceStore(s => s.pendingNewStoryWorldKey);
    const clearPendingNewStory = useWorkspaceStore(s => s.clearPendingNewStory);

    // ─── STATE BLOCKS ──────────────────────────────────────────

    /** DND State: Tracks which project is being dragged and which world is the current drop target */
    const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null);
    const [dragOverWorldId, setDragOverWorldId] = useState<string | null | 'standalone'>(null);

    /** Wizard UI State: Controls the visibility and step of the Shelf Wizard modal */
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
    const [editingWorldId, setEditingWorldId] = useState<string | null>(null);
    const [deletingWorldId, setDeletingWorldId] = useState<string | null>(null);
    /** Book awaiting delete confirmation (two-step, in place on the cover). */
    const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);

    /** Extra rows added per shelf beyond the default 3 (keyed by world id / 'standalone'). */
    const [extraRows, setExtraRows] = useState<Record<string, number>>({});

    /** Story-creation modal state (replaces the unsupported native prompt()). */
    const [isStoryModalOpen, setIsStoryModalOpen] = useState(false);
    const [storyWorldId, setStoryWorldId] = useState<string | undefined>(undefined);
    const [storyName, setStoryName] = useState('');
    /**
     * New-work modal: pick what you're writing, then name it and choose a start.
     * A Script / Report asks what KIND first — a YouTube script and a
     * dissertation want very different research.
     */
    const [storyStep, setStoryStep] = useState<'type' | 'kind' | 'details'>('type');
    const [storyTypeId, setStoryTypeId] = useState<string | null>(null);
    const [storySubTypeId, setStorySubTypeId] = useState<string | null>(null);
    const [storyBrief, setStoryBrief] = useState<ProjectBrief>({});

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
            // The store owns what a world starts out as; the wizard only passes
            // the parts it actually collected.
            createWorld(wizardData.name, {
                genre: wizardData.genre,
                tone: wizardData.tone,
                logline: wizardData.logline,
                techLevel: wizardData.techLevel,
                timePeriod: wizardData.timePeriod,
            });
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

    /** Opens the new-work modal at step one, remembering the shelf to file it under. */
    const handleCreateStory = (worldId?: string) => {
        setStoryWorldId(worldId);
        setStoryName('');
        setStoryTypeId(null);
        setStorySubTypeId(null);
        setStoryBrief({});
        setStoryStep('type');
        setIsStoryModalOpen(true);
    };

    /**
     * Home can ask for a new book but does not own the work-type flow, so it
     * leaves the shelf to file under here and routes over. Consume it once and
     * clear it, or arriving here again would reopen the modal.
     */
    useEffect(() => {
        if (!pendingNewStoryWorldKey) return;
        handleCreateStory(
            pendingNewStoryWorldKey === STANDALONE_KEY ? undefined : pendingNewStoryWorldKey,
        );
        clearPendingNewStory();
        // The pending key is the only real trigger: handleCreateStory is
        // redefined every render, so depending on it would refire this forever.
    }, [pendingNewStoryWorldKey, clearPendingNewStory]);

    /**
     * Step one: what kind of work this is. Types with sub-types (today, just
     * Script / Report) ask which one before naming; the rest go straight on.
     */
    const pickWorkType = (id: string) => {
        setStoryTypeId(id);
        setStorySubTypeId(null);
        setStoryBrief({});
        setStoryStep(getSubTypesFor(id).length > 0 ? 'kind' : 'details');
    };

    /** Step two, Script / Report only: which kind, then on to naming it. */
    const pickSubType = (id: string) => {
        setStorySubTypeId(id);
        setStoryStep('details');
    };

    /**
     * Creates the story with its first chapter + scene, then routes to the
     * chosen starting point: the Research Table (gather first), the Draft
     * Table (outline first), or the Writing Desk (straight into prose).
     */
    const confirmCreateStory = (destination: 'template' | 'desk' | 'research') => {
        const name = storyName.trim();
        const workType = getWorkType(storyTypeId);
        if (!name || !workType) return;

        const projectId = crypto.randomUUID();
        const docId = crypto.randomUUID();
        const sceneId = crypto.randomUUID();

        const subType = getWorkSubType(storySubTypeId);
        // Only keep answers that were actually filled in.
        const brief: ProjectBrief = Object.fromEntries(
            Object.entries(storyBrief).filter(([, v]) => v?.trim()),
        );
        const hasBrief = Object.keys(brief).length > 0;

        addProject({
            id: projectId,
            name,
            writingMode: workType.writingMode,
            coverColor: COVER_COLORS[Math.floor(Math.random() * COVER_COLORS.length)],
            worldId: storyWorldId,
            createdAt: new Date(),
            ...(subType ? { workSubTypeId: subType.id } : {}),
            ...(hasBrief ? { brief } : {}),
        });

        // Pre-filter the Draft Table's method library to suit the work, so the
        // writer isn't offered screenplay beats for an essay. The sub-type knows
        // better than the work type — a video script isn't an article.
        const draftTypeId = subType?.draftTypeId ?? workType.draftTypeId;
        if (draftTypeId) {
            updateDraftState(projectId, {
                draftTypeId,
                draftFormat: getDraftType(draftTypeId)?.format,
            });
        }

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
    const renderDiamondBook = (p: Project) => {
        const isDeleting = deletingProjectId === p.id;
        // A story stays a book cover; the other work types show their medium
        // instead. A cover the writer chose always wins over either.
        const workTypeId = getWorkTypeByWritingMode(p.writingMode)?.id;
        const isPaper = !p.coverImageUrl && !!workTypeId && workTypeId !== 'story';
        return (
            <div
                key={p.id}
                className={`${styles.slot} ${draggedProjectId === p.id ? styles.dragging : ''}`}
            >
                <div
                    draggable={!isDeleting}
                    onDragStart={(e) => handleDragStart(e, p.id)}
                    onDragEnd={() => setDraggedProjectId(null)}
                    onClick={() => { if (!isDeleting) handleSelectProject(p.id); }}
                    title={p.name}
                    className={`${styles.book} ${isPaper ? styles.bookPaper : ''} ${p.id === activeProjectId ? styles.bookActive : ''}`}
                    style={{
                        background: p.coverImageUrl || isPaper ? undefined : greyForId(p.id),
                        backgroundImage: p.coverImageUrl ? `url(${p.coverImageUrl})` : undefined,
                    }}
                >
                    {isPaper && <WorkTypeArtwork typeId={workTypeId!} />}
                    {!p.coverImageUrl && (
                        <span className={`${styles.bookInitials} ${isPaper ? styles.bookInitialsInk : ''}`}>
                            {p.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                        </span>
                    )}
                    <span className={styles.bookLabel}>{p.name}</span>
                </div>

                {/* Delete lives on the slot, not the cover: the cover tilts 18°
                    on hover, which would make a button inside it hard to hit. */}
                {isDeleting ? (
                    <div className={styles.bookConfirm} onClick={e => e.stopPropagation()}>
                        <span className={styles.bookConfirmText}>Delete?</span>
                        <div className={styles.bookConfirmActions}>
                            <button
                                className={styles.bookConfirmNo}
                                onClick={() => setDeletingProjectId(null)}
                            >
                                No
                            </button>
                            <button
                                className={styles.bookConfirmYes}
                                onClick={() => { deleteProject(p.id); setDeletingProjectId(null); }}
                            >
                                Yes
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        className={styles.bookDeleteBtn}
                        title={`Delete “${p.name}”`}
                        onClick={e => { e.stopPropagation(); setDeletingProjectId(p.id); }}
                    >
                        ✕
                    </button>
                )}
            </div>
        );
    };

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
                        {storyStep === 'type' ? (
                            <>
                                <h2 className={styles.wizardTitle}>What are you writing?</h2>
                                <div className={styles.workTypeGrid}>
                                    {WORK_TYPES.map(t => (
                                        <button
                                            key={t.id}
                                            className={styles.workTypeCard}
                                            onClick={() => pickWorkType(t.id)}
                                        >
                                            <span className={styles.workTypeIcon}>{t.icon}</span>
                                            <span className={styles.workTypeLabel}>{t.label}</span>
                                            <span className={styles.workTypeDesc}>{t.desc}</span>
                                        </button>
                                    ))}
                                </div>
                                <div className={styles.wizardActions}>
                                    <button className={styles.wizardBtnSecondary} onClick={() => setIsStoryModalOpen(false)}>Cancel</button>
                                </div>
                            </>
                        ) : storyStep === 'kind' ? (
                            <>
                                <h2 className={styles.wizardTitle}>What kind of script or report?</h2>
                                <p className={styles.briefHint}>
                                    This sets the outlining methods you&apos;re offered, and tells the
                                    research assistant what it&apos;s helping you write.
                                </p>
                                <div className={styles.workTypeGrid}>
                                    {getSubTypesFor(storyTypeId).map(t => (
                                        <button
                                            key={t.id}
                                            className={`${styles.workTypeCard} ${styles.workTypeCardCompact}`}
                                            onClick={() => pickSubType(t.id)}
                                        >
                                            <span className={styles.workTypeIcon}>{t.icon}</span>
                                            <span className={styles.workTypeLabel}>{t.label}</span>
                                            <span className={styles.workTypeDesc}>{t.desc}</span>
                                        </button>
                                    ))}
                                </div>
                                <div className={styles.wizardActions}>
                                    <button className={styles.wizardBtnSecondary} onClick={() => setStoryStep('type')}>← Back</button>
                                    <button className={styles.wizardBtnSecondary} onClick={() => setIsStoryModalOpen(false)}>Cancel</button>
                                </div>
                            </>
                        ) : (
                            <>
                                <h2 className={styles.wizardTitle}>
                                    {getWorkSubType(storySubTypeId)?.icon ?? getWorkType(storyTypeId)?.icon}
                                    {' '}New {getWorkSubType(storySubTypeId)?.label ?? getWorkType(storyTypeId)?.label}
                                </h2>
                                <div style={{ marginBottom: '16px' }}>
                                    <label className={styles.shelfLabel}>Name</label>
                                    <input
                                        className={styles.wizardInput}
                                        value={storyName}
                                        onChange={e => setStoryName(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') { e.preventDefault(); confirmCreateStory('template'); }
                                            if (e.key === 'Escape') setIsStoryModalOpen(false);
                                        }}
                                        placeholder={getWorkType(storyTypeId)?.namePlaceholder}
                                        autoFocus
                                    />
                                </div>

                                {/* The brief. Optional — a writer who just wants to start can
                                    skip straight past it to the start options. */}
                                {getWorkSubType(storySubTypeId) && (
                                    <div className={styles.briefFields}>
                                        {getWorkSubType(storySubTypeId)!.fields.map(f => (
                                            <div key={f.key}>
                                                <label className={styles.shelfLabel}>{f.label}</label>
                                                <input
                                                    className={styles.wizardInput}
                                                    value={storyBrief[f.key] ?? ''}
                                                    onChange={e => setStoryBrief({ ...storyBrief, [f.key]: e.target.value })}
                                                    onKeyDown={e => { if (e.key === 'Escape') setIsStoryModalOpen(false); }}
                                                    placeholder={f.placeholder}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <label className={styles.shelfLabel}>Where do you want to begin?</label>
                                <div className={styles.beginOptions}>
                                    <button
                                        className={styles.beginOption}
                                        onClick={() => confirmCreateStory('research')}
                                        disabled={!storyName.trim()}
                                    >
                                        <span className={styles.beginOptionTitle}>🔎 Research First</span>
                                        <span className={styles.beginOptionDesc}>Gather notes and build the world with the AI assistant</span>
                                    </button>
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
                                        <span className={styles.beginOptionDesc}>Jump straight in on the Writing Desk</span>
                                    </button>
                                </div>
                                <div className={styles.wizardActions}>
                                    <button
                                        className={styles.wizardBtnSecondary}
                                        onClick={() => setStoryStep(getSubTypesFor(storyTypeId).length > 0 ? 'kind' : 'type')}
                                    >
                                        ← Back
                                    </button>
                                    <button className={styles.wizardBtnSecondary} onClick={() => setIsStoryModalOpen(false)}>Cancel</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
