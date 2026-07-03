import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { logger } from '@/lib/logger';
import { getStoredValue } from '@/lib/storage';
import { worldKeyForProject, worldKeyForEntity, type WorldKey } from '@/lib/worldKey';
import { migrateWorkspaceSchema } from './migrateWorkspaceSchema';
import { DEFAULT_WORLD_BIBLE_LAYOUT } from '@/lib/worldBibleNav';
import { wouldCreateCycle, fileByType } from '@/lib/folderTree';

// Cover colors auto-assigned to new projects in rotation
export const COVER_COLORS = [
    '#4A6FA5', '#6B4C9A', '#2E8B57', '#C0392B',
    '#D46A1A', '#1A7A8A', '#7A4A2E', '#4A4A8A'
];

export interface WritingGoal {
    dailyTarget: number;
    sessionTarget: number;
}


export type EntityType = 'character' | 'location' | 'faction' | 'artifact' | 'lore' | 'magic' | 'religion' | 'species';
export type ThemeMode = 'light' | 'dark' | 'system';
// Theme family is orthogonal to light/dark mode: each family supplies its own
// light and dark palettes. 'default' is the original Procreate-clean look;
// 'fantasy' is the parchment cartographer look (see globals.css).
export type ThemeFamily = 'default' | 'fantasy';

export type WorldGenre =
  | 'fantasy'
  | 'sci-fi'
  | 'real-world'
  | 'alternate-history'
  | 'horror'
  | 'contemporary';

export interface WorldTone {
  darkness: 'dark' | 'balanced' | 'light';
  scale: 'grounded' | 'balanced' | 'epic';
  humor: 'serious' | 'balanced' | 'comedic';
}

export interface World {
  id: string;
  name: string;
  genre: WorldGenre;
  tone: WorldTone;
  logline: string;
  magicExists: boolean;
  techLevel: 'primitive' | 'medieval' | 'modern' | 'futuristic' | 'post-apocalyptic';
  timePeriod: string;
  coverColor: string;
  createdAt: Date;
  updatedAt?: Date;
}

/** A single root category in the World Bible hierarchy */
export interface WorldBibleRootConfig {
  id: string;            // stable UUID — used as React key
  label: string;         // display name e.g. "People", "Mortals"
  icon: string;          // emoji e.g. "👤"
  entityTypes: EntityType[]; // which entity types live here
  parentId?: string;     // Sprint 66: optional parent for nesting
  x?: number;            // Sprint 65: spatial canvas position
  y?: number;
  width?: number;        // Sprint 67: resizable active area
  height?: number;
}

/** Per-project World Bible layout customization */
export interface WorldBibleLayout {
  roots: WorldBibleRootConfig[];
}

/** Everything a single shelf's World Bible owns. Keyed by WorldKey in the store. */
export interface WorldBibleConfig {
  layout: WorldBibleLayout;
  /** Cover title — defaults to the world name / "Standalones" when unset. */
  coverTitle?: string;
  /** Cover subtitle — defaults to "World Bible" when unset. */
  coverSub?: string;
  /** Cover accent color (hex). */
  tint?: string;
}

export interface Project {
    id: string;
    name: string;
    writingMode: 'novel' | 'screenplay' | 'markdown' | 'poetry' | 'real-world';
    coverColor: string;
    coverImageUrl?: string;
    worldId?: string;
    createdAt: Date;
    updatedAt?: Date;
    /** Optional character entity this project is attributed to — shown on their article */
    attributedEntityId?: string;
    description?: string;
    authorName?: string;
    worldBibleLayout?: WorldBibleLayout;
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
}

export type BlockType = 'richtext' | 'image' | 'statrow' | 'divider' | 'quote' | 'timeline';

export interface ArticleBlock {
  id: string;
  type: BlockType;
  x: number;
  y: number;
  content: { [key: string]: any };
  /** Sprint 50: optional block dimensions set by resize handle — undefined = full width / auto height */
  width?: number;
  height?: number;
  // Per-type content shapes:
  // richtext: { html: string }
  // image: { src: string; caption?: string }
  // statrow: { label: string; value: string }
  // divider: {}
  // quote: { text: string; attribution?: string }
  // timeline: { events: { date: string; label: string; detail?: string }[] }
}

export interface ArticleTemplate {
  id: string;
  name: string;
  description?: string;
  // Block structure only — content is stripped, only type is preserved
  blocks: Array<{ type: BlockType }>;
  createdAt: Date;
}

export interface HierarchyTemplate {
  id: string;
  name: string;
  description?: string;
  layout: WorldBibleLayout;
  createdAt: Date;
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
    lore: "Lore / Event",
    magic: "Magic System",
    religion: "Religion / Deity",
    species: "Species / Race",
};

// =============================================
// Character Profile ("Glamour" template)
// =============================================

export interface ProfileField { label: string; value: string; }
export interface ProfileMeter { label: string; level: number; } // 0–100
export interface PersonaRow { image?: string; label?: string; heading?: string; text?: string; }
export interface PaletteSwatch { name: string; hex: string; }
export interface LookItem { label: string; value?: string; image?: string; }
export interface MoodItem { image?: string; caption?: string; }
export interface AppearanceSection { label: string; note?: string; moodboard?: MoodItem[]; }
export interface RelationEntry { image?: string; name?: string; relation?: string; text?: string; }

export interface CharacterProfile {
    tagline?: string;
    decorImages?: string[];
    quote?: string;
    fullName?: string;
    dossier?: ProfileField[];
    firstImpression?: string;
    bio?: string;
    corePersonality?: { image?: string; heading?: string; text?: string };
    personaRows?: PersonaRow[];
    meters?: ProfileMeter[];
    dos?: string;
    donts?: string;
    palette?: PaletteSwatch[];
    lookbook?: LookItem[];
    visualImpression?: string;
    appearanceSections?: AppearanceSection[];
    relations?: RelationEntry[];
}

/** A profile scaffold so a new character's pages aren't blank. */
export function createDefaultProfile(): CharacterProfile {
    return {
        dossier: [
            { label: 'Age', value: '' },
            { label: 'Gender', value: '' },
            { label: 'Sexuality', value: '' },
            { label: 'Origin', value: '' },
            { label: 'Job', value: '' },
            { label: 'Role', value: '' },
            { label: 'Status', value: '' },
        ],
        personaRows: [],
        meters: [],
        palette: [],
        lookbook: [],
        appearanceSections: [],
        relations: [],
        decorImages: [],
    };
}

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
    /** Sprint 46A: base64 or URL for card image */
    imageUrl?: string;
    /** Sprint 46A: pinned to favorites strip */
    isFavorite?: boolean;
    /** Sprint 46A: user-defined or preset sublabel */
    subcategory?: string;
    /** Sprint 46A: flexible key/value pairs for custom metadata */
    customFields?: { label: string; value: string }[];
    /** Sprint 48A: block-based article content */
    articleBlocks?: ArticleBlock[];
    /** Sprint 52: TipTap HTML content for the Document-mode article editor — separate from articleBlocks */
    articleDoc?: string;
    /** Sprint 60: structured character profile ("glamour" template). */
    profile?: CharacterProfile;
    /** Sprint 69: the world (shelf) this entity belongs to. undefined = standalone shelf. */
    worldId?: string;
    /** Sprint 71: the folder (WorldBibleRootConfig id in this world's bible)
     *  this article lives in. undefined = Unfiled. Dormant until Phase 3B UI. */
    categoryId?: string;
}

// =============================================
// Writing Desk System Interfaces
// =============================================

export type DeskWidgetType = 'writingZone' | 'sticky' | 'reference' | 'image' | 'biblePinit' | 'sceneControl' | 'characterState' | 'continuity' | 'structure' | 'research' | 'progress' | 'relMap' | 'draftNav' | 'untyped';

export interface DeskWidget {
  id: string;
  type: DeskWidgetType;
  x: number;
  y: number;
  width: number;
  height: number;
  content: Record<string, any>;
  dock?: 'center' | 'left' | 'right' | null;
  /** Linked scope for visibility logic */
  scope?: 'scene' | 'chapter' | 'project' | 'global';
  scopeId?: string;
}

export interface DeskState {
  widgets: DeskWidget[];
  zoom: number;
  canvasOffset: { x: number; y: number };
}

export interface SceneSnapshot {
  id: string;
  sceneId: string;
  projectId: string;
  label: string;          // "Auto — 2:34 PM" or user-typed name
  content: string;        // full HTML content at snapshot time
  wordCount: number;
  createdAt: Date;
  isAuto: boolean;
}

export interface EntitySnapshot {
  id: string;
  entityId: string;
  projectId: string;
  label: string;
  articleDoc: string;     // full TipTap HTML at snapshot time
  createdAt: Date;
  isAuto: boolean;
}

/**
 * Extended entity type for characters — adds character-specific fields
 * that don't apply to locations, factions, etc.
 */
export interface CharacterEntity extends Entity {
    type: 'character';
    voiceSamples?: string[];
}

/**
 * Type guard to narrow an Entity to CharacterEntity.
 * Use wherever character-specific fields (e.g. voiceSamples) are accessed.
 */
export function isCharacterEntity(entity: Entity): entity is CharacterEntity {
    return entity.type === 'character';
}

// =============================================
// Sprint 47A: Goals System Interfaces
// =============================================

/** One entry per project per calendar day — auto-tracked from editor */
export interface WritingDay {
    id: string;
    projectId: string;
    date: string;             // YYYY-MM-DD format
    wordsWritten: number;
    minutesWritten: number;
    goalMet: boolean;
}

/** User-configured goal settings */
interface GoalConfig {
    dailyWordTarget: number;       // default: 200
    dailyTimeTarget: number;       // minutes, default: 20
    primaryMetric: 'words' | 'time'; // default: 'words'
    writingDaysPerWeek: number;    // default: 5
    streakRepairsAvailable: number; // default: 1
    goalConfigured: boolean;       // false until user sets goal
}

/** Cached streak state — derived from WritingDay history */
export interface StreakState {
    currentStreak: number;         // consecutive writing days
    longestStreak: number;         // all-time longest streak
    lastWritingDate: string;       // YYYY-MM-DD
    totalWritingDays: number;      // all-time days written
    totalWordsAllTime: number;     // all-time word count
}

/** Static badge definitions — IDs are stable strings used as keys */
export const BADGE_DEFINITIONS = {
    first_day: {
        id: 'first_day',
        name: 'The First Day',
        description: 'You showed up. That is how every story starts.',
        icon: '✏️',
    },
    seven_day_streak: {
        id: 'seven_day_streak',
        name: 'The Habit',
        description: 'Seven days. You showed up seven days in a row.',
        icon: '🔥',
    },
    ten_thousand_words: {
        id: 'ten_thousand_words',
        name: 'Ten Thousand',
        description: 'Ten thousand words. A short story\'s worth of showing up.',
        icon: '📖',
    },
    thirty_day_streak: {
        id: 'thirty_day_streak',
        name: 'The Ritual',
        description: 'Thirty days. Writing is no longer something you do. It is who you are.',
        icon: '⭐',
    },
    fifty_thousand_words: {
        id: 'fifty_thousand_words',
        name: 'Novel Length',
        description: 'Fifty thousand words. You have written a novel\'s worth of words.',
        icon: '🏆',
    },
} as const;

/** Earned badge record — stored per user */
interface EarnedBadge {
    badgeId: keyof typeof BADGE_DEFINITIONS;
    earnedAt: Date;
}

/** XP event log — data layer only, not shown in UI yet */
interface XPEvent {
    id: string;
    type: 'goal_met' | 'streak_milestone' | 'project_milestone' | 'first_session';
    xp: number;
    projectId?: string;
    earnedAt: Date;
}

export interface SocialPost {
    id: string;
    platform: string;
    content: string;
    timestamp: string;
}

export type WorkspaceMode = 'worldBible' | 'worldBibleEdit' | 'template' | 'desk' | 'hierarchy' | 'bookshelf';

export interface WorkspaceState {
    workspaceMode: WorkspaceMode;
    // --- STATE FIELDS ---
    worlds: World[];
    projects: Project[];
    documents: Document[];
    scenes: Scene[];
    activeProjectId: string | null;
    activeDocumentId: string | null;
    activeSceneId: string | null;
    sceneSnapshots: SceneSnapshot[];
    entitySnapshots: EntitySnapshot[];

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
     * The current theme family (visual style). Combines with `theme` mode to
     * pick the active palette: family × {light, dark}.
     */
    themeFamily: ThemeFamily;

    /**
     * Whether the World Bible sidebar is currently visible.
     */
    isSidebarOpen: boolean;

    /**
     * Whether the Global Command Palette is currently active.
     */
    isCommandPaletteOpen: boolean;
    /** Whether the Export modal overlay is currently open. */
    isExportOpen: boolean;
    /** Browser spellcheck in editors — off by default fights fantasy names less. */
    isSpellcheckEnabled: boolean;

    /**
     * The currently active side panel.
     * Sprint 62: Centralized for beta feedback and future integrations.
     */
    activePanel: 'worldBible' | 'consistency' | 'writingGoals' | 'socialMedia' | 'aiChatbot' | 'music' | 'beta' | 'versionHistory' | null;

    /**
     * Typewriter mode keeps the active line centered in the viewport.
     */
    isTypewriterMode: boolean;

    /**
     * Hides the UI layout framing (sidebar, etc) around the editor content.
     */
    isFullscreen: boolean;

    /**
     * Focus mode hides sidebar and right rail panels for distraction-free writing.
     */
    isFocusMode: boolean;

    /**
     * Width constraints for the main WritingEditor flow. Default 800px.
     */
    editorWidth: number;

    /** Width of the left navigation sidebar in pixels. User-adjustable. */
    navPanelWidth: number;

    /** Optional maximum width for the editor. If null, uses flex behavior. */
    editorMaxWidth: number | null;

    /** Caches editorMaxWidth before snapping to standard format. */
    cachedEditorMaxWidth: number | null;

    /** Whether the editor is snapped to a 720px standard text width. */
    isStandardFormat: boolean;

    /** Width of the right-edge panel tabs in pixels. User-adjustable. */
    tabRailWidth: number;

    /** Width of the slide-out panels in pixels. User-adjustable. */
    panelWidth: number;

    /** Width of the article active zone in pixels. Independent of UI panel width. */
    articleZoneWidth: number;

    /**
     * The currently selected entity for the detail panel view.
     * This is intentionally not persisted (resets to null on refresh).
     */
    selectedEntityId: string | null;
    
    /** Whether the World Bible Hierarchy Designer modal is open */
    isHierarchyModalOpen: boolean;
    /** Whether the designer should start in scratch mode */
    isHierarchyScratchMode: boolean;

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
     * User's established targets for words per day/session.
     */
    writingGoal: WritingGoal;

    /**
     * Words added during this specific browser session.
     */
    sessionWordCount: number;

    /** Toggle for persistent rich text toolbar visibility */
    isToolbarVisible: boolean;

    /**
     * Global fallback writing mode. Per-project mode (project.writingMode) takes precedence.
     * Kept for backward compatibility with WritingEditor fallback logic.
     */
    writingMode: 'novel' | 'screenplay' | 'markdown' | 'poetry';

    /**
     * Base font size for the writing editor in pixels.
     * Default 20px (approx 1.25rem).
     */
    baseFontSize: number;

    /**
     * The ID of the entity whose article is currently focused in the center column.
     * This is NOT persisted (resets to null on reload).
     */
    focusedArticleEntityId: string | null;

    /**
     * User-saved block layout templates for the Article Canvas.
     */
    articleTemplates: ArticleTemplate[];

    /**
     * User-saved hierarchy layout templates for the World Bible.
     */
    hierarchyTemplates: HierarchyTemplate[];

    /**
     * TEMPORARY hierarchy layout used while designing in the Draft Table.
     * Prevents live projects from being updated automatically.
     */
    draftHierarchyLayout: WorldBibleLayout | null;

    /**
     * Desk widgets that are globally available across all projects.
     */
    globalWidgets: DeskWidget[];

    /**
     * Writing Desk states per project.
     */
    deskStates: Record<string, DeskState>;

    /** Sprint 69: per-shelf World Bible configs, keyed by world id or 'standalone'. */
    worldBibles: Record<WorldKey, WorldBibleConfig>;
    /** Sprint 69: which shelf's bible is currently open (null = derive from active project). */
    activeWorldKey: WorldKey | null;

    setWorkspaceMode: (mode: WorkspaceMode) => void;
    setActiveWorldKey: (key: WorldKey | null) => void;

    /** Sprint 70: edit a bible's identity fields (cover title/sub/tint). */
    updateWorldBibleConfig: (key: WorldKey, patch: Partial<Omit<WorldBibleConfig, 'layout'>>) => void;
    /** Sprint 70: replace a bible's layout wholesale (presets, reset). */
    setWorldBibleLayout: (key: WorldKey, layout: WorldBibleLayout) => void;
    /** Sprint 71: replace a bible's layout AND re-file its articles by type. */
    applyBibleLayout: (key: WorldKey, layout: WorldBibleLayout) => void;
    /** Sprint 70: danger zone — delete every entity belonging to a shelf. */
    deleteWorldEntities: (key: WorldKey) => void;

    // --- ACTIONS ---
    addWorld: (world: World) => void;
    /** Update an existing world's metadata */
    updateWorld: (id: string, updates: Partial<Omit<World, 'id' | 'createdAt'>>) => void;
    /** Delete a world and reassign its projects to Uncategorized */
    deleteWorld: (id: string) => void;
    addProject: (project: Project) => void;
    updateProject: (id: string, updates: Partial<Omit<Project, 'id' | 'createdAt'>>) => void;
    deleteProject: (id: string) => void;

    addDocument: (document: Document) => void;
    updateGlobalWidgets: (widgets: DeskWidget[]) => void;
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
     * Sets the current theme family (visual style).
     */
    setThemeFamily: (family: ThemeFamily) => void;

    /**
     * Toggles the visibility of the World Bible sidebar.
     */
    toggleSidebar: () => void;

    /**
     * Toggles the command palette.
     */
    setCommandPaletteOpen: (open: boolean) => void;
    setExportOpen: (open: boolean) => void;
    setSpellcheckEnabled: (on: boolean) => void;

    /**
     * Toggles Typewriter layout mode.
     */
    toggleTypewriterMode: () => void;

    /**
     * Toggles the distraction-free Fullscreen mode.
     */
    toggleFullscreen: () => void;

    /**
     * Toggles Focus mode (hides sidebar and right rail).
     */
    toggleFocusMode: () => void;

    /** Sets the currently active side panel */
    setActivePanel: (activePanel: 'worldBible' | 'writingGoals' | 'socialMedia' | 'music' | 'beta' | 'versionHistory' | null) => void;

    /** Spotify Controls */
    setSpotifyUrl: (url: string | null) => void;
    setSpotifyOpen: (isOpen: boolean) => void;

    /**
     * Customizes the max-width bounding box for the writing editor text block.
     */
    setEditorWidth: (width: number) => void;

    setTabRailWidth: (width: number) => void;
    setPanelWidth: (width: number) => void;
    setArticleZoneWidth: (width: number) => void;

    setNavPanelWidth: (width: number) => void;
    setEditorMaxWidth: (width: number | null) => void;
    toggleStandardFormat: () => void;

    /** Sets the currently selected entity for the detail view. */
    setSelectedEntity: (id: string | null) => void;

    /** Hierarchy Canvas Management */
    addWorldBibleRoot: (root: WorldBibleRootConfig, isDraft?: boolean) => void;
    updateWorldBibleRoot: (id: string, updates: Partial<Omit<WorldBibleRootConfig, 'id'>>, isDraft?: boolean) => void;
    deleteWorldBibleRoot: (id: string, isDraft?: boolean) => void;
    moveWorldBibleType: (type: EntityType, fromRootId: string, toRootId: string, isDraft?: boolean) => void;

    /** Designer / Draft Table State */
    setDraftHierarchyLayout: (layout: WorldBibleLayout | null) => void;
    applyDraftHierarchy: () => void;

    /** Updates an existing entity. */
    updateEntity: (id: string, updates: Partial<Omit<Entity, 'id' | 'createdAt'>>) => void;

    /**
     * Deletes an entity by ID.
     */
    deleteEntity: (id: string) => void;

    /** Controls the global Hierarchy Designer modal */
    setHierarchyModal: (open: boolean, scratch?: boolean) => void;

    /** Sprint 46A: Toggle an entity's favorite status */
    toggleEntityFavorite: (id: string) => void;

    /** Sprint 46A: Update an entity's image URL */
    updateEntityImage: (id: string, imageUrl: string) => void;

    /** Sprint 48A: update entity article blocks */
    updateEntityArticle: (entityId: string, blocks: ArticleBlock[]) => void;

    /** Sprint 52: Save TipTap document HTML for an entity */
    updateEntityDoc: (entityId: string, html: string) => void;

    /**
     * Updates the internal tracking flag verifying persistence load.
     */
    setHasHydrated: (state: boolean) => void;

    /** Toggles the rich text toolbar visibility */
    toggleToolbarVisible: () => void;

    /** Sets the global fallback writing mode */
    setWritingMode: (mode: 'novel' | 'screenplay' | 'markdown' | 'poetry') => void;

    /** Sets the base font size for the editor */
    setBaseFontSize: (size: number) => void;

    /** Sets the focused article entity for the center column view */
    setFocusedArticleEntity: (entityId: string | null) => void;

    /** Save current article blocks as a structural template */
    saveArticleTemplate: (name: string, description: string | undefined, sourceBlocks: ArticleBlock[]) => void;
    
    /** Delete a template from the library */
    deleteArticleTemplate: (templateId: string) => void;
    
    /** Apply a template's structure to an entity's article */
    applyArticleTemplate: (entityId: string, templateId: string) => void;

    /** Writing Desk Actions */
    updateDeskState: (projectId: string, updates: Partial<DeskState>) => void;
    pinEntityToDesk: (projectId: string, entityId: string) => void;


    /**
     * Updates the user's daily/session writing target targets.
     */
    setWritingGoal: (goal: Partial<WritingGoal>) => void;

    /**
     * Set the current running session's word count derived from editor diffs.
     */
    setSessionWordCount: (count: number) => void;

    // --- SPRINT 47A: GOALS SYSTEM ACTIONS ---
    writingDays: WritingDay[];
    goalConfig: GoalConfig;
    streakState: StreakState;
    earnedBadges: EarnedBadge[];
    xpEvents: XPEvent[];

    socialHistory: SocialPost[];
    addSocialPost: (post: Omit<SocialPost, 'id' | 'timestamp'>) => void;
    deleteSocialPost: (id: string) => void;

    /** Record a writing session — called by editor autosave flow */
    recordWritingSession: (projectId: string, wordsAdded: number, minutesSpent: number) => void;
    /** Update goal configuration — sets goalConfigured: true */
    updateGoalConfig: (updates: Partial<GoalConfig>) => void;
    /** Repair a broken streak by marking a date as goalMet */
    repairStreak: (date: string) => void;
    /** Recompute streakState from writingDays history */
    computeStreakState: () => StreakState;
    /** Check milestones and award badges that haven't been earned yet */
    checkAndAwardBadges: () => void;

    saveSceneSnapshot: (sceneId: string, label: string, isAuto: boolean) => void;
    saveEntitySnapshot: (entityId: string, label: string, isAuto: boolean) => void;
    restoreSceneSnapshot: (snapshotId: string) => void;
    restoreEntitySnapshot: (snapshotId: string) => void;
    deleteSnapshot: (snapshotId: string, type: 'scene' | 'entity') => void;

    /** World Bible Hierarchy Templates */
    saveHierarchyTemplate: (name: string, description: string | undefined, layout: WorldBibleLayout) => void;
    deleteHierarchyTemplate: (templateId: string) => void;
    applyHierarchyTemplate: (worldKey: WorldKey, templateId: string) => void;
}

/**
 * Applies fn to the active shelf's bible layout. First-time customization
 * seeds from the DEFAULT layout (deep copy) so user edits start from
 * People/Places/Things/World Systems instead of an empty layout.
 */
function withActiveBibleLayout(
    state: Pick<WorkspaceState, 'activeWorldKey' | 'worldBibles'>,
    fn: (layout: WorldBibleLayout) => WorldBibleLayout,
): Partial<WorkspaceState> {
    const key = state.activeWorldKey;
    if (!key) return {};
    const existing = state.worldBibles[key]?.layout;
    const current: WorldBibleLayout = existing?.roots?.length
        ? existing
        : JSON.parse(JSON.stringify(DEFAULT_WORLD_BIBLE_LAYOUT));
    return {
        worldBibles: {
            ...state.worldBibles,
            [key]: { ...state.worldBibles[key], layout: fn(current) },
        },
    };
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
 * supporting the lorecanvas offline standalone nature.
 * `partialize` explicitly omits standard transient UI variables (`hoveredEntityId`, etc)
 * so refreshing never caches a stuck hover box overlay.
 */

// =============================================
// Sprint 47A: Pure helper functions for goals
// =============================================

/**
 * Compute streak state from a list of WritingDay entries.
 * Pure function — no store dependency.
 */
export function computeStreakFromDays(days: WritingDay[]): StreakState {
    // Get unique dates where goal was met (across all projects)
    const metDates = [...new Set(
        days.filter(d => d.goalMet).map(d => d.date)
    )].sort(); // ascending

    // Total words across all entries
    const totalWordsAllTime = days.reduce((sum, d) => sum + d.wordsWritten, 0);

    // Total unique writing days (goal met)
    const totalWritingDays = metDates.length;

    // Last writing date (any words > 0)
    const datesWithWords = [...new Set(
        days.filter(d => d.wordsWritten > 0).map(d => d.date)
    )].sort();
    const lastWritingDate = datesWithWords.length > 0
        ? datesWithWords[datesWithWords.length - 1]
        : '';

    if (metDates.length === 0) {
        return { currentStreak: 0, longestStreak: 0, lastWritingDate, totalWritingDays, totalWordsAllTime };
    }

    // Helper: add N days to a YYYY-MM-DD string
    const addDays = (dateStr: string, n: number): string => {
        const d = new Date(dateStr + 'T00:00:00');
        d.setDate(d.getDate() + n);
        return d.toISOString().split('T')[0];
    };

    const metSet = new Set(metDates);
    const today = new Date().toISOString().split('T')[0];

    // Current streak: count consecutive days backward from today (or yesterday)
    let currentStreak = 0;
    let checkDate = metSet.has(today) ? today : addDays(today, -1);
    while (metSet.has(checkDate)) {
        currentStreak++;
        checkDate = addDays(checkDate, -1);
    }

    // Longest streak: scan all met dates for longest consecutive run
    let longestStreak = 0;
    let runLength = 1;
    for (let i = 1; i < metDates.length; i++) {
        const expected = addDays(metDates[i - 1], 1);
        if (metDates[i] === expected) {
            runLength++;
        } else {
            longestStreak = Math.max(longestStreak, runLength);
            runLength = 1;
        }
    }
    longestStreak = Math.max(longestStreak, runLength);

    return { currentStreak, longestStreak, lastWritingDate, totalWritingDays, totalWordsAllTime };
}

/**
 * Check badge conditions and return any newly earned badges.
 * Pure function — compares streak state against already-earned badges.
 */
function checkBadges(streak: StreakState, earned: EarnedBadge[]): EarnedBadge[] {
    const earnedIds = new Set(earned.map(b => b.badgeId));
    const newBadges: EarnedBadge[] = [];
    const now = new Date();

    const conditions: [keyof typeof BADGE_DEFINITIONS, boolean][] = [
        ['first_day', streak.totalWritingDays >= 1],
        ['seven_day_streak', streak.currentStreak >= 7],
        ['thirty_day_streak', streak.currentStreak >= 30],
        ['ten_thousand_words', streak.totalWordsAllTime >= 10000],
        ['fifty_thousand_words', streak.totalWordsAllTime >= 50000],
    ];

    for (const [id, met] of conditions) {
        if (met && !earnedIds.has(id)) {
            newBadges.push({ badgeId: id, earnedAt: now });
        }
    }

    return newBadges;
}

/**
 * Debounced localStorage adapter.
 *
 * Zustand's persist middleware writes synchronously on every `set()`. With the
 * full workspace (scenes + entity articles) that is a multi-MB JSON.stringify on
 * every keystroke. This coalesces writes to once per idle window, and flushes on
 * tab hide / unload so the final edit is never lost.
 */
const PERSIST_DEBOUNCE_MS = 1200;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let pendingWrite: { name: string; value: string } | null = null;

function flushPersist() {
    if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
    if (pendingWrite) {
        try { localStorage.setItem(pendingWrite.name, pendingWrite.value); } catch { /* quota */ }
        pendingWrite = null;
    }
}

const debouncedLocalStorage = {
    getItem: (name: string): string | null => localStorage.getItem(name),
    setItem: (name: string, value: string): void => {
        pendingWrite = { name, value };
        if (persistTimer) clearTimeout(persistTimer);
        persistTimer = setTimeout(flushPersist, PERSIST_DEBOUNCE_MS);
    },
    removeItem: (name: string): void => localStorage.removeItem(name),
};

if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flushPersist);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flushPersist();
    });
}

/** WorldKey of the ACTIVE PROJECT's shelf — for desk/editor surfaces. */
export const selectProjectWorldKey = (state: WorkspaceState): WorldKey =>
    worldKeyForProject(state.projects.find(p => p.id === state.activeProjectId));

/**
 * The persisted/synced subset of workspace state. Shared by the local persist
 * middleware AND the Supabase cloud sync so both layers always agree on the
 * payload — previously the cloud save shipped the full state (including
 * transient UI), which the local layer then disagreed with on rehydrate.
 */
export function partializeWorkspace(state: WorkspaceState) {
    return {
        worlds: state.worlds,
        projects: state.projects,
        documents: state.documents,
        scenes: state.scenes,
        activeProjectId: state.activeProjectId,
        activeDocumentId: state.activeDocumentId,
        activeSceneId: state.activeSceneId,
        entities: state.entities,
        theme: state.theme,
        themeFamily: state.themeFamily,
        isSidebarOpen: state.isSidebarOpen,
        isTypewriterMode: state.isTypewriterMode,
        isFocusMode: state.isFocusMode,
        editorWidth: state.editorWidth,
        tabRailWidth: state.tabRailWidth,
        panelWidth: state.panelWidth,
        articleZoneWidth: state.articleZoneWidth,
        writingGoal: state.writingGoal,
        isToolbarVisible: state.isToolbarVisible,
        writingMode: state.writingMode,
        navPanelWidth: state.navPanelWidth,
        baseFontSize: state.baseFontSize,
        editorMaxWidth: state.editorMaxWidth,
        cachedEditorMaxWidth: state.cachedEditorMaxWidth,
        isStandardFormat: state.isStandardFormat,
        isSpellcheckEnabled: state.isSpellcheckEnabled,
        // Sprint 47A: persist goals data (streakState is derived, not persisted)
        writingDays: state.writingDays,
        goalConfig: state.goalConfig,
        earnedBadges: state.earnedBadges,
        socialHistory: state.socialHistory,
        articleTemplates: state.articleTemplates,
        workspaceMode: state.workspaceMode,
        sceneSnapshots: state.sceneSnapshots,
        entitySnapshots: state.entitySnapshots,
        hierarchyTemplates: state.hierarchyTemplates,
        deskStates: state.deskStates,
        worldBibles: state.worldBibles,
        activeWorldKey: state.activeWorldKey,
    };
}

/**
 * One-time rename migration (MythForge -> LoreCanvas, June 2026).
 * Copies data from the old "mythforge-*" localStorage keys to the new
 * "lorecanvas-*" keys so existing users keep their work. Old keys are left
 * in place as a safety net. Must run BEFORE the store is created below,
 * because the persist middleware reads its key at creation time.
 */
function migrateRenamedStorageKeys() {
    if (typeof window === 'undefined') return;
    try {
        const RENAMES: Array<[string, string]> = [
            ['mythforge-workspace', 'lorecanvas-workspace'],
            ['mythforge-beta-feedback', 'lorecanvas-beta-feedback'],
            ['mythforge-music-library-v2', 'lorecanvas-music-library-v2'],
        ];
        for (const [oldKey, newKey] of RENAMES) {
            const oldVal = localStorage.getItem(oldKey);
            if (oldVal !== null && localStorage.getItem(newKey) === null) {
                localStorage.setItem(newKey, oldVal);
            }
        }
        // Backup ring: copy old-prefix backups to the new prefix once.
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k?.startsWith('mythforge-backup-')) continue;
            const newKey = k.replace('mythforge-backup-', 'lorecanvas-backup-');
            if (localStorage.getItem(newKey) === null) {
                const v = localStorage.getItem(k);
                if (v !== null) localStorage.setItem(newKey, v);
            }
        }
    } catch {
        // localStorage unavailable or full — the app still works from defaults.
    }
}
migrateRenamedStorageKeys();

export const useWorkspaceStore = create<WorkspaceState>()(
    persist(
        (set, get) => ({
            worlds: [],
            projects: [],
            documents: [],
            scenes: [],
            activeProjectId: null,
            activeDocumentId: null,
            activeSceneId: null,
            sceneSnapshots: [],
            entitySnapshots: [],
            entities: [],
            hoveredEntityId: null,
            isInlineCreatorOpen: false,
            pendingEntityName: null,
            theme: 'system',
            themeFamily: 'default',
            isSidebarOpen: true,
            isCommandPaletteOpen: false,
            isExportOpen: false,
            isSpellcheckEnabled: true,
            isTypewriterMode: false,
            activePanel: null,
            isFullscreen: false,
            isFocusMode: false,
            spotifyUrl: null,
            isSpotifyOpen: false,
            editorWidth: 800,
            navPanelWidth: 220,
            editorMaxWidth: null,
            cachedEditorMaxWidth: null,
            isStandardFormat: false,
            globalWidgets: [],
            tabRailWidth: 72,
            panelWidth: 480,
            articleZoneWidth: 680,
            selectedEntityId: null,
            isHierarchyModalOpen: false,
            isHierarchyScratchMode: false,
            _hasHydrated: false,
            deskStates: {},
            writingGoal: { dailyTarget: 0, sessionTarget: 0 },
            sessionWordCount: 0,
            isToolbarVisible: true,
            writingMode: 'novel',
            baseFontSize: 20,
            focusedArticleEntityId: null,
            articleTemplates: [],
            hierarchyTemplates: [],
            draftHierarchyLayout: null,
            workspaceMode: 'bookshelf',
            worldBibles: {},
            activeWorldKey: null,

            // Sprint 47A: Goals system initial state
            writingDays: [],
            goalConfig: {
                dailyWordTarget: 200,
                dailyTimeTarget: 20,
                primaryMetric: 'words',
                writingDaysPerWeek: 5,
                streakRepairsAvailable: 1,
                goalConfigured: false,
            },
            streakState: {
                currentStreak: 0,
                longestStreak: 0,
                lastWritingDate: '',
                totalWritingDays: 0,
                totalWordsAllTime: 0,
            },
            earnedBadges: [],
            xpEvents: [],
            socialHistory: [],

            addWorld: (world) =>
                set((state) => {
                    logger.info('World added:', world.name);
                    return { worlds: [...state.worlds, world] };
                }),

            updateWorld: (id, updates) =>
                set((state) => {
                    logger.info('World updated:', id);
                    return {
                        worlds: state.worlds.map(w =>
                            w.id === id ? { ...w, ...updates, updatedAt: new Date() } : w
                        ),
                    };
                }),

            deleteWorld: (id) =>
                set((state) => {
                    logger.info('World deleted (reassigning orphans):', id);
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { [id]: _removed, ...remainingBibles } = state.worldBibles;
                    return {
                        worlds: state.worlds.filter(w => w.id !== id),
                        // Sprint 66: Projects tied to this world move to Uncategorized (standalone)
                        projects: state.projects.map(p =>
                            p.worldId === id ? { ...p, worldId: undefined, updatedAt: new Date() } : p
                        ),
                        // Lore moves to the standalone shelf, mirroring projects
                        entities: state.entities.map(e =>
                            e.worldId === id ? { ...e, worldId: undefined, categoryId: undefined } : e
                        ),
                        worldBibles: remainingBibles,
                        activeWorldKey: state.activeWorldKey === id ? null : state.activeWorldKey,
                    };
                }),

            addProject: (project) =>
                set((state) => {
                    logger.info('Project added:', project.name);
                    return { projects: [...state.projects, project] };
                }),

            updateProject: (id, updates) =>
                set((state) => {
                    logger.info('Project updated:', id);
                    return {
                        projects: state.projects.map(p =>
                            p.id === id ? { ...p, ...updates, updatedAt: new Date() } : p
                        ),
                    };
                }),

            deleteProject: (id) =>
                set((state) => {
                    logger.info('Project deleted (lore stays with its world):', id);
                    return {
                        projects: state.projects.filter(p => p.id !== id),
                        documents: state.documents.filter(d => d.projectId !== id),
                        scenes: state.scenes.filter(s => s.projectId !== id),
                        activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
                        activeDocumentId: state.documents.find(d => d.id === state.activeDocumentId)?.projectId === id ? null : state.activeDocumentId,
                        activeSceneId: state.scenes.find(s => s.id === state.activeSceneId)?.projectId === id ? null : state.activeSceneId,
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
                        documents: state.documents.map(d =>
                            d.id === id ? { ...d, ...updates, updatedAt: new Date() } : d
                        ),
                    };
                }),

            updateGlobalWidgets: (widgets) =>
                set(() => ({ globalWidgets: widgets })),

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
                        scenes: state.scenes.map(s =>
                            s.id === id ? { ...s, ...updates, updatedAt: new Date() } : s
                        ),
                    };
                }),

            updateEntityArticle: (entityId, blocks) =>
                set((state) => {
                    logger.info('Entity article updated:', entityId);
                    return {
                        entities: state.entities.map(e =>
                            e.id === entityId ? { ...e, articleBlocks: blocks, updatedAt: new Date() } : e
                        ),
                    };
                }),

            /** Sprint 52: Save TipTap document HTML for an entity */
            updateEntityDoc: (entityId, html) =>
                set((state) => ({
                    entities: state.entities.map(e =>
                        e.id === entityId ? { ...e, articleDoc: html, updatedAt: new Date() } : e
                    ),
                })),

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
                    return { entities: [...state.entities, entity] };
                }),

            setHoveredEntity: (id) =>
                set(() => ({ hoveredEntityId: id })),

            openInlineCreator: (name?: string) =>
                set(() => ({ isInlineCreatorOpen: true, pendingEntityName: name ?? null })),

            closeInlineCreator: () =>
                set(() => ({ isInlineCreatorOpen: false, pendingEntityName: null })),

            setTheme: (theme) =>
                set(() => ({ theme })),

            setThemeFamily: (themeFamily) =>
                set(() => ({ themeFamily })),

            toggleSidebar: () =>
                set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

            setCommandPaletteOpen: (open) =>
                set(() => ({ isCommandPaletteOpen: open })),

            setExportOpen: (open) =>
                set(() => ({ isExportOpen: open })),

            setSpellcheckEnabled: (on) =>
                set(() => ({ isSpellcheckEnabled: on })),

            toggleTypewriterMode: () =>
                set((state) => ({ isTypewriterMode: !state.isTypewriterMode })),

            toggleFullscreen: () =>
                set((state) => ({ isFullscreen: !state.isFullscreen })),

            setActivePanel: (activePanel) =>
                set(() => ({ activePanel })),

            addSocialPost: (post) =>
                set((state) => ({
                    socialHistory: [
                        { ...post, id: crypto.randomUUID(), timestamp: new Date().toISOString() },
                        ...state.socialHistory
                    ]
                })),

            deleteSocialPost: (id) =>
                set((state) => ({
                    socialHistory: state.socialHistory.filter(p => p.id !== id)
                })),

            toggleFocusMode: () =>
                set((state) => ({ isFocusMode: !state.isFocusMode })),

            setSpotifyUrl: (url) =>
                set(() => ({ spotifyUrl: url })),

            setSpotifyOpen: (isOpen) =>
                set(() => ({ isSpotifyOpen: isOpen })),

            setEditorWidth: (width) =>
                set(() => ({ editorWidth: width })),

            setTabRailWidth: (width) =>
                set(() => ({ tabRailWidth: width })),

            setPanelWidth: (width) =>
                set(() => ({ panelWidth: width })),

            setArticleZoneWidth: (width) =>
                set(() => ({ articleZoneWidth: width })),

            setNavPanelWidth: (width) =>
                set(() => ({ navPanelWidth: width })),

            setEditorMaxWidth: (width) =>
                set(() => ({ editorMaxWidth: width })),

            toggleStandardFormat: () =>
                set((state) => {
                    const nextIsStandard = !state.isStandardFormat;
                    if (nextIsStandard) {
                        return {
                            isStandardFormat: true,
                            cachedEditorMaxWidth: state.editorMaxWidth,
                            editorMaxWidth: 720,
                        };
                    } else {
                        return {
                            isStandardFormat: false,
                            editorMaxWidth: state.cachedEditorMaxWidth,
                            cachedEditorMaxWidth: null,
                        };
                    }
                }),

            setSelectedEntity: (id) =>
                set(() => ({ selectedEntityId: id })),

            setHierarchyModal: (open, scratch = false) =>
                set(() => ({ 
                    isHierarchyModalOpen: open, 
                    isHierarchyScratchMode: scratch 
                })),

            updateEntity: (id, updates) =>
                set((state) => {
                    logger.info('Entity updated:', id);
                    return {
                        entities: state.entities.map(e =>
                            e.id === id ? { ...e, ...updates, updatedAt: new Date() } : e
                        ),
                    };
                }),

            deleteEntity: (id) =>
                set((state) => {
                    logger.info('Entity deleted:', id);
                    return { entities: state.entities.filter(e => e.id !== id) };
                }),

            // Sprint 46A: Toggle an entity's favorite pin
            toggleEntityFavorite: (id) =>
                set((state) => ({
                    entities: state.entities.map(e =>
                        e.id === id ? { ...e, isFavorite: !e.isFavorite } : e
                    ),
                })),

            // Sprint 46A: Update an entity's card image
            updateEntityImage: (id, imageUrl) =>
                set((state) => ({
                    entities: state.entities.map(e =>
                        e.id === id ? { ...e, imageUrl } : e
                    ),
                })),

            setHasHydrated: (state) =>
                set(() => ({ _hasHydrated: state })),


            setWritingGoal: (goal) =>
                set((state) => ({ writingGoal: { ...state.writingGoal, ...goal } })),

            setSessionWordCount: (count) =>
                set(() => ({ sessionWordCount: count })),

            toggleToolbarVisible: () =>
                set((state) => ({ isToolbarVisible: !state.isToolbarVisible })),

            setWritingMode: (mode) =>
                set(() => ({ writingMode: mode })),

            setBaseFontSize: (size) =>
                set(() => ({ baseFontSize: size })),

            // =============================================
            // Sprint 47A: Goals System Actions
            // =============================================

            // This action is called by the writing editor via
            // window.dispatchEvent(new CustomEvent('lorecanvas:sessionUpdate',
            // { detail: { projectId, wordsAdded, minutesSpent } }))
            // The Goals panel listens for this event.
            // Do NOT call this directly from the store — it is
            // triggered by the editor's autosave flow.
            recordWritingSession: (projectId, wordsAdded, minutesSpent) =>
                set((state) => {
                    const today = new Date().toISOString().split('T')[0];
                    const existing = state.writingDays.find(
                        d => d.projectId === projectId && d.date === today
                    );

                    let updatedDays: WritingDay[];
                    if (existing) {
                        // Accumulate onto existing day entry
                        const updated: WritingDay = {
                            ...existing,
                            wordsWritten: existing.wordsWritten + wordsAdded,
                            minutesWritten: existing.minutesWritten + minutesSpent,
                            goalMet: false, // recomputed below
                        };
                        // Compute goalMet based on primaryMetric
                        updated.goalMet = state.goalConfig.primaryMetric === 'words'
                            ? updated.wordsWritten >= state.goalConfig.dailyWordTarget
                            : updated.minutesWritten >= state.goalConfig.dailyTimeTarget;
                        updatedDays = state.writingDays.map(d =>
                            d.id === existing.id ? updated : d
                        );
                    } else {
                        // Create new day entry
                        const newDay: WritingDay = {
                            id: crypto.randomUUID(),
                            projectId,
                            date: today,
                            wordsWritten: wordsAdded,
                            minutesWritten: minutesSpent,
                            goalMet: state.goalConfig.primaryMetric === 'words'
                                ? wordsAdded >= state.goalConfig.dailyWordTarget
                                : minutesSpent >= state.goalConfig.dailyTimeTarget,
                        };
                        updatedDays = [...state.writingDays, newDay];
                    }

                    // Recompute streak from updated days
                    const streakState = computeStreakFromDays(updatedDays);

                    // Check and award badges inline
                    const newBadges = checkBadges(streakState, state.earnedBadges);

                    return {
                        writingDays: updatedDays,
                        streakState,
                        earnedBadges: newBadges.length > 0
                            ? [...state.earnedBadges, ...newBadges]
                            : state.earnedBadges,
                    };
                }),

            updateGoalConfig: (updates) =>
                set((state) => {
                    const newConfig = { ...state.goalConfig, ...updates, goalConfigured: true };

                    // Recompute goalMet on existing days with new targets
                    const updatedDays = state.writingDays.map(d => ({
                        ...d,
                        goalMet: newConfig.primaryMetric === 'words'
                            ? d.wordsWritten >= newConfig.dailyWordTarget
                            : d.minutesWritten >= newConfig.dailyTimeTarget,
                    }));

                    const streakState = computeStreakFromDays(updatedDays);

                    return {
                        goalConfig: newConfig,
                        writingDays: updatedDays,
                        streakState,
                    };
                }),

            repairStreak: (date) =>
                set((state) => {
                    if (state.goalConfig.streakRepairsAvailable <= 0) return {};

                    // Add a repaired day entry
                    const repairedDay: WritingDay = {
                        id: crypto.randomUUID(),
                        projectId: state.activeProjectId || '',
                        date,
                        wordsWritten: 0,
                        minutesWritten: 0,
                        goalMet: true,
                    };

                    const updatedDays = [...state.writingDays, repairedDay];
                    const streakState = computeStreakFromDays(updatedDays);

                    return {
                        writingDays: updatedDays,
                        goalConfig: {
                            ...state.goalConfig,
                            streakRepairsAvailable: state.goalConfig.streakRepairsAvailable - 1,
                        },
                        streakState,
                    };
                }),

            computeStreakState: () => {
                const state = get();
                const streakState = computeStreakFromDays(state.writingDays);
                set({ streakState });
                return streakState;
            },

            checkAndAwardBadges: () =>
                set((state) => {
                    const newBadges = checkBadges(state.streakState, state.earnedBadges);
                    if (newBadges.length === 0) return {};
                    return { earnedBadges: [...state.earnedBadges, ...newBadges] };
                }),

            setFocusedArticleEntity: (id) =>
                set(() => ({ focusedArticleEntityId: id })),

            setWorkspaceMode: (mode) => set((state) => {
                let activeWorldKey = state.activeWorldKey;
                if ((mode === 'worldBible' || mode === 'worldBibleEdit' || mode === 'hierarchy') && !activeWorldKey) {
                    activeWorldKey = worldKeyForProject(
                        state.projects.find(p => p.id === state.activeProjectId)
                    );
                }
                return {
                    workspaceMode: mode,
                    activeWorldKey,
                    focusedArticleEntityId: (mode === 'worldBible' || mode === 'hierarchy')
                        ? null
                        : state.focusedArticleEntityId,
                };
            }),

            setActiveWorldKey: (key) => set(() => ({ activeWorldKey: key })),

            updateWorldBibleConfig: (key, patch) =>
                set((state) => {
                    const existing = state.worldBibles[key];
                    // Destructure layout out first: spreading `existing` directly after an
                    // explicit `layout:` key trips TS2783 (duplicate property). Behaviourally
                    // identical to a plain spread, just strict-mode safe.
                    const { layout: existingLayout, ...existingIdentity } = existing ?? {};
                    return {
                        worldBibles: {
                            ...state.worldBibles,
                            [key]: {
                                layout: existingLayout ?? { roots: [] },
                                ...existingIdentity,
                                ...patch,
                            },
                        },
                    };
                }),

            setWorldBibleLayout: (key, layout) =>
                set((state) => ({
                    worldBibles: {
                        ...state.worldBibles,
                        [key]: { ...state.worldBibles[key], layout },
                    },
                })),

            applyBibleLayout: (key, layout) =>
                set((state) => ({
                    worldBibles: {
                        ...state.worldBibles,
                        [key]: { ...state.worldBibles[key], layout },
                    },
                    // Re-file this world's articles into the new structure by type
                    // (covers previously-unfiled ones too; presets span all 8 types).
                    entities: state.entities.map(e => {
                        if (worldKeyForEntity(e) !== key) return e;
                        return { ...e, categoryId: fileByType(layout.roots, e.type) };
                    }),
                })),

            deleteWorldEntities: (key) =>
                set((state) => {
                    logger.info('World bible cleared of articles:', key);
                    return { entities: state.entities.filter(e => worldKeyForEntity(e) !== key) };
                }),

            addWorldBibleRoot: (root, isDraft) =>
                set((state) => {
                    if (isDraft) {
                        const layout = state.draftHierarchyLayout || { roots: [] };
                        return { draftHierarchyLayout: { ...layout, roots: [...layout.roots, root] } };
                    }
                    return withActiveBibleLayout(state, (layout) => ({
                        ...layout,
                        roots: [...layout.roots, root],
                    }));
                }),

            updateWorldBibleRoot: (id, updates, isDraft) =>
                set((state) => {
                    // Folder re-parenting must never create a loop.
                    if (updates.parentId !== undefined) {
                        const layout = isDraft
                            ? state.draftHierarchyLayout
                            : (state.activeWorldKey ? state.worldBibles[state.activeWorldKey]?.layout : undefined);
                        if (layout && wouldCreateCycle(layout.roots, id, updates.parentId)) return state;
                    }
                    if (isDraft) {
                        const layout = state.draftHierarchyLayout;
                        if (!layout) return state;
                        return {
                            draftHierarchyLayout: {
                                ...layout,
                                roots: layout.roots.map(r => r.id === id ? { ...r, ...updates } : r)
                            }
                        };
                    }
                    return withActiveBibleLayout(state, (layout) => ({
                        ...layout,
                        roots: layout.roots.map(r => r.id === id ? { ...r, ...updates } : r),
                    }));
                }),

            deleteWorldBibleRoot: (id, isDraft) =>
                set((state) => {
                    const layout = isDraft
                        ? state.draftHierarchyLayout
                        : (state.activeWorldKey
                            ? state.worldBibles[state.activeWorldKey]?.layout
                                ?? JSON.parse(JSON.stringify(DEFAULT_WORLD_BIBLE_LAYOUT))
                            : undefined);
                    if (!layout) return state;

                    const removed = layout.roots.find(r => r.id === id);
                    if (!removed) return state;
                    const parentId = removed.parentId;

                    // Children re-parent to the deleted folder's parent — nothing cascades.
                    const remaining = layout.roots
                        .filter(r => r.id !== id)
                        .map(r => (r.parentId === id ? { ...r, parentId } : r));
                    const nextLayout = { ...layout, roots: remaining };

                    if (isDraft) {
                        return { draftHierarchyLayout: nextLayout };
                    }

                    // Articles in the deleted folder move up (top-level → Unfiled).
                    // Scoped to the active world: folder ids are only unique per bible
                    // (materialized default layouts share ids across worlds).
                    return {
                        ...withActiveBibleLayout(state, () => nextLayout),
                        entities: state.entities.map(e =>
                            worldKeyForEntity(e) === state.activeWorldKey && e.categoryId === id
                                ? { ...e, categoryId: parentId }
                                : e
                        ),
                    };
                }),

            moveWorldBibleType: (type, fromRootId, toRootId, isDraft) =>
                set((state) => {
                    if (isDraft) {
                        const layout = state.draftHierarchyLayout;
                        if (!layout) return state;
                        return {
                            draftHierarchyLayout: {
                                ...layout,
                                roots: layout.roots.map(r => {
                                    if (r.id === fromRootId) return { ...r, entityTypes: r.entityTypes.filter(t => t !== type) };
                                    if (r.id === toRootId) return { ...r, entityTypes: [...new Set([...r.entityTypes, type])] };
                                    return r;
                                })
                            }
                        };
                    }
                    return withActiveBibleLayout(state, (layout) => ({
                        ...layout,
                        roots: layout.roots.map(r => {
                            if (r.id === fromRootId) return { ...r, entityTypes: r.entityTypes.filter(t => t !== type) };
                            if (r.id === toRootId) return { ...r, entityTypes: [...new Set([...r.entityTypes, type])] };
                            return r;
                        }),
                    }));
                }),

            setDraftHierarchyLayout: (layout) => set({ draftHierarchyLayout: layout }),

            applyDraftHierarchy: () =>
                set((state) => {
                    if (!state.draftHierarchyLayout) return state;
                    return withActiveBibleLayout(state, () => state.draftHierarchyLayout!);
                }),

            saveArticleTemplate: (name, description, sourceBlocks) =>
                set((state) => ({
                    articleTemplates: [
                        ...state.articleTemplates,
                        {
                            id: crypto.randomUUID(),
                            name,
                            description,
                            blocks: sourceBlocks.map(b => ({ type: b.type })),
                            createdAt: new Date(),
                        }
                    ]
                })),

            deleteArticleTemplate: (templateId) =>
                set((state) => ({
                    articleTemplates: state.articleTemplates.filter(t => t.id !== templateId)
                })),

            applyArticleTemplate: (entityId, templateId) => set(state => {
                const template = state.articleTemplates.find(t => t.id === templateId);
                if (!template) return state;

                const newBlocks: ArticleBlock[] = template.blocks.map(b => ({
                    id: crypto.randomUUID(),
                    type: b.type,
                    x: 0, 
                    y: 0,
                    content: {},
                }));

                const entities = state.entities.map(e =>
                    e.id === entityId ? { ...e, articleBlocks: newBlocks } : e
                );
                return { entities };
            }),

            saveHierarchyTemplate: (name, description, layout) => set(state => ({
                hierarchyTemplates: [
                    ...state.hierarchyTemplates,
                    {
                        id: crypto.randomUUID(),
                        name,
                        description,
                        layout: JSON.parse(JSON.stringify(layout)), // deep copy
                        createdAt: new Date(),
                    }
                ]
            })),

            deleteHierarchyTemplate: (templateId) => set(state => ({
                hierarchyTemplates: state.hierarchyTemplates.filter(t => t.id !== templateId)
            })),

            applyHierarchyTemplate: (worldKey, templateId) => set(state => {
                const template = state.hierarchyTemplates.find(t => t.id === templateId);
                if (!template) return state;
                return {
                    worldBibles: {
                        ...state.worldBibles,
                        [worldKey]: {
                            ...state.worldBibles[worldKey],
                            layout: JSON.parse(JSON.stringify(template.layout)),
                        },
                    },
                };
            }),

            saveSceneSnapshot: (sceneId, label, isAuto) =>
                set((state) => {
                    const scene = state.scenes.find(s => s.id === sceneId);
                    if (!scene) return {};
                    const snapshot: SceneSnapshot = {
                        id: crypto.randomUUID(),
                        sceneId,
                        projectId: scene.projectId,
                        label,
                        content: scene.content,
                        wordCount: scene.wordCount ?? 0,
                        createdAt: new Date(),
                        isAuto,
                    };
                    // Keep max 50 per scene, prune oldest auto-snapshots first
                    const existing = state.sceneSnapshots.filter(s => s.sceneId === sceneId);
                    let pruned = [...existing, snapshot];
                    if (pruned.length > 50) {
                        // Remove oldest auto snapshot first, then oldest manual
                        const oldestAuto = pruned.find(s => s.isAuto);
                        if (oldestAuto) pruned = pruned.filter(s => s.id !== oldestAuto.id);
                        else pruned = pruned.slice(1);
                    }
                    return {
                        sceneSnapshots: [
                            ...state.sceneSnapshots.filter(s => s.sceneId !== sceneId),
                            ...pruned,
                        ],
                    };
                }),

            saveEntitySnapshot: (entityId, label, isAuto) =>
                set((state) => {
                    const entity = state.entities.find(e => e.id === entityId);
                    if (!entity || !entity.articleDoc) return {};
                    const snapshot: EntitySnapshot = {
                        id: crypto.randomUUID(),
                        entityId,
                        projectId: entity.projectId,
                        label,
                        articleDoc: entity.articleDoc,
                        createdAt: new Date(),
                        isAuto,
                    };
                    const existing = state.entitySnapshots.filter(s => s.entityId === entityId);
                    let pruned = [...existing, snapshot];
                    if (pruned.length > 20) {
                        const oldestAuto = pruned.find(s => s.isAuto);
                        if (oldestAuto) pruned = pruned.filter(s => s.id !== oldestAuto.id);
                        else pruned = pruned.slice(1);
                    }
                    return {
                        entitySnapshots: [
                            ...state.entitySnapshots.filter(s => s.entityId !== entityId),
                            ...pruned,
                        ],
                    };
                }),

            restoreSceneSnapshot: (snapshotId) =>
                set((state) => {
                    const snapshot = state.sceneSnapshots.find(s => s.id === snapshotId);
                    if (!snapshot) return {};
                    // Save current state as a snapshot before restoring
                    const scene = state.scenes.find(s => s.id === snapshot.sceneId);
                    if (!scene) return {};
                    const autoBackup: SceneSnapshot = {
                        id: crypto.randomUUID(),
                        sceneId: scene.id,
                        projectId: scene.projectId,
                        label: `Before restore — ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
                        content: scene.content,
                        wordCount: scene.wordCount ?? 0,
                        createdAt: new Date(),
                        isAuto: true,
                    };
                    return {
                        scenes: state.scenes.map(s =>
                            s.id === snapshot.sceneId
                                ? { ...s, content: snapshot.content, wordCount: snapshot.wordCount, updatedAt: new Date() }
                                : s
                        ),
                        sceneSnapshots: [...state.sceneSnapshots.filter(s => s.id !== autoBackup.id), autoBackup],
                    };
                }),

            restoreEntitySnapshot: (snapshotId) =>
                set((state) => {
                    const snapshot = state.entitySnapshots.find(s => s.id === snapshotId);
                    if (!snapshot) return {};
                    const entity = state.entities.find(e => e.id === snapshot.entityId);
                    if (!entity) return {};
                    const autoBackup: EntitySnapshot = {
                        id: crypto.randomUUID(),
                        entityId: entity.id,
                        projectId: entity.projectId,
                        label: `Before restore — ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
                        articleDoc: entity.articleDoc ?? '',
                        createdAt: new Date(),
                        isAuto: true,
                    };
                    return {
                        entities: state.entities.map(e =>
                            e.id === snapshot.entityId
                                ? { ...e, articleDoc: snapshot.articleDoc, updatedAt: new Date() }
                                : e
                        ),
                        entitySnapshots: [...state.entitySnapshots.filter(s => s.id !== autoBackup.id), autoBackup],
                    };
                }),

            deleteSnapshot: (snapshotId, type) =>
                set((state) => {
                    if (type === 'scene') {
                        return { sceneSnapshots: state.sceneSnapshots.filter(s => s.id !== snapshotId) };
                    }
                    return { entitySnapshots: state.entitySnapshots.filter(s => s.id !== snapshotId) };
                }),

            updateDeskState: (projectId, updates) =>
                set((state) => {
                    const current = state.deskStates[projectId] || { widgets: [], zoom: 1, canvasOffset: { x: 0, y: 0 } };
                    return {
                        deskStates: {
                            ...state.deskStates,
                            [projectId]: { ...current, ...updates }
                        }
                    };
                }),

            pinEntityToDesk: (projectId, entityId) =>
                set((state) => {
                    const current = state.deskStates[projectId] || { widgets: [], zoom: 1, canvasOffset: { x: 0, y: 0 } };
                    const newWidget: DeskWidget = {
                        id: crypto.randomUUID(),
                        type: 'biblePinit',
                        x: 100, // Default position
                        y: 100,
                        width: 280,
                        height: 380,
                        content: { entityId, lastUpdatedAt: new Date().toISOString() }
                    };
                    return {
                        deskStates: {
                            ...state.deskStates,
                            [projectId]: {
                                ...current,
                                widgets: [...current.widgets, newWidget]
                            }
                        }
                    };
                }),
        }),
        {
            name: 'lorecanvas-workspace',

            // Only persist core data — transient UI flags (hover state, open modals, etc.) reset on reload.
            // SECURITY NOTE: apiKey is stored in localStorage. Never log or expose this value.
            partialize: partializeWorkspace,

            // Track hydration phases allowing components to await persistence payload dynamically
            onRehydrateStorage: () => (state) => {
                if (state) {
                    // WORKAROUND(migration): Migrate legacy root-level localStorage data to the new Project architecture.
                    // Root cause: Pre-Sprint 13, documents did not exist natively inside the Zustand workspace structure.
                    // Remove when: After sufficient cycles (e.g. 2 months), assuming all clients have synced.
                    if (state.projects.length === 0 && state.scenes.length === 0 && state.entities.length === 0) {
                        logger.info('Migrating legacy data to new Project architecture.');
                        const defaultProject: Project = {
                            id: crypto.randomUUID(),
                            name: 'My First Project',
                            writingMode: 'novel',
                            coverColor: COVER_COLORS[0],
                            createdAt: new Date()
                        };
                        const defaultDocument: Document = {
                            id: crypto.randomUUID(),
                            projectId: defaultProject.id,
                            // Legacy pre-Sprint-13 keys — written under the old app name, never renamed
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

                            // Clear content from document layer — it now lives in scenes
                            doc.content = '';

                            if (doc.id === state.activeDocumentId) {
                                newActiveSceneId = sceneId;
                            }
                        });

                        state.scenes = newScenes;
                        state.activeSceneId = newActiveSceneId;
                    }

                    // Migration: patch existing projects missing writingMode or coverColor (Sprint 38)
                    state.projects = state.projects.map((p, i) => ({
                        ...p,
                        writingMode: (p as Project & { writingMode?: string }).writingMode || 'novel',
                        coverColor: (p as Project & { coverColor?: string }).coverColor || COVER_COLORS[i % COVER_COLORS.length]
                    })) as Project[];

                    // Migration: patch existing entities missing Sprint 46A fields
                    state.entities = state.entities.map(e => ({
                        ...e,
                        isFavorite: e.isFavorite ?? false,
                        imageUrl: e.imageUrl ?? '',
                        subcategory: e.subcategory ?? '',
                        customFields: e.customFields ?? [],
                    }));

                    // Sprint 47A: initialize goals fields for existing users
                    if (!(state as unknown as Record<string, unknown>).goalConfig) {
                        state.goalConfig = {
                            dailyWordTarget: 200,
                            dailyTimeTarget: 20,
                            primaryMetric: 'words',
                            writingDaysPerWeek: 5,
                            streakRepairsAvailable: 1,
                            goalConfigured: false,
                        };
                    }
                    if (!(state as unknown as Record<string, unknown>).writingDays) state.writingDays = [];
                    if (!(state as unknown as Record<string, unknown>).earnedBadges) state.earnedBadges = [];
                    if (!(state as unknown as Record<string, unknown>).xpEvents) state.xpEvents = [];
                    if (!(state as unknown as Record<string, unknown>).socialHistory) {
                        state.socialHistory = [];
                    }

                    // Hydration/Migration: Ensure baseFontSize is initialized
                    if (typeof (state as unknown as Record<string, unknown>).baseFontSize !== 'number') {
                        state.baseFontSize = 20;
                    }

                    // Recompute streak on rehydration (streakState is never persisted)
                    state.streakState = computeStreakFromDays(state.writingDays ?? []);

                    // Hydration/Migration: Ensure workspaceMode is initialized correctly for Sprint 99
                    if (!['worldBible', 'worldBibleEdit', 'hierarchy', 'template', 'desk', 'bookshelf'].includes((state as any).workspaceMode)) {
                        state.workspaceMode = 'bookshelf';
                    }

                    // Sprint 51: Migrate articleBlocks from order-based to x/y coordinate system
                    state.entities = state.entities.map(e => {
                        if (!e.articleBlocks || e.articleBlocks.length === 0) return e;
                        const needsMigration = e.articleBlocks.some(
                            (b: any) => typeof b.order === 'number' && typeof b.x !== 'number'
                        );
                        if (!needsMigration) return e;
                        return {
                            ...e,
                            articleBlocks: e.articleBlocks.map((b: any, idx: number) => ({
                                ...b,
                                x: 40,
                                y: 40 + (idx * 220),
                                order: undefined, // remove legacy field
                            }))
                        };
                    });
 
                    // Initialize snapshots for existing users
                    if (!(state as unknown as Record<string, unknown>).sceneSnapshots) state.sceneSnapshots = [];
                    if (!(state as unknown as Record<string, unknown>).entitySnapshots) state.entitySnapshots = [];
 
                    // Initialize worlds for existing users
                    if (!(state as unknown as Record<string, unknown>).worlds) {
                        state.worlds = [];
                    }

                    if (typeof (state as unknown as Record<string, unknown>).articleZoneWidth !== 'number') {
                        state.articleZoneWidth = 680;
                    }
                    state.setHasHydrated(true);
                }
            },

            // Intercept JSON deserialization to properly reconstruct native JavaScript `Date` objects.
            // Writes go through a debounced adapter so editing doesn't serialize the
            // full workspace on every keystroke (flushes on tab hide / unload).
            storage: createJSONStorage(() => debouncedLocalStorage, {
                reviver: (key, value) => {
                    // Only apply Date reconstruction to arrays that contain objects
                    // with createdAt/updatedAt. Non-entity arrays (writingDays,
                    // earnedBadges, xpEvents) are returned as-is to avoid corruption.
                    const DATE_ARRAY_KEYS = [
                        'worlds', 'projects', 'documents', 'scenes',
                        'entities', 'articleTemplates', 'earnedBadges',
                        'sceneSnapshots', 'entitySnapshots',
                    ];
                    if (DATE_ARRAY_KEYS.includes(key) && Array.isArray(value)) {
                        return value.map((item: Record<string, unknown>) => {
                            if (typeof item !== 'object' || item === null) return item;
                            return {
                                ...item,
                                ...(item.createdAt ? { createdAt: new Date(item.createdAt as string) } : {}),
                                ...(item.updatedAt ? { updatedAt: new Date(item.updatedAt as string) } : {}),
                                ...(item.earnedAt  ? { earnedAt:  new Date(item.earnedAt  as string) } : {}),
                            };
                        });
                    }
                    return value;
                },
            }),
            /**
             * Schema Versioning and Migration logic (Sprint 68)
             * version: 2 — Introduced targeted reviver and automatic backups.
             * version: 3 — Per-shelf World Bibles (entity.worldId + worldBibles map).
             * version: 4 — Article folder membership (entity.categoryId).
             */
            version: 4,
            migrate: (persistedState: any, fromVersion: number) => {
                // Take an automatic backup BEFORE any migration
                try {
                    const backupKey = `lorecanvas-backup-v${fromVersion}-${Date.now()}`;
                    const backupData = { ...persistedState };
                    localStorage.setItem(backupKey, JSON.stringify(backupData));
                    // Keep only the 5 most recent backups — prune older ones
                    const backupKeys = Object.keys(localStorage)
                        .filter(k => k.startsWith('lorecanvas-backup-'))
                        .sort();
                    if (backupKeys.length > 5) {
                        backupKeys.slice(0, backupKeys.length - 5).forEach(k => localStorage.removeItem(k));
                    }
                } catch (e) {
                    // localStorage may be full — ignore backup failure, proceed with migration
                    logger.warn('LoreCanvas: backup failed, proceeding with migration', e);
                }

                // v4: full schema chain (per-shelf bibles + article folders).
                // Idempotent — safe even if the cloud path already migrated it.
                return migrateWorkspaceSchema(persistedState ?? {});
            },
        }
    )
);

/**
 * Returns a list of available backup snapshots in localStorage,
 * sorted newest-first. Each entry has a key and a timestamp.
 */
export function listDataBackups(): { key: string; timestamp: number; version: number }[] {
    const backups: { key: string; timestamp: number; version: number }[] = [];
    if (typeof localStorage === 'undefined') return [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k?.startsWith('lorecanvas-backup-')) continue;
        // Key format: lorecanvas-backup-v{version}-{timestamp}
        const parts = k.replace('lorecanvas-backup-', '').split('-');
        const versionStr = parts[0].replace('v', '');
        const version = parseInt(versionStr) || 0;
        const timestamp = parseInt(parts[1]) || 0;
        backups.push({ key: k, timestamp, version });
    }
    return backups.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Restores a specific backup by key, replacing the current workspace data.
 * Returns true on success, false on failure.
 * After calling this, the page must be reloaded for changes to take effect.
 */
export function restoreDataBackup(backupKey: string): boolean {
    try {
        const raw = localStorage.getItem(backupKey);
        if (!raw) return false;
        localStorage.setItem('lorecanvas-workspace', raw);
        return true;
    } catch (e) {
        logger.error('LoreCanvas: restore failed', e);
        return false;
    }
}

/**
 * Creates a manual backup of the current workspace data.
 * Returns the backup key on success, null on failure.
 */
export function createManualBackup(): string | null {
    try {
        const current = localStorage.getItem('lorecanvas-workspace');
        if (!current) return null;
        const key = `lorecanvas-backup-v2-${Date.now()}`;
        localStorage.setItem(key, current);
        return key;
    } catch (e) {
        logger.error('LoreCanvas: manual backup failed', e);
        return null;
    }
}


