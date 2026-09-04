import { describe, it, expect } from 'vitest';
import { pickZone } from './WritingZoneRenderer';
import { StoryWritingZone } from './zones/StoryWritingZone';

describe('pickZone', () => {
    it('sends the novel mode to the story zone', () => {
        expect(pickZone('novel')).toBe(StoryWritingZone);
    });

    it('falls back to the story zone for real-world and unset modes', () => {
        expect(pickZone('real-world')).toBe(StoryWritingZone);
        expect(pickZone(undefined)).toBe(StoryWritingZone);
        expect(pickZone(null)).toBe(StoryWritingZone);
        expect(pickZone('nonsense')).toBe(StoryWritingZone);
    });

    it('opens legacy projects of withdrawn types in the story zone, with their content intact', () => {
        expect(pickZone('screenplay')).toBe(StoryWritingZone);
        expect(pickZone('markdown')).toBe(StoryWritingZone);
        expect(pickZone('poetry')).toBe(StoryWritingZone);
        expect(pickZone('visual-novel')).toBe(StoryWritingZone);
    });
});
