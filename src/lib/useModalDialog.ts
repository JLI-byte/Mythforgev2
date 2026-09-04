"use client";

import { useCallback, useEffect, useRef } from 'react';
import { FOCUSABLE_SELECTOR, initialTrapIndex, nextTrapIndex } from './focusTrap';

/**
 * Everything a modal dialog owes the keyboard, in one hook: focus moves in on
 * open, Tab cycles inside instead of walking the page behind, Escape closes,
 * and focus returns to whatever opened it.
 *
 * Nesting is why the Escape listener is stack-aware rather than per-component.
 * MethodLibrary and its ConfirmDialog each added their own window listener, so
 * a single Escape over the confirm closed the library underneath it too.
 *
 * Give the dialog element `tabIndex={-1}` so there is somewhere to put focus
 * when it contains no focusable control, and `data-autofocus` on any control
 * that should be the first stop.
 *
 * Sits in src/lib beside useWritingSession.ts, which set that precedent. It
 * imports React, so it is deliberately NOT a leaf module — the pure part it
 * calls is focusTrap.ts.
 */

/** Open dialogs, innermost last. Only the last one answers Escape and Tab. */
const openDialogs: symbol[] = [];

export function useModalDialog<T extends HTMLElement>(onClose: () => void) {
    const ref = useRef<T>(null);

    // Held in a ref so a dialog that rebuilds its onClose every render does not
    // tear down and re-run the whole effect, stealing focus back on each keystroke.
    // Updated in an effect, not during render: writing a ref while rendering is
    // a React rule violation and misbehaves under concurrent rendering. The
    // keydown handler only ever reads it at event time, long after this flushes.
    const onCloseRef = useRef(onClose);
    useEffect(() => { onCloseRef.current = onClose; });

    const focusables = useCallback((): HTMLElement[] => {
        const root = ref.current;
        if (!root) return [];
        return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
            // getClientRects() rather than offsetParent: dialogs are usually
            // position:fixed, for which offsetParent is null even when visible.
            .filter(el => el.getClientRects().length > 0);
    }, []);

    useEffect(() => {
        const token = Symbol('dialog');
        openDialogs.push(token);

        const root = ref.current;
        const restoreTo = document.activeElement as HTMLElement | null;

        const items = focusables();
        const marked = items.findIndex(el => el.hasAttribute('data-autofocus'));
        const index = initialTrapIndex(items.length, marked);
        if (index >= 0) items[index].focus();
        else root?.focus();

        const onKeyDown = (e: KeyboardEvent) => {
            if (openDialogs[openDialogs.length - 1] !== token) return;

            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onCloseRef.current();
                return;
            }
            if (e.key !== 'Tab') return;

            const current = focusables();
            if (current.length === 0) return;
            e.preventDefault();
            const at = current.indexOf(document.activeElement as HTMLElement);
            const to = nextTrapIndex(current.length, at, e.shiftKey);
            if (to >= 0) current[to].focus();
        };

        // Capture phase: the dialog gets Escape before any editor keymap does.
        document.addEventListener('keydown', onKeyDown, true);

        return () => {
            document.removeEventListener('keydown', onKeyDown, true);
            const at = openDialogs.indexOf(token);
            if (at >= 0) openDialogs.splice(at, 1);
            restoreTo?.focus?.();
        };
    }, [focusables]);

    return ref;
}
