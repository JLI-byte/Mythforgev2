/**
 * Ren'Py export — turns a visual novel project into a .rpy file that drops
 * into an existing Ren'Py game's game/ folder. LEAF MODULE, and deliberately
 * pure: data in, string out, no store and no DOM.
 *
 * Nothing here can be verified by running it — the machine has no Ren'Py SDK.
 * The tests are the only safety net, so every rule below exists because
 * breaking it produces a file that fails to compile.
 */

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
export function buildLabelMap(scenes: { id: string; title: string }[]): Map<string, string> {
    const taken = new Set<string>();
    const map = new Map<string, string>();

    for (const scene of scenes) {
        let base = scene.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');

        // 'untitled' rather than 'scene': 'scene' is itself a Ren'Py keyword,
        // so using it as the fallback would trip the guard below.
        if (!base) base = 'untitled';
        if (/^[0-9]/.test(base)) base = `s_${base}`;
        if (RENPY_KEYWORDS.has(base)) base = `${base}_scene`;

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
