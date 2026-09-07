import { describe, it, expect, vi } from 'vitest';
import {
    ANNOUNCEMENT_COALESCE_MS,
    ANNOUNCEMENT_TTL_MS,
    EMPTY_ANNOUNCER,
    announce,
    announcementText,
    expireAnnouncements,
    pushAnnouncement,
    subscribeToAnnouncements,
} from './liveAnnouncer';

describe('pushAnnouncement', () => {
    it('ignores a blank or whitespace-only message', () => {
        expect(pushAnnouncement(EMPTY_ANNOUNCER, '', 'polite', 0)).toBe(EMPTY_ANNOUNCER);
        expect(pushAnnouncement(EMPTY_ANNOUNCER, '   ', 'polite', 0)).toBe(EMPTY_ANNOUNCER);
    });

    it('does not mutate the state it is given', () => {
        const before = pushAnnouncement(EMPTY_ANNOUNCER, 'Saved', 'polite', 0);
        const after = pushAnnouncement(before, 'Exported', 'polite', 100);
        expect(before.queue).toHaveLength(1);
        expect(after.queue).toHaveLength(2);
        expect(after).not.toBe(before);
    });

    it('drops a repeat of the same message inside the coalesce window', () => {
        const first = pushAnnouncement(EMPTY_ANNOUNCER, 'Saved', 'polite', 0);
        const second = pushAnnouncement(first, 'Saved', 'polite', ANNOUNCEMENT_COALESCE_MS - 1);
        expect(second.queue).toHaveLength(1);
        expect(second.nextId).toBe(first.nextId);
    });

    it('re-announces the same message once the coalesce window has passed', () => {
        const first = pushAnnouncement(EMPTY_ANNOUNCER, 'Saved', 'polite', 0);
        const second = pushAnnouncement(first, 'Saved', 'polite', ANNOUNCEMENT_COALESCE_MS + 1);
        expect(second.queue).toHaveLength(2);
        expect(announcementText(second, 'polite')).not.toBe(announcementText(first, 'polite'));
    });

    it('trims the message before storing it', () => {
        const state = pushAnnouncement(EMPTY_ANNOUNCER, '  Saved  ', 'polite', 0);
        expect(state.queue[0].message).toBe('Saved');
    });
});

describe('announcementText', () => {
    it('is empty for a channel with nothing in it', () => {
        expect(announcementText(EMPTY_ANNOUNCER, 'polite')).toBe('');
        expect(announcementText(EMPTY_ANNOUNCER, 'assertive')).toBe('');
    });

    it('reads the newest message on that channel', () => {
        let state = pushAnnouncement(EMPTY_ANNOUNCER, 'Saved', 'polite', 0);
        state = pushAnnouncement(state, 'Exported', 'polite', 1000);
        expect(announcementText(state, 'polite')).toContain('Exported');
        expect(announcementText(state, 'polite')).not.toContain('Saved');
    });

    it('keeps polite and assertive apart', () => {
        let state = pushAnnouncement(EMPTY_ANNOUNCER, 'Saved', 'polite', 0);
        state = pushAnnouncement(state, 'Export failed', 'assertive', 10);
        expect(announcementText(state, 'polite')).toContain('Saved');
        expect(announcementText(state, 'assertive')).toContain('Export failed');
    });
});

describe('expireAnnouncements', () => {
    it('drops entries older than the TTL', () => {
        const state = pushAnnouncement(EMPTY_ANNOUNCER, 'Saved', 'polite', 0);
        expect(expireAnnouncements(state, ANNOUNCEMENT_TTL_MS + 1).queue).toHaveLength(0);
    });

    it('returns the same object when nothing has expired', () => {
        const state = pushAnnouncement(EMPTY_ANNOUNCER, 'Saved', 'polite', 0);
        expect(expireAnnouncements(state, 10)).toBe(state);
    });
});

describe('the announcement bus', () => {
    it('delivers to a subscriber and stops on unsubscribe', () => {
        const heard = vi.fn();
        const stop = subscribeToAnnouncements(heard);

        announce('Saved');
        expect(heard).toHaveBeenCalledWith('Saved', 'polite');

        announce('Export failed', 'assertive');
        expect(heard).toHaveBeenCalledWith('Export failed', 'assertive');

        stop();
        announce('Ignored');
        expect(heard).toHaveBeenCalledTimes(2);
    });

    it('does not throw when nothing is listening', () => {
        expect(() => announce('Nobody home')).not.toThrow();
    });
});
