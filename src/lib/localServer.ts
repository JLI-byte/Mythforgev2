/**
 * Local model server auto-launch — SERVER ONLY (uses node:child_process).
 *
 * When the research chat is in local mode and the Ollama server isn't up, the
 * route calls ensureOllama() to start it (`ollama serve`), wait for it to bind,
 * then continue. Only ever launches for a localhost base URL, and only the
 * configured command — never something a request supplies.
 */
import { spawn } from 'node:child_process';

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** The origin (scheme + host + port) of a base URL, or null if unparseable. */
function safeOrigin(base: string): string | null {
    try {
        return new URL(base).origin;
    } catch {
        return null;
    }
}

function isLocalOrigin(origin: string): boolean {
    try {
        const host = new URL(origin).hostname;
        return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0';
    } catch {
        return false;
    }
}

/** True if the server answers at its root within the timeout. */
async function pingUp(origin: string, timeoutMs = 1500): Promise<boolean> {
    try {
        const r = await fetch(`${origin}/`, { signal: AbortSignal.timeout(timeoutMs) });
        return r.ok;
    } catch {
        return false;
    }
}

/** Fire-and-forget launch of the configured command (detached, no I/O). */
function launch(cmd: string): void {
    const child = spawn(cmd, { shell: true, detached: true, stdio: 'ignore', windowsHide: true });
    child.unref();
}

export type OllamaStatus = 'up' | 'launched' | 'failed';

/**
 * Ensure the local Ollama server is reachable, starting it if needed.
 * - 'up': it was already running.
 * - 'launched': it was down; we started it and it came up.
 * - 'failed': not localhost, auto-launch disabled, or it didn't come up in time.
 *
 * `onLaunching` fires once, right before we spawn the server, so the caller can
 * tell the user we're starting it.
 */
export async function ensureOllama(base: string, onLaunching?: () => void): Promise<OllamaStatus> {
    const origin = safeOrigin(base);
    if (!origin) return 'failed';
    if (await pingUp(origin)) return 'up';

    // Only ever auto-start a server on this machine, and only if not opted out.
    if (!isLocalOrigin(origin)) return 'failed';
    if (process.env.OLLAMA_AUTOLAUNCH === '0' || process.env.OLLAMA_AUTOLAUNCH === 'false') return 'failed';

    onLaunching?.();
    const cmd = process.env.OLLAMA_LAUNCH_CMD || 'ollama serve';
    try {
        launch(cmd);
    } catch {
        return 'failed';
    }

    // Poll for it to bind — a cold start takes a few seconds.
    for (let i = 0; i < 15; i++) {
        await delay(1000);
        if (await pingUp(origin)) return 'launched';
    }
    return 'failed';
}
