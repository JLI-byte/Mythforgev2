"use client";

import React, { useCallback, useEffect, useRef } from 'react';
import styles from './DrawingRenderer.module.css';

interface Props {
    content: { strokes?: number[][] };
    onChange: (c: Record<string, unknown>) => void;
}

const LINE_WIDTH = 2;
/** Two numbers make a point; a stroke needs two points to be a line. */
const MIN_STROKE_LENGTH = 4;

const EMPTY: number[][] = [];

/**
 * A margin sketch — a coastline, an arrow between two ideas, a floor plan.
 *
 * Strokes are stored as flat [x0,y0,x1,y1,...] arrays, never as a data URL: a
 * PNG of a full-card sketch runs to hundreds of kilobytes and the workspace
 * has a size limit, while the same drawing as points costs a few hundred bytes
 * and stays diffable.
 */
export function DrawingRenderer({ content, onChange }: Props) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const strokesRef = useRef<number[][]>(content.strokes ?? EMPTY);
    /** The stroke under the pointer, held outside React so a drag is not a render per point. */
    const draftRef = useRef<number[] | null>(null);

    const redraw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        // Back the canvas at device resolution, or the ink looks soft.
        const dpr = window.devicePixelRatio || 1;
        const width = Math.round(rect.width * dpr);
        const height = Math.round(rect.height * dpr);
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const computed = getComputedStyle(canvas);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, rect.width, rect.height);
        // Read the ink colour at draw time so the sketch follows the theme.
        ctx.strokeStyle = computed.getPropertyValue('--foreground').trim() || computed.color;
        ctx.lineWidth = LINE_WIDTH;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const draft = draftRef.current;
        const all = draft ? [...strokesRef.current, draft] : strokesRef.current;
        for (const stroke of all) {
            if (stroke.length < MIN_STROKE_LENGTH) continue;
            ctx.beginPath();
            ctx.moveTo(stroke[0], stroke[1]);
            for (let i = 2; i < stroke.length - 1; i += 2) {
                ctx.lineTo(stroke[i], stroke[i + 1]);
            }
            ctx.stroke();
        }
    }, []);

    // Only re-seed from props when they carry something this card did not
    // just push. onChange is debounced, so without the guard a second stroke
    // drawn inside that window would be built from the stale list and the
    // first would vanish.
    const lastPushed = useRef(content.strokes);
    useEffect(() => {
        if (content.strokes !== lastPushed.current) {
            strokesRef.current = content.strokes ?? EMPTY;
            lastPushed.current = content.strokes;
        }
        redraw();
    }, [content.strokes, redraw]);

    useEffect(() => {
        const parent = canvasRef.current?.parentElement;
        if (!parent) return;
        const observer = new ResizeObserver(() => redraw());
        observer.observe(parent);
        return () => observer.disconnect();
    }, [redraw]);

    const pointAt = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
        const rect = e.currentTarget.getBoundingClientRect();
        return [e.clientX - rect.left, e.clientY - rect.top];
    };

    const handleDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const [x, y] = pointAt(e);
        draftRef.current = [x, y];
    };

    const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const draft = draftRef.current;
        if (!draft) return;
        const [x, y] = pointAt(e);
        draftRef.current = [...draft, x, y];
        redraw();
    };

    const handleUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const draft = draftRef.current;
        draftRef.current = null;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
        if (!draft || draft.length < MIN_STROKE_LENGTH) {
            redraw();
            return;
        }
        const next = [...strokesRef.current, draft];
        strokesRef.current = next;
        lastPushed.current = next;
        onChange({ ...content, strokes: next });
    };

    return (
        <div className={styles.card}>
            <div className={styles.surface}>
                <canvas
                    ref={canvasRef}
                    className={styles.canvas}
                    onPointerDown={handleDown}
                    onPointerMove={handleMove}
                    onPointerUp={handleUp}
                    onPointerCancel={handleUp}
                />
            </div>
            <footer className={styles.foot}>
                <button
                    className={styles.clear}
                    aria-label="Clear drawing"
                    onClick={() => {
                        strokesRef.current = EMPTY;
                        lastPushed.current = EMPTY;
                        onChange({ ...content, strokes: [] });
                    }}
                >
                    Clear
                </button>
            </footer>
        </div>
    );
}
