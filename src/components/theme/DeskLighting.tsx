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

    // viewBox units the filter computes in.
    const VB_W = 1000;
    const VB_H = 640;

    useEffect(() => {
        if (themeFamily !== "fantasy") return;

        // Map a viewport pixel to filter user-space, inverting the SVG's
        // "xMidYMid slice" so the light sits exactly under the cursor.
        const setLightPos = (clientX: number, clientY: number) => {
            if (!lightRef.current) return;
            const W = window.innerWidth;
            const H = window.innerHeight;
            const scale = Math.max(W / VB_W, H / VB_H);
            const ux = (clientX - (W - VB_W * scale) / 2) / scale;
            const uy = (clientY - (H - VB_H * scale) / 2) / scale;
            lightRef.current.setAttribute("x", ux.toFixed(1));
            lightRef.current.setAttribute("y", uy.toFixed(1));
        };

        // Position is event-driven for instant 1:1 tracking — no easing, no throttle.
        const onMove = (e: MouseEvent) => setLightPos(e.clientX, e.clientY);
        window.addEventListener("mousemove", onMove, { passive: true });

        // The rAF loop ONLY drives the candle flicker (z + intensity + colour).
        // It writes attributes only when they change, so light mode stays idle
        // (no needless full-screen filter recompute) until the cursor moves.
        let raf = 0;
        let t = 0;
        let last = 0;
        let prevZ = "";
        let prevI = "";
        let prevColor = "";
        const FRAME_MS = 1000 / 40;

        const loop = (now: number) => {
            raf = requestAnimationFrame(loop);
            if (now - last < FRAME_MS) return;
            last = now;
            t += 1;

            const isDark =
                document.documentElement.getAttribute("data-theme") === "dark";

            let z = isDark ? 50 : 120;
            let intensity = isDark ? 1.2 : 1.0;
            if (isDark) {
                // Layered sines = irregular candle flicker.
                const f =
                    Math.sin(t * 0.55) * 0.5 +
                    Math.sin(t * 0.91 + 1) * 0.3 +
                    Math.sin(t * 1.9 + 2) * 0.2;
                z += f * 7;
                intensity += f * 0.14;
            }

            const zStr = z.toFixed(1);
            const iStr = intensity.toFixed(3);
            const color = isDark ? "#ff9234" : "#fff1c4";
            if (lightRef.current && zStr !== prevZ) {
                lightRef.current.setAttribute("z", zStr);
                prevZ = zStr;
            }
            if (diffuseRef.current && iStr !== prevI) {
                diffuseRef.current.setAttribute("diffuseConstant", iStr);
                prevI = iStr;
            }
            if (diffuseRef.current && color !== prevColor) {
                diffuseRef.current.setAttribute("lighting-color", color);
                prevColor = color;
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
