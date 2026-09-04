import { describe, it, expect } from 'vitest';
import { hasProse, projectProgress, progressLine } from './structuralProgress';

function scene(id: string, documentId: string, content: string, wordCount = 0) {
    return { id, projectId: 'p1', documentId, content, wordCount };
}

const documents = [
    { id: 'd1', projectId: 'p1' },
    { id: 'd2', projectId: 'p1' },
    { id: 'd3', projectId: 'p1' },
    { id: 'dX', projectId: 'p2' },
];

describe('hasProse', () => {
    it('is false for empty, whitespace and bare markup', () => {
        expect(hasProse('')).toBe(false);
        expect(hasProse('   ')).toBe(false);
        expect(hasProse('<p></p>')).toBe(false);
        expect(hasProse('<p><br></p>')).toBe(false);
        expect(hasProse('<p>&nbsp;</p>')).toBe(false);
    });

    it('is true once there are actual words', () => {
        expect(hasProse('<p>The tide came in.</p>')).toBe(true);
    });
});

describe('projectProgress', () => {
    it('reports zeroes for a project with nothing in it', () => {
        const p = projectProgress({ projectId: 'p1', documents: [], scenes: [] });
        expect(p).toEqual({
            chapters: 0, chaptersStarted: 0,
            scenes: 0, scenesStarted: 0,
            words: 0, fraction: 0,
        });
    });

    it('counts only this project\'s chapters and scenes', () => {
        const p = projectProgress({
            projectId: 'p1',
            documents,
            scenes: [
                scene('s1', 'd1', '<p>Words.</p>', 120),
                { ...scene('sX', 'dX', '<p>Elsewhere.</p>', 900), projectId: 'p2' },
            ],
        });
        expect(p.chapters).toBe(3);
        expect(p.scenes).toBe(1);
        expect(p.words).toBe(120);
    });

    it('separates scenes that exist from scenes that have prose', () => {
        const p = projectProgress({
            projectId: 'p1',
            documents,
            scenes: [
                scene('s1', 'd1', '<p>Written.</p>', 100),
                scene('s2', 'd1', '<p></p>'),
                scene('s3', 'd2', '   '),
            ],
        });
        expect(p.scenes).toBe(3);
        expect(p.scenesStarted).toBe(1);
    });

    it('counts a chapter as started when any one of its scenes has prose', () => {
        const p = projectProgress({
            projectId: 'p1',
            documents,
            scenes: [
                scene('s1', 'd1', '<p>a</p>', 1),
                scene('s2', 'd1', ''),
                scene('s3', 'd2', '<p>b</p>', 1),
                scene('s4', 'd3', ''),
            ],
        });
        expect(p.chaptersStarted).toBe(2);
    });

    it('reports the fraction of scenes drafted', () => {
        const p = projectProgress({
            projectId: 'p1',
            documents,
            scenes: [
                scene('s1', 'd1', '<p>a</p>', 1),
                scene('s2', 'd1', '<p>b</p>', 1),
                scene('s3', 'd2', ''),
                scene('s4', 'd2', ''),
            ],
        });
        expect(p.fraction).toBe(0.5);
    });

    it('totals words from the counts the editor maintains', () => {
        const p = projectProgress({
            projectId: 'p1',
            documents,
            scenes: [scene('s1', 'd1', '<p>a</p>', 800), scene('s2', 'd2', '<p>b</p>', 450)],
        });
        expect(p.words).toBe(1250);
    });
});

describe('progressLine', () => {
    it('says so when there is nothing to measure', () => {
        expect(progressLine({
            chapters: 0, chaptersStarted: 0, scenes: 0, scenesStarted: 0, words: 0, fraction: 0,
        })).toBe('No scenes yet');
    });

    it('reads in scenes and chapters', () => {
        expect(progressLine({
            chapters: 7, chaptersStarted: 3, scenes: 21, scenesStarted: 8, words: 9000, fraction: 8 / 21,
        })).toBe('8 of 21 scenes drafted · 3 of 7 chapters started');
    });

    it('stays singular where singular is right', () => {
        expect(progressLine({
            chapters: 1, chaptersStarted: 1, scenes: 1, scenesStarted: 1, words: 300, fraction: 1,
        })).toBe('1 of 1 scene drafted · 1 of 1 chapter started');
    });
});
