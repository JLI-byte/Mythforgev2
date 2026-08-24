/**
 * Ren'Py export — turns a visual novel project into a .rpy file that drops
 * into an existing Ren'Py game's game/ folder. LEAF MODULE, and deliberately
 * pure: data in, string out, no store and no DOM.
 *
 * Nothing here can be verified by running it — the machine has no Ren'Py SDK.
 * The tests are the only safety net, so every rule below exists because
 * breaking it produces a file that fails to compile.
 */

import type { VNScene } from './visualNovel';
import {
    formatDefault, formatEffect, formatCondition, type VNFlag,
} from './vnFlags';

/**
 * Words Ren'Py owns. A label with one of these names shadows the language, so
 * they get a suffix. Not exhaustive — it covers the statement keywords a scene
 * title plausibly collides with.
 */
const RENPY_KEYWORDS = new Set([
    'start', 'menu', 'label', 'jump', 'call', 'return', 'init', 'python',
    'define', 'default', 'scene', 'show', 'hide', 'image', 'transform',
    'pause', 'while', 'if', 'elif', 'else', 'pass', 'screen', 'style',
]);

/**
 * Scene id → Ren'Py label, derived rather than stored so renaming a scene
 * renames its label. Order matters: dedupe suffixes follow the input order.
 */
/**
 * A raw string as a Python-style identifier: letters, digits and underscores,
 * never leading with a digit, never a word Ren'Py owns.
 *
 * Shared by labels and flag names because both are emitted bare into the
 * script. Only the fallback and the keyword-collision suffix differ.
 *
 * Non-Latin titles reduce to the fallback, since the regex keeps only ASCII.
 * Transliteration is out of scope; the dedupe suffix keeps the output valid,
 * just less readable if the writer hand-edits the exported file.
 */
function toIdentifier(raw: string, fallback: string, keywordSuffix: string): string {
    let base = raw
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

    if (!base) base = fallback;
    if (/^[0-9]/.test(base)) base = `s_${base}`;
    if (RENPY_KEYWORDS.has(base)) base = `${base}${keywordSuffix}`;

    return base;
}

/**
 * A flag name as Ren'Py will see it.
 *
 * Flags are typed into a free-text field, so "met bob" reaches here as-is —
 * and `default met bob = False` is a syntax error. The writer has no way to
 * discover that without a Ren'Py install, so it is normalised here instead.
 */
export function toFlagName(raw: string): string {
    return toIdentifier(raw, 'flag', '_flag');
}

export function buildLabelMap(scenes: { id: string; title: string }[]): Map<string, string> {
    const taken = new Set<string>();
    const map = new Map<string, string>();

    for (const scene of scenes) {
        // 'untitled' rather than 'scene': 'scene' is itself a Ren'Py keyword,
        // so using it as the fallback would trip the keyword guard.
        const base = toIdentifier(scene.title, 'untitled', '_scene');

        let label = base;
        let n = 2;
        while (taken.has(label)) {
            label = `${base}_${n}`;
            n += 1;
        }

        taken.add(label);
        map.set(scene.id, label);
    }

    return map;
}

/**
 * Makes a line safe inside a Ren'Py double-quoted string.
 *
 * Backslash goes first on purpose: the later rules introduce backslashes, and
 * escaping them again would corrupt the output. Closing brackets need no
 * escape — only the opening ones are significant.
 */
export function escapeRenpyText(text: string): string {
    return text
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\[/g, '[[')
        .replace(/\{/g, '{{');
}

export interface ParsedLine {
    /** The name as written, when it matched a cast member. */
    speaker?: string;
    text: string;
}

/**
 * Splits `Name: line` into speaker and text, but only when the name is
 * actually in the cast — otherwise "The sign read: Keep Out" would invent a
 * character called "The sign read". Anything unmatched is narration.
 *
 * `cast` holds lowercased names.
 */
export function parseDialogueLine(line: string, cast: Set<string>): ParsedLine {
    const match = line.match(/^\s*([^:]{1,40}):\s+(.*)$/);
    if (match) {
        const name = match[1].trim();
        if (cast.has(name.toLowerCase())) {
            return { speaker: name, text: match[2].trim() };
        }
    }
    return { text: line.trim() };
}

/**
 * Name → short Ren'Py alias, so dialogue reads `s "Hi"` rather than repeating
 * the full name. Grows the alias letter by letter on collision, then falls
 * back to numbering when a name has no letters left to give.
 */
export function buildAliasMap(names: string[]): Map<string, string> {
    const taken = new Set<string>();
    const map = new Map<string, string>();

    for (const name of names) {
        const letters = name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'c';

        let alias = letters.slice(0, 1);
        let length = 1;
        while (taken.has(alias) && length < letters.length) {
            length += 1;
            alias = letters.slice(0, length);
        }

        let n = 2;
        while (taken.has(alias)) {
            alias = `${letters.slice(0, 1)}${n}`;
            n += 1;
        }

        taken.add(alias);
        map.set(name, alias);
    }

    return map;
}

const INDENT = '    ';

/**
 * Every name that needs a `define`: the shelf's cast, plus any name used as a
 * speaker in scene text. Typed-but-unknown names are included on purpose, so a
 * speaker is never silently demoted to narration.
 */
function collectSpeakers(scenes: VNScene[], castNames: string[]): string[] {
    const names: string[] = [...castNames];
    const seen = new Set(castNames.map(n => n.toLowerCase()));

    for (const scene of scenes) {
        for (const line of scene.content.split('\n')) {
            const match = line.match(/^\s*([^:]{1,40}):\s+.*$/);
            if (!match) continue;
            const name = match[1].trim();
            if (!name || seen.has(name.toLowerCase())) continue;
            seen.add(name.toLowerCase());
            names.push(name);
        }
    }

    return names;
}

/**
 * The whole .rpy file. Pure — this is what the tests exercise, and the only
 * thing standing between the writer and a file that will not compile.
 */
export function buildRenpyScript(
    scenes: VNScene[],
    castNames: string[],
    projectName: string,
    flags: VNFlag[] = [],
): string {
    const ordered = [...scenes].sort((a, b) => a.order - b.order);
    const labels = buildLabelMap(ordered);
    const speakers = collectSpeakers(ordered, castNames);
    const aliases = buildAliasMap(speakers);
    const cast = new Set(speakers.map(n => n.toLowerCase()));
    // Keyed by lowercase because parseDialogueLine returns the casing used on
    // that line: a writer typing "Sylvie:" once and "SYLVIE:" later must reach
    // the same alias, or the second line emits `undefined` as its speaker.
    const aliasByName = new Map(
        [...aliases].map(([name, alias]) => [name.toLowerCase(), alias]),
    );
    // Flag id → the identifier it is emitted as. Built once so a `default`
    // line and every `$` and `if` that touches the flag always agree.
    const flagNames = new Map(flags.map(f => [f.id, toFlagName(f.name)]));

    const out: string[] = [
        `# Generated by LoreCanvas — ${projectName}`,
        `# Drop this file into your Ren'Py project's game/ folder.`,
        '',
    ];

    for (const name of speakers) {
        out.push(`define ${aliases.get(name)} = Character("${escapeRenpyText(name)}")`);
    }
    if (speakers.length) out.push('');

    for (const flag of [...flags].sort((a, b) => a.name.localeCompare(b.name))) {
        out.push(formatDefault(flag, flagNames.get(flag.id)!));
    }
    if (flags.length) out.push('');

    if (!ordered.length) return `${out.join('\n').trimEnd()}\n`;

    out.push('label start:', `${INDENT}jump ${labels.get(ordered[0].id)}`, '');

    ordered.forEach((scene, index) => {
        out.push(`label ${labels.get(scene.id)}:`);

        for (const raw of scene.content.split('\n')) {
            if (!raw.trim()) {
                out.push('');
                continue;
            }
            const parsed = parseDialogueLine(raw, cast);
            const text = `"${escapeRenpyText(parsed.text)}"`;
            out.push(parsed.speaker
                ? `${INDENT}${aliasByName.get(parsed.speaker.toLowerCase())} ${text}`
                : `${INDENT}${text}`);
        }

        const choices = scene.choices ?? [];

        if (choices.length) {
            out.push('', `${INDENT}menu:`);
            for (const choice of choices) {
                const identifier = choice.condition
                    ? flagNames.get(choice.condition.flagId)
                    : undefined;
                const guard = choice.condition && identifier
                    ? ` if ${formatCondition(choice.condition, identifier)}`
                    : '';
                out.push(`${INDENT.repeat(2)}"${escapeRenpyText(choice.text)}"${guard}:`);

                for (const effect of choice.effects ?? []) {
                    const name = flagNames.get(effect.flagId);
                    // A flag deleted from the registry leaves dangling effects.
                    // Skipping beats emitting `$ undefined = True`.
                    if (!name) continue;
                    out.push(`${INDENT.repeat(3)}${formatEffect(effect, name)}`);
                }
                const target = labels.get(choice.targetSceneId);
                if (target) {
                    out.push(`${INDENT.repeat(3)}jump ${target}`);
                } else {
                    out.push(`${INDENT.repeat(3)}# LoreCanvas: this choice targeted a scene that no longer exists`);
                    out.push(`${INDENT.repeat(3)}return`);
                }
                out.push('');
            }
        } else {
            // No choices: fall through to the next scene by order, or end the
            // game if this is the last one. Order is the story's spine, so a
            // scene that ends a branch belongs last — validateVisualNovel
            // warns about the dead ends this leaves.
            const next = ordered[index + 1];
            out.push(next ? `${INDENT}jump ${labels.get(next.id)}` : `${INDENT}return`);
            out.push('');
        }
    });

    return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}
