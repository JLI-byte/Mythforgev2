import { WritingMethod } from '../types';

/**
 * Spatial / visual-thinking methods and non-linear drafting.
 * Field-guide families VII (spatial) and IX (non-linear / dialogue-first).
 */
export const VISUAL_METHODS: WritingMethod[] = [
    {
        id: 'index-cards',
        name: 'Index Cards',
        family: 'spatial',
        formats: ['story', 'script'],
        tagline: 'One scene per card — shuffle until the order feels inevitable.',
        bestFor: 'Everyone; the fastest way to experiment with structure',
        beats: [
            { label: 'How to Work This Board', guidance: 'Each card below is one scene. Fill them, drag them, reorder them. Add more cards from the widget palette as the story grows. The magic is in the shuffling.', placeholder: 'Delete this card once you\'re rolling — it\'s just the instructions.' },
            { label: 'Scene', guidance: 'One scene: who\'s in it, what happens, what changes. Keep it to a few lines — cards are for structure, not prose.', placeholder: 'e.g. Nadia finds the door unlocked — decides not to tell…' },
            { label: 'Scene', guidance: 'One scene per card. If a card needs two sentences of "and then," it\'s probably two cards.', placeholder: '…' },
            { label: 'Scene', guidance: 'Try tagging cards by POV or subplot in the first word, so patterns jump out when you rearrange.', placeholder: '…' },
            { label: 'Scene', guidance: 'A card that could sit anywhere might belong nowhere — every scene should resist being moved.', placeholder: '…' },
            { label: 'Scene', guidance: 'Gaps are information. If two cards don\'t connect, the missing card between them is your next scene.', placeholder: '…' },
            { label: 'Scene', guidance: 'Keep going — add cards freely from the palette.', placeholder: '…' },
        ],
    },
    {
        id: 'corkboard-acts',
        name: 'Corkboard by Acts',
        family: 'spatial',
        formats: ['story', 'script'],
        tagline: 'Index cards arranged in act columns — freeform thinking with structural gravity.',
        bestFor: 'Screenwriters and spatial thinkers who want light structure',
        beats: [
            { group: 'Act I', label: 'Act I — Opening', guidance: 'Cards in this column belong to the setup: world, want, and the door into Act II.', placeholder: 'e.g. Meet Theo at the failing radio station…' },
            { group: 'Act I', label: 'Act I — Scene', guidance: 'Keep adding Act I cards below this one. When a card feels like escalation rather than setup, it\'s telling you it belongs in Act II.', placeholder: '…' },
            { group: 'Act II', label: 'Act II — Escalation', guidance: 'The long middle: complications, reversals, the midpoint shift. This column should be roughly as tall as the other two combined.', placeholder: 'e.g. The broadcast reaches someone it shouldn\'t…' },
            { group: 'Act II', label: 'Act II — Scene', guidance: 'Watch for sag: every few cards, something should be irreversibly worse.', placeholder: '…' },
            { group: 'Act II', label: 'Act II — Midpoint', guidance: 'Pin the midpoint card at this column\'s center — the fulcrum the whole board balances on.', placeholder: 'e.g. The voice on the air is his own, dated next week…' },
            { group: 'Act III', label: 'Act III — Payoff', guidance: 'Climax and resolution. Every setup card in Act I should have a payoff card here — check them off in pairs.', placeholder: 'e.g. Last broadcast: he reads tomorrow\'s news and changes it…' },
        ],
    },
    {
        id: 'mind-map',
        name: 'Mind Map',
        family: 'spatial',
        formats: ['story', 'article', 'game'],
        tagline: 'Radial free-association — the idea at the center, everything it touches around it.',
        bestFor: 'Early ideation, before structure exists',
        beats: [
            { label: 'Center: The Idea', guidance: 'The seed at the middle of the map. Everything else radiates from here. Place this card centrally and arrange branches around it.', placeholder: 'e.g. A city built on the back of something asleep…' },
            { label: 'Branch: Characters', guidance: 'Who lives in this idea? Free-associate — names, roles, fragments. Don\'t judge, just branch.', placeholder: 'e.g. The listener guild… a child who sleepwalks toward the edge…' },
            { label: 'Branch: Conflicts', guidance: 'Where\'s the friction? What breaks, who fights, what\'s scarce?', placeholder: 'e.g. The wake-cult vs. the lullaby industry…' },
            { label: 'Branch: Images & Moments', guidance: 'Scenes you can see before there\'s a plot. These often become your tentpoles.', placeholder: 'e.g. The whole city tilting three degrees at dawn…' },
            { label: 'Branch: Questions', guidance: 'What do you not know yet? Questions are branches that grow.', placeholder: 'e.g. What does it dream? Who feeds it?…' },
            { label: 'The Path', guidance: 'When the map feels full, draw a line through the branches that excite you most — in order. That path is your first outline.', placeholder: 'e.g. sleepwalking child → listener guild → the tilt → what it dreams…' },
        ],
    },
    {
        id: 'storyboard',
        name: 'Storyboarding',
        family: 'spatial',
        formats: ['script', 'story'],
        tagline: 'Think in sequential panels — what the audience sees, beat by beat.',
        bestFor: 'Comics, film-adjacent stories, visual thinkers',
        beats: [
            { label: 'Panel 1', guidance: 'Describe the frame: what we SEE. Then add the internality — what the moment means, feels like, or hides. Drop image widgets beside these cards for real sketches.', placeholder: 'e.g. SEE: wide shot, empty pool, one deck chair. FEEL: someone left in a hurry…' },
            { label: 'Panel 2', guidance: 'Each panel is a beat of attention. What does the eye land on next?', placeholder: 'e.g. SEE: close-up — sunglasses at the pool\'s bottom…' },
            { label: 'Panel 3', guidance: 'Vary the shot distance: wide establishes, medium relates, close-up reveals.', placeholder: '…' },
            { label: 'Panel 4', guidance: 'The cut IS the storytelling: what you don\'t show between panels is where the reader works.', placeholder: '…' },
            { label: 'Panel 5', guidance: 'Where\'s the page-turn or act-break reveal? Put your gasp on the turn.', placeholder: '…' },
            { label: 'Sequence Notes', guidance: 'The connective tissue: pacing of the whole sequence, what it must accomplish, where it sits in the larger story.', placeholder: 'e.g. This sequence must make us love the house before we burn it…' },
        ],
    },
    {
        id: 'timeline-chronology',
        name: 'Timeline & Chronology',
        family: 'spatial',
        formats: ['story', 'script'],
        tagline: 'Separate when events HAPPEN from when the reader LEARNS them.',
        bestFor: 'Non-linear narratives, dual timelines, mysteries, epics',
        beats: [
            { label: 'Chronological Events', guidance: 'List story events in the order they actually happen in-world, with dates or relative time. This is the true history — including what happens off-page.', placeholder: 'e.g. 1961: the fire / 1962: the adoption / 1989: the letter arrives…' },
            { label: 'Narrative Order', guidance: 'Now list the order the READER experiences them. Number each against the chronology — the gap between the two lists is your structure.', placeholder: 'e.g. Opens 1989 (letter) → 1961 (fire) withheld until ch. 20…' },
            { label: 'Revelation Ledger', guidance: 'The third axis: when does the reader learn each key fact, and from whom? Suspense lives in the distance between happening and knowing.', placeholder: 'e.g. Reader learns the adoption in ch. 4; heroine learns in ch. 16…' },
            { label: 'Anchor Dates', guidance: 'Fixed points that can\'t move — ages, seasons, historical events. Check every scene against these when you reorder.', placeholder: 'e.g. She must be 7 in 1961; the trial is public record, June 1990…' },
            { label: 'Off-Page Clocks', guidance: 'What advances while we\'re not looking? Antagonist plans and background pressures should progress between scenes, not pause.', placeholder: 'e.g. While ch. 8–12 happen, the demolition permit clears…' },
        ],
    },
    {
        id: 'relationship-map',
        name: 'Relationship Map',
        family: 'spatial',
        formats: ['story', 'game'],
        tagline: 'The cast as a web — who loves, owes, fears, and betrays whom, and how that changes.',
        bestFor: 'Large casts, intrigue, ensemble stories',
        beats: [
            { label: 'The Cast', guidance: 'One card per major character (duplicate this card). Place them spatially — allies near, enemies far, and let position mean something.', placeholder: 'e.g. VARA — spymaster, owes everyone, trusts no one…' },
            { label: 'The Bonds', guidance: 'For each pair that matters: the relationship\'s type, direction, and secret. "A loves B" and "B uses A" is a story; mutual friendship is wallpaper.', placeholder: 'e.g. Vara→Col: protects (guilt) / Col→Vara: informs on her (debt)…' },
            { label: 'How Bonds Change', guidance: 'Relationships are arcs too. Note each bond\'s trajectory: where it starts, what bends it, where it lands.', placeholder: 'e.g. Vara & Col: protector/informant → enemies → uneasy equals by Act III…' },
            { label: 'The Web\'s Pressure Points', guidance: 'Which single bond, if snapped, reconfigures the whole web? That snap is probably your midpoint or climax.', placeholder: 'e.g. If Col\'s informing surfaces, every alliance re-sorts…' },
        ],
    },

    // ── Non-linear / modular ─────────────────────────────────
    {
        id: 'modular-drafting',
        name: 'Modular (Out-of-Order) Drafting',
        family: 'nonlinear',
        formats: ['story'],
        tagline: 'Write whichever scene is alive today; assemble the order later.',
        bestFor: 'Writers whose energy jumps around the story',
        beats: [
            { label: 'The Module Tray', guidance: 'List every scene you\'ve drafted or want to draft, in no particular order. Write what\'s vivid; never force the "next" scene.', placeholder: 'e.g. ✓ the eulogy / ✓ the car argument / ○ the meet / ○ the diagnosis…' },
            { label: 'Assembly Order', guidance: 'Periodically, arrange the modules into a candidate sequence. Expect this to change — it\'s a hypothesis, not a commitment.', placeholder: 'e.g. meet → diagnosis → car argument → eulogy?  or eulogy first?…' },
            { label: 'The Join List', guidance: 'For each adjacent pair in your assembly: does B follow from A? Does the reader know what they need? Missing joins become bridge scenes.', placeholder: 'e.g. car argument → eulogy: need a scene where they don\'t reconcile…' },
            { label: 'Continuity Ledger', guidance: 'Facts that must stay consistent across modules written weeks apart: injuries, weather, who knows what, what day it is.', placeholder: 'e.g. Marc\'s cast: on in "diagnosis", off by "eulogy" — 6+ weeks between…' },
        ],
    },
    {
        id: 'dialogue-first',
        name: 'Dialogue-First Drafting',
        family: 'nonlinear',
        formats: ['story', 'script'],
        tagline: 'Draft scenes as pure dialogue — the skeleton of voices — then dress them in prose.',
        bestFor: 'Dialogue-driven scenes; writers who hear characters before seeing them',
        beats: [
            { label: 'The Dialogue Skeleton', guidance: 'Write the scene as bare script: names and lines only. No description, no attribution beyond the name. Let the voices fight it out.', placeholder: 'e.g. MAE: You kept the receipt. / JUN: I keep everything. / MAE: That\'s the problem…' },
            { label: 'What Each Voice Wants', guidance: 'Under the skeleton: each speaker\'s goal in the scene. Dialogue without agendas is just chat.', placeholder: 'e.g. Mae wants an apology she can refuse; Jun wants to be caught…' },
            { label: 'The Unsaid', guidance: 'Note what each character is NOT saying. Subtext is the gap between the lines and the wants.', placeholder: 'e.g. Neither mentions the anniversary. Both know…' },
            { label: 'Dressing Notes', guidance: 'When the skeleton works aloud, list what the prose pass must add: setting, action beats, interiority — placed where the silences are.', placeholder: 'e.g. The receipt is ON the table the whole time; she folds it at the last line…' },
        ],
    },
];
