"use client";

/**
 * VNEdgeLayer — the curves between story blocks on a branch map.
 *
 * Rendered INSIDE the canvas's transformed div, so widget x/y are already the
 * right coordinate space and no conversion is needed. Edges are derived from
 * each block's choices every render and never stored: a connection is a
 * projection of the data, and storing it would create a second source of
 * truth that can disagree with the first.
 */

import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useWorkspaceStore, type DeskWidget } from '@/store/workspaceStore';
import styles from '../../WritingDesk.module.css';

/**
 * The SVG is anchored well up and left of the canvas origin so curves between
 * blocks at negative coordinates are not clipped. Path points are shifted by
 * the same amount to compensate.
 */
const ORIGIN = 4000;

export function VNEdgeLayer({ widgets }: { widgets: DeskWidget[] }) {
    const activeProjectId = useWorkspaceStore(s => s.activeProjectId);
    // Selected as stored documents, not reshaped inside the selector.
    // useShallow compares elements with Object.is, so mapping to a new object
    // per document makes every snapshot look changed and spins the render
    // loop. Reshaping after selection keeps the identities stable.
    const blockDocs = useWorkspaceStore(useShallow(s =>
        s.documents.filter(d => d.projectId === activeProjectId && d.choices?.length),
    ));
    const blocks = blockDocs.map(d => ({ id: d.id, choices: d.choices ?? [] }));

    const blockWidgets = widgets.filter(w => w.type === 'vnBlock' && w.content?.blockId);
    if (!blockWidgets.length || !blocks.length) return null;

    // Block id → its card. A block with no card on this canvas simply has no
    // edge drawn; that is not an error.
    const cardFor = new Map(blockWidgets.map(w => [w.content.blockId as string, w]));

    const edges: { key: string; d: string }[] = [];

    for (const block of blocks) {
        const from = cardFor.get(block.id);
        if (!from) continue;

        block.choices.forEach((choice, i) => {
            const to = cardFor.get(choice.targetBlockId);
            if (!to || to.id === from.id) return;

            // Leave the source's right edge, arrive at the target's left.
            const x1 = from.x + from.width + ORIGIN;
            const y1 = from.y + 70 + i * 26 + ORIGIN;
            const x2 = to.x + ORIGIN;
            const y2 = to.y + 40 + ORIGIN;
            const bend = Math.max(40, Math.abs(x2 - x1) / 2);

            edges.push({
                key: `${block.id}-${choice.id}`,
                d: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`,
            });
        });
    }

    if (!edges.length) return null;

    return (
        <svg className={styles.vnEdgeLayer} aria-hidden="true">
            <defs>
                <marker id="vn-arrow" viewBox="0 0 10 10" refX="9" refY="5"
                        markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" className={styles.vnEdgeArrow} />
                </marker>
            </defs>
            {edges.map(edge => (
                <path key={edge.key} d={edge.d} className={styles.vnEdgePath}
                      markerEnd="url(#vn-arrow)" />
            ))}
        </svg>
    );
}
