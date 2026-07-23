import { describe, it, expect } from 'vitest';
import {
    escapeHtml,
    bodyToHtml,
    buildArticleDoc,
    appendSectionsToDoc,
    articleDocToText,
    resolveFolderIdByName,
    resolveCategoryId,
    makeCategoryRoot,
    findEntityByName,
    serializeWorld,
} from './worldAuthoring';
import type { Entity, WorldBibleRootConfig } from '@/store/workspaceStore';

function root(id: string, label: string, entityTypes: string[] = [], parentId?: string): WorldBibleRootConfig {
    return { id, label, icon: '📁', entityTypes: entityTypes as never[], parentId };
}
function entity(name: string, type: Entity['type'], categoryId?: string): Entity {
    return { id: name, projectId: 'p', name, type, description: '', createdAt: new Date(), categoryId };
}

describe('escapeHtml / bodyToHtml', () => {
    it('escapes HTML-significant characters', () => {
        expect(escapeHtml('a < b & "c"')).toBe('a &lt; b &amp; &quot;c&quot;');
    });
    it('wraps blank-line-separated paragraphs in escaped <p> tags', () => {
        expect(bodyToHtml('First para.\n\nSecond <b>para</b>.')).toBe(
            '<p>First para.</p><p>Second &lt;b&gt;para&lt;/b&gt;.</p>',
        );
    });
});

describe('buildArticleDoc', () => {
    it('produces a parseable single Main tab with heading + text widgets', () => {
        const raw = buildArticleDoc([{ heading: 'Overview', body: 'A city.' }]);
        const tabs = JSON.parse(raw);
        expect(Array.isArray(tabs)).toBe(true);
        expect(tabs).toHaveLength(1);
        expect(tabs[0].name).toBe('Main');
        const types = tabs[0].widgets.map((w: { type: string }) => w.type);
        expect(types).toEqual(['heading', 'text']);
        expect(tabs[0].widgets[0].content).toEqual({ text: 'Overview', level: 2 });
        expect(tabs[0].widgets[1].content.html).toBe('<p>A city.</p>');
    });
    it('omits the heading widget when a section has none', () => {
        const tabs = JSON.parse(buildArticleDoc([{ body: 'Just prose.' }]));
        expect(tabs[0].widgets.map((w: { type: string }) => w.type)).toEqual(['text']);
    });
});

describe('folder resolution', () => {
    const roots = [root('people', 'People', ['character']), root('cities', 'Cities', [], 'places')];
    it('resolves a folder id by case-insensitive name', () => {
        expect(resolveFolderIdByName(roots, 'cities')).toBe('cities');
        expect(resolveFolderIdByName(roots, 'People')).toBe('people');
        expect(resolveFolderIdByName(roots, 'nope')).toBeUndefined();
    });
    it('resolveCategoryId prefers a named folder, else files by type', () => {
        expect(resolveCategoryId(roots, 'Cities', 'location')).toBe('cities');
        expect(resolveCategoryId(roots, undefined, 'character')).toBe('people');
        expect(resolveCategoryId(roots, 'ghost', 'character')).toBe('people');
    });
});

describe('makeCategoryRoot', () => {
    it('builds a freeform folder with a default icon and optional parent', () => {
        const c = makeCategoryRoot('Factions', undefined, 'people');
        expect(c.label).toBe('Factions');
        expect(c.icon).toBe('📁');
        expect(c.entityTypes).toEqual([]);
        expect(c.parentId).toBe('people');
        expect(typeof c.id).toBe('string');
    });
});

describe('findEntityByName', () => {
    it('matches case-insensitively', () => {
        const list = [entity('Kael', 'character'), entity('Veldrath', 'location')];
        expect(findEntityByName(list, 'kael')?.name).toBe('Kael');
        expect(findEntityByName(list, 'missing')).toBeUndefined();
    });
});

describe('serializeWorld', () => {
    it('outlines nested folders, their articles, and unfiled entries', () => {
        const roots = [
            root('places', 'Places'),
            root('cities', 'Cities', [], 'places'),
        ];
        const entities = [
            entity('Veldrath', 'location', 'cities'),
            entity('Loose Idea', 'lore', undefined),
        ];
        const out = serializeWorld(roots, entities);
        expect(out).toContain('- 📁 Places');
        expect(out).toContain('  - 📁 Cities');
        expect(out).toContain('    • Veldrath (location)');
        expect(out).toContain('- (unfiled)');
        expect(out).toContain('• Loose Idea (lore)');
    });
    it('reports an empty world clearly', () => {
        expect(serializeWorld([], [])).toContain('no folders or articles');
    });

    it('includes descriptions inline and full article contents', () => {
        const roots = [root('places', 'Places')];
        const doc = buildArticleDoc([{ heading: 'Overview', body: 'A grey city.' }]);
        const e: Entity = {
            id: 'v', projectId: 'p', name: 'Veldrath', type: 'location',
            description: 'A rain-drowned harbor.', articleDoc: doc, createdAt: new Date(), categoryId: 'places',
        };
        const out = serializeWorld(roots, [e]);
        expect(out).toContain('• Veldrath (location) — A rain-drowned harbor.');
        expect(out).toContain('Article contents:');
        expect(out).toContain('### Veldrath (location)');
        expect(out).toContain('Overview');
        expect(out).toContain('A grey city.');
    });
});

describe('articleDocToText', () => {
    it('round-trips a built article doc back to readable text', () => {
        const doc = buildArticleDoc([{ heading: 'History', body: 'Founded on salt.\n\nBurned twice.' }]);
        const text = articleDocToText(doc);
        expect(text).toContain('History');
        expect(text).toContain('Founded on salt.');
        expect(text).toContain('Burned twice.');
        expect(text).not.toMatch(/<[^>]+>/); // no HTML tags
    });
    it('returns empty string for malformed input', () => {
        expect(articleDocToText('not json')).toBe('');
        expect(articleDocToText(undefined)).toBe('');
    });
});

describe('appendSectionsToDoc', () => {
    it('adds widgets below existing content', () => {
        const base = buildArticleDoc([{ heading: 'Overview', body: 'One.' }]);
        const baseCount = JSON.parse(base)[0].widgets.length;
        const next = appendSectionsToDoc(base, [{ heading: 'Economy', body: 'Two.' }]);
        const tabs = JSON.parse(next);
        expect(tabs[0].widgets.length).toBe(baseCount + 2); // heading + text
        expect(articleDocToText(next)).toContain('Overview');
        expect(articleDocToText(next)).toContain('Economy');
    });
    it('falls back to a fresh doc when input is unparseable', () => {
        const doc = appendSectionsToDoc('garbage', [{ heading: 'New', body: 'Fresh.' }]);
        expect(articleDocToText(doc)).toContain('Fresh.');
    });
});
