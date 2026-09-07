/**
 * Focus-trap ordering. LEAF MODULE (no store, no React).
 *
 * The DOM half of a focus trap — querying, focusing, restoring — belongs in a
 * hook. The half worth testing is arithmetic: given how many focusable
 * elements a dialog has and which one holds focus, where does Tab go next?
 * That is here, and it is pure.
 */

/** Everything a dialog can put focus on, matched in DOM order. */
export const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Index Tab (or Shift+Tab) should land on.
 *
 * `current` is -1 when focus is outside the dialog, which is how focus escaping
 * gets pulled back in. Returns -1 when there is nothing focusable at all; the
 * caller treats that as "focus the dialog container itself".
 */
export function nextTrapIndex(count: number, current: number, backwards: boolean): number {
    if (count <= 0) return -1;
    if (current < 0 || current >= count) return backwards ? count - 1 : 0;
    const next = backwards ? current - 1 : current + 1;
    if (next < 0) return count - 1;
    if (next >= count) return 0;
    return next;
}

/**
 * Index to focus when the dialog opens. `autoFocusIndex` is the position of an
 * element the dialog marked as its own first stop, or -1 if it named none.
 */
export function initialTrapIndex(count: number, autoFocusIndex: number): number {
    if (count <= 0) return -1;
    if (autoFocusIndex >= 0 && autoFocusIndex < count) return autoFocusIndex;
    return 0;
}
