"use client";

import { useEffect, useRef } from "react";
import { useWorkspaceStore } from "@/store/workspaceStore";

/**
 * DeskLighting — a WebGL point-light shader multiplied over the wood desk.
 *
 * Same lighting model as SVG feDiffuseLighting (the CodePen reference), but on
 * the GPU: the fragment shader derives a bump normal from the wood's luminance
 * gradient and lights it with a point light at the cursor. The canvas outputs
 * the LIGHT only and is `mix-blend-mode: multiply`-ed over the sharp CSS wood
 * layer, so the grain catches the light.
 *
 * Why WebGL: Chromium rasterises SVG filters on the CPU at final screen scale,
 * so the previous version re-ran a ~2.5M-pixel feDiffuseLighting on every mouse
 * move — the source of the periodic stutter. This shader is trivial for any
 * GPU (integrated included). The canvas renders at half resolution (soft light
 * upscales invisibly) and draws only when something changed: cursor moves, the
 * candle flickers (dark mode, ~30fps), or theme/resize. Light mode with a still
 * cursor draws nothing.
 *
 * Fallbacks: no WebGL → transparent canvas, the static CSS wood still shows.
 * prefers-reduced-motion → no flicker. Hidden tab → loop paused.
 */
export default function DeskLighting() {
    const themeFamily = useWorkspaceStore((s) => s.themeFamily);
    const workspaceMode = useWorkspaceStore((s) => s.workspaceMode);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    // The wood desk + candle belongs to the Writing Desk ('desk') only.
    const active = themeFamily === "fantasy" && workspaceMode === "desk";

    useEffect(() => {
        if (!active) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const gl = canvas.getContext("webgl", {
            alpha: true,
            antialias: false,
            depth: false,
            stencil: false,
            powerPreference: "low-power",
        });
        if (!gl) return; // CSS wood remains as the static fallback

        // Half-resolution render target — the light is soft, so the compositor
        // upscale is invisible and the fill cost drops 4x.
        const RES = 0.5;
        // Wood tile size in CSS px — MUST match globals.css background-size so the
        // light's grain highlights line up with the visible (CSS-tiled) wood.
        const TILE_CSS_PX = 820;

        const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

        // Mirrors feDiffuseLighting: N from the height-field gradient,
        // out = lightColor * diffuseConstant * max(N.L, 0).
        const FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uWood;
uniform vec2 uTileUv;
uniform vec2 uTexel;
uniform vec3 uLight;
uniform vec2 uCanvas;
uniform vec3 uColor;
uniform vec3 uAmbient;
uniform float uIntensity;
uniform float uBump;

float lum(vec2 uv) {
  vec3 c = texture2D(uWood, uv).rgb;
  return dot(c, vec3(0.299, 0.587, 0.114));
}

void main() {
  // Tiled UVs (texture wrap is REPEAT) — matches the CSS-tiled wood scale.
  vec2 uv = vUv * uTileUv;
  vec2 st = uTexel * 3.0;
  float hl = lum(uv - vec2(st.x, 0.0));
  float hr = lum(uv + vec2(st.x, 0.0));
  float hd = lum(uv - vec2(0.0, st.y));
  float hu = lum(uv + vec2(0.0, st.y));
  vec3 n = normalize(vec3((hl - hr) * uBump, (hd - hu) * uBump, 1.0));
  vec3 L = normalize(uLight - vec3(vUv * uCanvas, 0.0));
  float diff = max(dot(n, L), 0.0);
  // Ambient floor keeps the desk readable away from the light — without it,
  // dark mode multiplies to near-black whenever the cursor is idle/off-window.
  gl_FragColor = vec4(min(uAmbient + uColor * diff * uIntensity, vec3(1.0)), 1.0);
}`;

        const compile = (type: number, src: string) => {
            const sh = gl.createShader(type);
            if (!sh) return null;
            gl.shaderSource(sh, src);
            gl.compileShader(sh);
            if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
                gl.deleteShader(sh);
                return null;
            }
            return sh;
        };
        const vs = compile(gl.VERTEX_SHADER, VERT);
        const fs = compile(gl.FRAGMENT_SHADER, FRAG);
        if (!vs || !fs) return;
        const prog = gl.createProgram();
        if (!prog) return;
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
        gl.useProgram(prog);

        // Fullscreen triangle pair
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([-1, -1, 3, -1, -1, 3]),
            gl.STATIC_DRAW,
        );
        const aPos = gl.getAttribLocation(prog, "aPos");
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        const U = (name: string) => gl.getUniformLocation(prog, name);
        const uTileUv = U("uTileUv");
        const uTexel = U("uTexel");
        const uLight = U("uLight");
        const uCanvas = U("uCanvas");
        const uColor = U("uColor");
        const uAmbient = U("uAmbient");
        const uIntensity = U("uIntensity");
        const uBump = U("uBump");

        // ---- mutable render state -------------------------------------------
        let texReady = false;
        let texW = 1536;
        let texH = 1024;
        let W = 1;
        let H = 1; // canvas pixel size
        let dirty = true;
        let isDark =
            document.documentElement.getAttribute("data-theme") === "dark";
        const mouse = { x: 0.5, y: 0.35 }; // viewport fraction
        const reducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
        ).matches;

        const resize = () => {
            W = Math.max(1, Math.floor(window.innerWidth * RES));
            H = Math.max(1, Math.floor(window.innerHeight * RES));
            canvas.width = W;
            canvas.height = H;
            gl.viewport(0, 0, W, H);
            // Tiled mapping (must match CSS background-size). Tile in canvas px
            // = TILE_CSS_PX * RES; tiles-across = canvas / tilePx.
            const tilePx = TILE_CSS_PX * RES;
            gl.uniform2f(uTileUv, W / tilePx, H / tilePx);
            gl.uniform2f(uTexel, 1 / texW, 1 / texH);
            gl.uniform2f(uCanvas, W, H);
            dirty = true;
        };

        // Wood texture (NPOT: clamp + linear, no mips)
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        // REPEAT wrap for tiling (desk.webp is 1024² power-of-two, WebGL1-safe).
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        const img = new Image();
        img.src = "/textures/desk.webp";
        img.decode()
            .then(() => {
                texW = img.naturalWidth;
                texH = img.naturalHeight;
                gl.bindTexture(gl.TEXTURE_2D, tex);
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
                gl.texImage2D(
                    gl.TEXTURE_2D,
                    0,
                    gl.RGB,
                    gl.RGB,
                    gl.UNSIGNED_BYTE,
                    img,
                );
                texReady = true;
                resize();
            })
            .catch(() => {
                /* keep canvas transparent; CSS wood shows */
            });

        resize();
        gl.uniform1f(uBump, 4.5);

        const onMove = (e: MouseEvent) => {
            mouse.x = e.clientX / window.innerWidth;
            mouse.y = e.clientY / window.innerHeight;
            dirty = true;
        };
        window.addEventListener("mousemove", onMove, { passive: true });
        window.addEventListener("resize", resize);

        const themeObserver = new MutationObserver(() => {
            isDark =
                document.documentElement.getAttribute("data-theme") === "dark";
            dirty = true;
        });
        themeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["data-theme"],
        });

        // ---- draw loop: draws ONLY when dirty or (dark && flicker tick) -----
        let raf = 0;
        let t = 0;
        let lastFlicker = 0;
        const FLICKER_MS = 1000 / 30;

        const draw = (now: number) => {
            raf = requestAnimationFrame(draw);
            if (!texReady) return;

            const flickerDue =
                isDark && !reducedMotion && now - lastFlicker >= FLICKER_MS;
            if (!dirty && !flickerDue) return;
            if (flickerDue) {
                lastFlicker = now;
                t += 1;
            }
            dirty = false;

            // Candle sits low and tight; sun high and broad (fractions of width).
            let z = (isDark ? 0.052 : 0.3) * W;
            let intensity = isDark ? 1.15 : 1.25;
            if (isDark && !reducedMotion) {
                const f =
                    Math.sin(t * 0.55) * 0.5 +
                    Math.sin(t * 0.91 + 1) * 0.3 +
                    Math.sin(t * 1.9 + 2) * 0.2;
                z += f * 0.008 * W;
                intensity += f * 0.14;
            }

            gl.uniform3f(
                uLight,
                mouse.x * W,
                (1 - mouse.y) * H, // GL y is bottom-up
                z,
            );
            gl.uniform1f(uIntensity, intensity);
            if (isDark) {
                gl.uniform3f(uColor, 1.0, 0.573, 0.204); // #ff9234 candle
                gl.uniform3f(uAmbient, 0.34, 0.29, 0.23); // warm ember floor
            } else {
                gl.uniform3f(uColor, 1.0, 0.945, 0.769); // #fff1c4 sun
                gl.uniform3f(uAmbient, 0.2, 0.19, 0.17); // soft daylight floor
            }
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        };
        raf = requestAnimationFrame(draw);

        const onVisibility = () => {
            cancelAnimationFrame(raf);
            if (document.visibilityState === "visible") {
                dirty = true;
                raf = requestAnimationFrame(draw);
            }
        };
        document.addEventListener("visibilitychange", onVisibility);

        const onContextLost = (e: Event) => e.preventDefault();
        canvas.addEventListener("webglcontextlost", onContextLost);

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("resize", resize);
            document.removeEventListener("visibilitychange", onVisibility);
            canvas.removeEventListener("webglcontextlost", onContextLost);
            themeObserver.disconnect();
        };
    }, [active]);

    if (!active) return null;

    return (
        <canvas
            ref={canvasRef}
            aria-hidden="true"
            style={{
                position: "fixed",
                inset: 0,
                width: "100vw",
                height: "100vh",
                zIndex: -1,
                pointerEvents: "none",
                mixBlendMode: "multiply",
            }}
        />
    );
}
