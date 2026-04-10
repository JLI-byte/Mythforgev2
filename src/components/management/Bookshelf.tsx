"use client";

import React, { useState } from 'react';
import { useWorkspaceStore, Project, World, COVER_COLORS } from '@/store/workspaceStore';
import styles from './Bookshelf.module.css';

export function Bookshelf() {
    const projects = useWorkspaceStore(s => s.projects);
    const worlds = useWorkspaceStore(s => s.worlds);
    const updateProject = useWorkspaceStore(s => s.updateProject);
    const addWorld = useWorkspaceStore(s => s.addWorld);
    const addProject = useWorkspaceStore(s => s.addProject);
    const addDocument = useWorkspaceStore(s => s.addDocument);
    const addScene = useWorkspaceStore(s => s.addScene);
    const activeProjectId = useWorkspaceStore(s => s.activeProjectId);
    const setActiveProject = useWorkspaceStore(s => s.setActiveProject);
    const setWorkspaceMode = useWorkspaceStore(s => s.setWorkspaceMode);

    // DND State
    const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null);
    const [dragOverWorldId, setDragOverWorldId] = useState<string | null | 'standalone'>(null);

    // Group projects by worldId
    const groups: Record<string, Project[]> = { 'standalone': [] };
    worlds.forEach(w => { groups[w.id] = []; });
    
    projects.forEach(p => {
        const key = p.worldId || 'standalone';
        if (groups[key]) {
            groups[key].push(p);
        } else {
            // If worldId doesn't exist anymore, treat as standalone
            groups['standalone'].push(p);
        }
    });

    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedProjectId(id);
        e.dataTransfer.setData('projectId', id);
        e.dataTransfer.effectAllowed = 'move';
        
        // Custom ghost image if needed, but default is usually fine
    };

    const handleDragOver = (e: React.DragEvent, worldId: string | 'standalone') => {
        e.preventDefault();
        setDragOverWorldId(worldId);
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, targetWorldId: string | 'standalone') => {
        e.preventDefault();
        const projectId = e.dataTransfer.getData('projectId') || draggedProjectId;
        
        if (projectId) {
            updateProject(projectId, { 
                worldId: targetWorldId === 'standalone' ? undefined : targetWorldId 
            });
        }
        
        setDraggedProjectId(null);
        setDragOverWorldId(null);
    };

    const handleSelectProject = (id: string) => {
        setActiveProject(id);
        setWorkspaceMode('desk');
    };

    const handleCreateWorld = () => {
        const name = prompt("Enter shelf (world) name:");
        if (!name) return;

        const newWorld: World = {
            id: crypto.randomUUID(),
            name,
            genre: 'fantasy',
            tone: { darkness: 'balanced', scale: 'balanced', humor: 'balanced' },
            logline: '',
            magicExists: false,
            techLevel: 'medieval',
            timePeriod: '',
            coverColor: COVER_COLORS[Math.floor(Math.random() * COVER_COLORS.length)],
            createdAt: new Date()
        };

        addWorld(newWorld);
    };

    const handleCreateStory = (worldId?: string) => {
        const name = prompt("Enter story name:");
        if (!name) return;

        const projectId = crypto.randomUUID();
        const docId = crypto.randomUUID();
        const sceneId = crypto.randomUUID();

        // 1. Create Project
        const newProject: Project = {
            id: projectId,
            name,
            writingMode: 'novel',
            coverColor: COVER_COLORS[Math.floor(Math.random() * COVER_COLORS.length)],
            worldId,
            createdAt: new Date()
        };
        addProject(newProject);

        // 2. Add initial Chapter
        addDocument({
            id: docId,
            projectId,
            title: 'Chapter 1',
            content: '',
            createdAt: new Date()
        });

        // 3. Add initial Scene
        addScene({
            id: sceneId,
            documentId: docId,
            projectId,
            title: 'Scene 1',
            content: '',
            order: 0,
            createdAt: new Date()
        });

        // Optionally immediately enter the story? 
        // handleSelectProject(projectId);
    };

    const renderProjectCard = (p: Project) => (
        <div 
            key={p.id}
            draggable
            onDragStart={(e) => handleDragStart(e, p.id)}
            onDragEnd={() => setDraggedProjectId(null)}
            className={`${styles.card} ${p.id === activeProjectId ? styles.cardActive : ''} ${draggedProjectId === p.id ? styles.dragging : ''}`}
            onClick={() => handleSelectProject(p.id)}
        >
            <div 
                className={styles.cover}
                style={{ 
                    background: p.coverColor,
                    backgroundImage: p.coverImageUrl ? `url(${p.coverImageUrl})` : 'none'
                }}
            >
                {!p.coverImageUrl && (
                    <span className={styles.initials}>
                        {p.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                )}
            </div>
            <div className={styles.cardInfo}>
                <span className={styles.cardTitle}>{p.name}</span>
                <span className={styles.cardMeta}>{p.writingMode.toUpperCase()}</span>
            </div>
        </div>
    );

    const renderShelf = (title: string, worldId: string | 'standalone', projects: Project[]) => (
        <div 
            key={worldId}
            className={`${styles.shelf} ${dragOverWorldId === worldId ? styles.shelfActive : ''}`}
            onDragOver={(e) => handleDragOver(e, worldId)}
            onDragLeave={() => setDragOverWorldId(null)}
            onDrop={(e) => handleDrop(e, worldId)}
        >
            <div className={styles.shelfHeader}>
                <span className={styles.shelfLabel}>{title}</span>
                <span className={styles.shelfCount}>{projects.length}</span>
                <button 
                    className={styles.addStoryBtn} 
                    onClick={() => handleCreateStory(worldId === 'standalone' ? undefined : worldId)}
                >
                    + Add Story
                </button>
            </div>
            <div className={styles.grid}>
                {projects.length > 0 ? (
                    projects.map(renderProjectCard)
                ) : (
                    <div className={styles.emptyHint}>
                        Drag a story here to organize it...
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>Your Bookshelf</h1>
                <button className={styles.actionBtn} onClick={handleCreateWorld}>
                    <span>+ New Shelf</span>
                </button>
            </div>

            {/* Render Standalone Shelf first or last? User said "saved under the world its tied to or in the uncategorized section" */}
            
            {/* Real World Shelves */}
            {worlds.map(w => renderShelf(w.name, w.id, groups[w.id]))}

            {/* Standalone Shelf */}
            {renderShelf('Uncategorized Standalones', 'standalone', groups['standalone'])}
        </div>
    );
}
