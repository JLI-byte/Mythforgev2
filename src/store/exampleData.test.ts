import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkspaceStore, partializeWorkspace } from './workspaceStore';

describe('example data state', () => {
    beforeEach(() => {
        useWorkspaceStore.setState({
            worlds: [], projects: [], documents: [], scenes: [], entities: [],
            exampleDataOn: false, stashedExample: null, exampleWorldId: null,
        });
    });

    it('starts off with nothing stashed', () => {
        const s = useWorkspaceStore.getState();
        expect(s.exampleDataOn).toBe(false);
        expect(s.stashedExample).toBeNull();
        expect(s.exampleWorldId).toBeNull();
    });

    it('persists all three fields', () => {
        const persisted = partializeWorkspace(useWorkspaceStore.getState());
        expect(persisted).toHaveProperty('exampleDataOn');
        expect(persisted).toHaveProperty('stashedExample');
        expect(persisted).toHaveProperty('exampleWorldId');
    });
});
