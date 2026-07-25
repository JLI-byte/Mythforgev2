/**
 * ComfyUI client — SERVER SIDE. Submits a workflow, waits for the render, and
 * returns the finished image as a data URL so it can ride the same NDJSON
 * `generated_image` event the OpenRouter path uses.
 *
 * Local rendering is slow by design (FLUX.2 dev streams weights from system
 * RAM on a 24GB card), so the poll budget is generous and the failure messages
 * say which stage gave up.
 */
import {
    buildFluxWorkflow,
    firstImageFromHistory,
    randomSeed,
    type Orientation,
} from './comfyWorkflow';

const POLL_INTERVAL_MS = 1500;
const DEFAULT_TIMEOUT_MS = 6 * 60 * 1000; // a cold FLUX.2 load can take minutes

export interface ComfyGenerateOptions {
    baseUrl: string;
    prompt: string;
    negative: string;
    model: string;
    clip: string;
    vae: string;
    steps: number;
    orientation?: Orientation;
    timeoutMs?: number;
}

export type ComfyResult =
    | { ok: true; dataUrl: string }
    | { ok: false; error: string };

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** Trim a trailing slash so URL joins stay predictable. */
function origin(baseUrl: string): string {
    return baseUrl.replace(/\/+$/, '');
}

/**
 * Render one image. Resolves with a data URL, or an `ok: false` result carrying
 * a message meant to be shown to the user as-is.
 */
export async function generateWithComfyUI(opts: ComfyGenerateOptions): Promise<ComfyResult> {
    const base = origin(opts.baseUrl);
    const workflow = buildFluxWorkflow({
        prompt: opts.prompt,
        negative: opts.negative,
        model: opts.model,
        clip: opts.clip,
        vae: opts.vae,
        steps: opts.steps,
        seed: randomSeed(),
        orientation: opts.orientation,
        filenamePrefix: 'lorecanvas',
    });

    // 1. Queue the prompt.
    let promptId: string;
    try {
        const resp = await fetch(`${base}/prompt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: workflow }),
            signal: AbortSignal.timeout(15_000),
        });
        if (!resp.ok) {
            const detail = await resp.text().catch(() => '');
            // ComfyUI returns 400 with a node_errors object when a model file is missing.
            return { ok: false, error: `ComfyUI rejected the workflow (HTTP ${resp.status}). ${detail.slice(0, 300)}` };
        }
        const json = (await resp.json()) as { prompt_id?: string };
        if (!json?.prompt_id) return { ok: false, error: 'ComfyUI accepted the request but returned no prompt id.' };
        promptId = json.prompt_id;
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown error';
        return { ok: false, error: `Could not reach ComfyUI at ${base}: ${msg}. Is it running?` };
    }

    // 2. Poll history until the image appears.
    const deadline = Date.now() + (opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    let image: ReturnType<typeof firstImageFromHistory> = null;
    while (Date.now() < deadline) {
        await delay(POLL_INTERVAL_MS);
        try {
            const resp = await fetch(`${base}/history/${promptId}`, {
                cache: 'no-store',
                signal: AbortSignal.timeout(10_000),
            });
            if (!resp.ok) continue;
            const hist = (await resp.json()) as Record<string, unknown>;
            const entry = hist?.[promptId];
            if (!entry) continue;

            image = firstImageFromHistory(entry);
            if (image) break;

            // Finished without producing an image — surface ComfyUI's own reason.
            const status = (entry as { status?: { status_str?: string; messages?: unknown[] } }).status;
            if (status?.status_str === 'error') {
                return { ok: false, error: 'ComfyUI reported an error while rendering. Check its console for the failing node.' };
            }
        } catch {
            // Transient poll failure — keep waiting until the deadline.
        }
    }

    if (!image) {
        return { ok: false, error: 'Timed out waiting for ComfyUI to finish rendering.' };
    }

    // 3. Fetch the PNG and inline it.
    try {
        const params = new URLSearchParams({
            filename: image.filename,
            subfolder: image.subfolder,
            type: image.type,
        });
        const resp = await fetch(`${base}/view?${params}`, { signal: AbortSignal.timeout(60_000) });
        if (!resp.ok) return { ok: false, error: `Could not download the rendered image (HTTP ${resp.status}).` };
        const buf = Buffer.from(await resp.arrayBuffer());
        const mime = resp.headers.get('content-type') || 'image/png';
        return { ok: true, dataUrl: `data:${mime};base64,${buf.toString('base64')}` };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown error';
        return { ok: false, error: `Rendered, but the image could not be downloaded: ${msg}` };
    }
}
