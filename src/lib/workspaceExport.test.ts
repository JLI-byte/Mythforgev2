import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
    EXPORT_FORMAT,
    EXPORT_FORMAT_VERSION,
    NOT_INCLUDED,
    WORKSPACE_SCHEMA_VERSION,
    buildWorkspaceExport,
    exportFileName,
} from './workspaceExport';

const workspace = { projects: [{ id: 'p1' }], scenes: [], entities: [] };

describe('buildWorkspaceExport', () => {
    it('stamps the format so a future importer can recognise the file', () => {
        const out = buildWorkspaceExport(workspace, { schemaVersion: 4, exportedAt: '2026-09-03T10:00:00.000Z' });
        expect(out.format).toBe(EXPORT_FORMAT);
        expect(out.formatVersion).toBe(EXPORT_FORMAT_VERSION);
        expect(out.schemaVersion).toBe(4);
        expect(out.exportedAt).toBe('2026-09-03T10:00:00.000Z');
    });

    it('carries the workspace through untouched', () => {
        const out = buildWorkspaceExport(workspace, { schemaVersion: 4, exportedAt: 'x' });
        expect(out.workspace).toEqual(workspace);
    });

    it('lists what is in the file, so the reader does not have to guess', () => {
        const out = buildWorkspaceExport(workspace, { schemaVersion: 4, exportedAt: 'x' });
        expect(out.contents).toEqual(['projects', 'scenes', 'entities']);
    });

    it('states what is not in the file', () => {
        const out = buildWorkspaceExport(workspace, { schemaVersion: 4, exportedAt: 'x' });
        expect(out.notIncluded).toEqual(NOT_INCLUDED);
    });

    it('records the account when it is known', () => {
        const out = buildWorkspaceExport(workspace, {
            schemaVersion: 4,
            exportedAt: 'x',
            userId: 'u1',
            email: 'writer@example.com',
        });
        expect(out.account).toEqual({ userId: 'u1', email: 'writer@example.com' });
    });

    it('omits the account entirely when signed out', () => {
        const out = buildWorkspaceExport(workspace, { schemaVersion: 4, exportedAt: 'x' });
        expect(out.account).toBeNull();
    });

    it('survives a round trip through JSON, which is how it is actually written', () => {
        const out = buildWorkspaceExport(workspace, { schemaVersion: 4, exportedAt: 'x' });
        expect(JSON.parse(JSON.stringify(out)).workspace).toEqual(workspace);
    });
});

describe('exportFileName', () => {
    it('dates the file from the export timestamp, not the clock', () => {
        expect(exportFileName('2026-09-03T10:00:00.000Z')).toBe('lorecanvas-export-2026-09-03.json');
    });
});

describe('WORKSPACE_SCHEMA_VERSION', () => {
    // The constant is mirrored here rather than imported, because this is a leaf
    // module and the store pulls in React. Reading the store's source is what
    // stops the mirror going stale the next time a migration bumps the version:
    // an export claiming schemaVersion 4 for a version-5 workspace would send a
    // future importer down the wrong migration chain.
    it('matches the persist version in workspaceStore.ts', () => {
        const source = readFileSync(
            path.resolve(__dirname, '../store/workspaceStore.ts'),
            'utf8',
        );
        const matches = [...source.matchAll(/^\s{12}version:\s*(\d+),/gm)];
        expect(matches).toHaveLength(1);
        expect(Number(matches[0][1])).toBe(WORKSPACE_SCHEMA_VERSION);
    });
});
