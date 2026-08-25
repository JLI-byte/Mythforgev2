import { describe, it, expect } from 'vitest';
import { tierForZoom } from './vnTimeline';

describe('tierForZoom', () => {
    it('shows the whole story when zoomed right out', () => {
        expect(tierForZoom(0.2)).toBe('story');
        expect(tierForZoom(0.34)).toBe('story');
    });

    it('shows seasons in the next band', () => {
        expect(tierForZoom(0.35)).toBe('season');
        expect(tierForZoom(0.64)).toBe('season');
    });

    it('shows episode detail in the next band', () => {
        expect(tierForZoom(0.65)).toBe('episode');
        expect(tierForZoom(1.09)).toBe('episode');
    });

    it('shows full decision editors when zoomed in', () => {
        expect(tierForZoom(1.1)).toBe('decision');
        expect(tierForZoom(2)).toBe('decision');
    });

    it('clamps below and above the canvas range rather than returning undefined', () => {
        expect(tierForZoom(0)).toBe('story');
        expect(tierForZoom(99)).toBe('decision');
    });
});
