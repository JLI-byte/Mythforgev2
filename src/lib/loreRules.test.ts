import { describe, it, expect } from 'vitest';
import type { Document as StoreDocument, Entity, Scene, WorldBibleRootConfig } from '@/store/workspaceStore';
import { buildArticleDoc } from './worldAuthoring';
import {
    mentionsName,
    worldEntities,
    manuscriptText,
    entityText,
    ruleEmptyDescription,
    ruleUncategorised,
    ruleDuplicateName,
    ruleLonelyCategory,
    ruleNeverReferenced,
    ruleBrokenLink,
    extractWikiLinks,
    extractEntityIdRefs,
    runLoreRules,
    findingToFlag,
    LORE_RULES,
    suggestArticles,
    countProperNounCandidates,
    SUGGESTION_MIN_OCCURRENCES,
    type LoreRuleInput,
} from './loreRules';

// ── Fixtures ────────────────────────────────────────────────

function entity(over: Partial<Entity> & { name: string }): Entity {
    return {
        id: over.id ?? `e-${over.name.toLowerCase().replace(/\s+/g, '-')}`,
        projectId: 'p1',
        type: over.type ?? 'character',
        description: over.description ?? 'A description.',
        createdAt: new Date('2026-01-01'),
        ...over,
    };
}

function scene(over: Partial<Scene> & { content: string }): Scene {
    return {
        id: over.id ?? 's1',
        documentId: 'd1',
        projectId: 'p1',
        title: over.title ?? 'Chapter One',
        order: over.order ?? 0,
        createdAt: new Date('2026-01-01'),
        ...over,
    };
}

function folder(id: string, label: string): WorldBibleRootConfig {
    return { id, label, icon: '📁', entityTypes: [] };
}

function input(over: Partial<LoreRuleInput> = {}): LoreRuleInput {
    return {
        entities: [],
        scenes: [],
        documents: [] as StoreDocument[],
        roots: [],
        worldKey: 'standalone',
        ...over,
    };
}

// ── Helpers ─────────────────────────────────────────────────

describe('mentionsName', () => {
    it('matches a whole word, case-insensitively', () => {
        expect(mentionsName('Kestrel walked in.', 'kestrel')).toBe(true);
        expect(mentionsName('the SALT GUILD met', 'Salt Guild')).toBe(true);
    });

    it('does not match a name buried inside a longer word', () => {
        expect(mentionsName('Also, nobody came.', 'Al')).toBe(false);
        expect(mentionsName('Kestrels circled.', 'Kestrel')).toBe(false);
    });

    it('treats punctuation as a boundary and an empty name as no match', () => {
        expect(mentionsName('"Kestrel," she said.', 'Kestrel')).toBe(true);
        expect(mentionsName('anything', '   ')).toBe(false);
    });
});

describe('worldEntities', () => {
    it('keeps only the entities on the shelf being checked', () => {
        const here = entity({ name: 'Kestrel', worldId: 'w1' });
        const elsewhere = entity({ name: 'Other', worldId: 'w2' });
        const standalone = entity({ name: 'Loose' });
        expect(worldEntities(input({ entities: [here, elsewhere, standalone], worldKey: 'w1' })))
            .toEqual([here]);
        expect(worldEntities(input({ entities: [here, elsewhere, standalone], worldKey: 'standalone' })))
            .toEqual([standalone]);
    });
});

describe('manuscriptText', () => {
    it('strips scene and document markup down to prose', () => {
        const texts = manuscriptText(input({
            scenes: [scene({ content: '<p>The <em>Salt</em> Guild&nbsp;met.</p>' })],
        }));
        expect(texts.join('\n')).toContain('Salt');
        expect(texts.join('\n')).not.toContain('<p>');
        expect(texts.join('\n')).not.toContain('&nbsp;');
    });

    it('drops empty bodies rather than emitting blank strings', () => {
        expect(manuscriptText(input({ scenes: [scene({ content: '' })] }))).toEqual([]);
    });
});

describe('entityText', () => {
    it('reads the description and the article body together', () => {
        const e = entity({
            name: 'Kestrel',
            description: 'A thief.',
            articleDoc: buildArticleDoc([{ heading: 'Origins', body: 'Born in Veldrath.' }]),
        });
        const text = entityText(e);
        expect(text).toContain('A thief.');
        expect(text).toContain('Origins');
        expect(text).toContain('Born in Veldrath.');
    });
});

// ── Rules ───────────────────────────────────────────────────

describe('ruleEmptyDescription', () => {
    it('flags an entity with a blank description', () => {
        const findings = ruleEmptyDescription(input({
            entities: [entity({ name: 'Kestrel', description: '   ' })],
        }));
        expect(findings).toHaveLength(1);
        expect(findings[0].ruleId).toBe('empty-description');
        expect(findings[0].severity).toBe('gap');
        expect(findings[0].entityId).toBe('e-kestrel');
        expect(findings[0].message).toContain('Kestrel');
    });

    it('leaves a described entity alone', () => {
        expect(ruleEmptyDescription(input({
            entities: [entity({ name: 'Kestrel', description: 'A thief.' })],
        }))).toEqual([]);
    });

    it('ignores entities on another shelf', () => {
        expect(ruleEmptyDescription(input({
            entities: [entity({ name: 'Kestrel', description: '', worldId: 'w2' })],
            worldKey: 'w1',
        }))).toEqual([]);
    });
});

describe('ruleUncategorised', () => {
    it('flags an entity with no folder', () => {
        const findings = ruleUncategorised(input({
            entities: [entity({ name: 'Kestrel' })],
            roots: [folder('f1', 'People')],
        }));
        expect(findings.map(f => f.ruleId)).toEqual(['uncategorised']);
        expect(findings[0].severity).toBe('gap');
        expect(findings[0].message).toContain('Kestrel');
    });

    it('flags an entity pointing at a folder that no longer exists', () => {
        expect(ruleUncategorised(input({
            entities: [entity({ name: 'Kestrel', categoryId: 'deleted-folder' })],
            roots: [folder('f1', 'People')],
        }))).toHaveLength(1);
    });

    it('leaves a properly filed entity alone', () => {
        expect(ruleUncategorised(input({
            entities: [entity({ name: 'Kestrel', categoryId: 'f1' })],
            roots: [folder('f1', 'People')],
        }))).toEqual([]);
    });
});

describe('ruleDuplicateName', () => {
    it('flags two entities sharing a name, ignoring case', () => {
        const findings = ruleDuplicateName(input({
            entities: [
                entity({ id: 'a', name: 'Kestrel' }),
                entity({ id: 'b', name: 'kestrel' }),
            ],
        }));
        expect(findings).toHaveLength(1);
        expect(findings[0].ruleId).toBe('duplicate-name');
        expect(findings[0].severity).toBe('contradiction');
        expect(findings[0].entityId).toBe('a');
        expect(findings[0].message).toContain('2 articles');
    });

    it('reports one finding per clashing name, not one per entity', () => {
        const findings = ruleDuplicateName(input({
            entities: [
                entity({ id: 'a', name: 'Kestrel' }),
                entity({ id: 'b', name: 'Kestrel' }),
                entity({ id: 'c', name: 'Kestrel' }),
            ],
        }));
        expect(findings).toHaveLength(1);
        expect(findings[0].message).toContain('3 articles');
    });

    it('does not flag distinct names, and never flags across shelves', () => {
        expect(ruleDuplicateName(input({
            entities: [entity({ id: 'a', name: 'Kestrel' }), entity({ id: 'b', name: 'Veldrath' })],
        }))).toEqual([]);
        expect(ruleDuplicateName(input({
            entities: [
                entity({ id: 'a', name: 'Kestrel', worldId: 'w1' }),
                entity({ id: 'b', name: 'Kestrel', worldId: 'w2' }),
            ],
            worldKey: 'w1',
        }))).toEqual([]);
    });
});

describe('ruleLonelyCategory', () => {
    it('flags a folder holding exactly one article, and names it', () => {
        const findings = ruleLonelyCategory(input({
            entities: [entity({ name: 'Kestrel', categoryId: 'f1' })],
            roots: [folder('f1', 'People')],
        }));
        expect(findings).toHaveLength(1);
        expect(findings[0].ruleId).toBe('lonely-category');
        expect(findings[0].severity).toBe('gap');
        expect(findings[0].message).toContain('People');
        expect(findings[0].entityId).toBeUndefined();
    });

    it('leaves an empty folder alone — a new folder is empty on purpose', () => {
        expect(ruleLonelyCategory(input({ roots: [folder('f1', 'People')] }))).toEqual([]);
    });

    it('leaves a folder with two or more articles alone', () => {
        expect(ruleLonelyCategory(input({
            entities: [
                entity({ id: 'a', name: 'Kestrel', categoryId: 'f1' }),
                entity({ id: 'b', name: 'Veldrath', categoryId: 'f1' }),
            ],
            roots: [folder('f1', 'People')],
        }))).toEqual([]);
    });
});

describe('ruleNeverReferenced', () => {
    it('flags an entity no scene and no other article names', () => {
        const findings = ruleNeverReferenced(input({
            entities: [entity({ name: 'Kestrel' })],
            scenes: [scene({ content: '<p>Nobody came.</p>' })],
        }));
        expect(findings).toHaveLength(1);
        expect(findings[0].ruleId).toBe('never-referenced');
        expect(findings[0].severity).toBe('gap');
        expect(findings[0].entityId).toBe('e-kestrel');
    });

    it('does not flag an entity a scene names', () => {
        expect(ruleNeverReferenced(input({
            entities: [entity({ name: 'Kestrel' })],
            scenes: [scene({ content: '<p>Then <strong>Kestrel</strong> arrived.</p>' })],
        }))).toEqual([]);
    });

    it('does not flag an entity another article names', () => {
        expect(ruleNeverReferenced(input({
            entities: [
                entity({ id: 'a', name: 'Kestrel' }),
                entity({ id: 'b', name: 'Veldrath', description: 'The city Kestrel fled.' }),
            ],
            scenes: [],
        })).map(f => f.entityId)).toEqual(['b']);
    });

    it('does not let an entity vouch for itself', () => {
        expect(ruleNeverReferenced(input({
            entities: [entity({ name: 'Kestrel', description: 'Kestrel is a thief.' })],
        }))).toHaveLength(1);
    });

    it('does not count a name buried inside a longer word', () => {
        expect(ruleNeverReferenced(input({
            entities: [entity({ name: 'Kestrel' })],
            scenes: [scene({ content: '<p>Two kestrels circled overhead.</p>' })],
        }))).toHaveLength(1);
    });
});

describe('extractWikiLinks', () => {
    it('pulls every distinct target out, taking the left half of a piped link', () => {
        expect(extractWikiLinks('See [[Veldrath]] and [[Kestrel|the thief]] and [[Veldrath]].'))
            .toEqual(['Veldrath', 'Kestrel']);
    });

    it('ignores empty, blank and unclosed brackets', () => {
        expect(extractWikiLinks('[[]] and [[   ]] and [[unclosed text')).toEqual([]);
    });
});

describe('extractEntityIdRefs', () => {
    it('reads plain and JSON-escaped attributes alike', () => {
        expect(extractEntityIdRefs('<span data-entity-id="e-1">A</span>')).toEqual(['e-1']);
        expect(extractEntityIdRefs('{"html":"<span data-entity-id=\\"e-2\\">A</span>"}')).toEqual(['e-2']);
    });
});

describe('ruleBrokenLink', () => {
    it('flags a [[link]] with no matching article', () => {
        const findings = ruleBrokenLink(input({
            entities: [entity({ name: 'Kestrel' })],
            scenes: [scene({ content: '<p>She fled to [[Veldrath]].</p>' })],
        }));
        expect(findings).toHaveLength(1);
        expect(findings[0].ruleId).toBe('broken-link');
        expect(findings[0].severity).toBe('contradiction');
        expect(findings[0].message).toContain('[[Veldrath]]');
        expect(findings[0].detail).toContain('Chapter One');
    });

    it('does not flag a [[link]] that resolves, ignoring case', () => {
        expect(ruleBrokenLink(input({
            entities: [entity({ name: 'Veldrath' })],
            scenes: [scene({ content: '<p>She fled to [[veldrath]].</p>' })],
        }))).toEqual([]);
    });

    it('flags a mark pointing at a deleted article', () => {
        const findings = ruleBrokenLink(input({
            entities: [entity({ id: 'kept', name: 'Kestrel' })],
            scenes: [scene({ content: '<p><span data-entity-id="gone">Veldrath</span></p>' })],
        }));
        expect(findings).toHaveLength(1);
        expect(findings[0].message).toContain('Chapter One');
    });

    it('does not flag a mark that still resolves', () => {
        expect(ruleBrokenLink(input({
            entities: [entity({ id: 'kept', name: 'Kestrel' })],
            scenes: [scene({ content: '<p><span data-entity-id="kept">Kestrel</span></p>' })],
        }))).toEqual([]);
    });

    it('reports one finding per broken target, however often it appears', () => {
        expect(ruleBrokenLink(input({
            scenes: [
                scene({ id: 's1', content: '[[Veldrath]] again [[Veldrath]]' }),
                scene({ id: 's2', title: 'Chapter Two', content: '[[Veldrath]]' }),
            ],
        }))).toHaveLength(1);
    });

    it('scans article bodies too', () => {
        expect(ruleBrokenLink(input({
            entities: [entity({
                name: 'Kestrel',
                articleDoc: buildArticleDoc([{ heading: 'Home', body: 'Raised in [[Veldrath]].' }]),
            })],
        }))).toHaveLength(1);
    });
});

// ── Composition ─────────────────────────────────────────────

describe('runLoreRules', () => {
    it('runs all six rules and returns every finding', () => {
        expect(LORE_RULES).toHaveLength(6);
        const findings = runLoreRules(input({
            entities: [
                entity({ id: 'a', name: 'Kestrel', description: '' }),
                entity({ id: 'b', name: 'Kestrel', description: 'A thief.', categoryId: 'f1' }),
            ],
            scenes: [scene({ content: '<p>She fled to [[Veldrath]].</p>' })],
            roots: [folder('f1', 'People')],
        }));
        expect(new Set(findings.map(f => f.ruleId))).toEqual(new Set([
            'empty-description', 'uncategorised', 'never-referenced',
            'lonely-category', 'broken-link', 'duplicate-name',
        ]));
    });

    it('returns nothing for an empty world', () => {
        expect(runLoreRules(input())).toEqual([]);
    });

    it('is deterministic — the same input gives the identical result', () => {
        const args = input({
            entities: [entity({ name: 'Kestrel', description: '' })],
            roots: [folder('f1', 'People')],
        });
        expect(runLoreRules(args)).toEqual(runLoreRules(args));
    });
});

describe('findingToFlag', () => {
    it('maps a finding onto the widget shape the renderer already reads', () => {
        const flag = findingToFlag({
            ruleId: 'empty-description',
            severity: 'gap',
            entityId: 'e-kestrel',
            message: '“Kestrel” has no description',
            detail: 'Write a line or two.',
        });
        expect(flag.kind).toBe('gap');
        expect(flag.summary).toBe('“Kestrel” has no description');
        expect(flag.detail).toBe('Write a line or two.');
        expect(flag.id).toBe('empty-description:e-kestrel');
    });

    it('gives a finding with no entity a stable id derived from its message', () => {
        const finding = {
            ruleId: 'lonely-category' as const,
            severity: 'gap' as const,
            message: 'The “People” folder holds only one article',
        };
        expect(findingToFlag(finding).id).toBe(findingToFlag(finding).id);
        expect(findingToFlag(finding).id.startsWith('lonely-category:')).toBe(true);
    });
});

// ── Article suggestions ─────────────────────────────────────

describe('countProperNounCandidates', () => {
    it('counts a capitalised word wherever it appears', () => {
        const counts = countProperNounCandidates(['Kestrel ran. Then Kestrel stopped.']);
        expect(counts.find(c => c.name === 'Kestrel')?.occurrences).toBe(2);
    });

    it('keeps a capitalised run together as one candidate', () => {
        const counts = countProperNounCandidates(['The Crimson King waited.']);
        expect(counts.map(c => c.name)).toContain('The Crimson King');
        expect(counts.map(c => c.name)).not.toContain('Crimson');
    });

    it('does not let a sentence-opening grammar word swallow the name after it', () => {
        expect(countProperNounCandidates(['Then Kestrel stopped.']).map(c => c.name))
            .toEqual(['Kestrel']);
    });

    it('drops a common English word that only started a sentence', () => {
        const counts = countProperNounCandidates(['The door closed.\nShe waited.\nThen nothing.']);
        expect(counts.map(c => c.name)).toEqual([]);
    });

    it('keeps a common word when it is not sentence-initial', () => {
        const counts = countProperNounCandidates(['They called her She Who Waits.']);
        expect(counts.map(c => c.name)).toContain('She Who Waits');
    });

    it('records the index of the text a candidate first appeared in', () => {
        const counts = countProperNounCandidates(['nothing here.', 'Kestrel arrived.']);
        expect(counts.find(c => c.name === 'Kestrel')?.sourceIndex).toBe(1);
    });
});

describe('suggestArticles', () => {
    const thrice = '<p>Kestrel ran.</p><p>Then Kestrel stopped.</p><p>Later, Kestrel slept.</p>';

    it('suggests a name recurring at least three times with no article', () => {
        const suggestions = suggestArticles(input({ scenes: [scene({ content: thrice })] }));
        expect(suggestions.map(s => s.name)).toEqual(['Kestrel']);
        expect(suggestions[0].id).toBe('suggest:kestrel');
        expect(suggestions[0].type).toBe('lore');
        expect(suggestions[0].category).toBeUndefined();
        expect(suggestions[0].reason).toContain('3 times');
        expect(suggestions[0].reason).toContain('Chapter One');
    });

    it('does not suggest a name that already has an article, ignoring case', () => {
        expect(suggestArticles(input({
            entities: [entity({ name: 'kestrel' })],
            scenes: [scene({ content: thrice })],
        }))).toEqual([]);
    });

    it('does not suggest a name appearing only twice', () => {
        expect(suggestArticles(input({
            scenes: [scene({ content: '<p>Kestrel ran.</p><p>Then Kestrel stopped.</p>' })],
        }))).toEqual([]);
        expect(SUGGESTION_MIN_OCCURRENCES).toBe(3);
    });

    it('orders the most frequent first', () => {
        const suggestions = suggestArticles(input({
            scenes: [scene({ content: `${thrice}<p>Veldrath. Veldrath. Veldrath. Veldrath.</p>` })],
        }));
        expect(suggestions.map(s => s.name)).toEqual(['Veldrath', 'Kestrel']);
    });
});
