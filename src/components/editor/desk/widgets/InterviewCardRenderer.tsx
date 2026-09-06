"use client";

import React from 'react';
import { BUILTIN_INTERVIEWS } from '@/lib/interviews';
import type { Interview } from '@/lib/interviews';
import { useWorkspaceStore } from '@/store/workspaceStore';
import styles from './InterviewCardRenderer.module.css';

interface Props {
    content: { interviewId?: string | null; answers?: string[] };
    onChange: (c: Record<string, unknown>) => void;
}

/**
 * An interview on the desk: the questions in order, with the answers typed
 * straight into the card.
 *
 * Only the interview's id is stored, so an edit to a custom interview shows up
 * here rather than being frozen into the widget's content.
 */
export function InterviewCardRenderer({ content, onChange }: Props) {
    const customInterviews = useWorkspaceStore(s => s.customInterviews);
    const interviewId = content.interviewId ?? null;

    const available: Interview[] = React.useMemo(
        () => [...BUILTIN_INTERVIEWS, ...customInterviews],
        [customInterviews],
    );

    const interview = React.useMemo(
        () => (interviewId ? available.find(i => i.id === interviewId) : undefined),
        [available, interviewId],
    );

    // The answers are held locally as well as in the store. onChange is
    // debounced by the caller, so two answers typed inside that window would
    // both read the same props array and the first would be lost. Local state
    // leads; props re-seed it only when they change from outside.
    const [answers, setAnswers] = React.useState<string[]>(content.answers ?? []);
    const lastPushed = React.useRef(content.answers);

    React.useEffect(() => {
        if (content.answers !== lastPushed.current) {
            setAnswers(content.answers ?? []);
            lastPushed.current = content.answers;
        }
    }, [content.answers]);

    const commit = (next: string[]) => {
        setAnswers(next);
        lastPushed.current = next;
        onChange({ ...content, answers: next });
    };

    const answerAt = (index: number, value: string) => {
        const next = [...answers];
        while (next.length <= index) next.push('');
        next[index] = value;
        commit(next);
    };

    const clear = () => onChange({ interviewId: null, answers: [] });

    if (!interviewId) {
        return (
            <div className={styles.card}>
                <p className={styles.label}>Choose an interview</p>
                <div className={styles.list}>
                    {available.map(i => (
                        <button
                            key={i.id}
                            className={styles.choice}
                            onMouseDown={e => e.stopPropagation()}
                            onClick={() => onChange({ interviewId: i.id, answers: [] })}
                        >
                            {i.title}
                        </button>
                    ))}
                    {available.length === 0 && (
                        <p className={styles.empty}>No interviews available.</p>
                    )}
                </div>
            </div>
        );
    }

    if (!interview) {
        return (
            <div className={styles.card}>
                <div className={styles.list}>
                    <p className={styles.empty}>This interview was deleted.</p>
                </div>
                <div className={styles.foot}>
                    <button
                        className={styles.change}
                        onMouseDown={e => e.stopPropagation()}
                        onClick={clear}
                    >
                        Change
                    </button>
                </div>
            </div>
        );
    }

    const total = interview.questions.length;
    const answered = interview.questions.reduce(
        (count, _question, i) => count + ((answers[i] ?? '').trim() ? 1 : 0),
        0,
    );

    return (
        <div className={styles.card}>
            <header className={styles.head}>
                <h3 className={styles.title}>{interview.title}</h3>
                <p className={styles.progress}>{answered} of {total} answered</p>
            </header>

            <ol className={styles.list}>
                {interview.questions.map((question, i) => (
                    <li key={`${question.label}-${i}`} className={styles.question}>
                        <p className={styles.prompt}>{question.prompt}</p>
                        <textarea
                            className={styles.answer}
                            aria-label={question.prompt}
                            rows={2}
                            value={answers[i] ?? ''}
                            onMouseDown={e => e.stopPropagation()}
                            onChange={e => answerAt(i, e.target.value)}
                        />
                    </li>
                ))}
            </ol>

            <div className={styles.foot}>
                <button
                    className={styles.change}
                    onMouseDown={e => e.stopPropagation()}
                    onClick={clear}
                >
                    Change
                </button>
            </div>
        </div>
    );
}
