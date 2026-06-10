"use client";

import React, { useRef, useEffect, useCallback } from 'react';
import styles from '../ArticleGridEditor.module.css';

// ============================================================
// GRID CANVAS — Static dot background
// ============================================================

const DOT_SPACING = 28;
const DOT_RADIUS = 1.5;
const DOT_COLOR = 'rgba(255, 255, 255, 0.15)';

export function StaticGridCanvas({ containerRef, opacity = 1 }: { containerRef: React.RefObject<HTMLDivElement | null>, opacity?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = container.clientWidth;
    const h = container.clientHeight;
    canvas.width = w;
    canvas.height = h;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.15 * opacity})`;

    const cols = Math.ceil(w / DOT_SPACING) + 1;
    const rows = Math.ceil(h / DOT_SPACING) + 1;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * DOT_SPACING;
        const y = r * DOT_SPACING;
        ctx.beginPath();
        ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver(draw);
    ro.observe(container);

    draw();
    return () => ro.disconnect();
  }, [containerRef, draw]);

  return (
    <canvas
      ref={canvasRef}
      className={styles.gridCanvas}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}
