import { describe, it, expect } from 'vitest';
import { buildLabelMap, escapeRenpyText, parseDialogueLine, buildAliasMap, buildRenpyScript } from './renpyExport';
import type { VNScene } from './visualNovel';

const titled = (id: string, title: string) => ({ id, title });

describe('buildLabelMap', () => {
    it('turns a title into a lowercase underscored label', () => {
        const map = buildLabelMap([titled('1', 'The Meadow')]);
        expect(map.get('1')).toBe('the_meadow');
    });

    it('never emits a hyphen — they are a syntax error in a Ren\'Py label', () => {
        const map = buildLabelMap([titled('1', 'Act One — The Long Goodbye')]);
        expect(map.get('1')).not.toContain('-');
        expect(map.get('1')).toBe('act_one_the_long_goodbye');
    });

    it('collapses punctuation runs and trims the edges', () => {
        expect(buildLabelMap([titled('1', '  ...Well?!  ')]).get('1')).toBe('well');
    });

    it('prefixes titles that start with a digit', () => {
        expect(buildLabelMap([titled('1', '3am')]).get('1')).toBe('s_3am');
    });

    it('prefixes Ren\'Py keywords so they cannot collide with the language', () => {
        expect(buildLabelMap([titled('1', 'Start')]).get('1')).toBe('start_scene');
        expect(buildLabelMap([titled('2', 'Return')]).get('2')).toBe('return_scene');
    });

    it('dedupes identical titles with a numeric suffix', () => {
        const map = buildLabelMap([
            titled('1', 'The Meadow'),
            titled('2', 'The Meadow'),
            titled('3', 'The Meadow'),
        ]);
        expect([map.get('1'), map.get('2'), map.get('3')])
            .toEqual(['the_meadow', 'the_meadow_2', 'the_meadow_3']);
    });

    it('falls back to a usable label when a title has no usable characters', () => {
        expect(buildLabelMap([titled('1', '???')]).get('1')).toBe('untitled');
    });
});

describe('escapeRenpyText', () => {
    it('escapes double quotes, which would otherwise end the string', () => {
        expect(escapeRenpyText('She said "no"')).toBe('She said \\"no\\"');
    });

    it('doubles square brackets, which are variable interpolation', () => {
        expect(escapeRenpyText('[again]')).toBe('[[again]');
    });

    it('doubles curly braces, which are text tags', () => {
        expect(escapeRenpyText('{b}bold{/b}')).toBe('{{b}bold{{/b}');
    });

    it('escapes backslashes first so the other rules are not double-escaped', () => {
        expect(escapeRenpyText('back\\slash')).toBe('back\\\\slash');
        expect(escapeRenpyText('a\\"b')).toBe('a\\\\\\"b');
    });

    it('handles a line that trips all three rules at once', () => {
        expect(escapeRenpyText('She said "no" [again] {sigh}'))
            .toBe('She said \\"no\\" [[again] {{sigh}');
    });

    it('leaves ordinary prose untouched', () => {
        expect(escapeRenpyText('The meadow is gold this time of year.'))
            .toBe('The meadow is gold this time of year.');
    });
});

describe('parseDialogueLine', () => {
    const cast = new Set(['sylvie', 'me']);

    it('splits a known speaker from their line', () => {
        expect(parseDialogueLine('Sylvie: Hey... umm...', cast))
            .toEqual({ speaker: 'Sylvie', text: 'Hey... umm...' });
    });

    it('matches the speaker regardless of case', () => {
        expect(parseDialogueLine('SYLVIE: Hi', cast).speaker).toBe('SYLVIE');
    });

    it('treats a colon line as narration when the name is not in the cast', () => {
        expect(parseDialogueLine('The sign read: Keep Out', cast))
            .toEqual({ text: 'The sign read: Keep Out' });
    });

    it('treats a plain line as narration', () => {
        expect(parseDialogueLine('The meadow is gold.', cast))
            .toEqual({ text: 'The meadow is gold.' });
    });

    it('trims surrounding whitespace', () => {
        expect(parseDialogueLine('   Me:   Yeah?   ', cast))
            .toEqual({ speaker: 'Me', text: 'Yeah?' });
    });
});

describe('buildAliasMap', () => {
    it('uses the first letter of each name', () => {
        const map = buildAliasMap(['Sylvie', 'Me']);
        expect(map.get('Sylvie')).toBe('s');
        expect(map.get('Me')).toBe('m');
    });

    it('grows the alias when two names share a first letter', () => {
        const map = buildAliasMap(['Sylvie', 'Sam']);
        expect(map.get('Sylvie')).toBe('s');
        expect(map.get('Sam')).toBe('sa');
    });

    it('falls back to a numbered alias when the letters run out', () => {
        const map = buildAliasMap(['S', 'S ', ' S']);
        expect(new Set(map.values()).size).toBe(3);
    });

    it('ignores punctuation and spacing when deriving letters', () => {
        expect(buildAliasMap(["D'Arcy"]).get("D'Arcy")).toBe('d');
    });
});

describe('buildRenpyScript', () => {
    const twoBranch: VNScene[] = [
        {
            id: 'meadow', title: 'The Meadow', order: 0,
            content: 'The meadow is gold this time of year.\n\nSylvie: Hey... umm...\nMe: Yeah?',
            choices: [
                { id: 'c1', text: 'Say yes.', targetSceneId: 'partners', setsFlag: 'agreed' },
                { id: 'c2', text: 'Ask what that means.', targetSceneId: 'explain' },
            ],
        },
        { id: 'partners', title: 'Partners', order: 1, content: 'Sylvie: Partners, then.', choices: [] },
        { id: 'explain', title: 'Explain', order: 2, content: 'Me: It is a kind of game.', choices: [
            { id: 'c3', text: 'Say yes now.', targetSceneId: 'partners', requiresFlag: 'agreed' },
        ] },
    ];

    it('emits a complete, paste-able script', () => {
        expect(buildRenpyScript(twoBranch, ['Sylvie', 'Me'], 'Lighthouse Summer')).toBe(
`# Generated by LoreCanvas — Lighthouse Summer
# Drop this file into your Ren'Py project's game/ folder.

define s = Character("Sylvie")
define m = Character("Me")

default agreed = False

label start:
    jump the_meadow

label the_meadow:
    "The meadow is gold this time of year."

    s "Hey... umm..."
    m "Yeah?"

    menu:
        "Say yes.":
            $ agreed = True
            jump partners

        "Ask what that means.":
            jump explain

label partners:
    s "Partners, then."
    return

label explain:
    m "It is a kind of game."

    menu:
        "Say yes now." if agreed:
            jump partners
`);
    });

    it('falls through to the next scene when a scene has no choices', () => {
        const script = buildRenpyScript([
            { id: 'a', title: 'A', order: 0, content: 'One.' },
            { id: 'b', title: 'B', order: 1, content: 'Two.' },
        ], [], 'X');
        expect(script).toContain('label a:\n    "One."\n    jump b');
    });

    it('ends the last choiceless scene with return', () => {
        const script = buildRenpyScript(
            [{ id: 'a', title: 'A', order: 0, content: 'Only.' }], [], 'X');
        expect(script.trimEnd().endsWith('return')).toBe(true);
    });

    it('sorts scenes by order, not array position', () => {
        const script = buildRenpyScript([
            { id: 'b', title: 'B', order: 5, content: 'Second.' },
            { id: 'a', title: 'A', order: 1, content: 'First.' },
        ], [], 'X');
        expect(script).toContain('label start:\n    jump a');
    });

    it('leaves a comment and returns when a choice targets a missing scene', () => {
        const script = buildRenpyScript([
            { id: 'a', title: 'A', order: 0, content: 'Hi.', choices: [
                { id: 'c1', text: 'Go', targetSceneId: 'deleted' },
            ] },
        ], [], 'X');
        expect(script).toContain('# LoreCanvas: this choice targeted a scene that no longer exists');
        expect(script).toContain('            return');
    });

    it('escapes the project name in the header', () => {
        expect(buildRenpyScript([], [], 'A "Quoted" Name'))
            .toContain('# Generated by LoreCanvas — A "Quoted" Name');
    });

    it('produces no output body for a project with no scenes', () => {
        expect(buildRenpyScript([], [], 'Empty')).not.toContain('label start:');
    });
});
