"use client";

import React, { useEffect, useRef } from 'react';
import styles from './welcome.module.css';

/**
 * Hero background: drifting particles linked by lines that fade with
 * distance. Ported from dudleystorey's "Dynamic Point Mesh Animation"
 * (codepen.io/dudleystorey/pen/NbNjjX), tinted to the brand violet.
 * Skipped entirely under prefers-reduced-motion.
 */

const OPTS = {
    particleColor: 'rgba(220, 210, 255, 0.9)',
    lineRGB: '190, 150, 255',
    particleAmount: 40,
    defaultSpeed: 0.6,
    variantSpeed: 0.6,
    defaultRadius: 1.5,
    variantRadius: 1.5,
    linkRadius: 180,
};

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    r: number;
}

export default function HeroMesh() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        let w = 0;
        let h = 0;
        let raf = 0;
        let tid = 0;
        let particles: Particle[] = [];

        const resize = () => {
            const rect = canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            w = rect.width;
            h = rect.height;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };

        const seed = () => {
            particles = Array.from({ length: OPTS.particleAmount }, () => {
                const angle = Math.random() * Math.PI * 2;
                const speed = OPTS.defaultSpeed + Math.random() * OPTS.variantSpeed;
                return {
                    x: Math.random() * w,
                    y: Math.random() * h,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    r: OPTS.defaultRadius + Math.random() * OPTS.variantRadius,
                };
            });
        };

        const step = () => {
            raf = requestAnimationFrame(step);
            ctx.clearRect(0, 0, w, h);

            for (const p of particles) {
                p.x += p.vx;
                p.y += p.vy;
                if (p.x <= 0 || p.x >= w) p.vx *= -1;
                if (p.y <= 0 || p.y >= h) p.vy *= -1;
                p.x = Math.min(w, Math.max(0, p.x));
                p.y = Math.min(h, Math.max(0, p.y));

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = OPTS.particleColor;
                ctx.fill();
            }

            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const a = particles[i];
                    const b = particles[j];
                    const opacity = 1 - Math.hypot(b.x - a.x, b.y - a.y) / OPTS.linkRadius;
                    if (opacity > 0) {
                        ctx.lineWidth = 0.5;
                        ctx.strokeStyle = `rgba(${OPTS.lineRGB}, ${opacity})`;
                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                        ctx.stroke();
                    }
                }
            }
        };

        const onResize = () => {
            clearTimeout(tid);
            tid = window.setTimeout(resize, 200);
        };

        resize();
        seed();
        step();
        window.addEventListener('resize', onResize);

        return () => {
            cancelAnimationFrame(raf);
            clearTimeout(tid);
            window.removeEventListener('resize', onResize);
        };
    }, []);

    return <canvas ref={canvasRef} className={styles.heroCanvas} aria-hidden="true" />;
}
