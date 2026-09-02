"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Maximize2, Minimize2, MoveHorizontal } from 'lucide-react';
import { useWorkspaceStore, selectProjectWorldKey } from '@/store/workspaceStore';
import { worldKeyForEntity } from '@/lib/worldKey';
import styles from '../../WritingDesk.module.css';

export function RelationshipMapRenderer({ content, onChange }: { content: any; onChange: (c: any) => void; }) {
  const projectWorldKey = useWorkspaceStore(selectProjectWorldKey);
  const entities = useWorkspaceStore(s => s.entities);
  const characters = useMemo(() =>
    entities.filter(e => worldKeyForEntity(e) === projectWorldKey && e.type === 'character'),
    [entities, projectWorldKey]
  );

  // Buffer node positions locally during drag; flush to onChange only on drag end.
  // localNodesRef always holds the latest value so flushing on mouseUp/mouseLeave
  // is never stale regardless of React re-render timing.
  const [localNodes, setLocalNodes] = useState(content.nodes || []);
  const localNodesRef = useRef<any[]>(content.nodes || []);
  const lastPropNodes = useRef(content.nodes);

  useEffect(() => {
    if (content.nodes !== lastPropNodes.current) {
      setLocalNodes(content.nodes || []);
      localNodesRef.current = content.nodes || [];
      lastPropNodes.current = content.nodes;
    }
  }, [content.nodes]);

  // Alias so all existing render references keep working unchanged
  const nodes = localNodes;
  const links = content.links || [];

  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleAddChar = (charId: string) => {
    if (localNodesRef.current.find((n: any) => n.charId === charId)) return;
    onChange({ ...content, nodes: [...localNodesRef.current, { charId, x: 50, y: 50 }] });
  };


  // During drag: update local state only — never touches onChange
  const updateNodePos = (id: string, x: number, y: number) => {
    const next = localNodesRef.current.map((n: any) => n.charId === id ? { ...n, x, y } : n);
    localNodesRef.current = next;
    setLocalNodes(next);
  };

  // Flush buffered positions to the store when drag ends
  const flushNodes = () => {
    if (dragNodeId) onChange({ ...content, nodes: localNodesRef.current });
    setDragNodeId(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragNodeId || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(5, Math.min(95, ((e.clientY - rect.top) / rect.height) * 100));
    updateNodePos(dragNodeId, x, y);
  };

  const isCompact = content.isCompact || false;

  if (isCompact) {
    return (
      <div className={styles.relMapCompact}>
        <div className={styles.relCompactStat}>
          <span>Social Hubs</span>
          <span className={styles.relCompactValue}>{nodes.length}</span>
        </div>
        <div className={styles.relCompactStat}>
          <span>Relationship Vectors</span>
          <span className={styles.relCompactValue}>{links.length}</span>
        </div>
        <button className={styles.compactToggleBtn} onClick={() => onChange({ ...content, isCompact: false })} aria-label="Expand widget"><Maximize2 size={13} /></button>
      </div>
    );
  }

  return (
    <div className={styles.relMap} onMouseMove={handleMouseMove} onMouseUp={flushNodes} onMouseLeave={flushNodes}>
      <div className={styles.structureHeader}>
        <div className={styles.progressLabel} style={{ marginTop: 0, opacity: 0.6 }}>Relationship Map</div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <select 
            aria-label="Add a character to the map"
            className={styles.relMapInput} 
            style={{ width: '120px' }} 
            onChange={e => { if(e.target.value) { handleAddChar(e.target.value); e.target.value = ''; } }}
          >
            <option value="">+ Character</option>
            {characters.filter(c => !nodes.find((n:any) => n.charId === c.id)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className={styles.sceneControlCompactToggle} onClick={() => onChange({ ...content, isCompact: true })} aria-label="Collapse widget"><Minimize2 size={13} /></button>
        </div>
      </div>

      <div className={styles.mapCanvas} ref={canvasRef}>
        <svg className={styles.svgLayer}>
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent)" />
            </marker>
          </defs>
          {links.map((link: any) => {
            const from = nodes.find((n: any) => n.charId === link.fromId);
            const to = nodes.find((n: any) => n.charId === link.toId);
            if (!from || !to) return null;
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;
            return (
              <g key={link.id}>
                <line 
                  x1={`${from.x}%`} y1={`${from.y}%`} 
                  x2={`${to.x}%`} y2={`${to.y}%`} 
                  className={styles.relLine} 
                  stroke={link.type === 'trust' ? 'var(--accent)' : '#ef4444'} 
                  opacity="0.6"
                />
                <circle cx={`${midX}%`} cy={`${midY}%`} r="3" fill={link.type === 'trust' ? 'var(--accent)' : '#ef4444'} />
                <text 
                  x={`${midX}%`} y={`${midY}%`} 
                  className={styles.relLabel} 
                  textAnchor="middle" 
                  dy="-8"
                >
                  {link.label}
                </text>
              </g>
            );
          })}
        </svg>

        {nodes.map((node: any) => {
          const char = characters.find(c => c.id === node.charId);
          return (
            <div 
              key={node.charId} 
              className={styles.mapNode} 
              style={{ left: `${node.x}%`, top: `${node.y}%`, transform: 'translate(-50%, -50%)', borderColor: dragNodeId === node.charId ? '#fff' : 'var(--accent)' }}
              onMouseDown={(e) => { e.stopPropagation(); setDragNodeId(node.charId); }}
            >
              {char?.imageUrl ? <img src={char.imageUrl} className={styles.mapNodeAvatar} alt="" /> : <span className={styles.mapNodeIcon}>👤</span>}
              <div className={styles.mapNodeName}>{char?.name || '(Unknown)'}</div>
              <button 
                style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ff4d4d', color: '#fff', border: 'none', borderRadius: '50%', width: '14px', height: '14px', fontSize: '0.6875rem', cursor: 'pointer', zIndex: 20 }}
                onClick={(e) => { e.stopPropagation(); onChange({ ...content, nodes: nodes.filter((n:any) => n.charId !== node.charId), links: links.filter((l:any) => l.fromId !== node.charId && l.toId !== node.charId) }); }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      <div className={styles.relMapControls}>
        <div className={styles.relControlRow}>
          <select className={styles.relMapInput} id="rel-from" aria-label="First character in the relationship">
             <option value="">Character A...</option>
             {nodes.map((n:any) => <option key={n.charId} value={n.charId}>{characters.find(c => c.id === n.charId)?.name}</option>)}
          </select>
          <span aria-hidden="true"><MoveHorizontal size={13} /></span>
          <select className={styles.relMapInput} id="rel-to" aria-label="Second character in the relationship">
             <option value="">Character B...</option>
             {nodes.map((n:any) => <option key={n.charId} value={n.charId}>{characters.find(c => c.id === n.charId)?.name}</option>)}
          </select>
        </div>
        <div className={styles.relControlRow}>
          <input className={styles.relMapInput} placeholder="Nature of bond (e.g. Rivals, Secrets)..." id="rel-label" aria-label="Nature of the bond" />
          <select className={styles.relMapInput} style={{ width: '80px' }} id="rel-type" aria-label="Relationship type">
             <option value="trust">Trust</option>
             <option value="conflict">Conflict</option>
          </select>
          <button className={styles.structureBtn} onClick={() => {
             const from = (document.getElementById('rel-from') as HTMLSelectElement).value;
             const to = (document.getElementById('rel-to') as HTMLSelectElement).value;
             const label = (document.getElementById('rel-label') as HTMLInputElement).value || 'Linked';
             const type = (document.getElementById('rel-type') as HTMLSelectElement).value;
             if(from && to && from !== to) {
               onChange({ ...content, links: [...links, { id: crypto.randomUUID(), fromId: from, toId: to, label, type }] });
               (document.getElementById('rel-label') as HTMLInputElement).value = '';
             }
          }}>Add Link</button>
        </div>
      </div>
    </div>
  );
}
