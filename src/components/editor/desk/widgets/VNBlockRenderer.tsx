"use client";

/**
 * VNBlockRenderer — one beat on the visual novel branch map.
 *
 * A block is a run of scenes that plays straight through and ends at a
 * decision. The widget holds only `{ blockId }`; the Document it names owns
 * the title and choices, and its Scenes are the beats inside. Nothing about
 * the graph lives on the canvas, so the map cannot drift from the story.
 */

import React, { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useWorkspaceStore } from '@/store/workspaceStore';
import type { VNBlockChoice } from '@/lib/vnBlocks';
import { describeEffect, describeCondition } from '@/lib/vnBlockView';
import type { VNEffect, VNCondition, VNFlag } from '@/lib/vnFlags';
import styles from '../../WritingDesk.module.css';

interface ChoiceStateEditorProps {
    choice: VNBlockChoice;
    flags: VNFlag[];
    onChange: (patch: Partial<VNBlockChoice>) => void;
}

/**
 * The state controls for one choice: what it does, and what it needs.
 *
 * Every operand comes from the declared registry — there is no free-text path
 * into the generated script, because nothing here can be compiled to find out
 * it was wrong.
 *
 * One effect per choice is deliberate. A choice moving two counters at once is
 * real but rare, and the data model already holds `effects[]`, so a second
 * needs no migration when it is wanted.
 */
function ChoiceStateEditor({ choice, flags, onChange }: ChoiceStateEditorProps) {
    const effect = choice.effects?.[0];
    const condition = choice.condition;

    const setEffect = (next: VNEffect | undefined) =>
        onChange({ effects: next ? [next] : undefined });

    const flagById = (id: string) => flags.find(f => f.id === id);

    if (!flags.length) {
        return (
            <div className={styles.vnChoiceState}>
                <span className={styles.vnStateHint}>
                    Add a Story Flags card to track state.
                </span>
            </div>
        );
    }

    return (
        <div className={styles.vnChoiceState} onMouseDown={e => e.stopPropagation()}>
            <label className={styles.vnStateRow}>
                <span>does</span>
                <select
                    value={effect?.flagId ?? ''}
                    onChange={e => {
                        const flagId = e.target.value;
                        if (!flagId) return setEffect(undefined);
                        const flag = flagById(flagId);
                        setEffect({
                            flagId,
                            op: flag?.kind === 'counter' ? 'add' : 'set',
                            value: flag?.kind === 'counter' ? 1 : undefined,
                        });
                    }}
                >
                    <option value="">nothing</option>
                    {flags.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>

                {effect && flagById(effect.flagId)?.kind === 'bool' && (
                    <select
                        value={effect.op}
                        onChange={e => setEffect({ ...effect, op: e.target.value as VNEffect['op'] })}
                    >
                        <option value="set">on</option>
                        <option value="clear">off</option>
                    </select>
                )}

                {effect && flagById(effect.flagId)?.kind === 'counter' && (
                    <input
                        type="number"
                        className={styles.vnStateNumber}
                        value={effect.value ?? 1}
                        onChange={e => setEffect({ ...effect, op: 'add', value: Number(e.target.value) })}
                    />
                )}
            </label>

            <label className={styles.vnStateRow}>
                <span>needs</span>
                <select
                    value={condition?.flagId ?? ''}
                    onChange={e => {
                        const flagId = e.target.value;
                        if (!flagId) return onChange({ condition: undefined });
                        const flag = flagById(flagId);
                        onChange({
                            condition: {
                                flagId,
                                op: flag?.kind === 'counter' ? 'atLeast' : 'is',
                                value: flag?.kind === 'counter' ? 1 : undefined,
                            },
                        });
                    }}
                >
                    <option value="">nothing</option>
                    {flags.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>

                {condition && flagById(condition.flagId)?.kind === 'bool' && (
                    <select
                        value={condition.op}
                        onChange={e => onChange({ condition: { ...condition, op: e.target.value as VNCondition['op'] } })}
                    >
                        <option value="is">is set</option>
                        <option value="not">is not set</option>
                    </select>
                )}

                {condition && flagById(condition.flagId)?.kind === 'counter' && (
                    <>
                        <select
                            value={condition.op}
                            onChange={e => onChange({ condition: { ...condition, op: e.target.value as VNCondition['op'] } })}
                        >
                            <option value="atLeast">≥</option>
                            <option value="atMost">≤</option>
                        </select>
                        <input
                            type="number"
                            className={styles.vnStateNumber}
                            value={condition.value ?? 1}
                            onChange={e => onChange({ condition: { ...condition, value: Number(e.target.value) } })}
                        />
                    </>
                )}
            </label>
        </div>
    );
}

export function VNBlockRenderer({ content, onChange }: { content: any; onChange: (c: any) => void }) {
    const blockId: string | undefined = content?.blockId;

    const activeProjectId = useWorkspaceStore(s => s.activeProjectId);
    const addDocument = useWorkspaceStore(s => s.addDocument);
    const updateDocument = useWorkspaceStore(s => s.updateDocument);

    const block = useWorkspaceStore(s => s.documents.find(d => d.id === blockId));
    const sceneTitles = useWorkspaceStore(useShallow(s =>
        s.scenes
            .filter(sc => sc.documentId === blockId)
            .sort((a, b) => a.order - b.order)
            .map(sc => sc.title),
    ));
    // Only documents that actually have a card on the branch map count as
    // blocks. A visual novel project also holds ordinary documents — the
    // "Chapter 1" created with the project, for one — and offering those as
    // jump targets produces a choice pointing somewhere the map cannot show,
    // which then silently draws no edge.
    const mappedBlockIds = useWorkspaceStore(useShallow(s =>
        (s.draftStates[activeProjectId ?? '']?.widgets ?? [])
            .filter(w => w.type === 'vnBlock' && w.content?.blockId)
            .map(w => w.content.blockId as string),
    ));

    // Select the stored documents, then reshape outside the selector.
    // useShallow compares array elements with Object.is, so mapping to
    // `{ id, title }` inside it produced fresh objects on every call, made
    // every snapshot look changed, and spun the render loop that crashed the
    // workspace. Selecting the store's own objects keeps identities stable.
    const projectDocs = useWorkspaceStore(useShallow(s =>
        s.documents.filter(d => d.projectId === activeProjectId),
    ));
    const onMap = new Set(mappedBlockIds);
    const blocks = projectDocs
        .filter(d => onMap.has(d.id))
        .map(d => ({ id: d.id, title: d.title }));
    const flags = useWorkspaceStore(useShallow(s =>
        s.projects.find(p => p.id === activeProjectId)?.vnFlags ?? [],
    ));

    // Read through a ref so `content` is not an effect dependency. It is a new
    // object on most renders, and depending on it re-ran the seeding effect.
    const contentRef = useRef(content);
    contentRef.current = content;

    // Fires at most once per mounted card, enforced by a latch rather than by
    // the dependency array. Creating the beat writes to the store, which
    // re-renders this component immediately — but the widget's own content is
    // persisted on a delay, so `blockId` is not visible here on the next pass.
    // Without the latch the effect saw a still-empty blockId and seeded again,
    // spawning documents until React gave up with "maximum update depth".
    const seededRef = useRef(false);

    useEffect(() => {
        if (blockId || seededRef.current || !activeProjectId) return;
        seededRef.current = true;

        const beatId = crypto.randomUUID();
        addDocument({
            id: beatId,
            projectId: activeProjectId,
            title: contentRef.current?.seedTitle || 'New Beat',
            content: '',
            createdAt: new Date(),
        });
        onChange({ ...contentRef.current, blockId: beatId });
    }, [blockId, activeProjectId, addDocument, onChange]);

    if (!block) {
        return (
            <div className={styles.vnBlock}>
                <p className={styles.vnBlockMissing}>Setting up this beat…</p>
            </div>
        );
    }

    const choices = block.choices ?? [];
    const setChoices = (next: VNBlockChoice[]) => updateDocument(block.id, { choices: next });

    const updateChoice = (id: string, patch: Partial<VNBlockChoice>) =>
        setChoices(choices.map(c => (c.id === id ? { ...c, ...patch } : c)));

    const addChoice = () =>
        setChoices([...choices, {
            id: crypto.randomUUID(),
            text: '',
            targetBlockId: blocks.find(b => b.id !== block.id)?.id ?? block.id,
        }]);

    const removeChoice = (id: string) => setChoices(choices.filter(c => c.id !== id));

    /**
     * Wire a choice by dragging onto another block.
     *
     * The drop target is found with elementFromPoint rather than by comparing
     * coordinates: the canvas is panned and zoomed, and asking the browser
     * what sits under the cursor is exact where re-deriving the transform is
     * a reliable source of off-by-a-few-pixels bugs.
     */
    const startConnect = (choiceId: string) => {
        const paint = (x: number, y: number) => {
            const card = (document.elementFromPoint(x, y) as HTMLElement | null)
                ?.closest('[data-vn-block-id]');
            document.querySelectorAll('[data-vn-block-id]').forEach(node =>
                node.classList.toggle(styles.vnBlockDropTarget, node === card));
            return card as HTMLElement | null;
        };

        const onMove = (e: MouseEvent) => { paint(e.clientX, e.clientY); };

        const onUp = (e: MouseEvent) => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);

            const card = paint(e.clientX, e.clientY);
            document.querySelectorAll('[data-vn-block-id]').forEach(node =>
                node.classList.remove(styles.vnBlockDropTarget));

            const targetBlockId = card?.dataset.vnBlockId;
            if (targetBlockId && targetBlockId !== block.id) {
                // Read the choices fresh rather than using the array captured
                // when the drag began. A keystroke in another choice on this
                // same block can commit mid-drag, and writing back the stale
                // snapshot would silently discard it.
                const current = useWorkspaceStore.getState()
                    .documents.find(d => d.id === block.id)?.choices ?? [];
                updateDocument(block.id, {
                    choices: current.map(c =>
                        c.id === choiceId ? { ...c, targetBlockId } : c),
                });
            }
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

    return (
        <div className={styles.vnBlock} data-vn-block-id={block.id}>
            <div className={styles.vnBlockHeader}>
                <input
                    className={styles.vnBlockTitle}
                    value={block.title}
                    onMouseDown={e => e.stopPropagation()}
                    onChange={e => updateDocument(block.id, { title: e.target.value })}
                />
                <div className={styles.vnBlockScenes}>
                    {sceneTitles.length === 0
                        ? 'No scenes yet'
                        : `${sceneTitles.length} scene${sceneTitles.length === 1 ? '' : 's'} · ${sceneTitles.join(' · ')}`}
                </div>
            </div>

            <div className={styles.vnBlockChoices}>
                {choices.length === 0 && (
                    <p className={styles.vnBlockEmpty}>
                        No choices — this beat flows into the next one.
                    </p>
                )}

                {choices.map(choice => (
                    <div key={choice.id} className={styles.vnChoiceRow}>
                        <input
                            className={styles.vnChoiceText}
                            value={choice.text}
                            placeholder="What the player sees"
                            onMouseDown={e => e.stopPropagation()}
                            onChange={e => updateChoice(choice.id, { text: e.target.value })}
                        />

                        <button
                            type="button"
                            className={styles.vnChoiceRemove}
                            onMouseDown={e => e.stopPropagation()}
                            onClick={() => removeChoice(choice.id)}
                            aria-label="Remove choice"
                        >
                            ×
                        </button>

                        <button
                            type="button"
                            className={styles.vnChoiceDot}
                            title="Drag to a block to connect"
                            aria-label="Drag to connect this choice"
                            onMouseDown={e => {
                                e.stopPropagation();
                                e.preventDefault();
                                startConnect(choice.id);
                            }}
                        />

                        <div className={styles.vnChoiceChips}>
                            {(choice.effects ?? []).map((effect, i) => (
                                <span key={i} className={styles.vnChipEffect}>
                                    {describeEffect(effect, flags)}
                                </span>
                            ))}
                            {choice.condition && (
                                <span className={styles.vnChipCondition}>
                                    {describeCondition(choice.condition, flags)}
                                </span>
                            )}
                        </div>

                        <select
                            className={styles.vnChoiceTarget}
                            value={choice.targetBlockId}
                            onMouseDown={e => e.stopPropagation()}
                            onChange={e => updateChoice(choice.id, { targetBlockId: e.target.value })}
                        >
                            {blocks.map(b => (
                                <option key={b.id} value={b.id}>{b.title}</option>
                            ))}
                        </select>

                        <ChoiceStateEditor
                            choice={choice}
                            flags={flags}
                            onChange={patch => updateChoice(choice.id, patch)}
                        />
                    </div>
                ))}

                <button
                    type="button"
                    className={styles.vnAddChoice}
                    onMouseDown={e => e.stopPropagation()}
                    onClick={addChoice}
                >
                    + choice
                </button>
            </div>
        </div>
    );
}
