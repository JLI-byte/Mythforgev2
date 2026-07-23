import { WritingMethod } from '../types';

/**
 * Scene-craft diagnostics, process/discovery methods, and list-based outlining.
 * Field-guide families IV (diagnostic), VI (process), and the outline lenses.
 */
export const CRAFT_METHODS: WritingMethod[] = [
    // ── Scene craft / diagnostic ─────────────────────────────
    {
        id: 'story-grid',
        name: 'Story Grid',
        family: 'diagnostic',
        formats: ['story'],
        tagline: 'Every scene must turn on a value shift — and every genre carries obligatory scenes.',
        bestFor: 'Revision and diagnosing why a draft isn\'t working',
        beats: [
            { label: 'Genre & Obligatory Scenes', guidance: 'Name your content genre (thriller, love story, war…) and list the scenes readers of that genre came for. Missing one breaks the contract.', placeholder: 'e.g. Crime: the discovery of the body, the false suspect, the unmasking…' },
            { label: 'Beginning Hook', guidance: 'The first ~25%: inciting incident, complication, crisis, climax, resolution. What value shifts from start to end (e.g. safety → danger)?', placeholder: 'e.g. Life → Unrest: the detective takes the case she was warned off…' },
            { label: 'Middle Build', guidance: 'The middle ~50%: progressive complications to an all-is-lost. Track the value at each turn — no two consecutive scenes should end on the same charge.', placeholder: 'e.g. Unrest → Obsession → Betrayal → Rock bottom…' },
            { label: 'Ending Payoff', guidance: 'The final ~25%: crisis, climax, resolution. Pays off every promise the hook made.', placeholder: 'e.g. Rock bottom → Sacrifice → Justice, at a price…' },
            { label: 'Scene Ledger', guidance: 'For each scene: what value enters, what value leaves, and its polarity (+/−). A scene where nothing turns isn\'t a scene.', placeholder: 'e.g. Sc.1: safety(+) → suspicion(−) / Sc.2: suspicion(−) → false hope(+)…' },
        ],
    },
    {
        id: 'scene-and-sequel',
        name: 'Scene & Sequel',
        family: 'diagnostic',
        formats: ['story'],
        tagline: 'Alternate action units (goal→conflict→disaster) with reaction units (reaction→dilemma→decision).',
        bestFor: 'Pacing genre fiction; fixing saggy middles',
        beats: [
            { group: 'Scene', label: 'Goal', guidance: 'The POV character enters wanting something specific and immediate. If they have no goal, it\'s not a scene yet.', placeholder: 'e.g. Get the harbormaster to unlock the manifest…' },
            { group: 'Scene', label: 'Conflict', guidance: 'Opposition to the goal — another agenda, an obstacle, a cost. Escalating friction, not delay.', placeholder: 'e.g. The harbormaster wants her signature on a lie first…' },
            { group: 'Scene', label: 'Disaster', guidance: 'The scene ends worse than it began: "No", "Yes, but…", or "No, and furthermore…".', placeholder: 'e.g. The manifest is already gone — and he\'s sent for the constable…' },
            { group: 'Sequel', label: 'Reaction', guidance: 'The emotional beat. Let the character (and reader) feel the disaster before thinking about it.', placeholder: 'e.g. Cold panic in the alley; her hands won\'t stop shaking…' },
            { group: 'Sequel', label: 'Dilemma', guidance: 'The options — all bad. Weigh them honestly; easy choices kill tension.', placeholder: 'e.g. Flee tonight, bribe the clerk, or confess to the captain…' },
            { group: 'Sequel', label: 'Decision', guidance: 'The character chooses, creating the goal of the next scene. The chain continues.', placeholder: 'e.g. The clerk. Which means finding money by dawn — next scene\'s goal.' },
        ],
    },
    {
        id: 'scene-evaluation',
        name: 'Scene Evaluation',
        family: 'diagnostic',
        formats: ['story'],
        tagline: 'Score every scene on the elements that make it earn its place (Fictionary-style).',
        bestFor: 'Revising a finished draft scene by scene',
        beats: [
            { label: 'POV & Goal', guidance: 'Whose scene is this, and what do they want in it? One clear POV, one clear goal.', placeholder: 'e.g. POV: Ines. Goal: leave the dinner without lying…' },
            { label: 'What Changes', guidance: 'Name the change: plot, relationship, or knowledge. If you can\'t, the scene is a candidate to cut.', placeholder: 'e.g. She learns her mother knew all along…' },
            { label: 'Conflict & Tension', guidance: 'Where\'s the friction — even in quiet scenes? Tension is a question the reader wants answered.', placeholder: 'e.g. Every toast is a test; the empty chair is a threat…' },
            { label: 'Entry & Exit Hooks', guidance: 'Does the opening line pull in, and does the closing line push forward to the next scene?', placeholder: 'e.g. In: the extra place setting / Out: "Your father called."' },
            { label: 'Setting Anchored', guidance: 'Is the reader grounded — where, when, who\'s present — within the first lines? Are the senses working?', placeholder: 'e.g. Overcooked lamb, a clock that runs seven minutes fast…' },
        ],
    },

    // ── Process / discovery ──────────────────────────────────
    {
        id: 'pantsing',
        name: 'Discovery Writing',
        family: 'process',
        formats: ['story'],
        tagline: 'No outline — write to find out what happens. The draft is the discovery.',
        bestFor: 'Voice-driven writers; finding characters by listening to them',
        beats: [
            { label: 'The Spark', guidance: 'The image, voice, question, or scene that excites you. You don\'t need a plot — you need a live wire.', placeholder: 'e.g. A woman answers a phone that isn\'t plugged in…' },
            { label: 'Open Questions', guidance: 'Not an outline — a curiosity list. What do YOU want to find out by writing? Add to it as the draft grows.', placeholder: 'e.g. Who\'s calling? Why does her sister pretend not to hear it?…' },
            { label: 'Emergent Threads', guidance: 'As you draft, log what keeps showing up: repeated images, characters who steal scenes, promises made to the reader. These are your soft anchors — the structure that\'s already emerging.', placeholder: 'e.g. Birds keep appearing at exits. The sister lies only about small things…' },
        ],
    },
    {
        id: 'full-outline',
        name: 'Full Outline',
        family: 'process',
        formats: ['story', 'script'],
        tagline: 'Plan the whole story before drafting — the classic plotter\'s approach.',
        bestFor: 'Series writers, deadline professionals, complex plots',
        beats: [
            { label: 'Premise', guidance: 'One paragraph: protagonist, want, obstacle, stakes. The elevator pitch you\'ll test every scene against.', placeholder: 'e.g. A quarantined lighthouse keeper must choose between the ship she can save and the town she\'s sworn to warn…' },
            { label: 'The Ending', guidance: 'Know your destination. Outlining works best backward from a known ending.', placeholder: 'e.g. She sinks the ship herself; the town never learns her name…' },
            { label: 'Act Skeleton', guidance: 'Rough the major movements: the beginning\'s promise, the middle\'s escalations, the end\'s payoff.', placeholder: 'e.g. Act I: the signal / Act II: the bargain / Act III: the storm…' },
            { label: 'Chapter Map', guidance: 'One line per chapter: POV, what happens, what changes. Gaps are fine — mark them.', placeholder: 'e.g. Ch1: Keeper POV — the light fails — she lies in the logbook…' },
            { label: 'Known Unknowns', guidance: 'List what the outline hasn\'t solved yet, so drafting doesn\'t stall when you hit them.', placeholder: 'e.g. How does the ship know the signal? What\'s in the sealed room?…' },
        ],
    },
    {
        id: 'plantsing',
        name: 'Headlights Outlining (Plantsing)',
        family: 'process',
        formats: ['story'],
        tagline: 'Outline only as far as your headlights reach — a few scenes ahead, revised as you go.',
        bestFor: 'Most writers: structure without a cage',
        beats: [
            { label: 'Where I Am', guidance: 'Summarize the story so far in a few lines. Update this card as the draft moves — it\'s your rear-view mirror.', placeholder: 'e.g. Draft is at ch. 7: the twins have swapped, nobody knows but the dog…' },
            { label: 'The Next Three Scenes', guidance: 'Outline just the immediate road ahead. When you\'ve drafted one, add one — always three in the headlights.', placeholder: 'e.g. 1) The recital goes wrong 2) Aunt Vi suspects 3) The letter arrives…' },
            { label: 'The Distant City', guidance: 'The ending or landmark you\'re driving toward. It can be fuzzy — a feeling, an image, a final line.', placeholder: 'e.g. Somehow it ends at the lake house, in winter, with both of them laughing…' },
            { label: 'Roads Not Taken', guidance: 'Park discarded directions here instead of deleting them. Discovery writers change their minds — keep the offcuts.', placeholder: 'e.g. Dropped: the mother knows from the start (killed ch. 3 tension)…' },
        ],
    },
    {
        id: 'tentpole',
        name: 'Tentpole Method',
        family: 'process',
        formats: ['story', 'script'],
        tagline: 'Pin down 3–5 vivid set-piece scenes, then discovery-write the bridges between them.',
        bestFor: 'Hybrid writers with strong scene-images but no full plot',
        beats: [
            { label: 'Tentpole One', guidance: 'A scene you can already see — vivid, inevitable, non-negotiable. Write it in enough detail to keep it alive.', placeholder: 'e.g. The duel on the frozen aqueduct, mid-thaw…' },
            { label: 'Tentpole Two', guidance: 'The next fixed point. Don\'t worry yet how the story gets here.', placeholder: 'e.g. She burns the treaty in front of both armies…' },
            { label: 'Tentpole Three', guidance: 'Another canvas peak. Three is enough; five is plenty.', placeholder: 'e.g. The reunion in the flooded library…' },
            { label: 'Tentpole Four (optional)', guidance: 'Add only if it\'s truly vivid. A weak tentpole sags the whole canvas.', placeholder: 'e.g. …' },
            { label: 'The Bridges', guidance: 'List the gaps between tentpoles as open questions. These you discovery-write — the tentpoles keep you from drifting.', placeholder: 'e.g. How does she get from the aqueduct to commanding an army?…' },
        ],
    },
    {
        id: 'freewrite-salvage',
        name: 'Freewrite & Salvage',
        family: 'process',
        formats: ['story', 'article'],
        tagline: 'Write fast and unedited to outrun the inner critic — then mine the output for gold.',
        bestFor: 'Unblocking, idea generation, zero drafts',
        starter: true,
        beats: [
            { label: 'Session Rules', guidance: 'Set a timer (10–25 min). Keep the hands moving; no deleting, no rereading, no fixing. Momentum is the whole method.', placeholder: 'e.g. 15 minutes. Prompt: the day the bees came back…' },
            { label: 'The Zero Draft', guidance: 'The raw output lives here (or in a Writing Zone widget beside this card). It\'s allowed to be terrible — it exists to be mined, not read.', placeholder: 'Paste or draft your unedited session output here…' },
            { label: 'Salvage: Characters', guidance: 'Reread once. Who showed up? List every person the freewrite invented, with the one detail that made them real.', placeholder: 'e.g. The beekeeper\'s daughter who counts everything twice…' },
            { label: 'Salvage: Threads', guidance: 'What questions or promises appeared? Unresolved tensions are story seeds.', placeholder: 'e.g. Why did the hives go silent for three years?…' },
            { label: 'Salvage: Keepers', guidance: 'Copy out the sentences worth keeping — images, lines of dialogue, moments with heat. This is what the session was for.', placeholder: 'e.g. "Grief, she decided, was just love with nowhere to land."' },
        ],
    },
    {
        id: 'reverse-outline',
        name: 'Reverse Outlining',
        family: 'process',
        formats: ['story', 'article'],
        tagline: 'Outline the draft you already wrote — one line per scene — to expose its real structure.',
        bestFor: 'Revision; pantsers turning a zero draft into a second draft',
        beats: [
            { label: 'Scene-by-Scene Summary', guidance: 'One line per existing scene: who, what happens, what changes. Summarize what\'s ON the page, not what you meant.', placeholder: 'e.g. 1. Cole finds the ring — hides it from Ada. 2. Market scene — nothing changes(!)…' },
            { label: 'The Throughline Test', guidance: 'Read only your one-liners. Does each cause the next? Mark every "and then" that should be a "because of that".', placeholder: 'e.g. Scenes 4→5 unconnected; 7 repeats 3\'s beat…' },
            { label: 'Cut, Merge, Move, Add', guidance: 'Decisions, not despair: which scenes cut, which merge, which move, and what\'s missing that the structure needs.', placeholder: 'e.g. Cut 2. Merge 3+7. Move 9 before 6. Add: Ada discovers the lie ON PAGE…' },
        ],
    },

    // ── Outlining lenses ─────────────────────────────────────
    {
        id: 'skeletal-outline',
        name: 'Skeletal-to-Detailed Outline',
        family: 'outline',
        formats: ['story', 'article'],
        tagline: 'Nest from macro to micro: premise → parts → chapters → scenes.',
        bestFor: 'Writers who think in lists and grow them downward',
        beats: [
            { label: 'Level 1: Premise', guidance: 'The whole piece in one line. Everything below must serve this.', placeholder: 'e.g. A history of the town told through its seven demolished buildings…' },
            { label: 'Level 2: Major Parts', guidance: 'The big movements — acts, parts, or sections. Three to six lines.', placeholder: 'e.g. I. The mill era / II. The fire / III. What was rebuilt…' },
            { label: 'Level 3: Chapters', guidance: 'Expand each part into chapters, one line each. Watch for parts that won\'t expand — they may not belong.', placeholder: 'e.g. I.1 The mill whistle / I.2 The company houses…' },
            { label: 'Level 4: Scenes / Sections', guidance: 'The finest grain: each chapter\'s scenes or sections. When a line here is vivid, it\'s ready to draft.', placeholder: 'e.g. I.1.a — dawn shift-change, the whistle\'s last morning…' },
        ],
    },
    {
        id: 'scene-list',
        name: 'Scene List / Chapter Roadmap',
        family: 'outline',
        formats: ['story'],
        tagline: 'The story as a database of scenes: POV, cast, and what changes — before any prose.',
        bestFor: 'Multi-POV stories; writers juggling many threads',
        beats: [
            { label: 'Scene Row Template', guidance: 'Each scene gets a row: # / POV / who\'s present / one-line action / what changes. Duplicate this card per scene.', placeholder: 'e.g. #12 / Bren / Bren, the Envoy / the toast goes wrong / alliance now suspect…' },
            { label: 'POV Balance Check', guidance: 'Tally scenes per POV. Is anyone\'s thread starving? Does the POV owning the climax own enough of the build-up?', placeholder: 'e.g. Bren: 14 · Sela: 9 · Envoy: 3 (!)…' },
            { label: 'Change Audit', guidance: 'Scan the "what changes" column. Any scene where the answer is weak or missing is a scene to cut or combine.', placeholder: 'e.g. #7 and #19 both reveal the same secret — merge…' },
            { label: 'Carried Burdens', guidance: 'What open promises does each scene carry forward — planted clues, unpaid setups, unresolved arguments? Track them so they land.', placeholder: 'e.g. The pawned watch (set #3) must return by #20…' },
        ],
    },
];
