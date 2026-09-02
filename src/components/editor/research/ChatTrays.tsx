"use client";

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useWorkspaceStore, selectProjectWorldKey } from '@/store/workspaceStore';
import { makeSuggestionsWidget, type ArticleSuggestion } from '@/lib/articleSuggestions';
import { makeFlagsWidget, type ConsistencyFlag } from '@/lib/consistencyFlags';
import { ArticleSuggestionsRenderer } from '../desk/widgets/ArticleSuggestionsRenderer';
import { ConsistencyFlagsRenderer } from '../desk/widgets/ConsistencyFlagsRenderer';
import { UnderstandingRenderer } from '../desk/widgets/UnderstandingRenderer';
import { InterviewMenu } from './InterviewMenu';
import type { Interview } from '@/lib/interviews';
import styles from '../WritingDesk.module.css';

type TrayId = 'suggestions' | 'flags' | 'understanding';

interface ChatTraysProps {
    /** Composite research scope key — suggestions & flags live under it. */
    scopeKey: string | null;
    /** Assistant actions that share the rail with the trays. */
    busy?: boolean;
    onReview: () => void;
    interviews: Interview[];
    onLaunchInterview: (iv: Interview) => void;
    onNewInterview: () => void;
    onEditInterview: (iv: Interview) => void;
}

/**
 * The chat's side trays. A slim tab rail sits on the chat's right edge; clicking
 * a tab slides out a drawer over the board's left edge. The three trays reuse
 * the existing widget renderers, so the assistant's Article Suggestions,
 * Consistency & Gaps, and "What I Understand" live attached to the chat instead
 * of floating on the board. Data is unchanged — suggestions/flags in the scope's
 * widgets, understanding keyed by world in the store.
 */
export function ChatTrays({
    scopeKey, busy, onReview, interviews,
    onLaunchInterview, onNewInterview, onEditInterview,
}: ChatTraysProps) {
    const [active, setActive] = useState<TrayId | null>(null);

    const widgets = useWorkspaceStore(s => (scopeKey ? s.researchStates[scopeKey]?.widgets : undefined)) ?? [];
    const updateResearchState = useWorkspaceStore(s => s.updateResearchState);
    const worldKey = useWorkspaceStore(selectProjectWorldKey);
    const understanding = useWorkspaceStore(s => s.worldUnderstanding[worldKey]);

    const suggestWidget = widgets.find(w => w.type === 'articleSuggestions');
    const flagsWidget = widgets.find(w => w.type === 'consistencyFlags');
    const suggestions: ArticleSuggestion[] = suggestWidget?.content?.suggestions ?? [];
    const flags: ConsistencyFlag[] = flagsWidget?.content?.flags ?? [];
    const hasUnderstanding = Boolean(understanding && (understanding.summary.trim() || understanding.preferences.trim()));

    // The renderers hand back the full next list; persist it into the scope's
    // widget (creating the widget the first time the user edits an empty tray).
    const onSuggestChange = (c: { suggestions: ArticleSuggestion[] }) => {
        if (!scopeKey) return;
        const next = suggestWidget
            ? widgets.map(w => (w.id === suggestWidget.id ? { ...w, content: { ...w.content, suggestions: c.suggestions } } : w))
            : [...widgets, makeSuggestionsWidget(c.suggestions)];
        updateResearchState(scopeKey, { widgets: next });
    };

    const onFlagsChange = (c: { flags: ConsistencyFlag[] }) => {
        if (!scopeKey) return;
        const next = flagsWidget
            ? widgets.map(w => (w.id === flagsWidget.id ? { ...w, content: { ...w.content, flags: c.flags } } : w))
            : [...widgets, makeFlagsWidget(c.flags)];
        updateResearchState(scopeKey, { widgets: next });
    };

    const toggle = (id: TrayId) => setActive(a => (a === id ? null : id));

    const tabs: { id: TrayId; icon: string; label: string; badge?: number; dot?: boolean }[] = [
        { id: 'suggestions', icon: '📝', label: 'Article Suggestions', badge: suggestions.length || undefined },
        { id: 'flags', icon: '⚠️', label: 'Consistency & Gaps', badge: flags.length || undefined },
        { id: 'understanding', icon: '🧠', label: 'What I Understand', dot: hasUnderstanding },
    ];

    return (
        <div className={styles.chatTrayRail}>
            {/* Assistant actions: they run something rather than opening a tray,
                so they sit above the divider. */}
            <button
                className={styles.chatTrayTab}
                onClick={onReview}
                disabled={busy}
                title="Review the world for contradictions and gaps"
            >
                <span className={styles.chatTrayTabIcon}>🔍</span>
            </button>
            <InterviewMenu
                interviews={interviews}
                disabled={busy}
                variant="rail"
                onLaunch={onLaunchInterview}
                onNew={onNewInterview}
                onEdit={onEditInterview}
            />

            <span className={styles.chatTrayDivider} />

            {tabs.map(t => (
                <button
                    key={t.id}
                    className={`${styles.chatTrayTab} ${active === t.id ? styles.chatTrayTabActive : ''}`}
                    onClick={() => toggle(t.id)}
                    title={t.label}
                    aria-pressed={active === t.id}
                >
                    <span className={styles.chatTrayTabIcon}>{t.icon}</span>
                    {typeof t.badge === 'number' && <span className={styles.chatTrayBadge}>{t.badge}</span>}
                    {t.dot && t.badge === undefined && <span className={styles.chatTrayDot} />}
                </button>
            ))}

            {active && (
                <div className={styles.chatTrayDrawer}>
                    <button className={styles.chatTrayClose} onClick={() => setActive(null)} title="Close tray">
                        <X size={18} />
                    </button>
                    <div className={styles.chatTrayDrawerBody}>
                        {active === 'suggestions' && (
                            <ArticleSuggestionsRenderer content={{ suggestions }} onChange={onSuggestChange} />
                        )}
                        {active === 'flags' && (
                            <ConsistencyFlagsRenderer content={{ flags }} onChange={onFlagsChange} />
                        )}
                        {active === 'understanding' && <UnderstandingRenderer />}
                    </div>
                </div>
            )}
        </div>
    );
}
