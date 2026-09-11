import { describe, it, expect } from 'vitest';

/**
 * A canary for the vitest include pattern.
 *
 * `vitest.config.ts` collected `src/**\/*.test.ts` only for most of this
 * project's life, so a `.test.tsx` file was never picked up: it sat in the
 * repo, the suite reported green, and nothing inside it had run. A component
 * test written under that config proved nothing.
 *
 * This file exists to fail loudly if that ever comes back. It is a .tsx file
 * that renders JSX. If the include pattern stops matching .tsx, this test does
 * not fail — it simply stops being counted, which is exactly the silent
 * failure mode being guarded against. So the guard is the test COUNT: this
 * suite is asserted in CI and in the suite total, and a drop is the signal.
 */
describe('test collection', () => {
    it('collects .test.tsx files', () => {
        // Reaching this line at all is the assertion: the file was collected.
        expect(true).toBe(true);
    });

    it('can evaluate JSX, so component tests are possible here', () => {
        const element = <div data-testid="canary">ok</div>;
        expect(element.type).toBe('div');
        expect(element.props['data-testid']).toBe('canary');
    });
});
