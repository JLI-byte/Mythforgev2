import { describe, it, expect } from 'vitest';
import { partializeWorkspace } from './workspaceStore';

/**
 * These three fields are per-user. They must live inside the single persisted
 * workspace blob so that Phase 3's ownerUserId discard and sign-out reset take
 * them with everything else. A separate localStorage key would survive both
 * and hand the next person on this browser someone else's onboarding.
 */
describe('partializeWorkspace: first-run state', () => {
    it('persists hasOnboarded', () => {
        const state = { hasOnboarded: true } as never;
        expect(partializeWorkspace(state)).toHaveProperty('hasOnboarded', true);
    });

    it('persists dismissedHints', () => {
        const state = { dismissedHints: ['entity-link'] } as never;
        expect(partializeWorkspace(state)).toHaveProperty('dismissedHints', ['entity-link']);
    });

    it('persists lastVisitAt', () => {
        const state = { lastVisitAt: '2026-09-01T08:30:00.000Z' } as never;
        expect(partializeWorkspace(state))
            .toHaveProperty('lastVisitAt', '2026-09-01T08:30:00.000Z');
    });

    it('does not persist previousVisitAt — it is derived at boot, once per load', () => {
        const state = { previousVisitAt: '2026-08-01T00:00:00.000Z' } as never;
        expect(partializeWorkspace(state)).not.toHaveProperty('previousVisitAt');
    });
});
