import { describe, it, expect } from 'vitest';
import { buildRegistry } from './boardMigration';

describe('buildRegistry', () => {
    it('makes a root board from a bare project key', () => {
        const reg = buildRegistry({ 'project:p1': {} }, {});
        expect(reg['project:p1']).toEqual({
            id: 'project:p1', name: 'Main', parentId: null, projectId: 'p1',
        });
    });

    it('hangs a composite key under its base as a child', () => {
        const reg = buildRegistry(
            { 'project:p1': {}, 'project:p1::b7': {} },
            { 'project:p1': [{ id: 'b7', name: 'Siege' }] },
        );
        expect(reg['project:p1::b7']).toEqual({
            id: 'project:p1::b7', name: 'Siege', parentId: 'project:p1', projectId: 'p1',
        });
    });

    it('names a child Untitled board when customBoards has forgotten it', () => {
        const reg = buildRegistry({ 'project:p1': {}, 'project:p1::gone': {} }, {});
        expect(reg['project:p1::gone'].name).toBe('Untitled board');
        expect(reg['project:p1::gone'].parentId).toBe('project:p1');
    });

    it('creates the missing root when only a child board was persisted', () => {
        // A board bar entry can outlive its base key if the base was never drawn on.
        const reg = buildRegistry({ 'project:p1::b7': {} }, { 'project:p1': [{ id: 'b7', name: 'Siege' }] });
        expect(reg['project:p1']).toBeDefined();
        expect(reg['project:p1'].parentId).toBeNull();
        expect(reg['project:p1::b7'].parentId).toBe('project:p1');
    });

    it('ignores world-scoped boards, which have no screen any more', () => {
        const reg = buildRegistry({ 'project:p1': {}, 'world:w1': {} }, {});
        expect(reg['world:w1']).toBeUndefined();
        expect(Object.keys(reg)).toEqual(['project:p1']);
    });

    it('returns an empty registry for an empty workspace', () => {
        expect(buildRegistry({}, {})).toEqual({});
    });

    it('is idempotent — running it on its own output changes nothing', () => {
        const states = { 'project:p1': {}, 'project:p1::b7': {} };
        const boards = { 'project:p1': [{ id: 'b7', name: 'Siege' }] };
        expect(buildRegistry(states, boards)).toEqual(buildRegistry(states, boards));
    });
});
