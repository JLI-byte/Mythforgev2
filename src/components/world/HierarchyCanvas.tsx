"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useWorkspaceStore, WorldBibleRootConfig, EntityType, ENTITY_TYPE_LABELS } from '@/store/workspaceStore';
import { getWorldBibleConfig } from '@/lib/worldBibleNav';
import { STANDALONE_KEY } from '@/lib/worldKey';
import styles from './HierarchyCanvas.module.css';

const DEFAULT_NODE_WIDTH = 320;
const CANVAS_WIDTH = 4000;
const CANVAS_HEIGHT = 3000;

const ALL_ENTITY_TYPES: EntityType[] = [
    'character', 'location', 'faction', 'artifact', 'lore', 'magic', 'religion', 'species'
];

const TYPE_ICONS: Record<EntityType, string> = {
    character: '👤',
    location: '📍',
    faction: '📦',
    artifact: '⚔️',
    lore: '🧙',
    magic: '🔮',
    religion: '📜',
    species: '🌿'
};

interface HierarchyCanvasProps {
    isDraft?: boolean;
}

export default function HierarchyCanvas({ isDraft }: HierarchyCanvasProps) {
    const worldBibles = useWorkspaceStore(state => state.worldBibles);
    const activeWorldKey = useWorkspaceStore(state => state.activeWorldKey) ?? STANDALONE_KEY;
    const draftLayout = useWorkspaceStore(state => state.draftHierarchyLayout);
    const setWorkspaceMode = useWorkspaceStore(state => state.setWorkspaceMode);
    const addWorldBibleRoot = useWorkspaceStore(state => state.addWorldBibleRoot);
    const updateWorldBibleRoot = useWorkspaceStore(state => state.updateWorldBibleRoot);
    const deleteWorldBibleRoot = useWorkspaceStore(state => state.deleteWorldBibleRoot);
    const moveWorldBibleType = useWorkspaceStore(state => state.moveWorldBibleType);

    const layout = isDraft ? (draftLayout || { roots: [] }) : getWorldBibleConfig(worldBibles, activeWorldKey).layout;
    const roots = layout.roots;

    // Local state for dragging nodes
    const [dragNodeId, setDragNodeId] = useState<string | null>(null);
    const [livePositions, setLivePositions] = useState<Record<string, { x: number; y: number }>>({});
    const [liveSizes, setLiveSizes] = useState<Record<string, { w: number; h: number }>>({});
    
    // Which type is being dragged from the palette
    const [isDraggingPaletteType, setIsDraggingPaletteType] = useState<EntityType | null>(null);
    const [dragSourceRootId, setDragSourceRootId] = useState<string | null>(null);

    // Zoom/Pan refs (simplified for now — just scrollable)
    const canvasRef = useRef<HTMLDivElement>(null);

    /** Initialize positions if they don't exist */
    useEffect(() => {
        roots.forEach((root, idx) => {
            if (root.x === undefined || root.y === undefined) {
                const col = idx % 3;
                const row = Math.floor(idx / 3);
                updateWorldBibleRoot(root.id, {
                    x: 100 + col * 400,
                    y: 100 + row * 400
                }, isDraft);
            }
        });
    }, [roots.length]);

    const handleNodeDragStart = (e: React.MouseEvent, rootId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setDragNodeId(rootId);

        const root = roots.find(r => r.id === rootId);
        if (!root) return;

        const startX = e.clientX;
        const startY = e.clientY;
        const initialX = root.x || 0;
        const initialY = root.y || 0;

        const onMouseMove = (moveEvent: MouseEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;
            setLivePositions(prev => ({
                ...prev,
                [rootId]: {
                    x: Math.max(0, initialX + dx),
                    y: Math.max(0, initialY + dy)
                }
            }));
        };

        const onMouseUp = (upEvent: MouseEvent) => {
            const dx = upEvent.clientX - startX;
            const dy = upEvent.clientY - startY;
            updateWorldBibleRoot(rootId, {
                x: Math.max(0, initialX + dx),
                y: Math.max(0, initialY + dy)
            }, isDraft);
            setDragNodeId(null);
            setLivePositions(prev => {
                const next = { ...prev };
                delete next[rootId];
                return next;
            });
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const handleResizeStart = (e: React.MouseEvent, rootId: string, axis: 'x' | 'y' | 'both') => {
        e.preventDefault();
        e.stopPropagation();

        const root = roots.find(r => r.id === rootId);
        if (!root) return;

        const startX = e.clientX;
        const startY = e.clientY;
        const startW = root.width || 800;
        const startH = root.height || 600;

        const onMouseMove = (moveEvent: MouseEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;
            
            setLiveSizes(prev => {
                const current = prev[rootId] || { w: startW, h: startH };
                return {
                    ...prev,
                    [rootId]: { 
                        w: (axis === 'x' || axis === 'both') ? Math.max(320, startW + dx) : current.w,
                        h: (axis === 'y' || axis === 'both') ? Math.max(200, startH + dy) : current.h
                    }
                };
            });
        };

        const onMouseUp = (upEvent: MouseEvent) => {
            const dx = upEvent.clientX - startX;
            const dy = upEvent.clientY - startY;
            
            const newW = (axis === 'x' || axis === 'both') ? Math.max(320, startW + dx) : startW;
            const newH = (axis === 'y' || axis === 'both') ? Math.max(200, startH + dy) : startH;
            
            updateWorldBibleRoot(rootId, {
                width: newW,
                height: newH
            }, isDraft);
            
            setLiveSizes(prev => {
                const next = { ...prev };
                delete next[rootId];
                return next;
            });
            
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const handleAddCategory = () => {
        const id = crypto.randomUUID();
        addWorldBibleRoot({
            id,
            label: 'New Category',
            icon: '📂',
            entityTypes: [],
            x: 200,
            y: 200
        }, isDraft);
    };

    const handleAddSubfolder = (parentId: string) => {
        const id = crypto.randomUUID();
        addWorldBibleRoot({
            id,
            label: 'New Subfolder',
            icon: '📁',
            entityTypes: [],
            parentId,
            x: 200,
            y: 200
        }, isDraft);
    };

    const handleReset = () => {
        if (window.confirm('Reset hierarchy to default? This will clear your custom categories and positions.')) {
            // Implementation of reset depends on whether we want a store action or just a local override
            // For now, let's keep it simple.
        }
    };

    // DRAG AND DROP for Entity Types
    const handleTypeDragStart = (e: React.DragEvent, type: EntityType, sourceRootId: string | null) => {
        e.dataTransfer.setData('type', type);
        if (sourceRootId) e.dataTransfer.setData('sourceRootId', sourceRootId);
        setIsDraggingPaletteType(type);
        setDragSourceRootId(sourceRootId);
    };

    const handleTypeDrop = (e: React.DragEvent, targetRootId: string) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent canvas from catching it
        const type = e.dataTransfer.getData('type') as EntityType;
        const sourceRootId = e.dataTransfer.getData('sourceRootId');
        
        if (sourceRootId === targetRootId) return;

        // If it came from the palette, find which root currently has it and move it
        if (!sourceRootId) {
            const currentRoot = roots.find(r => r.entityTypes.includes(type));
            if (currentRoot) {
                moveWorldBibleType(type, currentRoot.id, targetRootId, isDraft);
            }
        } else {
            moveWorldBibleType(type, sourceRootId, targetRootId, isDraft);
        }

        setIsDraggingPaletteType(null);
        setDragSourceRootId(null);
    };

    const handleCanvasDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const type = e.dataTransfer.getData('type') as EntityType;
        const sourceRootId = e.dataTransfer.getData('sourceRootId');

        // Calculate drop coordinates relative to the scrollable canvas area
        const rect = e.currentTarget.getBoundingClientRect();
        const dropX = e.clientX - rect.left;
        const dropY = e.clientY - rect.top;

        // Center the new card on the mouse
        const x = Math.max(0, dropX - 160);
        const y = Math.max(0, dropY - 20);

        if (!sourceRootId) {
            // New Category from palette
            const currentRoot = roots.find(r => r.entityTypes.includes(type));
            const newId = crypto.randomUUID();
            
            addWorldBibleRoot({
                id: newId,
                label: roots.length === 0 ? 'World Bible' : (ENTITY_TYPE_LABELS[type] || 'New Category'),
                icon: roots.length === 0 ? '📁' : (TYPE_ICONS[type] || '📂'),
                entityTypes: [type],
                x,
                y
            }, isDraft);

            if (currentRoot) {
                // Remove from old root
                moveWorldBibleType(type, currentRoot.id, newId, isDraft);
            }
        } else {
            // Move existing type onto canvas -> split into new category
            const newId = crypto.randomUUID();
            addWorldBibleRoot({
                id: newId,
                label: ENTITY_TYPE_LABELS[type] || 'New Category',
                icon: TYPE_ICONS[type] || '📂',
                entityTypes: [type],
                x,
                y
            }, isDraft);
            moveWorldBibleType(type, sourceRootId, newId, isDraft);
        }

        setIsDraggingPaletteType(null);
        setDragSourceRootId(null);
    };

    return (
        <main className={styles.main}>
            <div className={styles.canvasViewport} ref={canvasRef}>
                <div 
                    className={styles.canvasArea}
                    onDrop={handleCanvasDrop}
                >
                    {roots.filter(r => !r.parentId).map(root => {
                        const renderNode = (n: WorldBibleRootConfig, depth = 0) => {
                          const pos = livePositions[n.id] || { x: n.x || 0, y: n.y || 0 };
                          const isDragging = dragNodeId === n.id;
                          const children = roots.filter(r => r.parentId === n.id);
                          
                          const depthClass = depth === 0 ? styles.depth0 : depth === 1 ? styles.depth1 : styles.depth2;

                          const size = liveSizes[n.id] || { w: n.width || 800, h: n.height || 600 };

                          return (
                            <div
                                key={n.id}
                                id={`node-${n.id}`}
                                className={`${styles.node} ${depthClass} ${isDragging ? styles.nodeDragging : ''} ${depth > 0 ? styles.nodeNested : ''}`}
                                style={{ 
                                  left: depth === 0 ? pos.x : 'auto', 
                                  top: depth === 0 ? pos.y : 'auto',
                                  position: depth === 0 ? 'absolute' : 'relative',
                                  width: depth === 0 ? size.w : 'auto',
                                  height: depth === 0 ? size.h : 'auto',
                                }}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => handleTypeDrop(e, n.id)}
                            >
                                <div 
                                    className={styles.nodeHeader}
                                    onMouseDown={(e) => depth === 0 && handleNodeDragStart(e, n.id)}
                                >
                                    <div className={styles.nodeIcon}>{n.icon}</div>
                                    <input
                                        className={styles.nodeLabel}
                                        value={n.label}
                                        onChange={(e) => updateWorldBibleRoot(n.id, { label: e.target.value }, isDraft)}
                                        onClick={(e) => e.stopPropagation()}
                                        onMouseDown={(e) => e.stopPropagation()}
                                    />
                                    <div className={styles.nodeActions}>
                                        <button 
                                            className={styles.nodeActionBtn}
                                            onClick={(e) => { e.stopPropagation(); handleAddSubfolder(n.id); }}
                                            title="Add Subfolder"
                                        >
                                            ＋
                                        </button>
                                        {(roots.length > 1 || depth > 0) && (
                                            <button 
                                                className={styles.nodeDelete}
                                                onClick={(e) => { e.stopPropagation(); deleteWorldBibleRoot(n.id, isDraft); }}
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className={`${styles.nodeBody} ${depth === 0 ? styles.nodeBodyScroll : ''}`}>
                                    {n.entityTypes.length === 0 && children.length === 0 ? (
                                        <div className={styles.nodeEmptyHint}>
                                            Empty folder...
                                        </div>
                                    ) : (
                                        <>
                                            {n.entityTypes.map(type => (
                                                <div 
                                                    key={type} 
                                                    className={styles.nodeChip}
                                                    draggable
                                                    onDragStart={(e) => handleTypeDragStart(e, type, n.id)}
                                                >
                                                    <span>{TYPE_ICONS[type]} {ENTITY_TYPE_LABELS[type]}</span>
                                                </div>
                                            ))}
                                            {children.length > 0 && (
                                              <div className={styles.nodeChildren}>
                                                {children.map(child => renderNode(child, depth + 1))}
                                              </div>
                                            )}
                                        </>
                                    )}
                                </div>

                                {n.parentId === undefined && (
                                    <>
                                        <div 
                                            className={styles.resizeEdgeR}
                                            onMouseDown={(e) => handleResizeStart(e, n.id, 'x')}
                                        />
                                        <div 
                                            className={styles.resizeEdgeB}
                                            onMouseDown={(e) => handleResizeStart(e, n.id, 'y')}
                                        />
                                        <div 
                                            className={styles.resizeHandle}
                                            onMouseDown={(e) => handleResizeStart(e, n.id, 'both')}
                                        />
                                    </>
                                )}
                            </div>
                          );
                        };

                        return renderNode(root);
                    })}
                </div>
            </div>
        </main>
    );
}
