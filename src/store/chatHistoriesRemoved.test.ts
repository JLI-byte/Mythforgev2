import { describe, it, expect } from 'vitest';
import { partializeWorkspace } from './workspaceStore';

/**
 * Phase 2 removed the research chat. These pin that its history no longer
 * rides along in every persisted write, and that the boards it used to sit
 * beside are untouched.
 */
describe('partializeWorkspace after AI removal', () => {
    it('does not persist chat histories', () => {
        const state = {
            chatHistories: { 'board::1': [{ role: 'user', content: 'hi' }] },
        } as never;
        expect(partializeWorkspace(state)).not.toHaveProperty('chatHistories');
    });

    it('still persists the research boards the chat used to sit beside', () => {
        const state = {
            customBoards: { p1: [{ id: 'b1', name: 'Lore' }] },
            researchStates: { 'p1::b1': { widgets: [] } },
        } as never;
        const out = partializeWorkspace(state);
        expect(out).toHaveProperty('customBoards');
        expect(out).toHaveProperty('researchStates');
    });

    it('still persists the interviews the user authored', () => {
        const state = { customInterviews: [{ id: 'i1', title: 'Founding myth' }] } as never;
        expect(partializeWorkspace(state)).toHaveProperty('customInterviews');
    });
});
