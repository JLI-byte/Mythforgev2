import { describe, it, expect } from 'vitest';
import { selectProjectFrontMatter, type WorkspaceState } from './workspaceStore';
import { DEFAULT_FRONT_MATTER } from '@/lib/manuscript';

function stateWith(project: Record<string, unknown> | null): WorkspaceState {
    return {
        activeProjectId: project ? 'p1' : null,
        projects: project ? [project] : [],
    } as unknown as WorkspaceState;
}

describe('selectProjectFrontMatter', () => {
    it('gives a project that has never been compiled the defaults', () => {
        expect(selectProjectFrontMatter(stateWith({ id: 'p1', name: 'Book' })))
            .toEqual(DEFAULT_FRONT_MATTER);
    });

    it('gives the defaults when there is no active project at all', () => {
        expect(selectProjectFrontMatter(stateWith(null))).toEqual(DEFAULT_FRONT_MATTER);
    });

    it('merges what the writer saved over the defaults', () => {
        const state = stateWith({ id: 'p1', name: 'Book', frontMatter: { dedication: 'For Ada' } });
        expect(selectProjectFrontMatter(state))
            .toEqual({ ...DEFAULT_FRONT_MATTER, dedication: 'For Ada' });
    });
});
