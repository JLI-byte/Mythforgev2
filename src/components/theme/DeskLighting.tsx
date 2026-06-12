"use client";

import { useEffect, useRef } from "react";
import { useWorkspaceStore } from "@/store/workspaceStore";

/**
 * DeskLighting — an SVG lighting shader that multiplies over the wood desk.
 *
 * Technique (after alvov's "SVG lighting shader"): blur the wood, convert its
 * luminance to an alpha height-field (bump map), and light that bump map with a
 * movable point light via feDiffuseLighting. The result is the *light only*; it
 * is then `mix-blend-mode: multiply`-ed over the sharp wood that globals.css
 * paints behind it, so the grain catches the light without the filter ever
 * touching the (full-res) wood pixels.
 *
 * Performance: the filter is the expensive part, so the SVG is laid out tiny
 * (~1/5 viewport) and scaled up by the compositor — the filter rasterises at a
 * fraction of the pixels (the reference used a ~450px texture too) and the soft
 * light upscales invisibly. The point light tracks the cursor 1:1 via the SVG's
 * own CTM; only the candle flicker runs on a rAF loop. Fantasy theme only.
 */
export default function DeskLighting() {
    const themeFamily = useWorkspaceStore((s) => s.themeFamily);

    const svgRef = useRef<SVGSVGElement>(null);
    const lightRef = useRef<SVGFEPointLightElement>(null);
    const diffuseRef = useRef<SVGFEDiffuseLightingElement>(null);

    // Low-res filter space (keeps the lighting computation cheap).
    const VB_W = 500;
    const VB_H = 340;

    useEffect(() => {
        if (themeFamily !== "fantasy") return;

        // Map a viewport pixel straight into filter user-space via the SVG's own
        // CTM — exact regardless of the CSS scale / viewBox / slice.
        const setLightPos = (clientX: number, clientY: number) => {
            const svg = svgRef.current;
            const light = lightRef.current;
            if (!svg || !light) return;
            const ctm = svg.getScreenCTM();
            if (!ctm) return;
            const p = svg.createSVGPoint();
            p.x = clientX;
            p.y = clientY;
            const u = p.matrixTransform(ctm.inverse());
            light.setAttribute("x", u.x.toFixed(1));
            light.setAttribute("y", u.y.toFixed(1));
        };

        // Position is event-driven for instant 1:1 tracking — no easing/throttle.
        const onMove = (e: MouseEvent) => setLightPos(e.clientX, e.clientY);
        window.addEventListener("mousemove", onMove, { passive: true });

        // rAF loop ONLY drives candle flicker (z + intensity), written on change
        // so light mode stays idle when the cursor is still.
        let raf = 0;
        let t = 0;
        let last = 0;
        let prevZ = "";
        let prevI = "";
        let prevColor = "";
        const FRAME_MS = 1000 / 30;

        const loop = (now: number) => {
            raf = requestAnimationFrame(loop);
            if (now - last < FRAME_MS) return;
            last = now;
            t += 1;

            const isDark =
                document.documentElement.getAttribute("data-theme") === "dark";

            // Candle sits low & tight; sun sits higher & broad (viewBox units).
            let z = isDark ? 26 : 64;
            let intensity = isDark ? 1.15 : 1.0;
            if (isDark) {
                const f =
                    Math.sin(t * 0.55) * 0.5 +
                    Math.sin(t * 0.91 + 1) * 0.3 +
                    Math.sin(t * 1.9 + 2) * 0.2;
                z += f * 4;
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
            ref={svgRef}
            aria-hidden="true"
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            preserveAspectRatio="xMidYMid slice"
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "20vw",
                height: "20vh",
                transform: "scale(5)",
                transformOrigin: "top left",
                zIndex: -1,
                pointerEvents: "none",
                mixBlendMode: "multiply",
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
                {/* Output is the LIGHT only (no composite with the wood) — the
                    wood comes from the CSS layer below via multiply blend. */}
                <filter
                    id="deskLightFilter"
                    x="0"
                    y="0"
                    width="100%"
                    height="100%"
                >
                    <feGaussianBlur
                        in="SourceGraphic"
                        stdDeviation="0.8"
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
                        surfaceScale="2.2"
                        diffuseConstant="1.1"
                        lightingColor="#ff9234"
                    >
                        <fePointLight ref={lightRef} x="250" y="110" z="26" />
                    </feDiffuseLighting>
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
