"use client";

import React, { useState } from 'react';
import styles from './ConsistencyChecker.module.css';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { ConsistencyIssue } from '@/types';

export default function ConsistencyChecker() {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [issues, setIssues] = useState<ConsistencyIssue[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [hasAnalyzed, setHasAnalyzed] = useState(false);

    const activeProjectId = useWorkspaceStore((state) => state.activeProjectId);
    const documents = useWorkspaceStore((state) => state.documents);
    const activeDocumentId = useWorkspaceStore((state) => state.activeDocumentId);
    const allEntities = useWorkspaceStore((state) => state.entities);
    const aiConfig = useWorkspaceStore((state) => state.aiConfig);
    const projectEntities = allEntities.filter(e => e.projectId === activeProjectId);

    const handleAnalyze = async () => {
        setIsOpen(true);
        setIsLoading(true);
        setError(null);
        setIssues([]);

        try {
            const activeDocument = documents.find(d => d.id === activeDocumentId);
            const documentContent = activeDocument?.content || '';

            if (!documentContent) {
                setError('Your document is empty. Please write something to analyze.');
                setIsLoading(false);
                return;
            }

            if (projectEntities.length === 0) {
                setError('Your world is empty. Please add entities to the World Bible before analyzing.');
                setIsLoading(false);
                return;
            }

            if (aiConfig.provider !== 'ollama' && !aiConfig.apiKey) {
                setError('No API key configured. Open Settings (⚙) to add your API key.');
                setIsLoading(false);
                return;
            }

            const res = await fetch('/api/consistency-check', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-ai-provider': aiConfig.provider,
                    ...(aiConfig.apiKey ? { 'x-api-key': aiConfig.apiKey } : {}),
                    ...(aiConfig.provider === 'ollama' ? {
                        'x-ollama-endpoint': aiConfig.ollamaEndpoint,
                        'x-ollama-model': aiConfig.ollamaModel
                    } : {})
                },
                body: JSON.stringify({
                    documentContent,
                    entities: projectEntities
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to analyze consistency');
            }

            setIssues(data.issues || []);
            setHasAnalyzed(true);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const groupedIssues = {
        High: issues.filter(i => i.severity === 'High'),
        Medium: issues.filter(i => i.severity === 'Medium'),
        Low: issues.filter(i => i.severity === 'Low')
    };

    return (
        <>
            <button className={styles.triggerButton} onClick={handleAnalyze}>
                ✧ Analyze
            </button>

            <div className={`${styles.panel} ${isOpen ? styles.panelOpen : ''}`}>
                <div className={styles.panelHeader}>
                    <h3>Consistency Report</h3>
                    <button className={styles.closeButton} onClick={() => setIsOpen(false)}>×</button>
                </div>

                <div className={styles.panelContent}>
                    {isLoading && (
                        <div className={styles.loadingState}>
                            <div className={styles.spinner}></div>
                            <p>Consulting the AI Archmage...</p>
                        </div>
                    )}

                    {!isLoading && error && (
                        <div className={styles.errorState}>
                            <p>{error}</p>
                        </div>
                    )}

                    {!isLoading && !error && issues.length === 0 && (
                        <div className={styles.emptyState}>
                            {hasAnalyzed
                                ? 'No inconsistencies found! Your world is perfectly aligned.'
                                : 'Click Analyze to check your current document against your World Bible.'}
                        </div>
                    )}

                    {!isLoading && !error && issues.length > 0 && (
                        <div className={styles.issuesContainer}>
                            {(['High', 'Medium', 'Low'] as const).map(severity => {
                                const group = groupedIssues[severity];
                                if (group.length === 0) return null;

                                return (
                                    <div key={severity} className={styles.issueGroup}>
                                        <h4 className={styles.issueGroupTitle}>{severity} Priority</h4>
                                        {group.map((issue) => (
                                            <div key={`${issue.entityName}-${issue.issueType}-${issue.description.slice(0, 20)}`} className={`${styles.issueCard} ${styles[`severity${severity}`]}`}>
                                                <div className={styles.issueHeader}>
                                                    <span className={styles.entityName}>{issue.entityName}</span>
                                                    <span className={styles.issueType}>{issue.issueType}</span>
                                                </div>
                                                <p className={styles.issueDescription}>{issue.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
