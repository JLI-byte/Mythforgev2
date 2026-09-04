/**
 * Live-region announcements — the queue behind the app's two aria-live nodes.
 * LEAF MODULE (no store, no React).
 *
 * Two problems a bare <div aria-live> does not solve:
 *
 * 1. A screen reader says nothing when a live region's text has not changed.
 *    Saving twice in a row would therefore announce once. Each entry carries an
 *    id, and the rendered text carries an invisible marker derived from it, so
 *    a repeat really is a different string.
 * 2. Two announcements in the same tick overwrite each other. They queue
 *    instead, and the newest on each channel is what the region shows.
 *
 * The bus at the bottom is how a component anywhere announces without a prop
 * being threaded to it. It holds subscribers, not application state.
 */

export type Politeness = 'polite' | 'assertive';

export interface Announcement {
    id: number;
    message: string;
    politeness: Politeness;
    at: number;
}

export interface AnnouncerState {
    queue: readonly Announcement[];
    nextId: number;
}

export const EMPTY_ANNOUNCER: AnnouncerState = { queue: [], nextId: 1 };

/** How long an announcement stays in the region before it is swept out. */
export const ANNOUNCEMENT_TTL_MS = 5000;

/**
 * A repeat of the same message inside this window is the same event arriving
 * twice — a debounced save firing alongside a manual one — not two events.
 */
export const ANNOUNCEMENT_COALESCE_MS = 400;

export function pushAnnouncement(
    state: AnnouncerState,
    message: string,
    politeness: Politeness,
    now: number,
): AnnouncerState {
    const text = message.trim();
    if (!text) return state;

    const live = state.queue.filter(a => now - a.at < ANNOUNCEMENT_TTL_MS);
    const isRepeat = live.some(a =>
        a.message === text
        && a.politeness === politeness
        && now - a.at < ANNOUNCEMENT_COALESCE_MS);

    if (isRepeat) {
        return live.length === state.queue.length ? state : { ...state, queue: live };
    }

    return {
        queue: [...live, { id: state.nextId, message: text, politeness, at: now }],
        nextId: state.nextId + 1,
    };
}

export function expireAnnouncements(state: AnnouncerState, now: number): AnnouncerState {
    const live = state.queue.filter(a => now - a.at < ANNOUNCEMENT_TTL_MS);
    return live.length === state.queue.length ? state : { ...state, queue: live };
}

/**
 * Text for one region: the newest live message on that channel, plus an
 * invisible marker. The marker alternates with the entry id, so announcing
 * "Saved" twice produces two different strings and the reader speaks both.
 */
export function announcementText(state: AnnouncerState, politeness: Politeness): string {
    const channel = state.queue.filter(a => a.politeness === politeness);
    const latest = channel[channel.length - 1];
    if (!latest) return '';
    return latest.message + ' '.repeat(latest.id % 2);
}

// ─── The bus ────────────────────────────────────────────────────────────────

type AnnounceListener = (message: string, politeness: Politeness) => void;

const listeners = new Set<AnnounceListener>();

/** Returns the unsubscribe function, so a useEffect can return it directly. */
export function subscribeToAnnouncements(listener: AnnounceListener): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

/** Say something. Safe to call before anything is listening. */
export function announce(message: string, politeness: Politeness = 'polite'): void {
    // Copied first: a listener that unsubscribes while being called would
    // otherwise mutate the set mid-iteration.
    for (const listener of [...listeners]) listener(message, politeness);
}
