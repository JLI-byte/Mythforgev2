"use client";

/**
 * VNBlockRenderer — one beat on the visual novel branch map.
 *
 * A block is a run of scenes that plays straight through and ends at a
 * decision. The widget holds only `{ blockId }`; the Document it names owns
 * the title and choices, and its Scenes are the beats inside. Nothing about
 * the graph lives on the canvas, so the map cannot drift from the story.
 */

import React, { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useWorkspaceStore } from '@/store/workspaceStore';
import type { VNBlockChoice } from '@/lib/vnBlocks';
import { describeEffect, describeCondition } from '@/lib/vnBlockView';
import styles from '../../WritingDesk.module.css';

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
    const blocks = useWorkspaceStore(useShallow(s =>
        s.documents
            .filter(d => d.projectId === activeProjectId)
            .map(d => ({ id: d.id, title: d.title })),
    ));
    const flags = useWorkspaceStore(useShallow(s =>
        s.projects.find(p => p.id === activeProjectId)?.vnFlags ?? [],
    ));

    // A block dragged from the palette, or seeded by the method library,
    // arrives with no beat behind it. Create one on first render so the card
    // is never orphaned. This is why neither widget-creation path in
    // WritingDesk needs to know about story blocks.
    useEffect(() => {
        if (blockId || !activeProjectId) return;
        const beatId = crypto.randomUUID();
        addDocument({
            id: beatId,
            projectId: activeProjectId,
            title: content?.seedTitle || 'New Beat',
            content: '',
            createdAt: new Date(),
        });
        onChange({ ...content, blockId: beatId });
    }, [blockId, activeProjectId, content, addDocument, onChange]);

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
