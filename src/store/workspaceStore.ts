import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { logger } from '@/lib/logger';
import { getStoredValue } from '@/lib/storage';
import { AIProviderConfig } from '@/types';

export interface WritingGoal {
    dailyTarget: number;
    sessionTarget: number;
}

export interface Atmosphere {
    id: string;
    name: string;
    icon: string;                    // emoji string
    lightBackground: string;         // hex color for light mode
    darkBackground: string;          // hex color for dark mode
    soundType: 'silence' | 'brown-noise' | 'white-noise' | 'pink-noise' | 'dark-ambient' | 'warm-loop' | 'energetic-loop' | 'cafe-ambient';
    soundVolume: number;             // 0–1, default 0.35, reserved for Sprint 23
    lineHeightShift: number;         // e.g. 0.15 means add 0.15 to base line-height. 0 = no change
    letterSpacingShift: number;      // e.g. 0.02 means add 0.02em. 0 = no change
    isPreset: boolean;
    projectId: string | null;        // null = global preset available to all projects
    createdAt: Date;
}

export type EntityType = 'character' | 'location' | 'faction' | 'artifact' | 'lore';
export type ThemeMode = 'light' | 'dark' | 'system';

export interface Project {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt?: Date;
}

export interface Document {
    id: string;
    projectId: string;
    title: string;
    content: string;
    createdAt: Date;
    updatedAt?: Date;
    wordCount?: number;
}

export interface Scene {
    id: string;
    documentId: string;
    projectId: string;
    title: string;
    content: string;
    order: number;
    createdAt: Date;
    updatedAt?: Date;
    wordCount?: number;
    atmosphereId?: string;
}

/**
 * A central mapping for EntityType strings to their human-readable UI labels.
 * This should be used anywhere an entity type is rendered to the user.
 */
export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
    character: "Character",
    location: "Location",
    faction: "Faction",
    artifact: "Artifact",
    lore: "Lore / Event"
};

export interface Entity {
    /** Unique identifier for the entity */
    id: string;
    /** The ID of the project this entity belongs to */
    projectId: string;
    /** The human-readable name of the entity */
    name: string;
    /** Categorization of the entity within the world */
    type: EntityType;
    /** Primary descriptive text for the entity */
    description: string;
    /** Timestamp of when the entity was originally created */
    createdAt: Date;
    /** Timestamp of when the entity was last updated */
    updatedAt?: Date;
}

interface WorkspaceState {
    // --- STATE FIELDS ---
    projects: Project[];
    documents: Document[];
    scenes: Scene[];
    activeProjectId: string | null;
    activeDocumentId: string | null;
    activeSceneId: string | null;

    /**
     * Global core data structure: The list of established world entities.
     * This is what the World Bible renders and what the Consistency Checker evaluates against.
     */
    entities: Entity[];

    /**
     * The ID of the entity that the user's cursor is currently hovering over.
     * Null if no entity is being hovered. Controls the HoverPreview modal.
     */
    hoveredEntityId: string | null;

    /**
     * Whether the Inline Entry modal is currently visible to the writer.
     */
    isInlineCreatorOpen: boolean;

    /**
     * The exact string the writer typed that triggered the Inline Entry modal.
     * Stored here so the modal can pre-populate the "Name" field.
     */
    pendingEntityName: string | null;

    /**
     * The current theme mode preference for the UI.
     */
    theme: ThemeMode;

    /**
     * Whether the World Bible sidebar is currently visible.
     */
    isSidebarOpen: boolean;

    /**
     * Whether the Global Command Palette is currently active.
     */
    isCommandPaletteOpen: boolean;

    /**
     * Typewriter mode keeps the active line centered in the viewport.
     */
    isTypewriterMode: boolean;

    /**
     * Hides the UI layout framing (sidebar, etc) around the editor content.
     */
    isFullscreen: boolean;

    /**
     * Width constraints for the main WritingEditor flow. Default 800px.
     */
    editorWidth: number;

    /** Width of the right-edge panel tabs in pixels. User-adjustable. */
    tabRailWidth: number;

    /** Width of the slide-out panels in pixels. User-adjustable. */
    panelWidth: number;

    /**
     * The currently selected entity for the detail panel view.
     * This is intentionally not persisted (resets to null on refresh).
     */
    selectedEntityId: string | null;

    /**
     * INTERNAL: Flags whether the async local storage hydration has completed.
     * Starts false natively, set to true via the onRehydrateStorage callback.
     */
    _hasHydrated: boolean;

    /**
     * The URL of the Spotify playlist or track attached to the workspace.
     */
    spotifyUrl: string | null;

    /**
     * Whether the Spotify Mini-Player is currently expanded.
     */
    isSpotifyOpen: boolean;

    /**
     * The multi-provider configuration used for the AI Consistency Checker.
     */
    aiConfig: AIProviderConfig;

    /**
     * User's established targets for words per day/session.
     */
    writingGoal: WritingGoal;

    /**
     * Words added during this specific browser session.
     */
    sessionWordCount: number;

    /** User-defined custom scene atmospheres */
    customAtmospheres: Atmosphere[];

    /** Master toggle for scene visual atmospheres */
    atmospheresEnabled: boolean;

    /** Toggle for whether atmosphere tint applies to the full window or just the editor */
    atmosphereGlobalOverlay: boolean;

    /** Toggle for typography shifts when atmosphere is active */
    atmosphereTypographyEnabled: boolean;

    /** Toggle for reduced motion (disables smooth transitions for atmospheres) */
    atmosphereReducedMotion: boolean;

    // --- ACTIONS ---
    addProject: (project: Project) => void;
    updateProject: (id: string, updates: Partial<Omit<Project, 'id' | 'createdAt'>>) => void;
    deleteProject: (id: string) => void;

    addDocument: (document: Document) => void;
    updateDocument: (id: string, updates: Partial<Omit<Document, 'id' | 'projectId' | 'createdAt'>>) => void;
    deleteDocument: (id: string) => void;

    addScene: (scene: Scene) => void;
    updateScene: (id: string, updates: Partial<Omit<Scene, 'id' | 'documentId' | 'projectId' | 'createdAt'>>) => void;
    deleteScene: (id: string) => void;
    setActiveScene: (id: string | null) => void;
    reorderScenes: (documentId: string, orderedIds: string[]) => void;

    setActiveProject: (id: string | null) => void;
    setActiveDocument: (id: string | null) => void;

    /**
     * Appends a newly created entity to the global entities array.
     */
    addEntity: (entity: Entity) => void;

    /**
     * Updates the currently hovered entity ID. 
     * Passing `null` dismisses the HoverPreview.
     */
    setHoveredEntity: (id: string | null) => void;

    /**
     * Opens the Inline Entry modal and optionally sets the pre-filled name.
     */
    openInlineCreator: (name?: string) => void;

    /**
     * Closes the Inline Entry modal and completely clears the pending name state.
     */
    closeInlineCreator: () => void;

    /**
     * Sets the current theme mode.
     */
    setTheme: (theme: ThemeMode) => void;

    /**
     * Toggles the visibility of the World Bible sidebar.
     */
    toggleSidebar: () => void;

    /**
     * Toggles the command palette.
     */
    setCommandPaletteOpen: (open: boolean) => void;

    /**
     * Toggles Typewriter layout mode.
     */
    toggleTypewriterMode: () => void;

    /**
     * Toggles the distraction-free Fullscreen mode.
     */
    toggleFullscreen: () => void;

    /** Spotify Controls */
    setSpotifyUrl: (url: string | null) => void;
    setSpotifyOpen: (isOpen: boolean) => void;

    /**
     * Customizes the max-width bounding box for the writing editor text block.
     */
    setEditorWidth: (width: number) => void;

    setTabRailWidth: (width: number) => void;
    setPanelWidth: (width: number) => void;

    /**
     * Sets the currently selected entity for the detail view.
     */
    setSelectedEntity: (id: string | null) => void;

    /**
     * Updates an existing entity.
     */
    updateEntity: (id: string, updates: Partial<Omit<Entity, 'id' | 'createdAt'>>) => void;

    /**
     * Deletes an entity by ID.
     */
    deleteEntity: (id: string) => void;

    /**
     * Updates the internal tracking flag verifying persistence load.
     */
    setHasHydrated: (state: boolean) => void;

    // --- ATMOSPHERE ACTIONS ---
    addCustomAtmosphere: (atmosphere: Atmosphere) => void;
    updateCustomAtmosphere: (id: string, updates: Partial<Omit<Atmosphere, 'id' | 'createdAt'>>) => void;
    deleteCustomAtmosphere: (id: string) => void;
    setAtmospheresEnabled: (enabled: boolean) => void;
    setAtmosphereGlobalOverlay: (enabled: boolean) => void;
    setAtmosphereTypographyEnabled: (enabled: boolean) => void;
    setAtmosphereReducedMotion: (enabled: boolean) => void;

    /**
     * Submits partial updates to the AI provider configuration.
     */
    setAIConfig: (config: Partial<AIProviderConfig>) => void;

    /**
     * Updates the user's daily/session writing target targets.
     */
    setWritingGoal: (goal: Partial<WritingGoal>) => void;

    /**
     * Set the current running session's word count derived from editor diffs.
     */
    setSessionWordCount: (count: number) => void;
}

/**
 * Global Workspace Store
 * 
 * Manages the UI overlay states (what is hovered, is the creator open) 
 * and the actual world data (the entity list). 
 * Built with Zustand to allow precise, re-render-free subscriptions 
 * from the WritingEditor surface.
 * 
 * PERSISTENCE ARCHITECTURE:
 * We use Zustand's persist middleware configured cleanly via `localStorage` natively 
 * supporting the mythforge offline standalone nature. 
 * `partialize` explicitly omits standard transient UI variables (`hoveredEntityId`, etc) 
 * so refreshing never caches a stuck hover box overlay.
 */
export const useWorkspaceStore = create<WorkspaceState>()(
    persist(
        (set) => ({
            projects: [],
            documents: [],
            scenes: [],
            activeProjectId: null,
            activeDocumentId: null,
            activeSceneId: null,
            entities: [],
            hoveredEntityId: null,
            isInlineCreatorOpen: false,
            pendingEntityName: null,
            theme: 'system',
            isSidebarOpen: true,
            isCommandPaletteOpen: false,
            isTypewriterMode: false,
            isFullscreen: false,

            spotifyUrl: null,
            isSpotifyOpen: false,

            editorWidth: 800,
            tabRailWidth: 72,
            panelWidth: 480,
            selectedEntityId: null,
            _hasHydrated: false,
            aiConfig: {
                provider: 'anthropic',
                apiKey: '',
                ollamaEndpoint: 'http://localhost:11434',
                ollamaModel: 'llama3'
            },
            writingGoal: { dailyTarget: 0, sessionTarget: 0 },
            sessionWordCount: 0,
            customAtmospheres: [],
            atmospheresEnabled: true,
            atmosphereGlobalOverlay: false,
            atmosphereTypographyEnabled: true,
            atmosphereReducedMotion: false,

            addProject: (project) =>
                set((state) => {
                    logger.info('Project added:', project.name);
                    return { projects: [...state.projects, project] };
                }),

            updateProject: (id, updates) =>
                set((state) => {
                    logger.info('Project updated:', id);
                    return {
                        projects: state.projects.map(p => p.id === id ? { ...p, ...updates, updatedAt: new Date() } : p),
                    };
                }),

            deleteProject: (id) =>
                set((state) => {
                    logger.info('Project deleted (with cascade):', id);
                    return {
                        projects: state.projects.filter(p => p.id !== id),
                        documents: state.documents.filter(d => d.projectId !== id),
                        scenes: state.scenes.filter(s => s.projectId !== id),
                        entities: state.entities.filter(e => e.projectId !== id),
                        activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
                        activeDocumentId: state.documents.find(d => d.id === state.activeDocumentId)?.projectId === id ? null : state.activeDocumentId,
                        activeSceneId: state.scenes.find(s => s.id === state.activeSceneId)?.projectId === id ? null : state.activeSceneId,
                        selectedEntityId: state.entities.find(e => e.id === state.selectedEntityId)?.projectId === id ? null : state.selectedEntityId,
                    };
                }),

            addDocument: (document) =>
                set((state) => {
                    logger.info('Document added:', document.title);
                    return { documents: [...state.documents, document] };
                }),

            updateDocument: (id, updates) =>
                set((state) => {
                    logger.info('Document updated:', id);
                    return {
                        documents: state.documents.map(d => d.id === id ? { ...d, ...updates, updatedAt: new Date() } : d),
                    };
                }),

            deleteDocument: (id) =>
                set((state) => {
                    logger.info('Document deleted:', id);
                    return {
                        documents: state.documents.filter(d => d.id !== id),
                        scenes: state.scenes.filter(s => s.documentId !== id),
                        activeDocumentId: state.activeDocumentId === id ? null : state.activeDocumentId,
                        activeSceneId: state.scenes.find(s => s.id === state.activeSceneId)?.documentId === id ? null : state.activeSceneId,
                    };
                }),

            setActiveProject: (id) =>
                set(() => ({ activeProjectId: id })),

            /**
             * Sets the active document.
             * Automatically selects the first scene belonging to the document (by order).
             * If no scenes exist, clears the active scene.
             */
            setActiveDocument: (id) =>
                set((state) => {
                    let nextActiveSceneId: string | null = null;
                    if (id) {
                        const documentScenes = state.scenes
                            .filter(s => s.documentId === id)
                            .sort((a, b) => a.order - b.order);
                        if (documentScenes.length > 0) {
                            nextActiveSceneId = documentScenes[0].id;
                        }
                    }
                    return {
                        activeDocumentId: id,
                        activeSceneId: nextActiveSceneId
                    };
                }),

            addScene: (scene) =>
                set((state) => {
                    logger.info('Scene added:', scene.title);
                    return { scenes: [...state.scenes, scene] };
                }),

            updateScene: (id, updates) =>
                set((state) => {
                    logger.info('Scene updated:', id);
                    return {
                        scenes: state.scenes.map(s => s.id === id ? { ...s, ...updates, updatedAt: new Date() } : s),
                    };
                }),

            deleteScene: (id) =>
                set((state) => {
                    logger.info('Scene deleted:', id);

                    const sceneToDelete = state.scenes.find(s => s.id === id);
                    if (!sceneToDelete) return state;

                    const activeWillBeDeleted = state.activeSceneId === id;
                    let nextActiveSceneId = state.activeSceneId;

                    if (activeWillBeDeleted) {
                        const documentScenes = state.scenes
                            .filter(s => s.documentId === sceneToDelete.documentId)
                            .sort((a, b) => a.order - b.order);

                        const deletedIndex = documentScenes.findIndex(s => s.id === id);
                        if (documentScenes.length > 1) {
                            if (deletedIndex < documentScenes.length - 1) {
                                nextActiveSceneId = documentScenes[deletedIndex + 1].id;
                            } else {
                                nextActiveSceneId = documentScenes[deletedIndex - 1].id;
                            }
                        } else {
                            nextActiveSceneId = null;
                        }
                    }

                    return {
                        scenes: state.scenes.filter(s => s.id !== id),
                        activeSceneId: nextActiveSceneId
                    };
                }),

            setActiveScene: (id) =>
                set(() => ({ activeSceneId: id })),

            reorderScenes: (documentId, orderedIds) =>
                set((state) => {
                    logger.info(`Reordering ${orderedIds.length} scenes in document ${documentId}`);

                    const orderMap = new Map();
                    orderedIds.forEach((id, index) => {
                        orderMap.set(id, index);
                    });

                    return {
                        scenes: state.scenes.map(s => {
                            if (s.documentId === documentId && orderMap.has(s.id)) {
                                return { ...s, order: orderMap.get(s.id) };
                            }
                            return s;
                        })
                    };
                }),

            addEntity: (entity) =>
                set((state) => {
                    logger.info('Entity added:', entity.name);
                    return {
                        entities: [...state.entities, entity],
                    };
                }),
            setHoveredEntity: (id) =>
                set(() => ({ hoveredEntityId: id })),

            openInlineCreator: (name?: string) =>
                set(() => ({ isInlineCreatorOpen: true, pendingEntityName: name ?? null })),

            closeInlineCreator: () =>
                set(() => ({ isInlineCreatorOpen: false, pendingEntityName: null })),

            setTheme: (theme) =>
                set(() => ({ theme })),

            toggleSidebar: () =>
                set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

            setCommandPaletteOpen: (open) =>
                set(() => ({ isCommandPaletteOpen: open })),

            toggleTypewriterMode: () =>
                set((state) => ({ isTypewriterMode: !state.isTypewriterMode })),

            toggleFullscreen: () =>
                set((state) => ({ isFullscreen: !state.isFullscreen })),

            setSpotifyUrl: (url) =>
                set(() => ({ spotifyUrl: url })),

            setSpotifyOpen: (isOpen) =>
                set(() => ({ isSpotifyOpen: isOpen })),

            setEditorWidth: (width) =>
                set(() => ({ editorWidth: width })),

            setTabRailWidth: (width) => set(() => ({ tabRailWidth: width })),

            setPanelWidth: (width) => set(() => ({ panelWidth: width })),

            setSelectedEntity: (id) =>
                set(() => ({ selectedEntityId: id })),

            updateEntity: (id, updates) =>
                set((state) => {
                    logger.info('Entity updated:', id);
                    return {
                        entities: state.entities.map(e => e.id === id ? { ...e, ...updates, updatedAt: new Date() } : e),
                    };
                }),

            deleteEntity: (id) =>
                set((state) => {
                    logger.info('Entity deleted:', id);
                    return {
                        entities: state.entities.filter(e => e.id !== id),
                    };
                }),

            setHasHydrated: (state) =>
                set(() => ({ _hasHydrated: state })),

            setAIConfig: (config) =>
                set((state) => ({
                    aiConfig: { ...state.aiConfig, ...config }
                })),

            setWritingGoal: (goal) =>
                set((state) => ({
                    writingGoal: { ...state.writingGoal, ...goal }
                })),

            setSessionWordCount: (count) =>
                set(() => ({
                    sessionWordCount: count
                })),

            addCustomAtmosphere: (atmosphere) =>
                set((state) => {
                    logger.info('Custom atmosphere added:', atmosphere.name);
                    return { customAtmospheres: [...state.customAtmospheres, atmosphere] };
                }),

            updateCustomAtmosphere: (id, updates) =>
                set((state) => {
                    logger.info('Custom atmosphere updated:', id);
                    return {
                        customAtmospheres: state.customAtmospheres.map(a => a.id === id ? { ...a, ...updates } : a)
                    };
                }),

            deleteCustomAtmosphere: (id) =>
                set((state) => {
                    logger.info('Custom atmosphere deleted:', id);
                    return {
                        customAtmospheres: state.customAtmospheres.filter(a => a.id !== id),
                        // Also remove it from any scenes using it
                        scenes: state.scenes.map(s => s.atmosphereId === id ? { ...s, atmosphereId: undefined, updatedAt: new Date() } : s)
                    };
                }),

            setAtmospheresEnabled: (enabled) =>
                set(() => ({ atmospheresEnabled: enabled })),

            setAtmosphereGlobalOverlay: (enabled) =>
                set(() => ({ atmosphereGlobalOverlay: enabled })),

            setAtmosphereTypographyEnabled: (enabled) =>
                set(() => ({ atmosphereTypographyEnabled: enabled })),

            setAtmosphereReducedMotion: (enabled) =>
                set(() => ({ atmosphereReducedMotion: enabled })),
        }),
        {
            name: 'mythforge-workspace',

            // Explicitly only persist core data points natively, dump transient UI flags on mount memory limits
            // SECURITY NOTE: apiKey stored in localStorage. Never log or expose this value.
            partialize: (state) => ({
                projects: state.projects,
                documents: state.documents,
                scenes: state.scenes,
                activeProjectId: state.activeProjectId,
                activeDocumentId: state.activeDocumentId,
                activeSceneId: state.activeSceneId,
                entities: state.entities,
                theme: state.theme,
                isSidebarOpen: state.isSidebarOpen,
                isTypewriterMode: state.isTypewriterMode,
                editorWidth: state.editorWidth,
                tabRailWidth: state.tabRailWidth,
                panelWidth: state.panelWidth,
                aiConfig: state.aiConfig,
                writingGoal: state.writingGoal,
                customAtmospheres: state.customAtmospheres,
                atmospheresEnabled: state.atmospheresEnabled,
                atmosphereTypographyEnabled: state.atmosphereTypographyEnabled,
                atmosphereReducedMotion: state.atmosphereReducedMotion
            }),

            // Track hydration phases allowing components to await persistence payload dynamically
            onRehydrateStorage: () => (state) => {
                if (state) {
                    // WORKAROUND(migration): Migrate legacy root-level localStorage data to the new Project architecture.
                    // Root cause: Pre-Sprint 13, documents did not exist natively inside the Zustand workspace structure.
                    // Remove when: After sufficient cycles (e.g. 2 months), assuming all clients have synced.
                    if (state.projects.length === 0) {
                        logger.info('Migrating legacy data to new Project architecture.');
                        const defaultProject: Project = {
                            id: crypto.randomUUID(),
                            name: 'My First Project',
                            createdAt: new Date()
                        };
                        const defaultDocument: Document = {
                            id: crypto.randomUUID(),
                            projectId: defaultProject.id,
                            title: getStoredValue('mythforge-document-title') || 'Untitled Chapter',
                            content: getStoredValue('mythforge-document-content') || '',
                            createdAt: new Date()
                        };

                        state.projects = [defaultProject];
                        state.documents = [defaultDocument];
                        state.activeProjectId = defaultProject.id;
                        state.activeDocumentId = defaultDocument.id;
                        state.entities = state.entities.map(e => ({ ...e, projectId: defaultProject.id }));
                    }

                    // WORKAROUND(migration): Migrate Document content down to Scene layer (Sprint 20).
                    if ((!state.scenes || state.scenes.length === 0) && state.documents.length > 0) {
                        logger.info('Migrating document content to Scene layer.');
                        const newScenes: Scene[] = [];
                        let newActiveSceneId: string | null = null;

                        state.documents.forEach(doc => {
                            const sceneId = crypto.randomUUID();
                            newScenes.push({
                                id: sceneId,
                                documentId: doc.id,
                                projectId: doc.projectId,
                                title: 'Scene 1',
                                content: doc.content || '',
                                order: 0,
                                createdAt: new Date()
                            });

                            // Clear content from document
                            doc.content = '';

                            if (doc.id === state.activeDocumentId) {
                                newActiveSceneId = sceneId;
                            }
                        });

                        state.scenes = newScenes;
                        state.activeSceneId = newActiveSceneId;
                    }

                    state.setHasHydrated(true);
                }
            },

            // Intercept JSON deserialization to properly reconstruct native Javascript `Date` objects
            storage: createJSONStorage(() => localStorage, {
                reviver: (key, value) => {
                    // Check if the current value iteration dictates an internal array
                    // This handles `entities`, `projects`, and `documents` equally since they all have `createdAt` Date stamps.
                    if (Array.isArray(value)) {
                        return value.map((item: Record<string, unknown>) => ({
                            ...item,
                            // Verify structural mapping if it contains our `createdAt` tag
                            ...(item.createdAt ? { createdAt: new Date(item.createdAt as string) } : {}),
                            ...(item.updatedAt ? { updatedAt: new Date(item.updatedAt as string) } : {})
                        }));
                    }
                    return value;
                },
            }),
        }
    )
);
