import { describe, it, expect } from 'vitest';
import { fileToDataUrl } from './imageUpload';

describe('fileToDataUrl', () => {
    it('resolves a data URL for a file', async () => {
        const file = new File(['hello'], 'a.txt', { type: 'text/plain' });
        const url = await fileToDataUrl(file);
        expect(url.startsWith('data:')).toBe(true);
    });
});
