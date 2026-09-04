import { describe, it, expect } from 'vitest';
import { ALLOW_SIGNUP_FROM_LOGIN, isNotInvitedError } from './authPolicy';

describe('the invite policy', () => {
    it('never creates accounts from a login surface', () => {
        expect(ALLOW_SIGNUP_FROM_LOGIN).toBe(false);
    });
});

describe('isNotInvitedError', () => {
    it('recognises the ways GoTrue says "not invited"', () => {
        expect(isNotInvitedError('Signups not allowed for otp')).toBe(true);
        expect(isNotInvitedError('User not found')).toBe(true);
        expect(isNotInvitedError('Email signup is not allowed')).toBe(true);
    });

    it('does not swallow an unrelated failure', () => {
        expect(isNotInvitedError('Email rate limit exceeded')).toBe(false);
        expect(isNotInvitedError('')).toBe(false);
    });
});
