import { AIProvider } from '@/types';

/**
 * Detects the AI provider based on the structure of the API key.
 * 
 * @param apiKey - The provided API key string.
 * @returns The detected AI Provider.
 */
export function detectProvider(apiKey: string): AIProvider {
    if (apiKey.startsWith('sk-ant-')) return 'anthropic';
    if (apiKey.startsWith('sk-')) return 'openai';
    if (apiKey.startsWith('AIza')) return 'gemini';
    if (apiKey.trim() === '') return 'ollama';

    // Default fallback
    return 'anthropic';
}

/**
 * Returns a human-readable display label for the given AI provider.
 * 
 * @param provider - The AI provider type.
 * @returns A string suitable for UI display.
 */
export function getProviderLabel(provider: AIProvider): string {
    switch (provider) {
        case 'anthropic': return 'Anthropic';
        case 'openai': return 'OpenAI';
        case 'gemini': return 'Google Gemini';
        case 'ollama': return 'Ollama (Local)';
        default: return 'Unknown Provider';
    }
}

/**
 * Returns the URL pointing to where the user can generate an API key for the provider.
 * 
 * @param provider - The AI provider type.
 * @returns A string URL to the provider's API key console/documentation.
 */
export function getProviderDocsUrl(provider: AIProvider): string {
    switch (provider) {
        case 'anthropic': return 'https://console.anthropic.com';
        case 'openai': return 'https://platform.openai.com/api-keys';
        case 'gemini': return 'https://aistudio.google.com/app/apikey';
        case 'ollama': return 'https://ollama.com'; // links to installation
        default: return 'https://console.anthropic.com';
    }
}
