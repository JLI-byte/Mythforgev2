"use client";

/**
 * VNDecisionEditor — one decision and its options, at the deepest zoom.
 *
 * Every operand comes from the declared flag registry; nothing here is free
 * text that reaches the generated script. A minor decision has no route
 * control at all, which is what makes "minor never changes direction" a rule
 * rather than a label.
 */

import React from 'react';
import type { VNDecision, VNOption } from '@/lib/vnTimeline';
import type { VNEffect, VNFlag } from '@/lib/vnFlags';
import styles from './VNTimeline.module.css';

interface VNDecisionEditorProps {
    decision: VNDecision;
    flags: VNFlag[];
    episodes: { id: string; title: string }[];
    onChange: (patch: Partial<VNDecision>) => void;
    onRemove: () => void;
}

export function VNDecisionEditor({ decision, flags, episodes, onChange, onRemove }: VNDecisionEditorProps) {
    const setOptions = (options: VNOption[]) => onChange({ options });

    const updateOption = (id: string, patch: Partial<VNOption>) =>
        setOptions(decision.options.map(o => (o.id === id ? { ...o, ...patch } : o)));

    const addOption = () =>
        setOptions([...decision.options, { id: crypto.randomUUID(), text: '' }]);

    const flagById = (id: string) => flags.find(f => f.id === id);

    return (
        <div className={styles.decisionEditor} onClick={e => e.stopPropagation()}>
            <div className={styles.decisionHead}>
                <select
                    value={decision.kind}
                    onChange={e => {
                        const kind = e.target.value as VNDecision['kind'];
                        // A minor decision cannot route, so drop any route it had.
                        onChange(kind === 'minor'
                            ? { kind, options: decision.options.map(o => ({ ...o, routeToEpisodeId: undefined })) }
                            : { kind });
                    }}
                >
                    <option value="major">◆ major</option>
                    <option value="minor">◇ minor</option>
                </select>

                <input
                    className={styles.promptInput}
                    value={decision.prompt}
                    placeholder="What is being decided?"
                    onChange={e => onChange({ prompt: e.target.value })}
                />

                <button type="button" onClick={onRemove} aria-label="Remove decision">×</button>
            </div>

            {decision.options.map(option => (
                <div key={option.id} className={styles.optionRow}>
                    <input
                        className={styles.optionText}
                        value={option.text}
                        placeholder="What the player sees"
                        onChange={e => updateOption(option.id, { text: e.target.value })}
                    />

                    <select
                        value={option.effects?.[0]?.flagId ?? ''}
                        onChange={e => {
                            const flagId = e.target.value;
                            if (!flagId) return updateOption(option.id, { effects: undefined });
                            const flag = flagById(flagId);
                            const effect: VNEffect = {
                                flagId,
                                op: flag?.kind === 'counter' ? 'add' : 'set',
                                value: flag?.kind === 'counter' ? 1 : undefined,
                            };
                            updateOption(option.id, { effects: [effect] });
                        }}
                    >
                        <option value="">sets nothing</option>
                        {flags.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>

                    {decision.kind === 'major' && (
                        <select
                            value={option.routeToEpisodeId ?? ''}
                            title="Leave blank to rejoin and carry on"
                            onChange={e => updateOption(option.id, {
                                routeToEpisodeId: e.target.value || undefined,
                            })}
                        >
                            <option value="">rejoins</option>
                            {episodes.map(ep => (
                                <option key={ep.id} value={ep.id}>→ {ep.title}</option>
                            ))}
                        </select>
                    )}

                    <button
                        type="button"
                        onClick={() => setOptions(decision.options.filter(o => o.id !== option.id))}
                        aria-label="Remove option"
                    >
                        ×
                    </button>
                </div>
            ))}

            <button type="button" className={styles.addOption} onClick={addOption}>
                + option
            </button>
        </div>
    );
}
