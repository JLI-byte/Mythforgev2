/**
 * ComfyUI FLUX.2 workflow builder — LEAF MODULE (no fetch, no fs).
 *
 * Builds the API-format graph for the FLUX.2 Klein text-to-image pipeline that
 * ComfyUI's own template uses: CFGGuider (so a real negative prompt works),
 * Flux2Scheduler, euler. Kept pure so the graph shape can be tested without a
 * running ComfyUI.
 */

export type Orientation = 'square' | 'portrait' | 'landscape';

export interface ComfyImageOptions {
    prompt: string;
    negative: string;
    /** Diffusion model file, e.g. flux-2-klein-base-9b-fp8.safetensors. */
    model: string;
    /** Text encoder file — must match the model family. */
    clip: string;
    vae: string;
    steps: number;
    seed: number;
    orientation?: Orientation;
    filenamePrefix?: string;
}

/**
 * FLUX.2 works in multiples of 16; these are the sizes verified against the
 * local install (1MP-ish, which is what the model was tuned for).
 */
export function dimsFor(orientation: Orientation = 'square'): { width: number; height: number } {
    switch (orientation) {
        case 'portrait': return { width: 832, height: 1216 };
        case 'landscape': return { width: 1216, height: 832 };
        default: return { width: 1024, height: 1024 };
    }
}

/** A random 15-digit seed, matching the range ComfyUI's own UI produces. */
export function randomSeed(): number {
    return Math.floor(Math.random() * 900_000_000_000_000) + 100_000_000_000_000;
}

/** The API-format workflow object to POST to /prompt. */
export function buildFluxWorkflow(opts: ComfyImageOptions): Record<string, unknown> {
    const { width, height } = dimsFor(opts.orientation);
    const steps = Math.max(1, Math.min(60, Math.round(opts.steps) || 20));

    return {
        unet: {
            class_type: 'UNETLoader',
            inputs: { unet_name: opts.model, weight_dtype: 'default' },
        },
        clip: {
            class_type: 'CLIPLoader',
            inputs: { clip_name: opts.clip, type: 'flux2', device: 'default' },
        },
        vae: {
            class_type: 'VAELoader',
            inputs: { vae_name: opts.vae },
        },
        pos: {
            class_type: 'CLIPTextEncode',
            inputs: { text: opts.prompt, clip: ['clip', 0] },
        },
        neg: {
            class_type: 'CLIPTextEncode',
            inputs: { text: opts.negative, clip: ['clip', 0] },
        },
        guider: {
            class_type: 'CFGGuider',
            inputs: { model: ['unet', 0], positive: ['pos', 0], negative: ['neg', 0], cfg: 5 },
        },
        noise: {
            class_type: 'RandomNoise',
            inputs: { noise_seed: opts.seed },
        },
        sampler: {
            class_type: 'KSamplerSelect',
            inputs: { sampler_name: 'euler' },
        },
        sigmas: {
            class_type: 'Flux2Scheduler',
            inputs: { steps, width, height },
        },
        latent: {
            class_type: 'EmptyFlux2LatentImage',
            inputs: { width, height, batch_size: 1 },
        },
        sample: {
            class_type: 'SamplerCustomAdvanced',
            inputs: {
                noise: ['noise', 0],
                guider: ['guider', 0],
                sampler: ['sampler', 0],
                sigmas: ['sigmas', 0],
                latent_image: ['latent', 0],
            },
        },
        decode: {
            class_type: 'VAEDecode',
            inputs: { samples: ['sample', 0], vae: ['vae', 0] },
        },
        save: {
            class_type: 'SaveImage',
            inputs: { filename_prefix: opts.filenamePrefix || 'lorecanvas', images: ['decode', 0] },
        },
    };
}

export interface ComfyImageRef {
    filename: string;
    subfolder: string;
    type: string;
}

/**
 * Pull the first saved image out of a /history entry. ComfyUI nests outputs
 * per node id, and only some nodes produce images.
 */
export function firstImageFromHistory(entry: unknown): ComfyImageRef | null {
    const outputs = (entry as { outputs?: Record<string, { images?: ComfyImageRef[] }> })?.outputs;
    if (!outputs) return null;
    for (const node of Object.values(outputs)) {
        const img = node?.images?.[0];
        if (img?.filename) {
            return {
                filename: img.filename,
                subfolder: img.subfolder ?? '',
                type: img.type ?? 'output',
            };
        }
    }
    return null;
}
