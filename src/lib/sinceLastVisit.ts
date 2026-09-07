/**
 * What changed while you were away — LEAF MODULE (no store, no React import).
 *
 * Coming back to a manuscript after a fortnight is the hardest moment in the
 * whole job: you have lost the thread and the app has always greeted you
 * exactly as it greeted you yesterday. Every timestamp needed to fix that is
 * already recorded — updateProject, updateDocument, updateScene and
 * updateEntity all stamp updatedAt — so this is arithmetic, not new tracking.
 *
 * Only for a real absence. A digest of what you did twenty minutes ago is
 * noise, so anything under ABSENCE_THRESHOLD_MS reports nothing at all.
 */

import { dateKey } from './homeStats';

/** Under this, the writer has not really been away. Twenty hours. */
export const ABSENCE_THRESHOLD_MS = 20 * 60 * 60 * 1000;

/** The digest names a few things and counts the rest. */
export const MAX_DIGEST_ITEMS = 5;

export type ChangedKind = 'scene' | 'chapter' | 'article';

export interface ChangedItem {
    kind: ChangedKind;
    id: string;
    title: string;
    /** null for lore, which belongs to a world rather than to one book. */
    projectName: string | null;
    /** Epoch ms of the change. */
    at: number;
}

export interface AbsenceInput {
    projects: { id: string; name: string }[];
    documents: { id: string; projectId: string; title: string; createdAt: Date | string; updatedAt?: Date | string }[];
    scenes: { id: string; projectId: string; title: string; createdAt: Date | string; updatedAt?: Date | string }[];
    entities: { id: string; name: string; createdAt: Date | string; updatedAt?: Date | string }[];
    writingDays: { date: string; wordsWritten: number }[];
}

export interface AbsenceDigest {
    awayMs: number;
    /** Newest first, capped at MAX_DIGEST_ITEMS. */
    items: ChangedItem[];
    sceneCount: number;
    chapterCount: number;
    articleCount: number;
    wordsWritten: number;
}

function toTime(v: Date | string | undefined): number {
    if (!v) return 0;
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : 0;
}

/** When a record last changed: its update stamp, or its creation. */
function changedAt(r: { createdAt: Date | string; updatedAt?: Date | string }): number {
    return toTime(r.updatedAt) || toTime(r.createdAt);
}

/**
 * Everything touched between `since` and `now`, or null when there is nothing
 * worth saying: no previous visit, an unreadable stamp, or too short a gap.
 */
export function summarizeSinceLastVisit(
    input: AbsenceInput,
    since: string | null,
    now: Date,
): AbsenceDigest | null {
    if (!since) return null;
    const sinceMs = Date.parse(since);
    if (!Number.isFinite(sinceMs)) return null;

    const awayMs = now.getTime() - sinceMs;
    if (awayMs < ABSENCE_THRESHOLD_MS) return null;

    const projectName = (id: string) =>
        input.projects.find(p => p.id === id)?.name ?? null;

    const all: ChangedItem[] = [];

    for (const s of input.scenes) {
        const at = changedAt(s);
        if (at <= sinceMs) continue;
        all.push({ kind: 'scene', id: s.id, title: s.title, projectName: projectName(s.projectId), at });
    }
    for (const d of input.documents) {
        const at = changedAt(d);
        if (at <= sinceMs) continue;
        all.push({ kind: 'chapter', id: d.id, title: d.title, projectName: projectName(d.projectId), at });
    }
    for (const e of input.entities) {
        const at = changedAt(e);
        if (at <= sinceMs) continue;
        all.push({ kind: 'article', id: e.id, title: e.name, projectName: null, at });
    }

    all.sort((a, b) => b.at - a.at);

    // Words are recorded per calendar day, not per moment, so the day the
    // writer left is skipped rather than counted whole. A small undercount is
    // honest; counting the words they wrote before leaving is not.
    const leftOn = dateKey(new Date(sinceMs));
    const wordsWritten = input.writingDays
        .filter(d => d.date > leftOn)
        .reduce((n, d) => n + (d.wordsWritten || 0), 0);

    return {
        awayMs,
        items: all.slice(0, MAX_DIGEST_ITEMS),
        sceneCount: all.filter(i => i.kind === 'scene').length,
        chapterCount: all.filter(i => i.kind === 'chapter').length,
        articleCount: all.filter(i => i.kind === 'article').length,
        wordsWritten,
    };
}
