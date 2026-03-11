/**
 * useAIChat.ts
 *
 * React hook that manages the two-mode AI Chat feature: World Oracle and
 * Character Chat. Handles message state, context assembly, and streaming
 * communication with the /api/ai/chat backend route.
 *
 * Usage: const chat = useAIChat();
 *        chat.sendMessage("Tell me about the northern kingdoms");
 */

'use client';

import { useState, useCallback } from 'react';
import { useWorkspaceStore, isCharacterEntity } from '@/store/workspaceStore';
import { buildWorldOracleContext, buildCharacterContext } from '@/lib/ai/contextBuilders';

// --- Types ---

/** A single message in the chat conversation */
export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

/** The two AI Chat operating modes */
export type ChatMode = 'oracle' | 'character';

/** Return type of the useAIChat hook */
export interface UseAIChatReturn {
    messages: ChatMessage[];
    isLoading: boolean;
    error: string | null;
    mode: ChatMode;
    selectedCharacterId: string | null;
    setMode: (mode: ChatMode) => void;
    setSelectedCharacterId: (id: string | null) => void;
    sendMessage: (content: string, personaCharacterName?: string | null) => Promise<void>;
    clearMessages: () => void;
    clearError: () => void;
}

// --- Constants ---

/** Model used for World Oracle — higher capability for complex reasoning */
const ORACLE_MODEL = 'claude-sonnet-4-6';

/** Model used for Character Chat — fast and cost-effective for conversational RP */
const CHARACTER_MODEL = 'claude-haiku-4-5-20251001';

// --- Helper ---

/** Generate a simple unique ID for messages */
function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

// --- Hook ---

export function useAIChat(): UseAIChatReturn {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mode, setMode] = useState<ChatMode>('oracle');
    const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);

    const clearMessages = useCallback(() => setMessages([]), []);
    const clearError = useCallback(() => setError(null), []);

    const sendMessage = useCallback(async (content: string, personaCharacterName?: string | null) => {
        // Read current project and entities from the store at call time
        const state = useWorkspaceStore.getState();
        const project = state.projects.find(p => p.id === state.activeProjectId);

        if (!project) {
            setError('No active project. Open a project before chatting.');
            return;
        }

        // Filter entities to the active project
        const projectEntities = state.entities.filter(e => e.projectId === project.id);

        // Build the system prompt based on the current mode
        let systemPrompt: string;
        let model: string;

        if (mode === 'oracle') {
            // World Oracle — assembles full world context
            const worldContext = buildWorldOracleContext(project, projectEntities);
            systemPrompt =
                `You are the World Oracle for ${project.name}. You have complete knowledge of this ` +
                `world. Help the author think through their story — answer questions, find ` +
                `inconsistencies, brainstorm. Never write story content for them. Assist, suggest, ` +
                `surface. Stay grounded in the world data provided.\n\n` +
                `WORLD CONTEXT:\n${worldContext}`;
            model = ORACLE_MODEL;
        } else {
            // Character Chat — find and validate the selected character
            if (!selectedCharacterId) {
                setError('No character selected. Pick a character before chatting.');
                return;
            }

            const entity = projectEntities.find(e => e.id === selectedCharacterId);
            if (!entity) {
                setError('Selected character not found in this project.');
                return;
            }

            // Narrow the entity to CharacterEntity using the type guard
            if (!isCharacterEntity(entity)) {
                setError('Selected entity is not a character.');
                return;
            }

            const characterContext = buildCharacterContext(project, entity);

            // Assemble voice samples section separately for prompt clarity
            const voiceSection = entity.voiceSamples && entity.voiceSamples.length > 0
                ? `\n\nVOICE SAMPLES:\n${entity.voiceSamples.join('\n')}`
                : '';

            const personaInstruction = personaCharacterName 
                ? `\n\nThe user is speaking to you as ${personaCharacterName}. Respond based on your relationship with them as described in your character profile.`
                : '';

            systemPrompt =
                `You are ${entity.name} from ${project.name}. Respond only as this character — ` +
                `based on their profile and voice samples. Never break character. Never acknowledge ` +
                `being an AI. If asked something the character would not know, respond as they would.${personaInstruction}\n\n` +
                `CHARACTER PROFILE:\n${characterContext}${voiceSection}`;
            model = CHARACTER_MODEL;
        }

        // Create the user message
        const userMessage: ChatMessage = {
            id: generateId(),
            role: 'user',
            content,
            timestamp: new Date(),
        };

        // Append user message immediately so the UI updates
        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);
        setError(null);

        try {
            // Build the messages payload — include conversation history for context
            const apiMessages = [...messages, userMessage].map(m => ({
                role: m.role,
                content: m.content,
            }));

            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: apiMessages, systemPrompt, model }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    errorData.error || `Server error: ${response.status} ${response.statusText}`
                );
            }

            // Read the streamed response
            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No response stream available.');
            }

            const decoder = new TextDecoder();
            let assistantContent = '';

            // Create a placeholder assistant message that we'll update as chunks arrive
            const assistantMessageId = generateId();
            const assistantMessage: ChatMessage = {
                id: assistantMessageId,
                role: 'assistant',
                content: '',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, assistantMessage]);

            // Stream loop — read chunks and update the assistant message in place
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                assistantContent += chunk;

                // Update the assistant message content with accumulated text
                setMessages(prev =>
                    prev.map(m =>
                        m.id === assistantMessageId
                            ? { ...m, content: assistantContent }
                            : m
                    )
                );
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    }, [messages, mode, selectedCharacterId]);

    return {
        messages,
        isLoading,
        error,
        mode,
        selectedCharacterId,
        setMode,
        setSelectedCharacterId,
        sendMessage,
        clearMessages,
        clearError,
    };
}
