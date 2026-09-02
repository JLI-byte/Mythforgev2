/**
 * Home screen statistics — LEAF MODULE (no store import).
 *
 * Pure derivations for the Home bento: where to resume writing, today's
 * progress against the daily goal, the writing-day heatmap, World Bible
 * counts, and the "needs attention" tallies. Kept free of store/React so the
 * arithmetic can be tested directly.
 */

/** Local calendar date as YYYY-MM-DD (never UTC — streaks are a local concept). */
export function dateKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export interface WritingDayLike {
    date: string;
    wordsWritten: number;
    minutesWritten?: number;
}

/** Words written on a given day key (0 when the day has no entry). */
export function wordsOnDate(days: WritingDayLike[], key: string): number {
    return days
        .filter(d => d.date === key)
        .reduce((n, d) => n + (d.wordsWritten || 0), 0);
}

export interface HeatmapCell {
    date: string;
    words: number;
    /** 0 = nothing written, 1-4 = increasing share of the daily target. */
    level: 0 | 1 | 2 | 3 | 4;
}

/** Bucket a day's words into a 0-4 heat level relative to the daily target. */
export function heatLevel(words: number, target: number): HeatmapCell['level'] {
    if (words <= 0) return 0;
    const goal = target > 0 ? target : 500;
    const ratio = words / goal;
    if (ratio >= 1) return 4;
    if (ratio >= 0.6) return 3;
    if (ratio >= 0.25) return 2;
    return 1;
}

/**
 * Build a contribution grid ending on `end`, covering `weeks` full weeks and
 * aligned so each column is a Sunday-started week. Returns columns of 7 cells.
 *
 * `target` may be a function so a weekday schedule ("1000 on Fridays") shades
 * each day against the goal that actually applied to it.
 */
export function buildHeatmap(
    days: WritingDayLike[],
    end: Date,
    weeks: number,
    target: number | ((dateKey: string) => number),
): HeatmapCell[][] {
    const targetFor = typeof target === 'function' ? target : () => target;
    // Totals per day first — a date can have one entry per project.
    const totals = new Map<string, number>();
    for (const d of days) {
        totals.set(d.date, (totals.get(d.date) ?? 0) + (d.wordsWritten || 0));
    }

    // Walk back to the Sunday that starts the earliest visible week.
    const lastCol = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    lastCol.setDate(lastCol.getDate() - lastCol.getDay()); // Sunday of end's week
    const start = new Date(lastCol);
    start.setDate(start.getDate() - (weeks - 1) * 7);

    const cols: HeatmapCell[][] = [];
    const cursor = new Date(start);
    for (let w = 0; w < weeks; w++) {
        const col: HeatmapCell[] = [];
        for (let d = 0; d < 7; d++) {
            const key = dateKey(cursor);
            const words = totals.get(key) ?? 0;
            col.push({ date: key, words, level: heatLevel(words, targetFor(key)) });
            cursor.setDate(cursor.getDate() + 1);
        }
        cols.push(col);
    }
    return cols;
}

export interface ResumeTargetInput {
    projects: { id: string; name: string }[];
    documents: { id: string; projectId: string; title: string; updatedAt?: Date | string; createdAt: Date | string; wordCount?: number }[];
    scenes: { id: string; documentId: string; projectId: string; title: string; updatedAt?: Date | string; createdAt: Date | string; wordCount?: number }[];
}

export interface ResumeTarget {
    projectId: string;
    projectName: string;
    documentId: string;
    sceneId?: string;
    /** "Chapter 3" or "Chapter 3 — The Sinks" when a scene is the target. */
    label: string;
    wordCount: number;
    updatedAt: Date;
}

function toTime(v: Date | string | undefined): number {
    if (!v) return 0;
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : 0;
}

/**
 * The most recently touched piece of writing — a scene if there is one,
 * otherwise the document. Returns null when there's nothing to resume.
 */
export function resolveResumeTarget(input: ResumeTargetInput): ResumeTarget | null {
    const { projects, documents, scenes } = input;
    const projectName = (id: string) => projects.find(p => p.id === id)?.name ?? 'Untitled';
    const docById = new Map(documents.map(d => [d.id, d]));

    let best: ResumeTarget | null = null;
    let bestTime = -1;

    for (const s of scenes) {
        const t = toTime(s.updatedAt) || toTime(s.createdAt);
        if (t <= bestTime) continue;
        const doc = docById.get(s.documentId);
        if (!doc) continue; // orphaned scene — not resumable
        bestTime = t;
        best = {
            projectId: s.projectId,
            projectName: projectName(s.projectId),
            documentId: s.documentId,
            sceneId: s.id,
            label: s.title ? `${doc.title} — ${s.title}` : doc.title,
            wordCount: s.wordCount ?? 0,
            updatedAt: new Date(t),
        };
    }

    for (const d of documents) {
        const t = toTime(d.updatedAt) || toTime(d.createdAt);
        if (t <= bestTime) continue;
        bestTime = t;
        best = {
            projectId: d.projectId,
            projectName: projectName(d.projectId),
            documentId: d.id,
            label: d.title,
            wordCount: d.wordCount ?? 0,
            updatedAt: new Date(t),
        };
    }

    return best;
}

/** Compact "2 hours ago" / "just now" phrasing for the resume card. */
export function timeAgo(then: Date, now: Date = new Date()): string {
    const secs = Math.max(0, Math.floor((now.getTime() - then.getTime()) / 1000));
    if (secs < 60) return 'just now';
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
    const years = Math.floor(months / 12);
    return `${years} year${years === 1 ? '' : 's'} ago`;
}

/**
 * Pending flags and article suggestions across every research board, so Home
 * can show one "needs attention" tally. Mirrors the widget content shapes.
 */
export function attentionCounts(
    states: Record<string, { widgets?: { type: string; content?: Record<string, unknown> }[] }>,
): { flags: number; suggestions: number } {
    let flags = 0;
    let suggestions = 0;
    for (const state of Object.values(states ?? {})) {
        for (const w of state?.widgets ?? []) {
            if (w.type === 'consistencyFlags') {
                const list = w.content?.flags;
                if (Array.isArray(list)) flags += list.length;
            } else if (w.type === 'articleSuggestions') {
                const list = w.content?.suggestions;
                if (Array.isArray(list)) suggestions += list.length;
            }
        }
    }
    return { flags, suggestions };
}
