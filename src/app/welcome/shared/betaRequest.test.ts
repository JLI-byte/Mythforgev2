import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitBetaRequest } from './betaRequest';

const insertMock = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
    createClient: () => ({
        from: () => ({ insert: insertMock }),
    }),
}));

describe('submitBetaRequest', () => {
    beforeEach(() => insertMock.mockReset());

    it('returns done and normalizes fields on success', async () => {
        insertMock.mockResolvedValue({ error: null });
        const result = await submitBetaRequest({
            name: '  Jimi ',
            email: ' ME@Example.COM ',
            reason: '',
        });
        expect(result).toBe('done');
        expect(insertMock).toHaveBeenCalledWith({
            email: 'me@example.com',
            name: 'Jimi',
            reason: null,
        });
    });

    it('returns duplicate on unique violation 23505', async () => {
        insertMock.mockResolvedValue({ error: { code: '23505' } });
        const result = await submitBetaRequest({ name: '', email: 'a@b.c', reason: '' });
        expect(result).toBe('duplicate');
    });

    it('returns error on any other failure', async () => {
        insertMock.mockResolvedValue({ error: { code: 'PGRST301' } });
        const result = await submitBetaRequest({ name: '', email: 'a@b.c', reason: '' });
        expect(result).toBe('error');
    });
});
