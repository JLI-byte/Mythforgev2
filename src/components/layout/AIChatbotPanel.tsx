/**
 * AIChatbotPanel.tsx
 *
 * A slide-out panel providing a dual-mode AI Chat interface for writers.
 * Connects to the useAIChat hook to provide World Oracle (world-building assistant)
 * and Character Chat (roleplay) modes.
 */
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X, ArrowUp } from 'lucide-react';
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

    // Global Store
    const activeProjectId = useWorkspaceStore(state => state.activeProjectId);
    const entities = useWorkspaceStore(state => state.entities);
    
    // Derived Data
    const characters = entities.filter(e => e.projectId === activeProjectId && e.type === 'character');
    const selectedCharacter = characters.find(c => c.id === selectedCharacterId);

    useEffect(() => { setMounted(true); }, []);

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
        sendMessage(text);
        
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
            sendMessage(lastUserMessage);
        }
    };

    const handleSuggestionClick = (text: string) => {
        setLastUserMessage(text);
        sendMessage(text);
    };

    const handleExitCharacter = () => {
        setSelectedCharacterId(null);
        clearMessages();
    };

    // --- Sub-Components ---

    const ModeSwitcher = () => (
        <div className="flex p-2 gap-2 border-b border-[var(--border)] shrink-0">
            <button
                onClick={() => handleModeSwitch('oracle')}
                className={`flex-1 rounded-full py-1.5 text-sm font-medium transition-colors ${
                    mode === 'oracle' 
                        ? 'bg-[var(--accent)] text-white' 
                        : 'text-[var(--muted)] hover:bg-[var(--surface)]'
                }`}
            >
                World Oracle
            </button>
            <button
                onClick={() => handleModeSwitch('character')}
                className={`flex-1 rounded-full py-1.5 text-sm font-medium transition-colors ${
                    mode === 'character' 
                        ? 'bg-[var(--accent)] text-white' 
                        : 'text-[var(--muted)] hover:bg-[var(--surface)]'
                }`}
            >
                Character Chat
            </button>
        </div>
    );

    const OracleEmptyState = () => (
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6 overflow-y-auto">
            <div className="flex flex-col items-center text-center gap-2">
                <div className="w-12 h-12 rounded-full bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] mb-2">
                    <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold text-[var(--foreground)]">World Oracle</h3>
                <p className="text-sm text-[var(--muted)] max-w-[240px]">
                    Ask anything about your world. I can help brainstorm, find inconsistencies, or organize lore.
                </p>
            </div>
            
            <div className="flex flex-col gap-2 w-full mt-4">
                {[
                    "What are the key factions in this world?",
                    "Find any potential plot inconsistencies",
                    "Who are the most important characters?"
                ].map((chip) => (
                    <button
                        key={chip}
                        onClick={() => handleSuggestionClick(chip)}
                        className="text-sm px-4 py-2.5 rounded-full border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface)] hover:border-[var(--accent)] transition-all text-center w-full"
                    >
                        {chip}
                    </button>
                ))}
            </div>
        </div>
    );

    const CharacterSelector = () => (
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
                            className="flex flex-col items-start p-3 border border-[var(--border)] rounded-lg hover:border-[var(--accent)] hover:bg-[var(--surface)] hover:-translate-y-0.5 transition-all text-left group"
                        >
                            {char.imageUrl ? (
                                <img src={char.imageUrl} alt={char.name} className="w-8 h-8 rounded mb-2 object-cover border border-[var(--border)]" />
                            ) : (
                                <div 
                                    className="w-8 h-8 rounded mb-2 flex items-center justify-center text-white text-xs font-bold shrink-0"
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

    const ActiveCharacterHeader = () => {
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

    const MessageThread = () => (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-[var(--background)] relative">
            {messages.map((msg) => (
                <div 
                    key={msg.id} 
                    className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'self-end' : 'self-start'}`}
                >
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
                    {/* Bouncing dots using inline animation utilities - relying on Tailwind JIT for standard delays if available, or simple CSS. Because strict Tailwind without custom plugins lacks stagger delays natively, we'll use inline styles for the stagger. */}
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

    const InputArea = () => {
        const isInputDisabled = isLoading || (mode === 'character' && !selectedCharacterId);
        
        return (
            <div className="p-3 border-t border-[var(--border)] bg-[var(--background)] shrink-0">
                <div className="relative flex items-end">
                    <textarea 
                        ref={textareaRef}
                        value={inputText}
                        onChange={handleTextareaContent}
                        onKeyDown={handleKeyDown}
                        placeholder={isInputDisabled ? (mode === 'character' ? "Select a character..." : "Waiting...") : "Message..."}
                        disabled={isInputDisabled}
                        className="w-full max-h-[120px] bg-[var(--surface)] text-[var(--foreground)] text-sm rounded-2xl py-2.5 pl-4 pr-10 resize-none outline-none border border-[var(--border)] focus:border-[var(--accent)] transition-colors disabled:opacity-50 min-h-[42px]"
                        rows={1}
                    />
                    <button 
                        onClick={handleSend}
                        disabled={!inputText.trim() || isInputDisabled}
                        className="absolute right-1.5 bottom-1.5 p-1.5 rounded-full bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 disabled:bg-[var(--muted)]/30 disabled:text-[var(--muted)] transition-colors flex items-center justify-center"
                    >
                        <ArrowUp className="w-4 h-4 text-inherit" />
                    </button>
                </div>
                <div className="text-center mt-2 flex justify-center max-w-full">
                   <p className="text-[10px] text-[var(--muted)] opacity-60">AI can make mistakes. Check generated lore.</p>
                </div>
            </div>
        );
    };

    // --- Main Render ---

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
                    <div className={`${styles.contentWrapper} flex flex-col h-full bg-[var(--background)]`}>
                        <ModeSwitcher />

                        {mode === 'oracle' && messages.length === 0 && <OracleEmptyState />}
                        {mode === 'character' && !selectedCharacterId && <CharacterSelector />}
                        {mode === 'character' && selectedCharacterId && <ActiveCharacterHeader />}

                        {/* Only show messages if oracle has messages OR character is selected */}
                        {((mode === 'oracle' && messages.length > 0) || (mode === 'character' && selectedCharacterId)) && (
                            <MessageThread />
                        )}

                        <InputArea />
                    </div>
                </div>
            </div>
        </>
    );
}
