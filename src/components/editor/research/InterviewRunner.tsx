"use client";

import React, { useState } from 'react';
import { X } from 'lucide-react';
import {
    useWorkspaceStore,
    selectProjectWorldKey,
    type Entity,
    type EntityType,
} from '@/store/workspaceStore';
import { STANDALONE_KEY } from '@/lib/worldKey';
import { getWorldBibleConfig } from '@/lib/worldBibleNav';
import { buildArticleDoc, resolveCategoryId } from '@/lib/worldAuthoring';
import { sanitizeLabel } from '@/lib/sanitize';
import {
    buildInterviewSections,
    interviewDescription,
    type Interview,
    type InterviewAnswer,
} from '@/lib/interviews';
import styles from '../WritingDesk.module.css';

interface InterviewRunnerProps {
    interview: Interview;
    onClose: () => void;
    /** Called with the new entity's id once the article has been created. */
    onCreated?: (entityId: string) => void;
}

/** An interview that declares no target type produces one general article. */
const FALLBACK_TYPE: EntityType = 'lore';

/**
 * Runs an interview as a self-guided form. Step 0 names the article; steps 1..n
 * ask the interview's questions one at a time with Back, Skip and a progress
 * readout. Answers live in local state — nothing is written until Finish, which
 * builds a single World Bible article through the ordinary creation path.
 *
 * Every question is always asked, in order, exactly as written. That is the
 * point: the old model chose which to ask and how to reword them, so the
 * article's shape changed run to run.
 */
export function InterviewRunner({ interview, onClose, onCreated }: InterviewRunnerProps) {
    const questions = interview.questions.filter(q => q.prompt.trim());
    const totalSteps = questions.length + 1;

    const [step, setStep] = useState(0);
    const [name, setName] = useState('');
    const [answers, setAnswers] = useState<string[]>(() => questions.map(() => ''));

    const activeProjectId = useWorkspaceStore(s => s.activeProjectId);
    const worldKey = useWorkspaceStore(selectProjectWorldKey);
    const worldBibles = useWorkspaceStore(s => s.worldBibles);
    const addEntity = useWorkspaceStore(s => s.addEntity);

    const trimmedName = name.trim();
    const isNameStep = step === 0;
    const isLastStep = step === totalSteps - 1;
    const answeredCount = answers.filter(a => a.trim()).length;
    const canFinish = Boolean(activeProjectId) && trimmedName.length > 0;

    const setAnswer = (value: string) =>
        setAnswers(prev => prev.map((a, i) => (i === step - 1 ? value : a)));

    const back = () => setStep(s => Math.max(0, s - 1));
    const next = () => setStep(s => Math.min(totalSteps - 1, s + 1));
    const skip = () => { setAnswer(''); next(); };

    const finish = () => {
        if (!activeProjectId || !trimmedName) return;
        const pairs: InterviewAnswer[] = questions.map((q, i) => ({
            prompt: q.prompt,
            answer: answers[i],
        }));
        const type = interview.targetType ?? FALLBACK_TYPE;
        const roots = getWorldBibleConfig(worldBibles, worldKey).layout.roots;
        const entity: Entity = {
            id: crypto.randomUUID(),
            projectId: activeProjectId,
            worldId: worldKey === STANDALONE_KEY ? undefined : worldKey,
            categoryId: resolveCategoryId(roots, undefined, type),
            name: sanitizeLabel(trimmedName),
            type,
            description: interviewDescription(pairs),
            articleDoc: buildArticleDoc(buildInterviewSections(pairs)),
            createdAt: new Date(),
        };
        addEntity(entity);
        onCreated?.(entity.id);
        onClose();
    };

    return (
        <div className={styles.interviewEditorBackdrop} onClick={onClose}>
            <div
                className={`${styles.interviewEditorModal} ${styles.interviewRunnerModal}`}
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={`${interview.title} interview`}
            >
                <div className={styles.interviewEditorHeader}>
                    <h2 className={styles.interviewEditorTitle}>
                        {interview.icon} {interview.title}
                        <span className={styles.interviewRunnerProgress}>{step + 1} of {totalSteps}</span>
                    </h2>
                    <button className={styles.interviewEditorClose} onClick={onClose} title="Close">
                        <X size={18} />
                    </button>
                </div>

                <div className={styles.interviewRunnerBody}>
                    {isNameStep ? (
                        <>
                            <span className={styles.interviewRunnerLabel}>Name</span>
                            <p className={styles.interviewRunnerQuestion}>
                                What should this article be called?
                            </p>
                            <input
                                className={styles.interviewEditorInput}
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder={`Name your ${interview.title.toLowerCase()}`}
                                aria-label="Article name"
                                autoFocus
                            />
                            {!interview.targetType && (
                                <p className={styles.interviewRunnerNote}>
                                    This interview writes one article covering everything you answer.
                                </p>
                            )}
                        </>
                    ) : (
                        <>
                            <span className={styles.interviewRunnerLabel}>{questions[step - 1].label}</span>
                            <p className={styles.interviewRunnerQuestion}>{questions[step - 1].prompt}</p>
                            <textarea
                                className={styles.interviewRunnerAnswer}
                                value={answers[step - 1]}
                                onChange={e => setAnswer(e.target.value)}
                                placeholder="As much or as little as you like — Skip if you would rather not answer."
                                aria-label={questions[step - 1].label || 'Answer'}
                                rows={6}
                                autoFocus
                            />
                        </>
                    )}
                </div>

                <div className={styles.interviewEditorActions}>
                    <button className={styles.interviewEditorCancel} onClick={back} disabled={step === 0}>
                        Back
                    </button>
                    <div className={styles.interviewEditorActionsRight}>
                        <span className={styles.interviewRunnerCount}>
                            {answeredCount} of {questions.length} answered
                        </span>
                        {!isNameStep && !isLastStep && (
                            <button className={styles.interviewEditorCancel} onClick={skip}>Skip</button>
                        )}
                        {isLastStep ? (
                            <button className={styles.interviewEditorSave} onClick={finish} disabled={!canFinish}>
                                Finish &amp; create article
                            </button>
                        ) : (
                            <button
                                className={styles.interviewEditorSave}
                                onClick={next}
                                disabled={isNameStep && !trimmedName}
                            >
                                Next
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
