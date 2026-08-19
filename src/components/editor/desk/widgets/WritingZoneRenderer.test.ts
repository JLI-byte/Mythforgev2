import { describe, it, expect } from 'vitest';
import { pickZone } from './WritingZoneRenderer';
import { StoryWritingZone } from './zones/StoryWritingZone';
import { ScreenplayWritingZone } from './zones/ScreenplayWritingZone';
import { ReportWritingZone } from './zones/ReportWritingZone';
import { LyricsWritingZone } from './zones/LyricsWritingZone';
import { WORK_TYPES } from '@/lib/workTypes';

describe('pickZone', () => {
    it('sends each writing mode to the zone built for it', () => {
        expect(pickZone('novel')).toBe(StoryWritingZone);
        expect(pickZone('screenplay')).toBe(ScreenplayWritingZone);
        expect(pickZone('markdown')).toBe(ReportWritingZone);
        expect(pickZone('poetry')).toBe(LyricsWritingZone);
    });

    it('never sends two modes to the same zone', () => {
        const picked = WORK_TYPES.map(t => pickZone(t.writingMode));
        expect(new Set(picked).size).toBe(WORK_TYPES.length);
    });

    it('falls back to the story zone for real-world and unset modes', () => {
        expect(pickZone('real-world')).toBe(StoryWritingZone);
        expect(pickZone(undefined)).toBe(StoryWritingZone);
        expect(pickZone(null)).toBe(StoryWritingZone);
        expect(pickZone('nonsense')).toBe(StoryWritingZone);
    });
});
