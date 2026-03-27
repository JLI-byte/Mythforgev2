/**
 * TemplatePanel — Side drawer for ArticleCanvas to manage block templates.
 * Sprint 48B: Saves and applies structural layouts (types/order) without content.
 */
"use client";

import React, { useState } from 'react';
import { useWorkspaceStore, BlockType, ArticleBlock } from '@/store/workspaceStore';
import styles from './TemplatePanel.module.css';

interface TemplatePanelProps {
    currentBlocks: ArticleBlock[];
    entityId: string;
    onClose: () => void;
}

const BLOCK_TYPE_EMOJI: Record<BlockType, string> = {
    richtext: '📝',
    image: '🖼️',
    statrow: '📊',
    divider: '➖',
    quote: '💬',
    timeline: '⏳'
};

export default function TemplatePanel({ currentBlocks, entityId, onClose }: TemplatePanelProps) {
    const [templateName, setTemplateName] = useState('');
    const [templateDesc, setTemplateDesc] = useState('');
    const [nameError, setNameError] = useState(false);

    // Store reads/actions
    const articleTemplates = useWorkspaceStore(state => state.articleTemplates);
    const saveArticleTemplate = useWorkspaceStore(state => state.saveArticleTemplate);
    const deleteArticleTemplate = useWorkspaceStore(state => state.deleteArticleTemplate);
    const applyArticleTemplate = useWorkspaceStore(state => state.applyArticleTemplate);

    const handleSave = () => {
        if (!templateName.trim()) {
            setNameError(true);
            return;
        }

        saveArticleTemplate(templateName, templateDesc || undefined, currentBlocks);
        
        // Reset form
        setTemplateName('');
        setTemplateDesc('');
        setNameError(false);
    };

    const handleApply = (templateId: string) => {
        applyArticleTemplate(entityId, templateId);
        onClose();
    };

    return (
        <aside className={styles.panel}>
            <div className={styles.panelHeader}>
                <span className={styles.panelTitle}>Article Templates</span>
                <button className={styles.closeBtn} onClick={onClose} title="Close Panel">
                    ✕
                </button>
            </div>

            <div className={styles.panelBody}>
                {/* Save Section */}
                <div className={styles.section}>
                    <span className={styles.sectionLabel}>Save Current Layout</span>
                    <p className={styles.sectionNote}>
                        Saves the structure only. Content is not included in templates.
                    </p>
                    
                    <input 
                        type="text"
                        placeholder="Template Name (e.g. Character Profile)"
                        className={`${styles.nameInput} ${nameError ? styles.nameInputError : ''}`}
                        value={templateName}
                        onChange={(e) => {
                            setTemplateName(e.target.value);
                            if (nameError) setNameError(false);
                        }}
                    />
                    
                    <textarea 
                        placeholder="Optional description..."
                        className={styles.descTextarea}
                        rows={2}
                        value={templateDesc}
                        onChange={(e) => setTemplateDesc(e.target.value)}
                    />
                    
                    <button className={styles.saveBtn} onClick={handleSave}>
                        Save Template
                    </button>
                </div>

                <div className={styles.divider} />

                {/* Library Section */}
                <div className={styles.section}>
                    <span className={styles.sectionLabel}>Layout Library</span>
                    <div className={styles.warning}>
                        <span>⚠️</span>
                        <span>Applying a template replaces all current blocks.</span>
                    </div>

                    <div className={styles.templateList}>
                        {articleTemplates.length === 0 ? (
                            <div className={styles.emptyLib}>
                                No templates saved yet. Create one from your current layout!
                            </div>
                        ) : (
                            articleTemplates.map(template => (
                                <div key={template.id} className={styles.templateRow}>
                                    <div className={styles.templateName}>{template.name}</div>
                                    {template.description && (
                                        <div className={styles.templateDesc} title={template.description}>
                                            {template.description}
                                        </div>
                                    )}
                                    <div className={styles.templateBlockIcons}>
                                        {template.blocks
                                            .map((b, i) => (
                                                <span key={i} title={b.type}>{BLOCK_TYPE_EMOJI[b.type]}</span>
                                            ))
                                        }
                                    </div>
                                    <div className={styles.templateActions}>
                                        <button 
                                            className={styles.applyBtn}
                                            onClick={() => handleApply(template.id)}
                                        >
                                            Apply
                                        </button>
                                        <button 
                                            className={styles.deleteBtn}
                                            onClick={() => deleteArticleTemplate(template.id)}
                                            title="Delete Template"
                                        >
                                            🗑
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </aside>
    );
}
