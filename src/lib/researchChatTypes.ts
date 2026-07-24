/**
 * Research-chat message types — LEAF MODULE (no store or component imports).
 * Shared by the chat panel (renders them), ResearchTab (applies ToolEvents),
 * and the workspace store (persists chat history per scope).
 */

/** An AI action the panel forwards to the tab to apply against the store. */
export type ToolEvent =
    | { type: 'card'; text: string }
    | { type: 'suggest'; name: string; entityType: string; category?: string; reason?: string }
    | { type: 'flag'; kind: 'contradiction' | 'gap'; summary: string; detail?: string }
    | { type: 'understanding'; summary: string; preferences: string }
    | { type: 'save_image'; target: 'board' | 'article'; url: string; label?: string; articleName?: string }
    | {
          type: 'article';
          name: string;
          entityType: string;
          description: string;
          sections: { heading?: string; body: string }[];
          category?: string;
      }
    | { type: 'category'; name: string; icon?: string; parent?: string }
    | { type: 'move'; article: string; category: string }
    | {
          type: 'edit';
          name: string;
          description?: string;
          append_sections?: { heading?: string; body: string }[];
          tags?: string[];
      }
    | { type: 'rename_article'; name: string; new_name: string }
    | { type: 'delete_article'; name: string }
    | { type: 'rename_category'; name: string; new_name: string }
    | { type: 'delete_category'; name: string };

/** A mutating action held for the user to Apply or Discard before it touches the store. */
export interface PendingChange {
    id: string;
    label: string;
    evt: ToolEvent;
    status: 'pending' | 'applied' | 'discarded';
    warning?: string;
}

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    /** Clickable choices the assistant offered (via ask_options). */
    options?: { prompt: string; choices: string[]; chosen?: string };
    /** In-place edits/deletes/renames awaiting the user's Apply/Discard. */
    pending?: PendingChange[];
    /** The user's 👍/👎 on an assistant reply (also sends a quick steer). */
    reaction?: 'up' | 'down';
    /** Images the assistant generated (data URLs), shown inline with save actions. */
    generatedImages?: { prompt: string; url: string }[];
    /** Which backend produced this reply — tints the bubble (Claude vs local). */
    provider?: 'claude' | 'local';
}

/** Cap per persisted conversation so localStorage stays healthy. */
export const CHAT_HISTORY_LIMIT = 60;

/**
 * Shrink chat histories for persistence: cap each conversation's length and
 * drop generated-image data URLs (multi-MB base64 would blow the storage
 * quota). Images already saved to the board or an article live on there.
 */
export function sanitizeChatHistories(
    histories: Record<string, ChatMessage[]>,
): Record<string, ChatMessage[]> {
    const out: Record<string, ChatMessage[]> = {};
    for (const [key, msgs] of Object.entries(histories)) {
        if (!msgs.length) continue;
        out[key] = msgs.slice(-CHAT_HISTORY_LIMIT).map(m => {
            if (!m.generatedImages?.length) return m;
            const note = `\n\n🖼️ (generated ${m.generatedImages.length} image${m.generatedImages.length > 1 ? 's' : ''} — not kept after reload)`;
            return { ...m, generatedImages: undefined, content: m.content + note };
        });
    }
    return out;
}
