"use client";

import React, { useRef, useState } from 'react';
import { GOAL_MIN, GOAL_MAX, GOAL_STEP, clampGoal } from '@/lib/goalSchedule';
import styles from './GoalRing.module.css';

/**
 * Today's word goal as two concentric rings.
 *
 * The outer ring is read-only progress: words written against today's goal.
 * The inner ring is the control — drag the knob (or arrow-key it) to set the
 * goal itself. It is a 270-degree gauge rather than a full circle so there is
 * no wraparound point where a small drag flips the goal from max to min.
 *
 * Dragging only reports on release, so the store isn't asked to recompute
 * streak history on every pointer move.
 */

const SIZE = 116;
const OUTER_STROKE = 9;
const INNER_STROKE = 6;

/** Degrees from 12 o'clock, clockwise. The gauge opens at the bottom. */
const START_ANGLE = -135;
const SWEEP = 270;

const CX = SIZE / 2;
const CY = SIZE / 2;
const OUTER_R = (SIZE - OUTER_STROKE) / 2;
const INNER_R = OUTER_R - OUTER_STROKE - 9;
const OUTER_C = 2 * Math.PI * OUTER_R;
const INNER_C = 2 * Math.PI * INNER_R;
const ARC_LEN = INNER_C * (SWEEP / 360);

function fractionOf(value: number): number {
    return Math.min(1, Math.max(0, (value - GOAL_MIN) / (GOAL_MAX - GOAL_MIN)));
}

function pointAt(radius: number, angleDeg: number): { x: number; y: number } {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: CX + radius * Math.sin(rad), y: CY - radius * Math.cos(rad) };
}

interface GoalRingProps {
    written: number;
    target: number;
    /** Fired on pointer release or arrow key — not on every move. */
    onCommit: (target: number) => void;
}

export function GoalRing({ written, target, onCommit }: GoalRingProps) {
    const svgRef = useRef<SVGSVGElement>(null);
    const [drag, setDrag] = useState<number | null>(null);
    // Mirrored in a ref: pointerup must read the value the last pointermove set,
    // even when React has not re-rendered between the two events.
    const dragRef = useRef<number | null>(null);

    const setDragValue = (value: number | null) => {
        dragRef.current = value;
        setDrag(value);
    };

    // While dragging, the whole dial previews the goal being chosen.
    const shown = drag ?? target;
    const progress = shown > 0 ? Math.min(1, written / shown) : 0;
    const dialFraction = fractionOf(shown);
    const knob = pointAt(INNER_R, START_ANGLE + dialFraction * SWEEP);

    const valueFromEvent = (e: React.PointerEvent): number => {
        const svg = svgRef.current;
        if (!svg) return shown;
        const rect = svg.getBoundingClientRect();
        if (!rect.width) return shown;
        const scale = SIZE / rect.width;
        const dx = (e.clientX - rect.left) * scale - CX;
        const dy = (e.clientY - rect.top) * scale - CY;
        // atan2(dx, -dy) puts 0 at 12 o'clock and grows clockwise.
        const raw = (Math.atan2(dx, -dy) * 180) / Math.PI;
        // Pointer in the bottom gap snaps to whichever end of the arc is nearer.
        const angle = Math.min(SWEEP / 2, Math.max(-SWEEP / 2, raw));
        const fraction = (angle - START_ANGLE) / SWEEP;
        return clampGoal(GOAL_MIN + fraction * (GOAL_MAX - GOAL_MIN));
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        e.preventDefault();
        // Best-effort: capture keeps the drag alive outside the small dial, but
        // throws for a pointer id the browser no longer considers active.
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        setDragValue(valueFromEvent(e));
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (dragRef.current === null) return;
        setDragValue(valueFromEvent(e));
    };

    const handlePointerUp = () => {
        const value = dragRef.current;
        if (value === null) return;
        setDragValue(null);
        if (value !== target) onCommit(value);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        let next: number | null = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = shown + GOAL_STEP;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = shown - GOAL_STEP;
        else if (e.key === 'PageUp') next = shown + GOAL_STEP * 4;
        else if (e.key === 'PageDown') next = shown - GOAL_STEP * 4;
        else if (e.key === 'Home') next = GOAL_MIN;
        else if (e.key === 'End') next = GOAL_MAX;
        if (next === null) return;
        e.preventDefault();
        const clamped = clampGoal(next);
        if (clamped !== target) onCommit(clamped);
    };

    return (
        <div className={styles.ringWrap}>
            <svg
                ref={svgRef}
                width={SIZE}
                height={SIZE}
                viewBox={`0 0 ${SIZE} ${SIZE}`}
                className={styles.ring}
            >
                {/* Outer ring — progress against the goal */}
                <circle
                    className={styles.progressTrack}
                    cx={CX} cy={CY} r={OUTER_R} fill="none" strokeWidth={OUTER_STROKE}
                />
                <circle
                    className={`${styles.progressFill} ${progress >= 1 ? styles.progressDone : ''}`}
                    cx={CX} cy={CY} r={OUTER_R} fill="none"
                    strokeWidth={OUTER_STROKE} strokeLinecap="round"
                    strokeDasharray={`${OUTER_C * progress} ${OUTER_C * (1 - progress)}`}
                    transform={`rotate(-90 ${CX} ${CY})`}
                />

                {/* Inner ring — the goal dial */}
                <g
                    className={`${styles.dial} ${drag !== null ? styles.dialActive : ''}`}
                    role="slider"
                    tabIndex={0}
                    aria-label="Daily word goal"
                    aria-valuemin={GOAL_MIN}
                    aria-valuemax={GOAL_MAX}
                    aria-valuenow={shown}
                    aria-valuetext={`${shown} words`}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    onKeyDown={handleKeyDown}
                >
                    <circle
                        className={styles.dialTrack}
                        cx={CX} cy={CY} r={INNER_R} fill="none"
                        strokeWidth={INNER_STROKE} strokeLinecap="round"
                        strokeDasharray={`${ARC_LEN} ${INNER_C - ARC_LEN}`}
                        transform={`rotate(${START_ANGLE - 90} ${CX} ${CY})`}
                    />
                    <circle
                        className={styles.dialFill}
                        cx={CX} cy={CY} r={INNER_R} fill="none"
                        strokeWidth={INNER_STROKE} strokeLinecap="round"
                        strokeDasharray={`${ARC_LEN * dialFraction} ${INNER_C - ARC_LEN * dialFraction}`}
                        transform={`rotate(${START_ANGLE - 90} ${CX} ${CY})`}
                    />
                    {/* Invisible, generously thick grab band so the dial is easy to hit */}
                    <circle
                        className={styles.dialHit}
                        cx={CX} cy={CY} r={INNER_R} fill="none"
                        strokeWidth={22}
                        strokeDasharray={`${ARC_LEN} ${INNER_C - ARC_LEN}`}
                        transform={`rotate(${START_ANGLE - 90} ${CX} ${CY})`}
                    />
                    <circle className={styles.dialKnob} cx={knob.x} cy={knob.y} r={6} />
                </g>
            </svg>

            <div className={styles.ringCenter}>
                <span className={styles.ringValue}>{written.toLocaleString()}</span>
                <span className={`${styles.ringTarget} ${drag !== null ? styles.ringTargetLive : ''}`}>
                    of {shown.toLocaleString()}
                </span>
            </div>
        </div>
    );
}
