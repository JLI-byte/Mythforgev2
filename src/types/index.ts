export interface ConsistencyIssue {
    entityName: string;
    issueType: string; // e.g., 'Contradiction', 'Missing Detail', 'Anachronism'
    description: string;
    severity: 'High' | 'Medium' | 'Low';
}

export type AIProvider = 'anthropic' | 'openai' | 'gemini' | 'ollama';

export interface AIProviderConfig {
    provider: AIProvider;
    apiKey: string;          // empty string for Ollama
    ollamaEndpoint: string;  // default: 'http://localhost:11434'
    ollamaModel: string;     // default: 'llama3'
}
