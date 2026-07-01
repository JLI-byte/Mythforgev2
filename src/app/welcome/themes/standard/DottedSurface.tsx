"use client";

import { useEffect, useRef } from "react";

/**
 * DottedSurface — a lightweight animated dot field for the standard landing.
 *
 * A grid of dots on a 2D canvas; a travelling sine wave modulates each dot's
 * vertical offset and opacity so the field drifts like a slow swell. No
 * three.js. Fixed dark palette. Pauses when the tab is hidden and renders a
 * single static frame under prefers-reduced-motion. DPR is capped and dot
 * density is fixed by GAP, so fill cost stays low on large/ultrawide screens.
 */
export default function DottedSurface() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const GAP = 28;            // px between dots
        const DOT_RADIUS = 1.4;    // px
        const WAVE_SPEED = 0.0006; // radians per ms
        const WAVE_LENGTH = 0.004; // radians per px
        const AMPLITUDE = 10;      // px vertical drift
        const DOT_COLOR = "236, 233, 226"; // faint warm-neutral

        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        let cols = 0;
        let rows = 0;
        let width = 0;
        let height = 0;

        const resize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            canvas.style.width = width + "px";
            canvas.style.height = height + "px";
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            cols = Math.ceil(width / GAP) + 1;
            rows = Math.ceil(height / GAP) + 1;
        };

        const render = (time: number) => {
            ctx.clearRect(0, 0, width, height);
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const x = c * GAP;
                    const baseY = r * GAP;
                    const phase = (x + baseY) * WAVE_LENGTH + time * WAVE_SPEED;
                    const wave = Math.sin(phase);
                    const y = baseY + wave * AMPLITUDE;
                    const alpha = 0.1 + (wave * 0.5 + 0.5) * 0.35;
                    ctx.fillStyle = `rgba(${DOT_COLOR}, ${alpha})`;
                    ctx.beginPath();
                    ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        };

        const reduced = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
        ).matches;
        let raf = 0;

        const loop = (t: number) => {
            render(t);
            raf = requestAnimationFrame(loop);
        };

        const start = () => {
            if (reduced) {
                render(0);
                return;
            }
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(loop);
        };

        const onResize = () => {
            resize();
            if (reduced) render(0);
        };
        const onVisibility = () => {
            if (document.visibilityState === "hidden") {
                cancelAnimationFrame(raf);
            } else {
                start();
            }
        };

        resize();
        start();
        window.addEventListener("resize", onResize);
        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", onResize);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            aria-hidden="true"
            style={{
                position: "fixed",
                inset: 0,
                width: "100vw",
                height: "100vh",
                zIndex: 0,
                pointerEvents: "none",
                background: "#0a0a0b",
            }}
        />
    );
}
