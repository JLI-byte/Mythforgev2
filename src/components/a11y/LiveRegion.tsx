"use client";

import { useEffect, useState } from 'react';
import {
    ANNOUNCEMENT_TTL_MS,
    EMPTY_ANNOUNCER,
    announcementText,
    expireAnnouncements,
    pushAnnouncement,
    subscribeToAnnouncements,
    type AnnouncerState,
} from '@/lib/liveAnnouncer';

/**
 * The app's two live regions. Mounted once in the root layout so anything,
 * anywhere, can call announce() without a prop being threaded down to it.
 *
 * Two regions rather than one: polite waits for a pause in speech, which is
 * right for a save; assertive interrupts, which is right for an export that
 * failed and wrong for everything else.
 */
export default function LiveRegion() {
    const [state, setState] = useState<AnnouncerState>(EMPTY_ANNOUNCER);

    useEffect(() => subscribeToAnnouncements((message, politeness) => {
        setState(prev => pushAnnouncement(prev, message, politeness, Date.now()));
    }), []);

    // Sweep expired entries so the region does not hold stale text that a
    // reader would re-speak if the user navigated back to it.
    useEffect(() => {
        if (state.queue.length === 0) return;
        const timer = setInterval(
            () => setState(prev => expireAnnouncements(prev, Date.now())),
            ANNOUNCEMENT_TTL_MS,
        );
        return () => clearInterval(timer);
    }, [state.queue.length]);

    return (
        <>
            <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                {announcementText(state, 'polite')}
            </div>
            <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
                {announcementText(state, 'assertive')}
            </div>
        </>
    );
}
