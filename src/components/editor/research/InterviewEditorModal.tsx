"use client";

import React, { useState } from 'react';
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import type { EntityType } from '@/store/workspaceStore';
import type { Interview, InterviewQuestion } from '@/lib/interviews';
import styles from '../WritingDesk.module.css';

interface InterviewEditorModalProps {
    /** The interview being edited (a fresh draft for "new", a clone for "edit"). */
    interview: Interview;
    /** True when editing an existing custom interview (shows Delete). */
    canDelete?: boolean;
    onSave: (interview: Interview) => void;
    onDelete?: () => void;
    onClose: () => void;
}

/** The eight World Bible types, plus "mixed" for a whole-world interview. */
const TARGET_OPTIONS: { value: EntityType | ''; label: string }[] = [
    { value: '', label: 'Mixed — a whole world (many articles)' },
    { value: 'character', label: 'Character' },
    { value: 'location', label: 'Location' },
    { value: 'faction', label: 'Faction' },
    { value: 'species', label: 'Species' },
    { value: 'religion', label: 'Religion' },
    { value: 'artifact', label: 'Artifact' },
    { value: 'magic', label: 'Magic' },
    { value: 'lore', label: 'Lore' },
];

/**
 * Create / edit a custom interview skill: its title, icon, target type, and the
 * ordered list of questions. Save is blocked until it has a title and at least
 * one question with a prompt, so a launched interview always has something to ask.
 */
export function InterviewEditorModal({ interview, canDelete, onSave, onDelete, onClose }: InterviewEditorModalProps) {
    const [draft, setDraft] = useState<Interview>(interview);

    const patch = (updates: Partial<Interview>) => setDraft(d => ({ ...d, ...updates }));

    const patchQuestion = (index: number, updates: Partial<InterviewQuestion>) =>
        setDraft(d => ({
            ...d,
            questions: d.questions.map((q, i) => (i === index ? { ...q, ...updates } : q)),
        }));

    const addQuestion = () =>
        setDraft(d => ({
            ...d,
            questions: [...d.questions, { label: `Question ${d.questions.length + 1}`, prompt: '', seeds: '' }],
        }));

    const removeQuestion = (index: number) =>
        setDraft(d => ({ ...d, questions: d.questions.filter((_, i) => i !== index) }));

    const moveQuestion = (index: number, dir: -1 | 1) =>
        setDraft(d => {
            const next = [...d.questions];
            const target = index + dir;
            if (target < 0 || target >= next.length) return d;
            [next[index], next[target]] = [next[target], next[index]];
            return { ...d, questions: next };
        });

    const titleOk = draft.title.trim().length > 0;
    const hasQuestion = draft.questions.some(q => q.prompt.trim().length > 0);
    const canSave = titleOk && hasQuestion;

    const handleSave = () => {
        if (!canSave) return;
        onSave({
            ...draft,
            title: draft.title.trim(),
            icon: draft.icon.trim() || '📝',
            tagline: draft.tagline.trim(),
            builtIn: false,
            questions: draft.questions
                .filter(q => q.prompt.trim().length > 0)
                .map((q, i) => ({
                    label: q.label.trim() || `Question ${i + 1}`,
                    prompt: q.prompt.trim(),
                    seeds: q.seeds.trim(),
                })),
        });
    };

    return (
        <div className={styles.interviewEditorBackdrop} onClick={onClose}>
            <div className={styles.interviewEditorModal} onClick={e => e.stopPropagation()}>
                <div className={styles.interviewEditorHeader}>
                    <h2 className={styles.interviewEditorTitle}>{canDelete ? 'Edit interview' : 'New interview'}</h2>
                    <button className={styles.interviewEditorClose} onClick={onClose} title="Close">
                        <X size={18} />
                    </button>
                </div>

                <div className={styles.interviewEditorBody}>
                    <div className={styles.interviewEditorMeta}>
                        <label className={styles.interviewEditorField} style={{ flex: '0 0 64px' }}>
                            <span className={styles.interviewEditorLabel}>Icon</span>
                            <input
                                className={styles.interviewEditorInput}
                                value={draft.icon}
                                onChange={e => patch({ icon: e.target.value })}
                                maxLength={4}
                                placeholder="📝"
                            />
                        </label>
                        <label className={styles.interviewEditorField} style={{ flex: '1 1 auto' }}>
                            <span className={styles.interviewEditorLabel}>Title</span>
                            <input
                                className={styles.interviewEditorInput}
                                value={draft.title}
                                onChange={e => patch({ title: e.target.value })}
                                placeholder="e.g. Villain, Guild, Battle"
                                autoFocus
                            />
                        </label>
                    </div>

                    <label className={styles.interviewEditorField}>
                        <span className={styles.interviewEditorLabel}>Tagline</span>
                        <input
                            className={styles.interviewEditorInput}
                            value={draft.tagline}
                            onChange={e => patch({ tagline: e.target.value })}
                            placeholder="One line describing what this interview builds"
                        />
                    </label>

                    <label className={styles.interviewEditorField}>
                        <span className={styles.interviewEditorLabel}>Creates</span>
                        <select
                            className={styles.interviewEditorInput}
                            value={draft.targetType ?? ''}
                            onChange={e => patch({ targetType: (e.target.value || undefined) as EntityType | undefined })}
                        >
                            {TARGET_OPTIONS.map(o => (
                                <option key={o.value || 'mixed'} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    </label>

                    <div className={styles.interviewEditorQuestionsHead}>
                        <span className={styles.interviewEditorLabel}>Questions</span>
                        <span className={styles.interviewEditorHint}>Asked in order, one at a time.</span>
                    </div>

                    {draft.questions.map((q, i) => (
                        <div key={i} className={styles.interviewEditorQuestion}>
                            <div className={styles.interviewEditorQuestionTop}>
                                <span className={styles.interviewEditorQuestionNum}>{i + 1}</span>
                                <input
                                    className={styles.interviewEditorInput}
                                    value={q.label}
                                    aria-label="Question label"
                                    onChange={e => patchQuestion(i, { label: e.target.value })}
                                    placeholder="Short label, e.g. Core want"
                                />
                                <div className={styles.interviewEditorQuestionBtns}>
                                    <button onClick={() => moveQuestion(i, -1)} disabled={i === 0} title="Move up" aria-label="Move up"><ArrowUp size={13} /></button>
                                    <button onClick={() => moveQuestion(i, 1)} disabled={i === draft.questions.length - 1} title="Move down" aria-label="Move down"><ArrowDown size={13} /></button>
                                    <button onClick={() => removeQuestion(i)} disabled={draft.questions.length === 1} title="Remove"><X size={13} /></button>
                                </div>
                            </div>
                            <textarea
                                className={styles.interviewEditorTextarea}
                                value={q.prompt}
                                aria-label="Question prompt"
                                onChange={e => patchQuestion(i, { prompt: e.target.value })}
                                placeholder="The question to ask…"
                                rows={2}
                            />
                            <input
                                className={styles.interviewEditorInput}
                                value={q.seeds}
                                aria-label="Entity types this answer seeds"
                                onChange={e => patchQuestion(i, { seeds: e.target.value })}
                                placeholder="Seeds (optional) — entity types this answer creates, e.g. faction, location"
                            />
                        </div>
                    ))}

                    <button className={styles.interviewEditorAddQ} onClick={addQuestion}>＋ Add question</button>
                </div>

                <div className={styles.interviewEditorActions}>
                    {canDelete && onDelete && (
                        <button className={styles.interviewEditorDelete} onClick={onDelete}>Delete</button>
                    )}
                    <div className={styles.interviewEditorActionsRight}>
                        <button className={styles.interviewEditorCancel} onClick={onClose}>Cancel</button>
                        <button className={styles.interviewEditorSave} onClick={handleSave} disabled={!canSave}>
                            Save interview
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
