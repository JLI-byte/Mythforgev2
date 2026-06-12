"use client";

import { useEffect, useRef } from "react";
import { useWorkspaceStore } from "@/store/workspaceStore";

/**
 * DeskLighting — an SVG lighting shader over the fantasy wood desk.
 *
 * Technique (after alvov's "SVG lighting shader"): blur the wood image, convert
 * its luminance to an alpha height-field (bump map), light that bump map with a
 * movable point light via feDiffuseLighting, then multiply the lit result back
 * over the wood. The grain physically catches the light.
 *
 * The point light eases toward the cursor with a slow idle drift. The light
 * COLOUR and reach switch by mode: a tight warm candle (dark) vs a broad golden
 * sun (light). Only renders for the fantasy theme family.
 */
export default function DeskLighting() {
    const themeFamily = useWorkspaceStore((s) => s.themeFamily);

    const lightRef = useRef<SVGFEPointLightElement>(null);
    const diffuseRef = useRef<SVGFEDiffuseLightingElement>(null);
    // Normalised 0..1 light position (target = where it wants to be, pos = eased).
    const target = useRef({ x: 0.5, y: 0.3 });
    const pos = useRef({ x: 0.5, y: 0.3 });

    // viewBox units the filter computes in.
    const VB_W = 1000;
    const VB_H = 640;

    useEffect(() => {
        if (themeFamily !== "fantasy") return;

        const onMove = (e: MouseEvent) => {
            target.current.x = e.clientX / window.innerWidth;
            target.current.y = e.clientY / window.innerHeight;
        };
        window.addEventListener("mousemove", onMove, { passive: true });

        let raf = 0;
        let t = 0;
        let last = 0;
        const FRAME_MS = 1000 / 30; // throttle the filter recompute to ~30fps

        const loop = (now: number) => {
            raf = requestAnimationFrame(loop);
            if (now - last < FRAME_MS) return;
            last = now;
            t += 1;

            const isDark =
                document.documentElement.getAttribute("data-theme") === "dark";

            // Ease the light toward the cursor.
            pos.current.x += (target.current.x - pos.current.x) * 0.06;
            pos.current.y += (target.current.y - pos.current.y) * 0.06;

            // Slow autonomous drift so it feels alive even when the mouse is still.
            const driftX = Math.sin(t * 0.012) * 0.035;
            const driftY = Math.cos(t * 0.0094) * 0.028;

            // Mode-specific light: candle sits low & tight, sun sits high & broad.
            let z = isDark ? 52 : 115;
            let intensity = isDark ? 1.2 : 0.98;

            if (isDark) {
                // Layered sines = irregular candle flicker.
                const f =
                    Math.sin(t * 0.55) * 0.5 +
                    Math.sin(t * 0.91 + 1) * 0.3 +
                    Math.sin(t * 1.9 + 2) * 0.2;
                z += f * 7;
                intensity += f * 0.14;
            } else {
                intensity += Math.sin(t * 0.03) * 0.05; // gentle sun breathe
            }

            const lx = (pos.current.x + driftX) * VB_W;
            const ly = (pos.current.y + driftY) * VB_H;

            if (lightRef.current) {
                lightRef.current.setAttribute("x", lx.toFixed(1));
                lightRef.current.setAttribute("y", ly.toFixed(1));
                lightRef.current.setAttribute("z", z.toFixed(1));
            }
            if (diffuseRef.current) {
                diffuseRef.current.setAttribute(
                    "diffuseConstant",
                    intensity.toFixed(3),
                );
                diffuseRef.current.setAttribute(
                    "lighting-color",
                    isDark ? "#ff9234" : "#fff1c4",
                );
            }
        };
        raf = requestAnimationFrame(loop);

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("mousemove", onMove);
        };
    }, [themeFamily]);

    if (themeFamily !== "fantasy") return null;

    return (
        <svg
            aria-hidden="true"
            width="100%"
            height="100%"
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            preserveAspectRatio="xMidYMid slice"
            style={{
                position: "fixed",
                inset: 0,
                zIndex: -1,
                pointerEvents: "none",
            }}
        >
            <defs>
                <pattern
                    id="deskWoodPattern"
                    width={VB_W}
                    height={VB_H}
                    patternUnits="userSpaceOnUse"
                >
                    <image
                        href="/textures/desk.webp"
                        width={VB_W}
                        height={VB_H}
                        preserveAspectRatio="xMidYMid slice"
                    />
                </pattern>
                <filter
                    id="deskLightFilter"
                    x="0"
                    y="0"
                    width="100%"
                    height="100%"
                >
                    <feGaussianBlur
                        in="SourceGraphic"
                        stdDeviation="1.4"
                        result="blurred"
                    />
                    <feColorMatrix
                        in="blurred"
                        type="luminanceToAlpha"
                        result="bumpMap"
                    />
                    <feDiffuseLighting
                        ref={diffuseRef}
                        in="bumpMap"
                        surfaceScale="3.2"
                        diffuseConstant="1.1"
                        lightingColor="#ff9234"
                        result="light"
                    >
                        <fePointLight ref={lightRef} x="500" y="190" z="52" />
                    </feDiffuseLighting>
                    <feComposite
                        in="light"
                        in2="SourceGraphic"
                        operator="arithmetic"
                        k1="1"
                        k2="0"
                        k3="0"
                        k4="0"
                    />
                </filter>
            </defs>
            <rect
                width={VB_W}
                height={VB_H}
                fill="url(#deskWoodPattern)"
                filter="url(#deskLightFilter)"
            />
        </svg>
    );
}
