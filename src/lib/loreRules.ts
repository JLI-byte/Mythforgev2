/**
 * Lore rules — LEAF MODULE: pure functions, no store or React imports beyond
 * types, 4-space indent (matches worldKey.ts, researchScope.ts, folderTree.ts).
 *
 * These replace what the deleted research assistant used to guess at. Six named
 * rules find gaps and contradictions in a World Bible; suggestArticles() finds
 * recurring proper nouns in the manuscript that have no article yet. Every rule
 * is exported on its own so it can be unit-tested in isolation, and every
 * finding is reproducible from the same input — no randomness, no network, no
 * model deciding what to mention.
 */

import type {
    Document as StoreDocument,
    Entity,
    EntityType,
    Scene,
    WorldBibleRootConfig,
} from '@/store/workspaceStore';
import type { ArticleSuggestion } from './articleSuggestions';
import type { ConsistencyFlag } from './consistencyFlags';
import { articleDocToText, stripHtmlText } from './worldAuthoring';
import { worldKeyForEntity } from './worldKey';

/** A single rule hit, before it is adapted to the widget's flag shape. */
export interface LoreFinding {
    /** Stable rule name, e.g. 'empty-description'. */
    ruleId: string;
    /**
     * Typed from the widget's own vocabulary, not the spec's. ConsistencyFlag
     * ships with 'contradiction' | 'gap' and its renderer keys a label map off
     * exactly those, so the widget wins and there is no lossy mapping.
     */
    severity: ConsistencyFlag['kind'];
    /** The entity the finding is about, when it is about one. */
    entityId?: string;
    /** One line — becomes the flag summary. */
    message: string;
    /** Optional second line — what to do about it. */
    detail?: string;
}

export interface LoreRuleInput {
    /** Every entity in the workspace; each rule filters to `worldKey` itself. */
    entities: Entity[];
    /** The scenes to scan. The caller decides the scope. */
    scenes: Scene[];
    /** The documents to scan. The caller decides the scope. */
    documents: StoreDocument[];
    /** This shelf's World Bible folders — needed to name a lonely category. */
    roots: WorldBibleRootConfig[];
    /** The shelf being checked. */
    worldKey: string;
}

// ── Shared helpers ──────────────────────────────────────────

/** Escape a string for literal use inside a RegExp. */
function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * True when `name` appears in `text` as a whole word, case-insensitively.
 * Plain substring matching would report "Al" as mentioned by "Also"; letters
 * and digits on either side are what disqualify a match, so punctuation and
 * quotes still count as boundaries.
 */
export function mentionsName(text: string, name: string): boolean {
    const trimmed = name.trim();
    if (!trimmed || !text) return false;
    const pattern = `(^|[^\\p{L}\\p{N}])${escapeRegExp(trimmed)}([^\\p{L}\\p{N}]|$)`;
    return new RegExp(pattern, 'iu').test(text);
}

/** The entities on the shelf being checked. */
export function worldEntities(input: LoreRuleInput): Entity[] {
    return input.entities.filter(e => worldKeyForEntity(e) === input.worldKey);
}

/** Scene and document bodies, stripped to prose. Empty bodies are dropped. */
export function manuscriptText(input: LoreRuleInput): string[] {
    return [...input.scenes, ...input.documents]
        .map(item => stripHtmlText(item.content ?? ''))
        .filter(text => text.length > 0);
}

/** One entity's own prose: its description plus its article body. */
export function entityText(entity: Entity): string {
    return [(entity.description ?? '').trim(), articleDocToText(entity.articleDoc)]
        .filter(part => part.length > 0)
        .join('\n');
}

// ── Rules ───────────────────────────────────────────────────

/** An article with no description shows a blank preview and hover card. */
export function ruleEmptyDescription(input: LoreRuleInput): LoreFinding[] {
    return worldEntities(input)
        .filter(e => !(e.description ?? '').trim())
        .map(e => ({
            ruleId: 'empty-description',
            severity: 'gap' as const,
            entityId: e.id,
            message: `“${e.name}” has no description`,
            detail: 'Open the article and write a line or two — it is what previews and hover cards show.',
        }));
}

/**
 * An article filed nowhere, or filed into a folder that has since been
 * deleted. Both land in Unfiled, so both read the same way to the writer.
 */
export function ruleUncategorised(input: LoreRuleInput): LoreFinding[] {
    const folderIds = new Set(input.roots.map(r => r.id));
    return worldEntities(input)
        .filter(e => !e.categoryId || !folderIds.has(e.categoryId))
        .map(e => ({
            ruleId: 'uncategorised',
            severity: 'gap' as const,
            entityId: e.id,
            message: `“${e.name}” is not filed in any folder`,
            detail: 'Drag it into a World Bible folder so it stops living in Unfiled.',
        }));
}

/**
 * Two articles on one shelf answering to the same name. Every name-resolving
 * path in the app — findEntityByName, @ mentions, [[…]] links — picks the
 * first match, so the second article becomes unreachable by name.
 */
export function ruleDuplicateName(input: LoreRuleInput): LoreFinding[] {
    const groups = new Map<string, Entity[]>();
    for (const e of worldEntities(input)) {
        const key = e.name.trim().toLowerCase();
        if (!key) continue;
        groups.set(key, [...(groups.get(key) ?? []), e]);
    }

    const findings: LoreFinding[] = [];
    for (const group of groups.values()) {
        if (group.length < 2) continue;
        findings.push({
            ruleId: 'duplicate-name',
            severity: 'contradiction',
            entityId: group[0].id,
            message: `${group.length} articles are named “${group[0].name}”`,
            detail: 'Rename one or merge them — links and @ mentions can only ever reach the first.',
        });
    }
    return findings;
}

/**
 * A folder with exactly one article in it: either there is more to write, or
 * the folder should be merged into a bigger one. An empty folder is left
 * alone — a folder made a minute ago is empty on purpose.
 */
export function ruleLonelyCategory(input: LoreRuleInput): LoreFinding[] {
    const entities = worldEntities(input);
    return input.roots
        .filter(root => entities.filter(e => e.categoryId === root.id).length === 1)
        .map(root => ({
            ruleId: 'lonely-category',
            severity: 'gap' as const,
            message: `The “${root.label}” folder holds only one article`,
            detail: 'Either it has more to hold and you have not written it yet, or it belongs inside a bigger folder.',
        }));
}

/**
 * An article nothing points at: its name appears in no scene, no chapter, and
 * no other article. Either it has not made it into the story yet, or it is
 * spelled differently there. An article does not vouch for itself.
 */
export function ruleNeverReferenced(input: LoreRuleInput): LoreFinding[] {
    const entities = worldEntities(input);
    const manuscript = manuscriptText(input).join('\n');
    const articles = entities.map(e => ({ id: e.id, text: entityText(e) }));

    return entities
        .filter(e => {
            const name = e.name.trim();
            if (!name) return false;
            if (mentionsName(manuscript, name)) return false;
            return !articles.some(a => a.id !== e.id && mentionsName(a.text, name));
        })
        .map(e => ({
            ruleId: 'never-referenced',
            severity: 'gap' as const,
            entityId: e.id,
            message: `“${e.name}” is never mentioned anywhere`,
            detail: 'No scene, chapter or other article names it. Either it is not in the story yet, or it is spelled differently there.',
        }));
}

/** Every distinct `[[Target]]` in the text. `[[Target|label]]` yields Target. */
export function extractWikiLinks(text: string): string[] {
    const found: string[] = [];
    const seen = new Set<string>();
    const pattern = /\[\[([^[\]]+?)\]\]/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
        const target = match[1].split('|')[0].trim();
        const key = target.toLowerCase();
        if (!target || seen.has(key)) continue;
        seen.add(key);
        found.push(target);
    }
    return found;
}

/**
 * Every distinct entity id referenced by an entity mark. Matches both the
 * plain attribute and the JSON-escaped form articleDoc stores.
 */
export function extractEntityIdRefs(html: string): string[] {
    const found: string[] = [];
    const seen = new Set<string>();
    const pattern = /data-entity-id=\\?["']([^"'\\]+)/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
        const id = match[1].trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        found.push(id);
    }
    return found;
}

/**
 * A link with nothing on the other end. Two shapes, because a link can break
 * two ways: a `[[Target]]` never resolved to an article at all, or a resolved
 * mark's article was deleted afterwards and its data-entity-id now dangles.
 * Scanned against raw source — the id lives in an attribute, and articleDoc
 * stores its HTML JSON-escaped.
 */
export function ruleBrokenLink(input: LoreRuleInput): LoreFinding[] {
    const entities = worldEntities(input);
    const names = new Set(entities.map(e => e.name.trim().toLowerCase()));
    const ids = new Set(entities.map(e => e.id));

    const sources = [
        ...input.scenes.map(s => ({ label: s.title, raw: s.content ?? '' })),
        ...input.documents.map(d => ({ label: d.title, raw: d.content ?? '' })),
        ...entities.map(e => ({ label: e.name, raw: `${e.description ?? ''}\n${e.articleDoc ?? ''}` })),
    ];

    const findings: LoreFinding[] = [];
    const reported = new Set<string>();

    for (const source of sources) {
        const where = source.label.trim() || 'Untitled';

        for (const target of extractWikiLinks(source.raw)) {
            const key = `name:${target.toLowerCase()}`;
            if (names.has(target.toLowerCase()) || reported.has(key)) continue;
            reported.add(key);
            findings.push({
                ruleId: 'broken-link',
                severity: 'contradiction',
                message: `[[${target}]] links to an article that does not exist`,
                detail: `First seen in “${where}”. Create “${target}”, or fix the spelling in the link.`,
            });
        }

        for (const id of extractEntityIdRefs(source.raw)) {
            const key = `id:${id}`;
            if (ids.has(id) || reported.has(key)) continue;
            reported.add(key);
            findings.push({
                ruleId: 'broken-link',
                severity: 'contradiction',
                message: `A link in “${where}” points at a deleted article`,
                detail: 'The article it referenced no longer exists. Re-link it, or remove the link.',
            });
        }
    }

    return findings;
}

// ── Composition ─────────────────────────────────────────────

/** Every rule, in the order findings are reported. */
export const LORE_RULES = [
    ruleEmptyDescription,
    ruleUncategorised,
    ruleNeverReferenced,
    ruleLonelyCategory,
    ruleBrokenLink,
    ruleDuplicateName,
] as const;

/** Run every rule over one shelf. Pure: same input, same findings, always. */
export function runLoreRules(input: LoreRuleInput): LoreFinding[] {
    return LORE_RULES.flatMap(rule => rule(input));
}

/**
 * Adapt a finding to the shape the Consistency & Gaps widget already renders.
 * The id is derived, not random, so re-running the check updates the board
 * instead of stacking a second copy of every finding on it.
 */
export function findingToFlag(finding: LoreFinding): ConsistencyFlag {
    return {
        id: `${finding.ruleId}:${finding.entityId ?? finding.message.toLowerCase()}`,
        kind: finding.severity,
        summary: finding.message,
        detail: finding.detail,
    };
}

// ── Article suggestions ─────────────────────────────────────

/** A name must recur this often before it is worth suggesting an article for. */
export const SUGGESTION_MIN_OCCURRENCES = 3;

/** Frequency says nothing about what a name *is*, so it lands in the neutral bucket. */
export const SUGGESTION_DEFAULT_TYPE: EntityType = 'lore';

/**
 * Words that are capitalised by grammar rather than by being names. Applied
 * only to a ONE-WORD candidate that opened a sentence — "The Crimson King"
 * and a mid-sentence "She Who Waits" are both untouched by it.
 */
const COMMON_SENTENCE_STARTERS = new Set([
    'a', 'after', 'all', 'also', 'an', 'and', 'another', 'any', 'around', 'as',
    'at', 'back', 'because', 'before', 'behind', 'below', 'beside', 'both',
    'but', 'by', 'down', 'each', 'even', 'every', 'first', 'for', 'from', 'he',
    'her', 'here', 'his', 'how', 'i', 'if', 'in', 'inside', 'instead', 'it',
    'its', 'just', 'last', 'later', 'like', 'maybe', 'more', 'most', 'much',
    'my', 'near', 'neither', 'never', 'next', 'no', 'none', 'nor', 'not',
    'nothing', 'now', 'of', 'on', 'once', 'one', 'only', 'or', 'other', 'our',
    'out', 'outside', 'over', 'perhaps', 'she', 'so', 'some', 'someone',
    'something', 'still', 'such', 'than', 'that', 'the', 'their', 'them',
    'then', 'there', 'these', 'they', 'this', 'those', 'though', 'through',
    'to', 'together', 'too', 'under', 'until', 'up', 'was', 'we', 'well',
    'what', 'when', 'where', 'which', 'while', 'who', 'why', 'with', 'without',
    'yes', 'yet', 'you', 'your',
]);

/**
 * The sentence-initial common words that routinely belong to a name. "The
 * Crimson King" keeps its "The"; "Then Kestrel stopped." must not become a
 * candidate called "Then Kestrel", which is the single most common way a
 * frequency counter loses track of a name.
 */
const NAME_LEADING_WORDS = new Set(['the']);

/** A candidate proper noun and how often it was seen. */
export interface NameCount {
    /** The name as first written, e.g. "The Crimson King". */
    name: string;
    occurrences: number;
    /** Index of the first text it appeared in. */
    sourceIndex: number;
}

function startsCapital(word: string): boolean {
    return /^["'“‘(]*\p{Lu}/u.test(word);
}

/** Strip surrounding punctuation, keeping internal apostrophes and hyphens. */
function trimWord(word: string): string {
    return word
        .replace(/^[^\p{L}\p{N}]+/u, '')
        .replace(/[^\p{L}\p{N}'’]+$/u, '');
}

/**
 * Capitalised words and runs of them, counted across the given texts. A run is
 * greedy, so "The Crimson King" is one candidate rather than three, and a run
 * stops at the word carrying a comma or dash. A one-word candidate that opened
 * a sentence is dropped when it is a common English word.
 */
export function countProperNounCandidates(texts: string[]): NameCount[] {
    const counts = new Map<string, NameCount>();

    texts.forEach((text, sourceIndex) => {
        for (const sentence of text.split(/[.!?…]+[\s"'”’)]*|\n+/u)) {
            const words = sentence.trim().split(/\s+/).filter(Boolean);
            let i = 0;
            while (i < words.length) {
                if (!startsCapital(words[i])) {
                    i += 1;
                    continue;
                }
                const atSentenceStart = i === 0;
                const run: string[] = [];
                while (i < words.length && startsCapital(words[i])) {
                    const cleaned = trimWord(words[i]);
                    if (cleaned) run.push(cleaned);
                    const runEnds = /[,;:—–]$/.test(words[i]);
                    i += 1;
                    if (runEnds) break;
                }
                // "Then Kestrel" — drop a sentence-initial grammar word that
                // merged into the run, unless it plausibly belongs to the name.
                const leading = (run[0] ?? '').toLowerCase();
                const body = atSentenceStart && run.length > 1
                    && COMMON_SENTENCE_STARTERS.has(leading) && !NAME_LEADING_WORDS.has(leading)
                    ? run.slice(1)
                    : run;

                const name = body.join(' ');
                if (!name) continue;
                if (body.length === 1 && atSentenceStart && COMMON_SENTENCE_STARTERS.has(name.toLowerCase())) {
                    continue;
                }
                const key = name.toLowerCase();
                const seen = counts.get(key);
                counts.set(key, seen
                    ? { ...seen, occurrences: seen.occurrences + 1 }
                    : { name, occurrences: 1, sourceIndex });
            }
        }
    });

    return [...counts.values()];
}

/**
 * Names the writer keeps using that have no article yet. Returns the EXISTING
 * ArticleSuggestion shape so ArticleSuggestionsRenderer works unchanged — the
 * occurrence count and the source live in `reason`, which the widget shows as
 * a tooltip and writes into the created article.
 */
export function suggestArticles(input: LoreRuleInput): ArticleSuggestion[] {
    const known = new Set(worldEntities(input).map(e => e.name.trim().toLowerCase()));
    const sources = [
        ...input.scenes.map(s => ({ title: s.title, text: stripHtmlText(s.content ?? '') })),
        ...input.documents.map(d => ({ title: d.title, text: stripHtmlText(d.content ?? '') })),
    ];

    return countProperNounCandidates(sources.map(s => s.text))
        .filter(c => c.occurrences >= SUGGESTION_MIN_OCCURRENCES)
        .filter(c => !known.has(c.name.toLowerCase()))
        .sort((a, b) => b.occurrences - a.occurrences || a.name.localeCompare(b.name))
        .map(c => ({
            id: `suggest:${c.name.toLowerCase()}`,
            name: c.name,
            type: SUGGESTION_DEFAULT_TYPE,
            reason: `Appears ${c.occurrences} times in your writing (first in “${sources[c.sourceIndex]?.title.trim() || 'Untitled'}”) with no article yet.`,
        }));
}
