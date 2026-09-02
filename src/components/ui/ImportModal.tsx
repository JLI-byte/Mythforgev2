"use client";
import React, { useState, useEffect, useId, useRef } from 'react';
import { Cloud, FileText, Folder, Globe, X } from 'lucide-react';
import styles from './ImportModal.module.css';
import { useWorkspaceStore, COVER_COLORS } from '@/store/workspaceStore';
import { sanitizeImportedHtml, markdownToBasicHtml, fetchGDriveFileContent, parseFdxToHtml } from '@/lib/export';
import { parseCSV, flattenJSON } from '@/lib/importUtils';
import { logger } from '@/lib/logger';
import { getWorldBibleConfig } from '@/lib/worldBibleNav';
import { fileByType } from '@/lib/folderTree';
// mammoth (~1MB) is loaded on demand in the DOCX handlers below so it stays out
// of the main app bundle — most sessions never import a Word file.

interface ImportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type WritingMode = 'novel' | 'screenplay' | 'markdown' | 'poetry';
type ImportType = 'manuscript' | 'entities';

const MODES: { id: WritingMode; label: string; icon: string }[] = [
    { id: 'novel', label: 'Novel', icon: '📖' },
    { id: 'screenplay', label: 'Screenplay', icon: '🎬' },
    { id: 'markdown', label: 'Notes / Lore', icon: '📝' },
    { id: 'poetry', label: 'Poetry & Music', icon: '✍' },
];

export function ImportModal({ isOpen, onClose }: ImportModalProps) {
    const projects = useWorkspaceStore(state => state.projects);
    const worlds = useWorkspaceStore(state => state.worlds);
    const worldBibles = useWorkspaceStore(state => state.worldBibles);
    const addProject = useWorkspaceStore(state => state.addProject);
    const addDocument = useWorkspaceStore(state => state.addDocument);
    const addScene = useWorkspaceStore(state => state.addScene);
    const addEntity = useWorkspaceStore(state => state.addEntity);
    const setActiveProject = useWorkspaceStore(state => state.setActiveProject);
    const setActiveDocument = useWorkspaceStore(state => state.setActiveDocument);
    const setActiveScene = useWorkspaceStore(state => state.setActiveScene);

    const [step, setStep] = useState<'source' | 'mapping' | 'metadata'>('source');
    const [importType, setImportType] = useState<ImportType>('manuscript');
    
    // Manuscript data
    const [importData, setImportData] = useState<{ title: string; content: string; files?: { title: string; content: string }[] } | null>(null);
    
    // Entity data
    const [rawEntities, setRawEntities] = useState<any[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [mapping, setMapping] = useState({ name: '', type: '', description: '' });

    const [title, setTitle] = useState('');
    const [selectedMode, setSelectedMode] = useState<WritingMode>('novel');
    const [selectedWorldId, setSelectedWorldId] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);
    const entityInputRef = useRef<HTMLInputElement>(null);
    const fieldId = useId();

    useEffect(() => {
        if (!isOpen) {
            setStep('source');
            setImportType('manuscript');
            setImportData(null);
            setRawEntities([]);
            setHeaders([]);
            setTitle('');
            setSelectedWorldId('');
            setIsLoading(false);
            setProgress(0);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleLocalFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        setImportType('manuscript');
        const ext = file.name.split('.').pop()?.toLowerCase();

        try {
            if (ext === 'docx') {
                const mammoth = await import('mammoth');
                const arrayBuffer = await file.arrayBuffer();
                const result = await (mammoth as any).convertToHtml({ arrayBuffer });
                const content = sanitizeImportedHtml(result.value);
                setImportData({ title: file.name.replace(/\.[^/.]+$/, ""), content });
                setTitle(file.name.replace(/\.[^/.]+$/, ""));
                setStep('metadata');
            } else if (ext === 'fdx') {
                const text = await file.text();
                const content = parseFdxToHtml(text);
                setImportData({ title: file.name.replace(/\.[^/.]+$/, ""), content });
                setTitle(file.name.replace(/\.[^/.]+$/, ""));
                setSelectedMode('screenplay');
                setStep('metadata');
            } else {
                const reader = new FileReader();
                reader.onload = (event) => {
                    let content = event.target?.result as string;
                    if (ext === 'md') content = markdownToBasicHtml(content);
                    else if (ext === 'html') content = sanitizeImportedHtml(content);
                    else content = `<p>${content.replace(/\n/g, '</p><p>')}</p>`;
                    setImportData({ title: file.name.replace(/\.[^/.]+$/, ""), content });
                    setTitle(file.name.replace(/\.[^/.]+$/, ""));
                    setStep('metadata');
                };
                reader.readAsText(file);
            }
        } catch (error) {
            logger.error("Import failed:", error);
            alert("Could not import file.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleFolderImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        setIsLoading(true);
        setImportType('manuscript');
        setProgress(0);
        
        const extracted: { title: string; content: string }[] = [];
        const supportedExts = ['md', 'txt', 'html', 'docx', 'fdx'];

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const ext = file.name.split('.').pop()?.toLowerCase() || '';
                if (!supportedExts.includes(ext)) continue;

                const relativePath = (file as any).webkitRelativePath || file.name;
                const pathParts = relativePath.split('/');
                let displayTitle = file.name.replace(/\.[^/.]+$/, "");
                if (pathParts.length > 2) {
                    displayTitle = `[${pathParts.slice(1, -1).join('/')}] ${displayTitle}`;
                }

                let content = "";
                if (ext === 'docx') {
                    const mammoth = await import('mammoth');
                    const arrayBuffer = await file.arrayBuffer();
                    const result = await (mammoth as any).convertToHtml({ arrayBuffer });
                    content = sanitizeImportedHtml(result.value);
                } else if (ext === 'fdx') {
                    const raw = await file.text();
                    content = parseFdxToHtml(raw);
                } else {
                    const raw = await file.text();
                    if (ext === 'md') content = markdownToBasicHtml(raw);
                    else if (ext === 'html') content = sanitizeImportedHtml(raw);
                    else content = `<p>${raw.replace(/\n/g, '</p><p>')}</p>`;
                }

                extracted.push({ title: displayTitle, content });
                setProgress(Math.round(((i + 1) / files.length) * 100));
            }

            const rootFolderName = (files[0] as any).webkitRelativePath?.split('/')[0] || "Imported Project";
            setImportData({ title: rootFolderName, content: "", files: extracted });
            setTitle(rootFolderName);
            const allFdx = files.every(f => f.name.toLowerCase().endsWith('.fdx'));
            if (allFdx) setSelectedMode('screenplay');
            setStep('metadata');
        } catch (err) {
            logger.error("Folder import error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleEntityFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        setImportType('entities');
        const ext = file.name.split('.').pop()?.toLowerCase();

        try {
            const rawText = await file.text();
            if (ext === 'csv') {
                const matrix = parseCSV(rawText);
                if (matrix.length < 2) throw new Error("Invalid CSV");
                setHeaders(matrix[0]);
                const objects = matrix.slice(1).map(row => {
                    const obj: any = {};
                    matrix[0].forEach((h, idx) => obj[h] = row[idx]);
                    return obj;
                });
                setRawEntities(objects);
            } else if (ext === 'json') {
                const parsed = JSON.parse(rawText);
                const list = Array.isArray(parsed) ? parsed : [parsed];
                const flattened = list.map(item => flattenJSON(item));
                setRawEntities(flattened);
                if (flattened.length > 0) setHeaders(Object.keys(flattened[0]));
            }

            setTitle(file.name.replace(/\.[^/.]+$/, ""));
            setStep('mapping');
        } catch (err) {
            logger.error("Entity import fail:", err);
            alert("Could not parse entity file.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleGDriveImport = async () => {
        setIsLoading(true);
        const token = (window as any).gapi?.auth?.getToken()?.access_token;
        if (!token) {
            alert("Please connect to Google Drive first.");
            setIsLoading(false);
            return;
        }
        alert("Google Picker would open here.");
        setIsLoading(false);
    };

    const handleImportComplete = () => {
        if (!title.trim()) return;
        const newProjectId = crypto.randomUUID();

        if (importType === 'manuscript') {
            if (!importData) return;
            addProject({
                id: newProjectId,
                name: title.trim(),
                writingMode: selectedMode,
                coverColor: COVER_COLORS[projects.length % COVER_COLORS.length],
                worldId: selectedWorldId || undefined,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            if (importData.files && importData.files.length > 0) {
                let firstDocId = "";
                let firstSceneId = "";
                importData.files.forEach((file, index) => {
                    const docId = crypto.randomUUID();
                    const sceneId = crypto.randomUUID();
                    if (index === 0) { firstDocId = docId; firstSceneId = sceneId; }
                    addDocument({ id: docId, projectId: newProjectId, title: file.title, content: '', createdAt: new Date() });
                    addScene({ id: sceneId, documentId: docId, projectId: newProjectId, title: 'Main Content', content: file.content, order: 0, createdAt: new Date() });
                });
                setActiveProject(newProjectId); setActiveDocument(firstDocId); setActiveScene(firstSceneId);
            } else {
                const docId = crypto.randomUUID(); const sceneId = crypto.randomUUID();
                addDocument({ id: docId, projectId: newProjectId, title: 'Imported Draft', content: '', createdAt: new Date() });
                addScene({ id: sceneId, documentId: docId, projectId: newProjectId, title: 'Main Content', content: importData.content, order: 0, createdAt: new Date() });
                setActiveProject(newProjectId); setActiveDocument(docId); setActiveScene(sceneId);
            }
        } else {
            if (!mapping.name) { alert("Please map the Name field."); return; }
            addProject({
                id: newProjectId,
                name: title.trim(),
                writingMode: 'markdown',
                coverColor: COVER_COLORS[projects.length % COVER_COLORS.length],
                worldId: selectedWorldId || undefined,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            const targetKey = selectedWorldId || 'standalone';
            const layout = getWorldBibleConfig(worldBibles, targetKey).layout;

            rawEntities.forEach(raw => {
                const name = raw[mapping.name];
                if (!name) return;
                const desc = mapping.description ? raw[mapping.description] : '';
                const type = mapping.type ? raw[mapping.type].toLowerCase() : 'lore';
                const safeType = ['character', 'location', 'faction', 'artifact', 'lore'].includes(type) ? type : 'lore';

                addEntity({
                    id: crypto.randomUUID(),
                    projectId: newProjectId,
                    worldId: selectedWorldId || undefined,
                    categoryId: fileByType(layout.roots, safeType),
                    name,
                    type: safeType as any,
                    description: desc || '',
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            });
            setActiveProject(newProjectId);
        }
        onClose();
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2 className={styles.title}>
                        {step === 'mapping' ? 'Map World Data' : 'Import Writing'}
                    </h2>
                    <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
                        <X size={18} />
                    </button>
                </div>

                {step === 'source' ? (
                    <div className={styles.sourceGrid}>
                        <button className={styles.sourceCard} onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
                            <span className={styles.sourceIcon} aria-hidden="true"><FileText size={36} /></span>
                            <span className={styles.sourceLabel}>Single File</span>
                            <span className={styles.sourceDesc}>.docx, .md, .fdx, .txt, .html</span>
                        </button>
                        <button className={styles.sourceCard} onClick={() => folderInputRef.current?.click()} disabled={isLoading}>
                            <span className={styles.sourceIcon} aria-hidden="true"><Folder size={36} /></span>
                            <span className={styles.sourceLabel}>Full Folder</span>
                            <span className={styles.sourceDesc}>Obsidian / Scrivener / Research</span>
                        </button>
                        <button className={styles.sourceCard} onClick={() => entityInputRef.current?.click()} disabled={isLoading}>
                            <span className={styles.sourceIcon} aria-hidden="true"><Globe size={36} /></span>
                            <span className={styles.sourceLabel}>World Bible</span>
                            <span className={styles.sourceDesc}>Characters / Lore (.csv, .json)</span>
                        </button>
                        <button className={styles.sourceCard} onClick={handleGDriveImport} disabled={isLoading}>
                            <span className={styles.sourceIcon} aria-hidden="true"><Cloud size={36} /></span>
                            <span className={styles.sourceLabel}>Google Drive</span>
                            <span className={styles.sourceDesc}>Word / GDocs / Markdown</span>
                        </button>
                        <input type="file" ref={fileInputRef} aria-label="Choose a manuscript file" style={{ display: 'none' }} accept=".docx,.md,.fdx,.txt,.html" onChange={handleLocalFile} />
                        <input type="file" ref={folderInputRef} aria-label="Choose a folder to import" style={{ display: 'none' }} {...({ webkitdirectory: "" } as any)} onChange={handleFolderImport} />
                        <input type="file" ref={entityInputRef} aria-label="Choose a World Bible file" style={{ display: 'none' }} accept=".csv,.json" onChange={handleEntityFile} />
                    </div>
                ) : step === 'mapping' ? (
                    <div className={styles.mappingWizard}>
                        <p className={styles.mappingHint}>Map your file columns to LoreCanvas entity fields.</p>
                        <div className={styles.mappingGrid}>
                            <div className={styles.mappingRow}>
                                <label htmlFor={`${fieldId}-map-name`}>Name (Req)</label>
                                <select id={`${fieldId}-map-name`} value={mapping.name} onChange={e => setMapping(m => ({ ...m, name: e.target.value }))}>
                                    <option value="">Select column...</option>
                                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                            </div>
                            <div className={styles.mappingRow}>
                                <label htmlFor={`${fieldId}-map-type`}>Type</label>
                                <select id={`${fieldId}-map-type`} value={mapping.type} onChange={e => setMapping(m => ({ ...m, type: e.target.value }))}>
                                    <option value="">Static: Lore</option>
                                    {headers.map(h => <option key={h} value={h}>From Column: {h}</option>)}
                                </select>
                            </div>
                            <div className={styles.mappingRow}>
                                <label htmlFor={`${fieldId}-map-description`}>Description</label>
                                <select id={`${fieldId}-map-description`} value={mapping.description} onChange={e => setMapping(m => ({ ...m, description: e.target.value }))}>
                                    <option value="">None</option>
                                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className={styles.footer}>
                            <button className={styles.importBtn} onClick={() => setStep('metadata')}>
                                Continue to Project Setup
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className={styles.metadataForm}>
                        <div className={styles.field}>
                            <label className={styles.label} htmlFor={`${fieldId}-import-name`}>Import Name</label>
                            <input id={`${fieldId}-import-name`} className={styles.input} value={title} onChange={e => setTitle(e.target.value)} placeholder="Project title..." />
                        </div>
                        <div className={styles.field}>
                            <label className={styles.label} htmlFor={`${fieldId}-target-world`}>Target World</label>
                            <select id={`${fieldId}-target-world`} className={styles.select} value={selectedWorldId} onChange={e => setSelectedWorldId(e.target.value)}>
                                <option value="">Global Project (Uncategorized)</option>
                                {worlds.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                        </div>
                        {importType === 'manuscript' && (
                            <div className={styles.modeSelection}>
                                <label className={styles.label}>Writing Mode</label>
                                <div className={styles.modeGrid}>
                                    {MODES.map(mode => (
                                        <button key={mode.id} className={`${styles.modeItem} ${selectedMode === mode.id ? styles.modeItemActive : ''}`} onClick={() => setSelectedMode(mode.id)}>
                                            <span className={styles.modeIconSmall}>{mode.icon}</span> {mode.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        <button className={styles.importBtn} onClick={handleImportComplete}>
                            {importType === 'entities' ? `Import ${rawEntities.length} Entities` : 'Finalize Import'}
                        </button>
                    </div>
                )}

                {isLoading && (
                    <div className={styles.loaderOverlay}>
                        <div className={styles.spinner} />
                        <p>{progress > 0 ? `Processing... ${progress}%` : 'Reading file...'}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
