"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { worldKeyForProject, worldKeyForEntity } from '@/lib/worldKey';
import {
    BUILTIN_INTERVIEWS,
    makeBlankInterview,
    interviewLaunchLine,
    renderInterviewGuide,
    type Interview,
} from '@/lib/interviews';
import { InterviewMenu } from './InterviewMenu';
import { InterviewEditorModal } from './InterviewEditorModal';
import styles from '../WritingDesk.module.css';

/** A mutating action held for the user to Apply or Discard before it touches the store. */
interface PendingChange {
    id: string;
    label: string;
    evt: ToolEvent;
    status: 'pending' | 'applied' | 'discarded';
    warning?: string;
}

// Minimal typing for the Web Speech API (absent from some TS DOM lib configs).
interface SpeechRecognitionLike {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
    onend: (() => void) | null;
    onerror: (() => void) | null;
    start: () => void;
    stop: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;
interface WindowWithSpeech extends Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
}

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    /** Clickable choices the assistant offered (via ask_options). */
    options?: { prompt: string; choices: string[]; chosen?: string };
    /** In-place edits/deletes/renames awaiting the user's Apply/Discard. */
    pending?: PendingChange[];
    /** The user's 👍/👎 on an assistant reply (also sends a quick steer). */
    reaction?: 'up' | 'down';
}

/** Event types held for preview instead of applied immediately (mutating-in-place). */
const PREVIEW_TYPES = new Set(['edit', 'delete_article', 'delete_category', 'rename_article', 'rename_category', 'move']);

/** A short human description of a pending change, for the preview card. */
function describeChange(evt: ToolEvent): string {
    switch (evt.type) {
        case 'edit': {
            const bits: string[] = [];
            if (typeof evt.description === 'string') bits.push('new description');
            if (evt.append_sections?.length) bits.push(`+${evt.append_sections.length} section${evt.append_sections.length > 1 ? 's' : ''}`);
            if (evt.tags?.length) bits.push(`+${evt.tags.length} tag${evt.tags.length > 1 ? 's' : ''}`);
            return `Edit “${evt.name}”${bits.length ? ` — ${bits.join(', ')}` : ''}`;
        }
        case 'delete_article': return `Delete article “${evt.name}”`;
        case 'delete_category': return `Delete folder “${evt.name}”`;
        case 'rename_article': return `Rename “${evt.name}” → “${evt.new_name}”`;
        case 'rename_category': return `Rename folder “${evt.name}” → “${evt.new_name}”`;
        case 'move': return `Move “${evt.article}” → “${evt.category}”`;
        default: return 'Apply change';
    }
}

/**
 * Render assistant text with existing World Bible entity names turned into
 * clickable chips that open the article. Longest names match first so
 * "Salt Guild" wins over "Guild". Falls back to plain text when nothing matches.
 */
function renderWithEntityChips(
    text: string,
    entities: { id: string; name: string }[],
    onOpen: (id: string) => void,
    chipClass: string,
): React.ReactNode {
    if (!entities.length || !text) return text;
    const sorted = [...entities].filter(e => e.name.trim()).sort((a, b) => b.name.length - a.name.length);
    if (!sorted.length) return text;
    const byLower = new Map(sorted.map(e => [e.name.toLowerCase(), e.id]));
    const escaped = sorted.map(e => e.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const re = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');

    const out: React.ReactNode[] = [];
    let last = 0;
    let key = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        if (m.index > last) out.push(text.slice(last, m.index));
        const id = byLower.get(m[0].toLowerCase());
        if (id) {
            out.push(
                <button key={`chip-${key++}`} className={chipClass} onClick={() => onOpen(id)} title="Open article">
                    {m[0]}
                </button>,
            );
        } else {
            out.push(m[0]);
        }
        last = m.index + m[0].length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
}

/** An AI action the panel forwards to the tab to apply against the store. */
export type ToolEvent =
    | { type: 'card'; text: string }
    | { type: 'suggest'; name: string; entityType: string; category?: string; reason?: string }
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
    // The active interview's rendered guide ('' when none). Once an interview is
    // launched it rides every turn so the guide keeps reaching the model until
    // the subject is built.
    const [interviewGuide, setInterviewGuide] = useState('');
    // Editor modal: the interview being edited, and the id it updates on save
    // (null → adding a new custom interview).
    const [editorDraft, setEditorDraft] = useState<Interview | null>(null);
    const [editorExistingId, setEditorExistingId] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const abortRef = useRef<AbortController | null>(null);
    // Voice dictation via the browser Speech Recognition API (Chromium/Opera GX).
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const [isListening, setIsListening] = useState(false);
    const voiceSupported = typeof window !== 'undefined'
        && Boolean((window as WindowWithSpeech).SpeechRecognition || (window as WindowWithSpeech).webkitSpeechRecognition);

    const customInterviews = useWorkspaceStore(s => s.customInterviews);
    const addInterview = useWorkspaceStore(s => s.addInterview);
    const updateInterview = useWorkspaceStore(s => s.updateInterview);
    const deleteInterview = useWorkspaceStore(s => s.deleteInterview);
    const allInterviews: Interview[] = [...BUILTIN_INTERVIEWS, ...customInterviews];

    // Entity names the assistant can reference as clickable chips, scoped to the
    // active project's world. Clicking a chip opens that article's detail panel.
    const entities = useWorkspaceStore(s => s.entities);
    const activeProject = useWorkspaceStore(s => s.projects.find(p => p.id === s.activeProjectId) ?? null);
    const setSelectedEntity = useWorkspaceStore(s => s.setSelectedEntity);

    // An object the user attached ("Ask about this" / dragged-in passage) that
    // rides the next message as focused context, then clears.
    const chatAttachment = useWorkspaceStore(s => s.chatAttachment);
    const setChatAttachment = useWorkspaceStore(s => s.setChatAttachment);
    const [dragOver, setDragOver] = useState(false);

    // An image the user attached for the assistant to look at (base64 + a data
    // URL for the local thumbnail). Rides the next message, then clears.
    const [imageAttach, setImageAttach] = useState<{ mediaType: string; data: string; url: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const onImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // allow re-picking the same file
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = () => {
            const url = String(reader.result);
            const comma = url.indexOf(',');
            if (comma < 0) return;
            setImageAttach({ mediaType: file.type, data: url.slice(comma + 1), url });
        };
        reader.readAsDataURL(file);
    };
    const chipEntities = useMemo(() => {
        const worldKey = worldKeyForProject(activeProject);
        return entities
            .filter(e => worldKeyForEntity(e) === worldKey)
            .map(e => ({ id: e.id, name: e.name }));
    }, [entities, activeProject]);

    // Abort any in-flight request if the panel unmounts (e.g. switching tabs
    // mid-stream) so the fetch and its subprocess don't keep running.
    useEffect(() => () => {
        abortRef.current?.abort();
        recognitionRef.current?.stop();
    }, []);

    // Toggle voice dictation: recognized speech streams into the input box.
    const toggleVoice = () => {
        if (isListening) { recognitionRef.current?.stop(); return; }
        const Ctor = (window as WindowWithSpeech).SpeechRecognition || (window as WindowWithSpeech).webkitSpeechRecognition;
        if (!Ctor) return;
        const rec = new Ctor();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'en-US';
        const base = input ? `${input} ` : '';
        rec.onresult = (e) => {
            let transcript = '';
            for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
            setInput(base + transcript);
        };
        rec.onend = () => { setIsListening(false); recognitionRef.current = null; };
        rec.onerror = () => { setIsListening(false); recognitionRef.current = null; };
        recognitionRef.current = rec;
        setIsListening(true);
        rec.start();
    };

    const scrollToBottom = () => {
        requestAnimationFrame(() => {
            const el = scrollRef.current;
            if (el) el.scrollTop = el.scrollHeight;
        });
    };

    const send = async (explicitText?: string, forceGuide?: string) => {
        const text = (explicitText ?? input).trim();
        const img = imageAttach;
        if ((!text && !img) || isStreaming) return;

        // Consume any attached context/image for this one message, then clear.
        const attach = chatAttachment;
        if (attach) setChatAttachment(null);
        if (img) setImageAttach(null);

        const messageText = text || 'What do you see in this image, and how might it fit my world?';
        const outgoing: ChatMessage[] = [...messages, { role: 'user', content: img ? `🖼️ ${messageText}` : messageText }];
        setMessages([...outgoing, { role: 'assistant', content: '' }]);
        if (explicitText === undefined) setInput('');
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

        const attachOptions = (prompt: string, choices: string[]) => {
            setMessages(prev => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last && last.role === 'assistant') {
                    next[next.length - 1] = { ...last, options: { prompt, choices } };
                }
                return next;
            });
            scrollToBottom();
        };

        const attachPending = (evt: ToolEvent) => {
            const change: PendingChange = { id: crypto.randomUUID(), label: describeChange(evt), evt, status: 'pending' };
            setMessages(prev => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last && last.role === 'assistant') {
                    next[next.length - 1] = { ...last, pending: [...(last.pending ?? []), change] };
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
                body: JSON.stringify({
                    messages: outgoing,
                    ...getContext(),
                    interviewGuide: forceGuide ?? interviewGuide,
                    attachment: attach ? { label: attach.label, content: attach.content } : undefined,
                    image: img ? { mediaType: img.mediaType, data: img.data } : undefined,
                }),
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
                let evt: { type?: string; text?: string; prompt?: string; options?: string[] };
                try {
                    evt = JSON.parse(trimmed);
                } catch {
                    return; // ignore malformed line
                }
                if (evt.type === 'text' && typeof evt.text === 'string') {
                    appendToAssistant(evt.text);
                } else if (evt.type === 'options' && Array.isArray(evt.options)) {
                    // Attach clickable choices to the current assistant message.
                    attachOptions(evt.prompt ?? '', evt.options);
                } else if (evt.type && PREVIEW_TYPES.has(evt.type)) {
                    // A mutating-in-place action — hold it for the user to Apply/Discard.
                    attachPending(evt as ToolEvent);
                } else if (evt.type) {
                    // Additive actions (card, suggest, create) apply immediately.
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

    // Apply or discard a held change. The store mutation runs outside the state
    // updater so it can't double-fire under React's dev double-invoke.
    const resolvePending = (messageIndex: number, pendingId: string, accept: boolean) => {
        const change = messages[messageIndex]?.pending?.find(p => p.id === pendingId);
        if (!change || change.status !== 'pending') return;
        let warning: string | undefined;
        if (accept) warning = onToolEvent(change.evt) || undefined;
        setMessages(prev => prev.map((m, i) =>
            i === messageIndex && m.pending
                ? { ...m, pending: m.pending.map(p => p.id === pendingId ? { ...p, status: accept ? 'applied' : 'discarded', warning } : p) }
                : m,
        ));
    };

    // A 👍/👎 marks the reply and sends a one-line steer so the assistant adjusts
    // in the moment — one-click feedback without typing.
    const react = (messageIndex: number, kind: 'up' | 'down') => {
        if (isStreaming) return;
        const m = messages[messageIndex];
        if (!m || m.reaction) return;
        setMessages(prev => prev.map((mm, i) => (i === messageIndex ? { ...mm, reaction: kind } : mm)));
        send(kind === 'up'
            ? '👍 That direction works — more like this.'
            : '👎 Not quite — try a different angle.');
    };

    // Dropping selected text (from an article, note, anywhere) onto the chat
    // attaches it as context for the next message.
    const onChatDrop = (e: React.DragEvent) => {
        setDragOver(false);
        const text = e.dataTransfer.getData('text/plain').trim();
        if (!text) return;
        e.preventDefault();
        const label = text.length > 40 ? `${text.slice(0, 40)}…` : text;
        setChatAttachment({ kind: 'text', label, content: text });
    };
    const onChatDragOver = (e: React.DragEvent) => {
        if (e.dataTransfer.types.includes('text/plain')) {
            e.preventDefault();
            if (!dragOver) setDragOver(true);
        }
    };

    // Clicking an offered option records the pick (locking that card) and sends
    // the choice as the user's next message.
    const chooseOption = (messageIndex: number, choice: string) => {
        if (isStreaming) return;
        setMessages(prev => prev.map((m, i) =>
            i === messageIndex && m.options ? { ...m, options: { ...m.options, chosen: choice } } : m,
        ));
        send(choice);
    };

    // Launch an interview: render its guide, keep it active for the rest of the
    // conversation, and send the opening line so the assistant asks question one.
    const launchInterview = (iv: Interview) => {
        if (isStreaming) return;
        const guide = renderInterviewGuide(iv);
        setInterviewGuide(guide);
        send(interviewLaunchLine(iv), guide);
    };

    // Open the editor on a fresh custom interview.
    const newInterview = () => {
        setEditorDraft(makeBlankInterview(crypto.randomUUID()));
        setEditorExistingId(null);
    };

    // Edit an interview. A built-in can't be edited in place, so it opens as a
    // fresh, editable duplicate; a custom one edits in place.
    const editInterview = (iv: Interview) => {
        if (iv.builtIn) {
            setEditorDraft({ ...iv, id: crypto.randomUUID(), builtIn: false, title: `${iv.title} (copy)` });
            setEditorExistingId(null);
        } else {
            setEditorDraft(structuredClone(iv));
            setEditorExistingId(iv.id);
        }
    };

    const saveInterview = (iv: Interview) => {
        if (editorExistingId) updateInterview(editorExistingId, iv);
        else addInterview(iv);
        setEditorDraft(null);
        setEditorExistingId(null);
    };

    const removeInterview = (id: string) => {
        deleteInterview(id);
        setEditorDraft(null);
        setEditorExistingId(null);
    };

    return (
        <div
            className={`${styles.researchChat} ${dragOver ? styles.researchChatDragOver : ''}`}
            onDragOver={onChatDragOver}
            onDragLeave={() => setDragOver(false)}
            onDrop={onChatDrop}
        >
            <div className={styles.researchChatHeader}>
                <span>Research Assistant</span>
                <InterviewMenu
                    interviews={allInterviews}
                    disabled={isStreaming}
                    onLaunch={launchInterview}
                    onNew={newInterview}
                    onEdit={editInterview}
                />
            </div>

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
                        {m.content.trim() && (
                            <div className={styles.researchChatMsgBody}>
                                {m.role === 'assistant'
                                    ? renderWithEntityChips(m.content, chipEntities, setSelectedEntity, styles.entityChip)
                                    : m.content}
                            </div>
                        )}

                        {m.options && (
                            <div className={styles.chatOptions}>
                                {m.options.prompt && <div className={styles.chatOptionsPrompt}>{m.options.prompt}</div>}
                                <div className={styles.chatOptionsList}>
                                    {m.options.choices.map((choice, ci) => {
                                        const picked = m.options!.chosen;
                                        return (
                                            <button
                                                key={ci}
                                                className={`${styles.chatOption} ${picked === choice ? styles.chatOptionChosen : ''}`}
                                                disabled={Boolean(picked) || isStreaming}
                                                onClick={() => chooseOption(i, choice)}
                                            >
                                                {choice}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {m.pending?.map(p => (
                            <div key={p.id} className={`${styles.chatPending} ${p.status !== 'pending' ? styles.chatPendingResolved : ''}`}>
                                <span className={styles.chatPendingLabel}>{p.label}</span>
                                {p.status === 'pending' ? (
                                    <div className={styles.chatPendingBtns}>
                                        <button className={styles.chatPendingApply} onClick={() => resolvePending(i, p.id, true)}>Apply</button>
                                        <button className={styles.chatPendingDiscard} onClick={() => resolvePending(i, p.id, false)}>Discard</button>
                                    </div>
                                ) : (
                                    <span className={styles.chatPendingStatus}>
                                        {p.status === 'applied' ? (p.warning ? `⚠️ ${p.warning}` : '✓ Applied') : 'Discarded'}
                                    </span>
                                )}
                            </div>
                        ))}

                        {m.role === 'assistant' && m.content.trim() && (
                            <div className={styles.chatMsgActions}>
                                <button
                                    className={`${styles.chatReactBtn} ${m.reaction === 'up' ? styles.chatReactChosen : ''}`}
                                    disabled={Boolean(m.reaction) || isStreaming}
                                    title="More like this"
                                    onClick={() => react(i, 'up')}
                                >
                                    👍
                                </button>
                                <button
                                    className={`${styles.chatReactBtn} ${m.reaction === 'down' ? styles.chatReactChosen : ''}`}
                                    disabled={Boolean(m.reaction) || isStreaming}
                                    title="Try a different angle"
                                    onClick={() => react(i, 'down')}
                                >
                                    👎
                                </button>
                                <button
                                    className={styles.researchChatAddBtn}
                                    disabled={!scopeKey}
                                    title={scopeKey ? 'Add this reply to the board as a note' : 'Select a project first'}
                                    onClick={() => onToolEvent({ type: 'card', text: m.content })}
                                >
                                    + Add to board
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {chatAttachment && (
                <div className={styles.chatAttachment}>
                    <span className={styles.chatAttachmentIcon}>📎</span>
                    <span className={styles.chatAttachmentLabel} title={chatAttachment.content}>{chatAttachment.label}</span>
                    <button className={styles.chatAttachmentClear} onClick={() => setChatAttachment(null)} title="Remove attachment">✕</button>
                </div>
            )}

            {imageAttach && (
                <div className={styles.chatImageAttach}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageAttach.url} alt="Attached" className={styles.chatImageThumb} />
                    <span className={styles.chatAttachmentLabel}>Image attached</span>
                    <button className={styles.chatAttachmentClear} onClick={() => setImageAttach(null)} title="Remove image">✕</button>
                </div>
            )}

            <div className={styles.researchChatInputRow}>
                <textarea
                    className={styles.researchChatInput}
                    placeholder={chatAttachment ? `Ask about “${chatAttachment.label}”…` : 'Message the research assistant…'}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    rows={2}
                />
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={onImageSelected}
                />
                <button
                    className={styles.chatMicBtn}
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach an image"
                >
                    📷
                </button>
                {voiceSupported && (
                    <button
                        className={`${styles.chatMicBtn} ${isListening ? styles.chatMicBtnActive : ''}`}
                        onClick={toggleVoice}
                        title={isListening ? 'Stop dictation' : 'Dictate with your voice'}
                        aria-pressed={isListening}
                    >
                        {isListening ? '⏹' : '🎤'}
                    </button>
                )}
                <button className={styles.researchChatSendBtn} onClick={() => send()} disabled={isStreaming || (!input.trim() && !imageAttach)}>
                    {isStreaming ? '…' : 'Send'}
                </button>
            </div>

            {editorDraft && (
                <InterviewEditorModal
                    interview={editorDraft}
                    canDelete={editorExistingId !== null}
                    onSave={saveInterview}
                    onDelete={editorExistingId ? () => removeInterview(editorExistingId) : undefined}
                    onClose={() => { setEditorDraft(null); setEditorExistingId(null); }}
                />
            )}
        </div>
    );
}
