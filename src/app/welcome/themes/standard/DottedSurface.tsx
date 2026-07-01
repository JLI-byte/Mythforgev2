"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * DottedSurface — the three.js particle-wave background (21st.dev "dotted-surface").
 *
 * A 40×60 grid of points rendered in 3D perspective; each point's height is
 * driven by two crossing sine waves so the field rolls like water. Ported from
 * the 21st.dev registry component, with next-themes/Tailwind removed: the
 * standard landing is always dark, so the point palette is fixed and the layer
 * uses inline styles at z-index 0 (above the page's solid background, below the
 * content). The WebGL canvas is transparent — the dark backdrop comes from the
 * page behind it. Pauses on hidden tab and renders a single static frame under
 * prefers-reduced-motion.
 */
export default function DottedSurface() {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const SEPARATION = 150;
        const AMOUNTX = 40;
        const AMOUNTY = 60;

        const scene = new THREE.Scene();
        scene.fog = new THREE.Fog(0xffffff, 2000, 10000);

        const camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            1,
            10000,
        );
        camera.position.set(0, 355, 1220);

        const renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: true,
        });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor(0x000000, 0);
        container.appendChild(renderer.domElement);

        const geometry = new THREE.BufferGeometry();
        const positions: number[] = [];
        const colors: number[] = [];

        for (let ix = 0; ix < AMOUNTX; ix++) {
            for (let iy = 0; iy < AMOUNTY; iy++) {
                const x = ix * SEPARATION - (AMOUNTX * SEPARATION) / 2;
                const y = 0; // animated per frame
                const z = iy * SEPARATION - (AMOUNTY * SEPARATION) / 2;
                positions.push(x, y, z);
                colors.push(200, 200, 200);
            }
        }

        geometry.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(positions, 3),
        );
        geometry.setAttribute(
            "color",
            new THREE.Float32BufferAttribute(colors, 3),
        );

        const material = new THREE.PointsMaterial({
            size: 8,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            sizeAttenuation: true,
        });

        const points = new THREE.Points(geometry, material);
        scene.add(points);

        let count = 0;
        let animationId = 0;

        const renderWave = () => {
            const positionAttribute = geometry.attributes.position;
            const arr = positionAttribute.array as Float32Array;
            let i = 0;
            for (let ix = 0; ix < AMOUNTX; ix++) {
                for (let iy = 0; iy < AMOUNTY; iy++) {
                    const index = i * 3;
                    arr[index + 1] =
                        Math.sin((ix + count) * 0.3) * 50 +
                        Math.sin((iy + count) * 0.5) * 50;
                    i++;
                }
            }
            positionAttribute.needsUpdate = true;
            renderer.render(scene, camera);
            count += 0.1;
        };

        const reduced = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
        ).matches;

        const animate = () => {
            animationId = requestAnimationFrame(animate);
            renderWave();
        };

        const start = () => {
            if (reduced) {
                renderWave();
                return;
            }
            cancelAnimationFrame(animationId);
            animationId = requestAnimationFrame(animate);
        };

        const handleResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            if (reduced) renderWave();
        };

        const onVisibility = () => {
            if (document.visibilityState === "hidden") {
                cancelAnimationFrame(animationId);
            } else {
                start();
            }
        };

        start();
        window.addEventListener("resize", handleResize);
        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            cancelAnimationFrame(animationId);
            window.removeEventListener("resize", handleResize);
            document.removeEventListener("visibilitychange", onVisibility);
            geometry.dispose();
            material.dispose();
            renderer.dispose();
            if (renderer.domElement.parentNode === container) {
                container.removeChild(renderer.domElement);
            }
        };
    }, []);

    return (
        <div
            ref={containerRef}
            aria-hidden="true"
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 0,
                pointerEvents: "none",
            }}
        />
    );
}
