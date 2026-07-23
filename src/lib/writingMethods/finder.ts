import { DraftFormat } from './types';
import { getDraftType } from './draftTypes';

/**
 * The method finder — three answers in, two recommendations out.
 * Deterministic matrix keyed by format / work style / structure appetite,
 * with specialized draft types injecting their purpose-built top pick.
 */

export type WorkStyle = 'plan' | 'both' | 'discover';
export type StructureAppetite = 'full' | 'landmarks' | 'minimal';

export interface FinderAnswers {
    draftTypeId: string;
    workStyle: WorkStyle;
    structure: StructureAppetite;
}

export interface FinderRecommendation {
    methodId: string;
    /** One line tying this pick to the writer's answers */
    why: string;
}

type Matrix = Record<DraftFormat, Record<WorkStyle, Record<StructureAppetite, FinderRecommendation[]>>>;

const MATRIX: Matrix = {
    story: {
        plan: {
            full: [
                { methodId: 'save-the-cat', why: 'You want the whole map before drafting — this is the most complete, page-anchored beat sheet.' },
                { methodId: 'snowflake', why: 'Grow the plan from one sentence outward, with total control before any prose.' },
            ],
            landmarks: [
                { methodId: 'seven-point', why: 'Seven fixed landmarks, built backward from the ending — structure without micromanaging.' },
                { methodId: 'three-act', why: 'The classic skeleton: three acts, a few turning points, room to move between them.' },
            ],
            minimal: [
                { methodId: 'skeletal-outline', why: 'A nested list you deepen at your own pace — planning without a formal framework.' },
                { methodId: 'scene-list', why: 'A scene-per-line roadmap: enough plan to steer, nothing more.' },
            ],
        },
        both: {
            full: [
                { methodId: 'story-circle', why: 'Eight clear steps that still leave room to improvise inside each one.' },
                { methodId: 'take-off-your-pants', why: 'A fast, flaw-first beat list built for writers who outline light and draft hard.' },
            ],
            landmarks: [
                { methodId: 'tentpole', why: 'Pin the scenes you can already see; discovery-write the roads between them.' },
                { methodId: 'story-circle', why: 'Enough shape to guide you, loose enough to surprise you.' },
            ],
            minimal: [
                { methodId: 'plantsing', why: 'Outline only the next three scenes — headlights, not a map.' },
                { methodId: 'tentpole', why: 'A few fixed set-pieces; everything else stays free.' },
            ],
        },
        discover: {
            full: [
                { methodId: 'story-circle', why: 'The lightest full structure there is — eight steps you can check after drafting.' },
                { methodId: 'reverse-outline', why: 'Draft free, then outline what you wrote to find the structure hiding in it.' },
            ],
            landmarks: [
                { methodId: 'tentpole', why: 'Keep a few landmark scenes in sight and wander freely between them.' },
                { methodId: 'freewrite-salvage', why: 'Write hot, then mine the draft for the story\'s real shape.' },
            ],
            minimal: [
                { methodId: 'pantsing', why: 'No outline at all — a spark, open questions, and momentum.' },
                { methodId: 'freewrite-salvage', why: 'Timed, unedited drafting with a salvage pass to catch the gold.' },
            ],
        },
    },
    script: {
        plan: {
            full: [
                { methodId: 'save-the-cat', why: 'The screen-native beat sheet — fifteen beats with page targets.' },
                { methodId: 'eight-sequence', why: 'Eight mini-movies make a 110-page mountain climbable.' },
            ],
            landmarks: [
                { methodId: 'screen-doc-chain', why: 'Logline to treatment, one rung at a time — the industry\'s planning ladder.' },
                { methodId: 'seven-point', why: 'Seven landmarks with a mirrored hook and resolution — lean but load-bearing.' },
            ],
            minimal: [
                { methodId: 'screen-doc-chain', why: 'Stop at the beat-sheet rung: a page of beats, nothing heavier.' },
                { methodId: 'index-cards', why: 'One scene per card; structure emerges when you shuffle.' },
            ],
        },
        both: {
            full: [
                { methodId: 'story-circle', why: 'TV\'s favorite structure — eight steps, endlessly reusable.' },
                { methodId: 'eight-sequence', why: 'Sequence goals keep you honest while individual scenes stay flexible.' },
            ],
            landmarks: [
                { methodId: 'corkboard-acts', why: 'Cards under act columns — spatial planning that tolerates improvisation.' },
                { methodId: 'story-circle', why: 'Enough shape to guide, loose enough to surprise.' },
            ],
            minimal: [
                { methodId: 'index-cards', why: 'Shuffle-first structure — commit to nothing until it feels inevitable.' },
                { methodId: 'corkboard-acts', why: 'Loose cards with just enough act gravity.' },
            ],
        },
        discover: {
            full: [
                { methodId: 'story-circle', why: 'Draft to discover, then check your pages against eight simple steps.' },
                { methodId: 'dialogue-first', why: 'Let the voices lead; structure the skeleton after.' },
            ],
            landmarks: [
                { methodId: 'dialogue-first', why: 'Write the talk first — scenes reveal their shape from the inside.' },
                { methodId: 'corkboard-acts', why: 'Pin what you discover onto acts as it accumulates.' },
            ],
            minimal: [
                { methodId: 'dialogue-first', why: 'Pure voices on the page; everything else later.' },
                { methodId: 'freewrite-salvage', why: 'Draft hot, salvage the keepers.' },
            ],
        },
    },
    article: {
        plan: {
            full: [
                { methodId: 'narrative-nonfiction', why: 'Thesis, scenes, and an evidence map — rigor with narrative craft.' },
                { methodId: 'skeletal-outline', why: 'Premise to sections to paragraphs, one nested level at a time.' },
            ],
            landmarks: [
                { methodId: 'story-spine', why: 'Eight causal blanks that guarantee the piece hangs together.' },
                { methodId: 'skeletal-outline', why: 'Grow a nested list only as deep as you need.' },
            ],
            minimal: [
                { methodId: 'mind-map', why: 'Free-associate first; draw the path through the branches later.' },
                { methodId: 'story-spine', why: 'The lightest structure that still enforces cause and effect.' },
            ],
        },
        both: {
            full: [
                { methodId: 'narrative-nonfiction', why: 'Scene craft plus a claim-to-evidence map keeps truth and story aligned.' },
                { methodId: 'reverse-outline', why: 'Draft sections freely, then audit them against your thesis.' },
            ],
            landmarks: [
                { methodId: 'story-spine', why: 'Fill eight blanks; discover everything between them.' },
                { methodId: 'mind-map', why: 'Branch out, then compile the best path into a skeleton.' },
            ],
            minimal: [
                { methodId: 'freewrite-salvage', why: 'Get the thinking out fast; keep what\'s alive.' },
                { methodId: 'mind-map', why: 'A map of what you know before you commit to an order.' },
            ],
        },
        discover: {
            full: [
                { methodId: 'reverse-outline', why: 'Write first; the outline comes after, from the draft itself.' },
                { methodId: 'narrative-nonfiction', why: 'Use the claim-to-evidence map as a post-draft honesty check.' },
            ],
            landmarks: [
                { methodId: 'freewrite-salvage', why: 'Unedited momentum with a structured salvage pass.' },
                { methodId: 'reverse-outline', why: 'Find the piece\'s real shape after it exists.' },
            ],
            minimal: [
                { methodId: 'freewrite-salvage', why: 'Timer on, critic off.' },
                { methodId: 'mind-map', why: 'Wander the idea; keep the trails you like.' },
            ],
        },
    },
    game: {
        plan: {
            full: [
                { methodId: 'interactive-fiction', why: 'Map every passage, choice, and variable before you build.' },
                { methodId: 'three-clue-rule', why: 'Design mysteries that can\'t dead-end — three routes to every conclusion.' },
            ],
            landmarks: [
                { methodId: 'five-room-dungeon', why: 'Five beats that structure a whole scenario.' },
                { methodId: 'dungeon-world-fronts', why: 'Threats with countdowns — prep that survives contact with players.' },
            ],
            minimal: [
                { methodId: 'progress-clocks', why: 'A few ticking clocks instead of a plot.' },
                { methodId: 'five-room-dungeon', why: 'The smallest complete scenario skeleton.' },
            ],
        },
        both: {
            full: [
                { methodId: 'interactive-fiction', why: 'A living graph you grow as you design.' },
                { methodId: 'heros-journey', why: 'The mythic spine most game narratives already lean on.' },
            ],
            landmarks: [
                { methodId: 'five-room-dungeon', why: 'Five rooms planned; infinite table chaos welcomed.' },
                { methodId: 'progress-clocks', why: 'The world advances on its own; you improvise against it.' },
            ],
            minimal: [
                { methodId: 'progress-clocks', why: 'Clocks tick, story emerges.' },
                { methodId: 'dungeon-world-fronts', why: 'Prep threats, not plots — play to find out.' },
            ],
        },
        discover: {
            full: [
                { methodId: 'dungeon-world-fronts', why: 'Emergent by design: portents fire only if no one intervenes.' },
                { methodId: 'interactive-fiction', why: 'Grow the map from whatever the story does next.' },
            ],
            landmarks: [
                { methodId: 'dungeon-world-fronts', why: 'Fronts advance; the story writes itself.' },
                { methodId: 'progress-clocks', why: 'Offscreen pressure keeps discovery honest.' },
            ],
            minimal: [
                { methodId: 'progress-clocks', why: 'Minimal bookkeeping, maximum emergence.' },
                { methodId: 'mind-map', why: 'Sketch the world\'s pieces; connect them in play.' },
            ],
        },
    },
};

export function recommendMethods(answers: FinderAnswers): FinderRecommendation[] {
    const type = getDraftType(answers.draftTypeId);
    const format: DraftFormat = type?.format ?? 'story';
    const cell = MATRIX[format][answers.workStyle][answers.structure];

    // Specialized types (backstory, YouTube script, lore article…) lead with
    // their purpose-built method; the matrix pick covers the work style.
    if (type?.finderWhy) {
        const topPick: FinderRecommendation = { methodId: type.recommended[0], why: type.finderWhy };
        const second = cell.find(r => r.methodId !== topPick.methodId) ?? cell[0];
        return [topPick, second];
    }
    return cell;
}
