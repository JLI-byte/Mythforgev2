"use client";

import React, { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * ShaderSurface — the animated dot-matrix reveal background.
 *
 * Ported from the 21st.dev "sign-in-flow-1" CanvasRevealEffect (the shader
 * background only — the sign-in form/navbar are intentionally omitted). White
 * dots reveal outward from the centre on mount, then gently twinkle. Replaces
 * the previous DottedSurface. Adapted off Tailwind/`cn`/framer-motion: it wraps
 * the WebGL canvas in the same fixed, transparent, non-interactive layer the
 * old background used (z-index 0, above the page's dark backdrop, below the
 * content), and freezes to a single settled frame under prefers-reduced-motion.
 */

type Uniforms = Record<string, { value: number[] | number[][] | number; type: string }>;

// A time value past which the reveal has fully completed — used to render a
// static, fully-revealed frame when the visitor prefers reduced motion.
const SETTLED_TIME = 5.0;

function DotMatrix({
    colors = [[255, 255, 255]],
    opacities = [0.3, 0.3, 0.3, 0.5, 0.5, 0.5, 0.8, 0.8, 0.8, 1],
    totalSize = 20,
    dotSize = 6,
    reduced,
}: {
    colors?: number[][];
    opacities?: number[];
    totalSize?: number;
    dotSize?: number;
    reduced: boolean;
}) {
    const uniforms = useMemo<Uniforms>(() => {
        let colorsArray = [colors[0], colors[0], colors[0], colors[0], colors[0], colors[0]];
        if (colors.length === 2) {
            colorsArray = [colors[0], colors[0], colors[0], colors[1], colors[1], colors[1]];
        } else if (colors.length === 3) {
            colorsArray = [colors[0], colors[0], colors[1], colors[1], colors[2], colors[2]];
        }
        return {
            u_colors: {
                value: colorsArray.map((color) => [color[0] / 255, color[1] / 255, color[2] / 255]),
                type: "uniform3fv",
            },
            u_opacities: { value: opacities, type: "uniform1fv" },
            u_total_size: { value: totalSize, type: "uniform1f" },
            u_dot_size: { value: dotSize, type: "uniform1f" },
            u_reverse: { value: 0, type: "uniform1i" },
        };
    }, [colors, opacities, totalSize, dotSize]);

    return (
        <ShaderMaterial
            source={`
        precision mediump float;
        in vec2 fragCoord;

        uniform float u_time;
        uniform float u_opacities[10];
        uniform vec3 u_colors[6];
        uniform float u_total_size;
        uniform float u_dot_size;
        uniform vec2 u_resolution;
        uniform int u_reverse;

        out vec4 fragColor;

        float PHI = 1.61803398874989484820459;
        float random(vec2 xy) {
            return fract(tan(distance(xy * PHI, xy) * 0.5) * xy.x);
        }

        void main() {
            vec2 st = fragCoord.xy;
            st.x -= abs(floor((mod(u_resolution.x, u_total_size) - u_dot_size) * 0.5));
            st.y -= abs(floor((mod(u_resolution.y, u_total_size) - u_dot_size) * 0.5));

            float opacity = step(0.0, st.x);
            opacity *= step(0.0, st.y);

            vec2 st2 = vec2(int(st.x / u_total_size), int(st.y / u_total_size));

            float frequency = 5.0;
            float show_offset = random(st2);
            float rand = random(st2 * floor((u_time / frequency) + show_offset + frequency));
            opacity *= u_opacities[int(rand * 10.0)];
            opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.x / u_total_size));
            opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.y / u_total_size));

            vec3 color = u_colors[int(show_offset * 6.0)];

            float animation_speed_factor = 0.5;
            vec2 center_grid = u_resolution / 2.0 / u_total_size;
            float dist_from_center = distance(center_grid, st2);

            float timing_offset_intro = dist_from_center * 0.01 + (random(st2) * 0.15);
            float max_grid_dist = distance(center_grid, vec2(0.0, 0.0));
            float timing_offset_outro = (max_grid_dist - dist_from_center) * 0.02 + (random(st2 + 42.0) * 0.2);

            float current_timing_offset;
            if (u_reverse == 1) {
                current_timing_offset = timing_offset_outro;
                opacity *= 1.0 - step(current_timing_offset, u_time * animation_speed_factor);
                opacity *= clamp((step(current_timing_offset + 0.1, u_time * animation_speed_factor)) * 1.25, 1.0, 1.25);
            } else {
                current_timing_offset = timing_offset_intro;
                opacity *= step(current_timing_offset, u_time * animation_speed_factor);
                opacity *= clamp((1.0 - step(current_timing_offset + 0.1, u_time * animation_speed_factor)) * 1.25, 1.0, 1.25);
            }

            fragColor = vec4(color, opacity);
            fragColor.rgb *= fragColor.a;
        }`}
            uniforms={uniforms}
            reduced={reduced}
        />
    );
}

function ShaderMaterial({
    source,
    uniforms,
    reduced,
}: {
    source: string;
    uniforms: Uniforms;
    reduced: boolean;
}) {
    const { size } = useThree();
    const ref = useRef<THREE.Mesh>(null);

    useFrame(({ clock }) => {
        const mesh = ref.current;
        if (!mesh) return;
        const material = mesh.material as THREE.ShaderMaterial;
        // Freeze at a settled (fully-revealed, non-twinkling) time for reduced motion.
        material.uniforms.u_time.value = reduced ? SETTLED_TIME : clock.getElapsedTime();
    });

    const getUniforms = () => {
        const prepared: Record<string, { value: unknown; type?: string }> = {};
        for (const name in uniforms) {
            const u = uniforms[name];
            switch (u.type) {
                case "uniform1f":
                    prepared[name] = { value: u.value, type: "1f" };
                    break;
                case "uniform1i":
                    prepared[name] = { value: u.value, type: "1i" };
                    break;
                case "uniform1fv":
                    prepared[name] = { value: u.value, type: "1fv" };
                    break;
                case "uniform3fv":
                    prepared[name] = {
                        value: (u.value as number[][]).map((v) => new THREE.Vector3().fromArray(v)),
                        type: "3fv",
                    };
                    break;
                default:
                    break;
            }
        }
        prepared["u_time"] = { value: 0, type: "1f" };
        prepared["u_resolution"] = { value: new THREE.Vector2(size.width * 2, size.height * 2) };
        return prepared;
    };

    const material = useMemo(() => {
        return new THREE.ShaderMaterial({
            vertexShader: `
      precision mediump float;
      in vec2 coordinates;
      uniform vec2 u_resolution;
      out vec2 fragCoord;
      void main(){
        float x = position.x;
        float y = position.y;
        gl_Position = vec4(x, y, 0.0, 1.0);
        fragCoord = (position.xy + vec2(1.0)) * 0.5 * u_resolution;
        fragCoord.y = u_resolution.y - fragCoord.y;
      }
      `,
            fragmentShader: source,
            uniforms: getUniforms() as unknown as { [uniform: string]: THREE.IUniform },
            glslVersion: THREE.GLSL3,
            blending: THREE.CustomBlending,
            blendSrc: THREE.SrcAlphaFactor,
            blendDst: THREE.OneFactor,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [size.width, size.height, source]);

    return (
        <mesh ref={ref}>
            <planeGeometry args={[2, 2]} />
            <primitive object={material} attach="material" />
        </mesh>
    );
}

export default function ShaderSurface() {
    const reduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    return (
        <div
            aria-hidden="true"
            style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}
        >
            <Canvas
                gl={{ alpha: true, antialias: true }}
                frameloop={reduced ? "demand" : "always"}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            >
                <DotMatrix colors={[[255, 255, 255]]} dotSize={6} reduced={reduced} />
            </Canvas>
            {/* Centre vignette keeps the hero legible over the dot field. */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    background:
                        "radial-gradient(circle at center, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.15) 45%, transparent 100%)",
                }}
            />
        </div>
    );
}
