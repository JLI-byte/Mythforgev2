import { describe, it, expect } from 'vitest';
import {
    dimsFor,
    randomSeed,
    buildFluxWorkflow,
    firstImageFromHistory,
    type ComfyImageOptions,
} from './comfyWorkflow';

const base: ComfyImageOptions = {
    prompt: 'a harbour at dawn',
    negative: 'plastic skin',
    model: 'flux-2-klein-base-9b-fp8.safetensors',
    clip: 'qwen_3_8b_fp8mixed.safetensors',
    vae: 'flux2-vae.safetensors',
    steps: 20,
    seed: 123456789,
};

describe('dimsFor', () => {
    it('returns a square by default', () => {
        expect(dimsFor()).toEqual({ width: 1024, height: 1024 });
        expect(dimsFor('square')).toEqual({ width: 1024, height: 1024 });
    });

    it('returns taller-than-wide for portrait and the reverse for landscape', () => {
        const p = dimsFor('portrait');
        const l = dimsFor('landscape');
        expect(p.height).toBeGreaterThan(p.width);
        expect(l.width).toBeGreaterThan(l.height);
    });

    it('keeps every dimension a multiple of 16 (FLUX requirement)', () => {
        for (const o of ['square', 'portrait', 'landscape'] as const) {
            const { width, height } = dimsFor(o);
            expect(width % 16).toBe(0);
            expect(height % 16).toBe(0);
        }
    });
});

describe('randomSeed', () => {
    it('stays inside a 15-digit range', () => {
        for (let i = 0; i < 50; i++) {
            const s = randomSeed();
            expect(s).toBeGreaterThanOrEqual(100_000_000_000_000);
            expect(s).toBeLessThan(1_000_000_000_000_000);
            expect(Number.isInteger(s)).toBe(true);
        }
    });
});

describe('buildFluxWorkflow', () => {
    it('wires the prompts, model files and seed into the graph', () => {
        const wf = buildFluxWorkflow(base) as Record<string, { inputs: Record<string, unknown> }>;
        expect(wf.pos.inputs.text).toBe('a harbour at dawn');
        expect(wf.neg.inputs.text).toBe('plastic skin');
        expect(wf.unet.inputs.unet_name).toBe(base.model);
        expect(wf.clip.inputs.clip_name).toBe(base.clip);
        expect(wf.vae.inputs.vae_name).toBe(base.vae);
        expect(wf.noise.inputs.noise_seed).toBe(123456789);
    });

    it('keeps the scheduler and latent dimensions in sync', () => {
        const wf = buildFluxWorkflow({ ...base, orientation: 'portrait' }) as Record<string, { inputs: Record<string, unknown> }>;
        expect(wf.sigmas.inputs.width).toBe(wf.latent.inputs.width);
        expect(wf.sigmas.inputs.height).toBe(wf.latent.inputs.height);
        expect(wf.latent.inputs.height).toBe(1216);
    });

    it('clamps nonsense step counts into a usable range', () => {
        const low = buildFluxWorkflow({ ...base, steps: 0 }) as Record<string, { inputs: Record<string, number> }>;
        const high = buildFluxWorkflow({ ...base, steps: 999 }) as Record<string, { inputs: Record<string, number> }>;
        expect(low.sigmas.inputs.steps).toBe(20);   // 0 falls back to the default
        expect(high.sigmas.inputs.steps).toBe(60);  // capped
    });

    it('uses the CFGGuider so the negative prompt is actually applied', () => {
        const wf = buildFluxWorkflow(base) as Record<string, { class_type: string; inputs: Record<string, unknown> }>;
        expect(wf.guider.class_type).toBe('CFGGuider');
        expect(wf.guider.inputs.negative).toEqual(['neg', 0]);
    });

    it('produces a graph whose every node reference resolves', () => {
        const wf = buildFluxWorkflow(base) as Record<string, { inputs: Record<string, unknown> }>;
        const ids = new Set(Object.keys(wf));
        for (const node of Object.values(wf)) {
            for (const value of Object.values(node.inputs)) {
                if (Array.isArray(value) && typeof value[0] === 'string') {
                    expect(ids.has(value[0] as string)).toBe(true);
                }
            }
        }
    });
});

describe('firstImageFromHistory', () => {
    it('finds the image regardless of which node produced it', () => {
        const entry = {
            outputs: {
                '3': { latents: [] },
                'save': { images: [{ filename: 'a_00001_.png', subfolder: '', type: 'output' }] },
            },
        };
        expect(firstImageFromHistory(entry)).toEqual({
            filename: 'a_00001_.png', subfolder: '', type: 'output',
        });
    });

    it('defaults a missing subfolder and type', () => {
        const entry = { outputs: { save: { images: [{ filename: 'x.png' }] } } };
        expect(firstImageFromHistory(entry)).toEqual({
            filename: 'x.png', subfolder: '', type: 'output',
        });
    });

    it('returns null when there is no image yet', () => {
        expect(firstImageFromHistory(undefined)).toBeNull();
        expect(firstImageFromHistory({})).toBeNull();
        expect(firstImageFromHistory({ outputs: { save: {} } })).toBeNull();
    });
});
