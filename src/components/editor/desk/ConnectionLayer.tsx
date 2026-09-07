"use client";

import React from 'react';
import { resolveEndpoint, type Connection } from '@/lib/research/connections';
import type { DeskWidget } from '@/store/workspaceStore';
import styles from './ConnectionLayer.module.css';

interface Props {
    connections: Connection[];
    widgets: DeskWidget[];
    onSelect?: (id: string) => void;
}

/**
 * Lines between cards, drawn under the widgets inside the same transformed
 * layer, so they pan and zoom with the canvas rather than drifting off it.
 */
export function ConnectionLayer({ connections, widgets, onSelect }: Props) {
    if (connections.length === 0) return null;

    return (
        <svg className={styles.layer} aria-hidden="true">
            <defs>
                <marker id="lc-arrow" viewBox="0 0 10 10" refX="9" refY="5"
                        markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M0 0.5 L9.5 5 L0 9.5 z" fill="var(--accent)" />
                </marker>
            </defs>

            {connections.map(c => {
                const a = resolveEndpoint(c.from, widgets);
                const b = resolveEndpoint(c.to, widgets);
                if (!a || !b) return null;   // pruning is async; never draw a half line

                // A quadratic control point offset perpendicular to the run.
                const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
                const dx = b.x - a.x, dy = b.y - a.y;
                const len = Math.hypot(dx, dy) || 1;
                const cx = mx + (-dy / len) * c.curve;
                const cy = my + (dx / len) * c.curve;

                return (
                    <g key={c.id} onClick={() => onSelect?.(c.id)}>
                        <path
                            className={styles.line}
                            d={`M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`}
                            stroke={c.color ?? 'var(--accent)'}
                            markerEnd={c.arrow === 'none' ? undefined : 'url(#lc-arrow)'}
                            markerStart={c.arrow === 'both' ? 'url(#lc-arrow)' : undefined}
                        />
                        {c.label && (
                            <text className={styles.label} x={cx} y={cy - 6} textAnchor="middle">
                                {c.label}
                            </text>
                        )}
                    </g>
                );
            })}
        </svg>
    );
}
