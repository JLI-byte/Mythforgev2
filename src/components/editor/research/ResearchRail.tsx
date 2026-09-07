"use client";

import React, { useState } from 'react';
import { X } from 'lucide-react';
import {
    useWorkspaceStore,
    selectProjectWorldKey,
    type DeskWidget,
    type DeskWidgetType,
} from '@/store/workspaceStore';
import { worldKeyForProject } from '@/lib/worldKey';
import { getWorldBibleConfig } from '@/lib/worldBibleNav';
import { runLoreRules, findingToFlag, suggestArticles } from '@/lib/loreRules';
import { makeFlagsWidget, type ConsistencyFlag } from '@/lib/consistencyFlags';
import { makeSuggestionsWidget, type ArticleSuggestion } from '@/lib/articleSuggestions';
import { ArticleSuggestionsRenderer } from '../desk/widgets/ArticleSuggestionsRenderer';
import { ConsistencyFlagsRenderer } from '../desk/widgets/ConsistencyFlagsRenderer';
import { InterviewMenu } from './InterviewMenu';
import { InterviewRunner } from './InterviewRunner';
import { InterviewEditorModal } from './InterviewEditorModal';
import { BUILTIN_INTERVIEWS, makeBlankInterview, type Interview } from '@/lib/interviews';
import styles from '../WritingDesk.module.css';

type TrayId = 'suggestions' | 'flags';

interface ResearchRailProps {
    /** Composite research scope key — the board the trays read and write. */
    scopeKey: string | null;
}

/** Put `content` into the board's single widget of `type`, creating it if absent. */
function setWidgetContent(
    widgets: DeskWidget[],
    type: DeskWidgetType,
    make: () => DeskWidget,
    content: Record<string, unknown>,
): DeskWidget[] {
    const existing = widgets.find(w => w.type === type);
    if (!existing) return [...widgets, make()];
    return widgets.map(w => (w.id === existing.id ? { ...w, content: { ...w.content, ...content } } : w));
}

/**
 * The Research tab's left rail: launch an interview, run the lore check, and
 * open either result tray. It is what the chat's tray rail was, minus the chat
 * — the two widget renderers have no other host, since WritingDesk filters
 * both types off the board itself.
 */
export function ResearchRail({ scopeKey }: ResearchRailProps) {
    const [active, setActive] = useState<TrayId | null>(null);
    const [running, setRunning] = useState<Interview | null>(null);
    const [editing, setEditing] = useState<{ interview: Interview; existing: boolean } | null>(null);

    const widgets = useWorkspaceStore(s => (scopeKey ? s.researchStates[scopeKey]?.widgets : undefined)) ?? [];
    const updateResearchState = useWorkspaceStore(s => s.updateResearchState);
    const customInterviews = useWorkspaceStore(s => s.customInterviews);
    const addInterview = useWorkspaceStore(s => s.addInterview);
    const updateInterview = useWorkspaceStore(s => s.updateInterview);
    const deleteInterview = useWorkspaceStore(s => s.deleteInterview);
    const worldKey = useWorkspaceStore(selectProjectWorldKey);

    const interviews: Interview[] = [...BUILTIN_INTERVIEWS, ...customInterviews];

    const suggestionsWidget = widgets.find(w => w.type === 'articleSuggestions');
    const flagsWidget = widgets.find(w => w.type === 'consistencyFlags');
    const suggestions: ArticleSuggestion[] = suggestionsWidget?.content?.suggestions ?? [];
    const flags: ConsistencyFlag[] = flagsWidget?.content?.flags ?? [];

    // ── Lore check ──────────────────────────────────────────
    // Read the world imperatively: the rail must not re-render on every
    // keystroke in a scene just because it could one day check them.
    const runCheck = () => {
        if (!scopeKey) return;
        const s = useWorkspaceStore.getState();
        const projectIds = new Set(
            s.projects.filter(p => worldKeyForProject(p) === worldKey).map(p => p.id),
        );
        const input = {
            entities: s.entities,
            scenes: s.scenes.filter(x => projectIds.has(x.projectId)),
            documents: s.documents.filter(x => projectIds.has(x.projectId)),
            roots: getWorldBibleConfig(s.worldBibles, worldKey).layout.roots,
            worldKey,
        };

        const nextFlags = runLoreRules(input).map(findingToFlag);
        const nextSuggestions = suggestArticles(input);

        let next = s.researchStates[scopeKey]?.widgets ?? [];
        next = setWidgetContent(next, 'consistencyFlags', () => makeFlagsWidget(nextFlags), { flags: nextFlags });
        next = setWidgetContent(next, 'articleSuggestions', () => makeSuggestionsWidget(nextSuggestions), { suggestions: nextSuggestions });
        updateResearchState(scopeKey, { widgets: next });
        setActive(nextFlags.length || !nextSuggestions.length ? 'flags' : 'suggestions');
    };

    // ── Tray edits ──────────────────────────────────────────
    const onSuggestionsChange = (c: { suggestions: ArticleSuggestion[] }) => {
        if (!scopeKey) return;
        updateResearchState(scopeKey, {
            widgets: setWidgetContent(widgets, 'articleSuggestions', () => makeSuggestionsWidget(c.suggestions), c),
        });
    };

    const onFlagsChange = (c: { flags: ConsistencyFlag[] }) => {
        if (!scopeKey) return;
        updateResearchState(scopeKey, {
            widgets: setWidgetContent(widgets, 'consistencyFlags', () => makeFlagsWidget(c.flags), c),
        });
    };

    // ── Interviews ──────────────────────────────────────────
    const saveInterview = (interview: Interview) => {
        if (editing?.existing) updateInterview(interview.id, interview);
        else addInterview(interview);
        setEditing(null);
    };

    const removeInterview = () => {
        if (editing?.existing) deleteInterview(editing.interview.id);
        setEditing(null);
    };

    const tabs: { id: TrayId; icon: string; label: string; badge?: number }[] = [
        { id: 'suggestions', icon: '📝', label: 'Article Suggestions', badge: suggestions.length || undefined },
        { id: 'flags', icon: '⚠️', label: 'Consistency & Gaps', badge: flags.length || undefined },
    ];

    return (
        <div className={styles.chatTrayRail}>
            <button
                className={styles.chatTrayTab}
                onClick={runCheck}
                disabled={!scopeKey}
                title="Check this world for gaps, broken links and duplicate names"
                aria-label="Run the lore check"
            >
                <span className={styles.chatTrayTabIcon}>🔍</span>
            </button>
            <InterviewMenu
                interviews={interviews}
                variant="rail"
                onLaunch={setRunning}
                onNew={() => setEditing({ interview: makeBlankInterview(crypto.randomUUID()), existing: false })}
                onEdit={iv => setEditing(
                    iv.builtIn
                        ? { interview: { ...iv, id: crypto.randomUUID(), builtIn: false, title: `${iv.title} (copy)` }, existing: false }
                        : { interview: iv, existing: true },
                )}
            />

            <span className={styles.chatTrayDivider} />

            {tabs.map(t => (
                <button
                    key={t.id}
                    className={`${styles.chatTrayTab} ${active === t.id ? styles.chatTrayTabActive : ''}`}
                    onClick={() => setActive(a => (a === t.id ? null : t.id))}
                    title={t.label}
                    aria-label={t.label}
                    aria-pressed={active === t.id}
                >
                    <span className={styles.chatTrayTabIcon}>{t.icon}</span>
                    {typeof t.badge === 'number' && <span className={styles.chatTrayBadge}>{t.badge}</span>}
                </button>
            ))}

            {active && (
                <div className={styles.chatTrayDrawer}>
                    <button className={styles.chatTrayClose} onClick={() => setActive(null)} title="Close tray">
                        <X size={18} />
                    </button>
                    <div className={styles.chatTrayDrawerBody}>
                        {active === 'suggestions' && (
                            <ArticleSuggestionsRenderer content={{ suggestions }} onChange={onSuggestionsChange} />
                        )}
                        {active === 'flags' && (
                            <ConsistencyFlagsRenderer content={{ flags }} onChange={onFlagsChange} />
                        )}
                    </div>
                </div>
            )}

            {running && <InterviewRunner interview={running} onClose={() => setRunning(null)} />}

            {editing && (
                <InterviewEditorModal
                    interview={editing.interview}
                    canDelete={editing.existing}
                    onSave={saveInterview}
                    onDelete={removeInterview}
                    onClose={() => setEditing(null)}
                />
            )}
        </div>
    );
}
