/**
 * AIChatbotPanel.tsx
 *
 * A slide-out panel providing a dual-mode AI Chat interface for writers.
 * Connects to the useAIChat hook to provide World Oracle (world-building assistant)
 * and Character Chat (roleplay) modes, with a new option to assume a persona.
 */
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X, ArrowUp, User as UserIcon, Check } from 'lucide-react';
import styles from './AIChatbotPanel.module.css';
import { useAIChat, ChatMode } from '@/hooks/useAIChat';
import { useWorkspaceStore } from '@/store/workspaceStore';

interface AIChatbotPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onTabClick: () => void;
    tabWidth: number;
    onTabWidthChange: (width: number) => void;
    panelWidth: number;
    onPanelWidthChange: (width: number) => void;
}

const MessageIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
);

// Deterministic colors for character swatches based on name hash
const SWATCH_COLORS = [
    '#4A6FA5', '#6B4C9A', '#2E8B57', '#C0392B',
    '#D46A1A', '#1A7A8A', '#7A4A2E', '#4A4A8A'
];

function getSwatchColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return SWATCH_COLORS[Math.abs(hash) % SWATCH_COLORS.length];
}

// We define a simpler Character interface sufficient for these components
interface MinimalCharacter {
    id: string;
    name: string;
    imageUrl?: string;
    subcategory?: string;
}

// --- Sub-Components ---

const ModeSwitcher = ({ mode, handleModeSwitch }: { mode: ChatMode, handleModeSwitch: (mode: ChatMode) => void }) => (
    <div className="p-3 border-b border-[var(--border)] bg-[var(--background)] shrink-0">
        <div className="flex w-full p-1 gap-1 bg-[var(--surface)] rounded-full border border-[var(--border)]">
            <button
                onClick={() => handleModeSwitch('oracle')}
                className={`flex-1 rounded-full py-1.5 text-sm font-medium transition-all duration-200 ${
                    mode === 'oracle' 
                        ? 'bg-[var(--accent)] text-white shadow-sm' 
                        : 'bg-transparent text-[var(--muted)] hover:bg-[var(--background)]/50'
                }`}
            >
                World Oracle
            </button>
            <button
                onClick={() => handleModeSwitch('character')}
                className={`flex-1 rounded-full py-1.5 text-sm font-medium transition-all duration-200 ${
                    mode === 'character' 
                        ? 'bg-[var(--accent)] text-white shadow-sm' 
                        : 'bg-transparent text-[var(--muted)] hover:bg-[var(--background)]/50'
                }`}
            >
                Character Chat
            </button>
        </div>
    </div>
);

const OracleEmptyState = ({ handleSuggestionClick }: { handleSuggestionClick: (text: string) => void }) => (
    <div className="flex flex-col items-center justify-center h-full px-6 py-10 overflow-y-auto w-full">
        <div className="flex flex-col items-center text-center gap-3 mb-8">
            <div className="w-14 h-14 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-[var(--accent)]" />
            </div>
            <h3 className="text-xl font-semibold text-[var(--foreground)]">World Oracle</h3>
            <p className="text-sm text-[var(--muted)] max-w-[220px] text-center mx-auto">
                Ask anything about your world. I can help brainstorm, find inconsistencies, or organize lore.
            </p>
        </div>
        
        <div className="flex flex-col gap-2 w-full">
            {[
                "What are the key factions in this world?",
                "Find any potential plot inconsistencies",
                "Who are the most important characters?"
            ].map((chip) => (
                <button
                    key={chip}
                    onClick={() => handleSuggestionClick(chip)}
                    className="w-full text-left text-sm py-3 px-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--accent)]/50 hover:bg-[var(--accent)]/5 transition-all cursor-pointer"
                >
                    {chip}
                </button>
            ))}
        </div>
    </div>
);

const CharacterSelector = ({ characters, setSelectedCharacterId }: { characters: MinimalCharacter[], setSelectedCharacterId: (id: string) => void }) => (
    <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-[var(--border)] shrink-0 bg-[var(--background)] z-10 sticky top-0">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">Choose a character to speak with</h3>
            <p className="text-xs text-[var(--muted)] mt-1">Characters must be created in the World Bible first.</p>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3 pb-8">
            {characters.length === 0 ? (
                <div className="col-span-2 text-center p-8 text-sm text-[var(--muted)] border border-dashed border-[var(--border)] rounded-lg">
                    No characters found in this project.
                </div>
            ) : (
                characters.map(char => (
                    <button
                        key={char.id}
                        onClick={() => setSelectedCharacterId(char.id)}
                        className="flex flex-col items-start p-3 rounded-xl border border-[var(--border)] hover:border-[var(--accent)]/60 hover:bg-[var(--surface)] transition-all text-left group"
                    >
                        {char.imageUrl ? (
                            <img src={char.imageUrl} alt={char.name} className="w-10 h-10 rounded-lg mb-2 object-cover border border-[var(--border)] shrink-0" />
                        ) : (
                            <div 
                                className="w-10 h-10 rounded-lg mb-2 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm"
                                style={{ backgroundColor: getSwatchColor(char.name) }}
                            >
                                {char.name.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <span className="text-sm font-medium text-[var(--foreground)] w-full truncate">{char.name}</span>
                        {char.subcategory && (
                            <span className="text-xs text-[var(--muted)] w-full truncate">{char.subcategory}</span>
                        )}
                    </button>
                ))
            )}
        </div>
    </div>
);

const CleanActiveCharacterHeader = ({ selectedCharacter, handleExitCharacter }: { selectedCharacter: MinimalCharacter | undefined, handleExitCharacter: () => void }) => {
    if (!selectedCharacter) return null;
    return (
        <div className="flex items-center justify-between p-3 border-b border-[var(--border)] shrink-0 bg-[var(--surface)] text-[var(--foreground)]">
            <div className="flex items-center gap-2 overflow-hidden">
                {selectedCharacter.imageUrl ? (
                    <img src={selectedCharacter.imageUrl} alt="" className="w-6 h-6 rounded shrink-0 object-cover border border-[var(--border)]" />
                ) : (
                    <div 
                        className="w-6 h-6 rounded shrink-0 flex items-center justify-center text-white text-[10px] font-bold"
                        style={{ backgroundColor: getSwatchColor(selectedCharacter.name) }}
                    >
                        {selectedCharacter.name.charAt(0).toUpperCase()}
                    </div>
                )}
                <div className="flex flex-col truncate">
                    <span className="text-sm font-medium truncate">{selectedCharacter.name}</span>
                    <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                        <span className="text-[10px] uppercase tracking-wider text-[var(--muted)]">In Character</span>
                    </div>
                </div>
            </div>
            <button 
                onClick={handleExitCharacter}
                className="p-1.5 text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] rounded shrink-0"
                title="Exit Character Chat"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};

// --- PersonaBar Sub-component ---
const PersonaBar = ({ 
    personaId, 
    showPersonaPicker, 
    setShowPersonaPicker, 
    characters, 
    activeCharacterId,
    setPersonaId
}: { 
    personaId: string | null, 
    showPersonaPicker: boolean, 
    setShowPersonaPicker: (val: boolean) => void,
    characters: MinimalCharacter[],
    activeCharacterId: string,
    setPersonaId: (id: string | null) => void
}) => {
    const activePersona = characters.find(c => c.id === personaId);
    
    // Filter out the character we are chatting with
    const availablePersonas = characters.filter(c => c.id !== activeCharacterId);

    if (showPersonaPicker) {
        return (
            <div className="flex flex-col border-b border-[var(--border)] bg-[var(--surface)] shrink-0">
                <div className="flex items-center justify-between p-3 border-b border-[var(--border)]/50">
                    <span className="text-sm font-medium">Speak as...</span>
                    <button 
                        onClick={() => setShowPersonaPicker(false)}
                        className="p-1 text-[var(--muted)] hover:text-[var(--foreground)] rounded-md hover:bg-[var(--border)]"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="max-h-60 overflow-y-auto p-2 flex flex-col gap-1">
                    {/* Yourself option */}
                    <button 
                        onClick={() => {
                            setPersonaId(null);
                            setShowPersonaPicker(false);
                        }}
                        className={`flex items-center justify-between p-2 rounded-lg text-left transition-all overflow-hidden ${
                            personaId === null ? 'bg-[var(--accent)]/10 border-[var(--accent)]/40' : 'hover:bg-[var(--accent)]/5 hover:border-[var(--border)] border-transparent'
                        } border`}
                    >
                        <div className="flex items-center gap-2 overflow-hidden">
                            <div className="w-8 h-8 rounded-lg bg-[var(--muted)]/20 flex items-center justify-center shrink-0">
                                <UserIcon className="w-4 h-4 text-[var(--foreground)]/70" />
                            </div>
                            <span className="text-sm font-medium">Yourself</span>
                            <span className="text-xs text-[var(--muted)] ml-1 shrink-0">- No persona</span>
                        </div>
                        {personaId === null && <Check className="w-4 h-4 text-[var(--accent)] shrink-0 mr-2" />}
                    </button>
                    
                    {/* Other Characters */}
                    {availablePersonas.map(char => (
                        <button 
                            key={char.id}
                            onClick={() => {
                                setPersonaId(char.id);
                                setShowPersonaPicker(false);
                            }}
                            className={`flex items-center justify-between p-2 rounded-lg text-left transition-all overflow-hidden ${
                                personaId === char.id ? 'bg-[var(--accent)]/10 border-[var(--accent)]/40' : 'hover:bg-[var(--accent)]/5 hover:border-[var(--accent)]/40 border-transparent'
                            } border`}
                        >
                            <div className="flex items-center gap-2 overflow-hidden w-full">
                                {char.imageUrl ? (
                                    <img src={char.imageUrl} alt="" className="w-8 h-8 rounded-lg object-cover border border-[var(--border)] shrink-0" />
                                ) : (
                                    <div 
                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm"
                                        style={{ backgroundColor: getSwatchColor(char.name) }}
                                    >
                                        {char.name.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div className="flex flex-col truncate">
                                    <span className="text-sm font-medium truncate leading-tight">{char.name}</span>
                                    {char.subcategory && <span className="text-xs text-[var(--muted)] truncate">{char.subcategory}</span>}
                                </div>
                            </div>
                            {personaId === char.id && <Check className="w-4 h-4 text-[var(--accent)] shrink-0 mr-2" />}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="p-2 px-3 border-b border-[var(--border)] bg-[var(--surface)] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 truncate pr-2">
                <span className="text-[10px] uppercase tracking-wider text-[var(--muted)] shrink-0">Speaking as</span>
                {activePersona ? (
                    <div className="flex items-center gap-1.5 truncate">
                        {activePersona.imageUrl ? (
                            <img src={activePersona.imageUrl} alt="" className="w-4 h-4 rounded shrink-0 object-cover" />
                        ) : (
                            <div 
                                className="w-4 h-4 rounded shrink-0 flex items-center justify-center text-white text-[8px] font-bold"
                                style={{ backgroundColor: getSwatchColor(activePersona.name) }}
                            >
                                {activePersona.name.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <span className="text-xs font-medium truncate">{activePersona.name}</span>
                    </div>
                ) : (
                    <span className="text-xs italic text-[var(--muted)]">Yourself</span>
                )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
                {personaId && (
                    <button 
                        onClick={() => setPersonaId(null)}
                        className="text-[10px] text-[var(--muted)] hover:text-red-400 font-medium px-1"
                    >
                        Clear
                    </button>
                )}
                <button 
                    onClick={() => setShowPersonaPicker(true)}
                    className="text-xs text-[var(--foreground)] hover:text-[var(--accent)] transition-colors px-2 py-1 rounded bg-[var(--border)]/30 hover:bg-[var(--border)]/70 font-medium"
                >
                    {personaId ? 'Change' : 'Assume Persona'}
                </button>
            </div>
        </div>
    );
};

const ContextCard = ({ selectedCharacter, personaName }: { selectedCharacter: MinimalCharacter | undefined, personaName?: string }) => {
    if (!selectedCharacter) return null;
    
    return (
        <div className="p-3">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-3 w-full text-center">
                <p className="text-xs text-[var(--muted)]">
                    {personaName 
                        ? <><strong className="text-[var(--foreground)]">{selectedCharacter.name}</strong> is in character · speaking to <strong className="text-[var(--foreground)]">{personaName}</strong>. Their relationship will shape the response.</>
                        : <><strong className="text-[var(--foreground)]">{selectedCharacter.name}</strong> is in character. Ask them anything.</>
                    }
                </p>
            </div>
        </div>
    );
};


// We define a simpler Message interface sufficient for these components
interface MinimalMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
}

const MessageThread = ({ 
    messages, isLoading, error, messagesEndRef, handleRetry, personaName 
}: { 
    messages: MinimalMessage[], isLoading: boolean, error: string | null, messagesEndRef: React.RefObject<HTMLDivElement | null>, handleRetry: () => void, personaName?: string 
}) => (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-[var(--background)] relative w-full">
        {messages.map((msg) => (
            <div 
                key={msg.id} 
                className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'self-end' : 'self-start'}`}
            >
                {msg.role === 'user' && personaName && (
                    <span className="text-[10px] text-[var(--muted)] mb-1 mr-1 text-right">{personaName}</span>
                )}
                <div 
                    className={`px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap ${
                        msg.role === 'user' 
                            ? 'bg-[var(--accent)] text-white rounded-[18px] rounded-br-[4px]' 
                            : 'bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] rounded-[18px] rounded-bl-[4px]'
                    }`}
                    style={{ wordBreak: 'break-word' }}
                >
                    {msg.content}
                </div>
            </div>
        ))}
        
        {isLoading && (
            <div className="self-start bg-[var(--surface)] border border-[var(--border)] px-4 py-3 rounded-[18px] rounded-bl-[4px] flex items-center gap-1 max-w-[85%]">
                <span className="w-1.5 h-1.5 bg-[var(--muted)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-1.5 h-1.5 bg-[var(--muted)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-1.5 h-1.5 bg-[var(--muted)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
        )}
        
        {error && (
            <div className="self-center w-full max-w-[95%] mt-2 mb-2 bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-lg p-3 text-sm flex flex-col">
                <span className="text-[#ef4444] mb-2 font-medium">Something went wrong</span>
                <span className="text-[var(--foreground)] opacity-90 text-xs mb-3 font-mono break-words">{error}</span>
                <button 
                    onClick={handleRetry}
                    className="self-start text-xs bg-[#ef4444] text-white px-3 py-1.5 rounded hover:bg-[#dc2626] transition-colors"
                >
                    Retry Message
                </button>
            </div>
        )}
        
        <div ref={messagesEndRef} className="h-2 w-full shrink-0" />
    </div>
);

const InputArea = ({ 
    isLoading, mode, selectedCharacterId, textareaRef, inputText, handleTextareaContent, handleKeyDown, handleSend, personaName 
}: { 
    isLoading: boolean, mode: ChatMode, selectedCharacterId: string | null, textareaRef: React.RefObject<HTMLTextAreaElement | null>, inputText: string, handleTextareaContent: (e: React.ChangeEvent<HTMLTextAreaElement>) => void, handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void, handleSend: () => void, personaName?: string 
}) => {
    const isInputDisabled = isLoading || (mode === 'character' && !selectedCharacterId);
    let placeholderTxt = "Message...";
    if (isInputDisabled) {
        placeholderTxt = mode === 'character' ? "Select a character..." : "Waiting...";
    } else if (mode === 'character' && personaName) {
        placeholderTxt = `Speaking as ${personaName}...`;
    }
    
    return (
        <div className="p-3 border-t border-[var(--border)] bg-[var(--background)] shrink-0 flex flex-col items-center">
            <div className="relative flex items-end w-full">
                <textarea 
                    ref={textareaRef}
                    value={inputText}
                    onChange={handleTextareaContent}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholderTxt}
                    disabled={isInputDisabled}
                    className="w-full max-h-[120px] bg-[var(--surface)] text-[var(--foreground)] text-sm rounded-2xl py-2.5 pl-4 pr-12 resize-none outline-none border border-[var(--border)] focus:border-[var(--accent)] transition-colors disabled:opacity-50 min-h-[42px] placeholder:text-[var(--muted)]"
                    rows={1}
                />
                <button 
                    onClick={handleSend}
                    disabled={!inputText.trim() || isInputDisabled}
                    className="absolute right-2 bottom-1.5 w-9 h-9 rounded-full bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 disabled:bg-[var(--muted)]/20 disabled:text-[var(--muted)] transition-colors flex items-center justify-center shrink-0"
                >
                    <ArrowUp className="w-4 h-4 text-inherit" />
                </button>
            </div>
            <p className="text-[10px] text-[var(--muted)] opacity-40 text-center mt-1.5 w-full">
                AI can make mistakes. Check generated lore.
            </p>
        </div>
    );
};

export function AIChatbotPanel({ isOpen, onClose, onTabClick, tabWidth, onTabWidthChange, panelWidth, onPanelWidthChange }: AIChatbotPanelProps) {
    const [mounted, setMounted] = useState(false);
    
    // AI Chat Hook
    const {
        messages,
        isLoading,
        error,
        mode,
        selectedCharacterId,
        setMode,
        setSelectedCharacterId,
        sendMessage,
        clearMessages
    } = useAIChat();

    // Local UI State
    const [inputText, setInputText] = useState("");
    const [lastUserMessage, setLastUserMessage] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    
    // Assume Persona Local State
    const [personaId, setPersonaId] = useState<string | null>(null);
    const [showPersonaPicker, setShowPersonaPicker] = useState(false);

    // Global Store
    const activeProjectId = useWorkspaceStore(state => state.activeProjectId);
    const entities = useWorkspaceStore(state => state.entities);
    
    // Derived Data
    const characters = entities.filter(e => e.projectId === activeProjectId && e.type === 'character') as MinimalCharacter[];
    const selectedCharacter = characters.find(c => c.id === selectedCharacterId);
    const selectedPersonaCharacter = characters.find(c => c.id === personaId);

    // Reset persona state if changing modes or active character changes.
    // Spec says: Mode switch -> clear, Exit char -> clear, Select new char -> clear
    useEffect(() => {
        setPersonaId(null);
        setShowPersonaPicker(false);
    }, [mode, selectedCharacterId]);

    useEffect(() => { 
        // Delay setting mounted to avoid synchronous setState inside render-phase effect
        const timer = setTimeout(() => setMounted(true), 0);
        return () => clearTimeout(timer);
    }, []);

    // Auto-scroll to bottom of messages
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isLoading]);

    // Handle initial portal render
    if (!mounted) return null;

    // --- Action Handlers ---

    const handleSend = () => {
        const text = inputText.trim();
        if (!text || isLoading) return;
        
        setLastUserMessage(text);
        setInputText("");
        sendMessage(text, selectedPersonaCharacter?.name);
        
        // Reset textarea height
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleTextareaContent = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputText(e.target.value);
        // Auto-resize textarea
        e.target.style.height = 'auto';
        e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
    };

    const handleModeSwitch = (newMode: ChatMode) => {
        if (mode === newMode) return;
        setMode(newMode);
        clearMessages();
    };

    const handleRetry = () => {
        if (lastUserMessage && !isLoading) {
            sendMessage(lastUserMessage, selectedPersonaCharacter?.name);
        }
    };

    const handleSuggestionClick = (text: string) => {
        setLastUserMessage(text);
        sendMessage(text, selectedPersonaCharacter?.name); // Oracles don't use personaName anyway, but signature accepts it safely
    };

    const handleExitCharacter = () => {
        setSelectedCharacterId(null);
        clearMessages();
    };

    // --- Action Handlers ---

    return (
        <>
            {createPortal(
                <button
                    className={`${styles.sideTab} ${isOpen ? styles.sideTabActive : ''}`}
                    style={{
                        width: tabWidth,
                        right: isOpen ? panelWidth : 0,
                        transition: 'right 280ms ease-in-out'
                    }}
                    onClick={onTabClick}
                    title="AI Assistant"
                    aria-label="Toggle AI Assistant"
                >
                    <div
                        className={styles.dragHandle}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const startX = e.clientX;
                            const startWidth = tabWidth;
                            const onMouseMove = (moveEvent: MouseEvent) => {
                                const delta = startX - moveEvent.clientX;
                                const newWidth = Math.min(120, Math.max(44, startWidth + delta));
                                onTabWidthChange(newWidth);
                            };
                            const onMouseUp = () => {
                                document.removeEventListener('mousemove', onMouseMove);
                                document.removeEventListener('mouseup', onMouseUp);
                            };
                            document.addEventListener('mousemove', onMouseMove);
                            document.addEventListener('mouseup', onMouseUp);
                        }}
                        title="Drag to resize tab"
                    />
                    <MessageIcon />
                    <span className={styles.sideTabLabel}>AI Chat</span>
                </button>,
                document.body
            )}

            <div
                className={`${styles.panel} ${isOpen ? styles.open : ''}`}
                style={{ width: panelWidth }}
            >
                <div className={styles.panelInner}>
                    <div
                        className={styles.panelResizeHandle}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            const startX = e.clientX;
                            const startWidth = panelWidth;
                            const onMouseMove = (moveEvent: MouseEvent) => {
                                const delta = startX - moveEvent.clientX;
                                const newWidth = Math.min(1600, Math.max(300, startWidth + delta));
                                onPanelWidthChange(newWidth);
                            };
                            const onMouseUp = () => {
                                document.removeEventListener('mousemove', onMouseMove);
                                document.removeEventListener('mouseup', onMouseUp);
                            };
                            document.addEventListener('mousemove', onMouseMove);
                            document.addEventListener('mouseup', onMouseUp);
                        }}
                        title="Drag to resize panel"
                    />
                    
                    {/* Header */}
                    <div className={styles.header}>
                        <h2 className={styles.title}>AI Assistant</h2>
                        <button
                            className={styles.closeButton}
                            onClick={onClose}
                            aria-label="Close"
                            title="Close"
                        >
                            &times;
                        </button>
                    </div>

                    {/* Content Wrapper (Inner flex container) */}
                    <div className={`${styles.contentWrapper} flex flex-col h-full bg-[var(--background)] overflow-hidden`} style={{ paddingRight: tabWidth }}>
                        <ModeSwitcher mode={mode} handleModeSwitch={handleModeSwitch} />

                        <div key={mode} className="flex-1 flex flex-col overflow-hidden w-full">
                            {mode === 'oracle' && messages.length === 0 && <OracleEmptyState handleSuggestionClick={handleSuggestionClick} />}
                            {mode === 'character' && !selectedCharacterId && <CharacterSelector characters={characters} setSelectedCharacterId={setSelectedCharacterId} />}
                            
                            {/* Top info for active character context */}
                            {mode === 'character' && selectedCharacterId && (
                                <>
                                    <CleanActiveCharacterHeader selectedCharacter={selectedCharacter} handleExitCharacter={handleExitCharacter} />
                                    <PersonaBar 
                                        personaId={personaId} 
                                        showPersonaPicker={showPersonaPicker} 
                                        setShowPersonaPicker={setShowPersonaPicker} 
                                        characters={characters} 
                                        activeCharacterId={selectedCharacterId} 
                                        setPersonaId={setPersonaId} 
                                    />
                                </>
                            )}

                            {/* Only show messages if oracle has messages OR character is selected */}
                            {((mode === 'oracle' && messages.length > 0) || (mode === 'character' && selectedCharacterId)) && (
                                <>
                                    {mode === 'character' && <ContextCard selectedCharacter={selectedCharacter} personaName={selectedPersonaCharacter?.name} />}
                                    <MessageThread 
                                        messages={messages} 
                                        isLoading={isLoading} 
                                        error={error} 
                                        messagesEndRef={messagesEndRef} 
                                        handleRetry={handleRetry} 
                                        personaName={mode === 'character' ? selectedPersonaCharacter?.name : undefined}
                                    />
                                </>
                            )}
                        </div>

                        <InputArea 
                            isLoading={isLoading} 
                            mode={mode} 
                            selectedCharacterId={selectedCharacterId} 
                            textareaRef={textareaRef} 
                            inputText={inputText} 
                            handleTextareaContent={handleTextareaContent} 
                            handleKeyDown={handleKeyDown} 
                            handleSend={handleSend} 
                            personaName={selectedPersonaCharacter?.name}
                        />
                    </div>
                </div>
            </div>
        </>
    );
}
