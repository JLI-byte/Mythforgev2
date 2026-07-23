"use client";

import React, { useEffect, useRef, useState } from 'react';
import styles from '../WritingDesk.module.css';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

/** An AI action the panel forwards to the tab to apply against the store. */
export type ToolEvent =
    | { type: 'card'; text: string }
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

interface ResearchChatPanelProps {
    /** null when no project is active — add-to-board is then disabled. */
    scopeKey: string | null;
    /** Reads the current board + world structure as text at send time. */
    getContext: () => { board: string; world: string };
    /** Apply an AI action to the store. Returns a warning string when the action
     *  could not be applied (e.g. an unresolved name), so the chat can say so. */
    onToolEvent: (event: ToolEvent) => string | void;
}

export function ResearchChatPanel({ scopeKey, getContext, onToolEvent }: ResearchChatPanelProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const abortRef = useRef<AbortController | null>(null);

    // Abort any in-flight request if the panel unmounts (e.g. switching tabs
    // mid-stream) so the fetch and its subprocess don't keep running.
    useEffect(() => () => abortRef.current?.abort(), []);

    const scrollToBottom = () => {
        requestAnimationFrame(() => {
            const el = scrollRef.current;
            if (el) el.scrollTop = el.scrollHeight;
        });
    };

    const send = async () => {
        const text = input.trim();
        if (!text || isStreaming) return;

        const outgoing: ChatMessage[] = [...messages, { role: 'user', content: text }];
        setMessages([...outgoing, { role: 'assistant', content: '' }]);
        setInput('');
        setIsStreaming(true);
        scrollToBottom();

        const appendToAssistant = (chunk: string) => {
            setMessages(prev => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last && last.role === 'assistant') {
                    // Separate an error note from any already-streamed text, but don't
                    // leave a leading blank line when the reply is still empty.
                    const sep = chunk.startsWith('\n') && !last.content ? chunk.replace(/^\n+/, '') : chunk;
                    next[next.length - 1] = { ...last, content: last.content + sep };
                }
                return next;
            });
            scrollToBottom();
        };

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            const res = await fetch('/api/research-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: outgoing, ...getContext() }),
                signal: controller.signal,
            });
            if (!res.ok || !res.body) {
                const info = await res.json().catch(() => ({ error: 'Request failed' }));
                appendToAssistant(`[${info.error ?? 'Request failed'}]`);
                return;
            }
            // Response is newline-delimited JSON: a {type:'text',text} chunk, or a
            // tool event ({type:'card'|'article'|'category'|'move', ...}).
            const handleEvent = (line: string) => {
                const trimmed = line.trim();
                if (!trimmed) return;
                let evt: { type?: string; text?: string };
                try {
                    evt = JSON.parse(trimmed);
                } catch {
                    return; // ignore malformed line
                }
                if (evt.type === 'text' && typeof evt.text === 'string') {
                    appendToAssistant(evt.text);
                } else if (evt.type) {
                    // A tool event succeeded or returned a warning the model can't
                    // know (name resolution happens client-side) — surface it.
                    const warning = onToolEvent(evt as ToolEvent);
                    if (warning) appendToAssistant(`\n\n⚠️ ${warning}`);
                }
            };

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                let nl: number;
                while ((nl = buffer.indexOf('\n')) >= 0) {
                    handleEvent(buffer.slice(0, nl));
                    buffer = buffer.slice(nl + 1);
                }
            }
            if (buffer) handleEvent(buffer);
        } catch (err) {
            if (controller.signal.aborted) return; // cancelled by unmount — no error note
            const detail = err instanceof Error ? err.message : 'network error';
            appendToAssistant(`\n\n[Chat failed: ${detail}]`);
        } finally {
            if (abortRef.current === controller) abortRef.current = null;
            setIsStreaming(false);
        }
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    };

    return (
        <div className={styles.researchChat}>
            <div className={styles.researchChatHeader}>Research Assistant</div>

            <div className={styles.researchChatScroll} ref={scrollRef}>
                {messages.length === 0 && (
                    <div className={styles.researchChatEmpty}>
                        Ask about your research board, or anything else.
                    </div>
                )}
                {messages.map((m, i) => (
                    <div
                        key={i}
                        className={`${styles.researchChatMsg} ${m.role === 'user' ? styles.researchChatMsgUser : styles.researchChatMsgAssistant}`}
                    >
                        <div className={styles.researchChatMsgBody}>{m.content}</div>
                        {m.role === 'assistant' && m.content.trim() && (
                            <button
                                className={styles.researchChatAddBtn}
                                disabled={!scopeKey}
                                title={scopeKey ? 'Add this reply to the board as a note' : 'Select a project first'}
                                onClick={() => onToolEvent({ type: 'card', text: m.content })}
                            >
                                + Add to board
                            </button>
                        )}
                    </div>
                ))}
            </div>

            <div className={styles.researchChatInputRow}>
                <textarea
                    className={styles.researchChatInput}
                    placeholder="Message the research assistant…"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    rows={2}
                />
                <button className={styles.researchChatSendBtn} onClick={send} disabled={isStreaming || !input.trim()}>
                    {isStreaming ? '…' : 'Send'}
                </button>
            </div>
        </div>
    );
}
