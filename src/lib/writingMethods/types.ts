/**
 * Writing-method registry types.
 *
 * A "method" is data, not code: a named set of guided beat cards the Draft
 * Table lays out on the canvas. Adding a method means adding an entry to the
 * registry — no new components.
 */

export type MethodFamily =
    | 'fractal'        // expansion methods (Snowflake, MICE…)
    | 'beat-sheet'     // template beats (Save the Cat, Seven-Point…)
    | 'mythic'         // character-arc journeys (Hero's Journey, Story Circle…)
    | 'diagnostic'     // scene-craft frameworks (Story Grid, Scene & Sequel…)
    | 'classical'      // dramatic structures (Three-Act, Freytag…)
    | 'process'        // ways of working (Pantsing, Freewriting, Tentpole…)
    | 'spatial'        // visual thinking (Index Cards, Mind Map, Timeline…)
    | 'first-principles' // character-first / worldbuilding-first
    | 'nonlinear'      // modular & dialogue-first drafting
    | 'screen'         // screenwriting-specific
    | 'game'           // interactive fiction / TTRPG
    | 'nonfiction'     // articles, memoir, academic
    | 'outline';       // list-based outlining

export const FAMILY_LABELS: Record<MethodFamily, string> = {
    'fractal': 'Expansion Methods',
    'beat-sheet': 'Beat Sheets',
    'mythic': 'Character Journeys',
    'diagnostic': 'Scene Craft',
    'classical': 'Classic Structures',
    'process': 'Ways of Working',
    'spatial': 'Visual Thinking',
    'first-principles': 'Character & World First',
    'nonlinear': 'Non-Linear Drafting',
    'screen': 'Screenwriting',
    'game': 'Games & TTRPG',
    'nonfiction': 'Articles & Nonfiction',
    'outline': 'Outlining',
};

/** What the writer is drafting — used to filter the method library. */
export type DraftFormat = 'story' | 'script' | 'article' | 'game';

export interface MethodBeat {
    /** Card title, e.g. "Catalyst" */
    label: string;
    /** One-to-two-line teaching text shown in the ⓘ popover */
    guidance: string;
    /** Greyed example text inside the empty card */
    placeholder: string;
    /** Optional phase/act grouping label, e.g. "Act II" or "Phase 2: Falling" */
    group?: string;
}

export interface WritingMethod {
    /** kebab-case unique id, e.g. 'save-the-cat' */
    id: string;
    name: string;
    family: MethodFamily;
    /** Which draft formats this method suits (filters the library) */
    formats: DraftFormat[];
    /** One-line theory — the orienting sentence */
    tagline: string;
    /** Who it's for, e.g. "commercial/genre fiction" */
    bestFor: string;
    /** One of the six flagship methods shown first in the library */
    starter?: boolean;
    /** The guided cards this method lays on the canvas, in reading order */
    beats: MethodBeat[];
}
