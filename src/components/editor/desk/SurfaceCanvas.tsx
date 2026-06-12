"use client";

import React, { useRef, useEffect, useCallback } from 'react';
import styles from '../WritingDesk.module.css';
import { useWorkspaceStore } from '@/store/workspaceStore';

// ============================================================
// SURFACE CANVAS (Static grid, synced to pan/zoom)
// ============================================================

const DOT_SPACING = 28;
const DOT_RADIUS = 1.5;
const DOT_COLOR = 'rgba(255, 255, 255, 0.15)';

export const SurfaceCanvas = React.forwardRef<{ redraw: (off: { x: number; y: number }, z: number) => void }, { 
  containerRef: React.RefObject<HTMLDivElement | null>;
  zoom: number;
  offset: { x: number; y: number };
}>(({ containerRef, zoom, offset }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // The fantasy theme uses the wood desk surface, so the grid dots are hidden.
  const isFantasy = useWorkspaceStore((s) => s.themeFamily === 'fantasy');

  const draw = useCallback((currentOffset: { x: number; y: number }, currentZoom: number) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const vw = canvas.width;
    const vh = canvas.height;
    ctx.clearRect(0, 0, vw, vh);

    if (isFantasy) return; // no dot grid on the wood desk

    const scaledSpacing = DOT_SPACING * currentZoom;
    const colStart = Math.floor(-currentOffset.x / scaledSpacing) - 1;
    const colEnd = Math.ceil((vw - currentOffset.x) / scaledSpacing) + 1;
    const rowStart = Math.floor(-currentOffset.y / scaledSpacing) - 1;
    const rowEnd = Math.ceil((vh - currentOffset.y) / scaledSpacing) + 1;

    ctx.fillStyle = DOT_COLOR;
    const radius = DOT_RADIUS * Math.max(0.5, currentZoom);

    for (let r = rowStart; r <= rowEnd; r++) {
      for (let c = colStart; c <= colEnd; c++) {
        const vx = (c * scaledSpacing) + currentOffset.x; 
        const vy = (r * scaledSpacing) + currentOffset.y;
        
        ctx.beginPath(); 
        ctx.arc(vx, vy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [containerRef, isFantasy]);

  React.useImperativeHandle(ref, () => ({
    redraw: (off, z) => draw(off, z),
  }));

  useEffect(() => {
    draw(offset, zoom);
  }, [draw, offset, zoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ro = new ResizeObserver(() => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      draw(offset, zoom);
    });

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    ro.observe(container);
    return () => ro.disconnect();
  }, [containerRef, draw, offset, zoom]);

  return <canvas ref={canvasRef} className={styles.rippleCanvas} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />;
});
