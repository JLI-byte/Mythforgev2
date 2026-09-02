"use client";

import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { useWorkspaceStore, selectProjectWorldKey } from '@/store/workspaceStore';
import { worldKeyForEntity } from '@/lib/worldKey';
import styles from '../../ArticleGridEditor.module.css';

interface RelEdge {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  auto: boolean; // true = inferred, false = manual
}

interface RelNode {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export function RelationshipWidget({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const entities = useWorkspaceStore(s => s.entities);
  const scenes = useWorkspaceStore(s => s.scenes);
  const activeProjectId = useWorkspaceStore(s => s.activeProjectId);
  const projectWorldKey = useWorkspaceStore(selectProjectWorldKey);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<RelNode[]>([]);
  const frameRef = useRef<number>(0);
  const dragRef = useRef<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [showAddEdge, setShowAddEdge] = useState(false);
  const [newEdge, setNewEdge] = useState({ sourceId: '', targetId: '', label: '' });

  const autoDetect: boolean = content.autoDetect ?? true;
  const manualEdges: RelEdge[] = content.manualEdges || [];
  const includedEntityIds: string[] = content.includedEntityIds || [];

  // Compute the full entity set for this widget
  const worldEntities = entities.filter(e =>
    worldKeyForEntity(e) === projectWorldKey &&
    (includedEntityIds.length === 0 || includedEntityIds.includes(e.id))
  );

  // Compute auto edges from scene co-mentions
  const autoEdges = React.useMemo((): RelEdge[] => {
    if (!autoDetect) return [];
    const projectScenes = scenes.filter(s => s.projectId === activeProjectId);
    const edgeMap = new Map<string, RelEdge>();

    for (const scene of projectScenes) {
      if (!scene.content) continue;
      // Find which world entities appear in this scene's content
      const presentIds = worldEntities
        .filter(e => scene.content.includes(e.id) || scene.content.toLowerCase().includes(e.name.toLowerCase()))
        .map(e => e.id);

      // Every pair of co-present entities gets an edge
      for (let i = 0; i < presentIds.length; i++) {
        for (let j = i + 1; j < presentIds.length; j++) {
          const key = [presentIds[i], presentIds[j]].sort().join('|');
          if (!edgeMap.has(key)) {
            edgeMap.set(key, {
              id: key,
              sourceId: presentIds[i],
              targetId: presentIds[j],
              label: '',
              auto: true,
            });
          }
        }
      }
    }
    return Array.from(edgeMap.values());
  }, [autoDetect, scenes, worldEntities, activeProjectId]);

  // All edges combined
  const allEdges: RelEdge[] = React.useMemo(() => {
    const combined = [...autoEdges];
    for (const me of manualEdges) {
      // Manual edges override auto edges for the same pair
      const key = [me.sourceId, me.targetId].sort().join('|');
      const autoIdx = combined.findIndex(e => e.id === key);
      if (autoIdx !== -1) combined.splice(autoIdx, 1);
      combined.push({ ...me, auto: false });
    }
    return combined;
  }, [autoEdges, manualEdges]);

  // Initialize/update nodes when entity set changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width || canvas.offsetWidth;
    const H = canvas.height || canvas.offsetHeight;
    const cx = W / 2;
    const cy = H / 2;

    const existing = new Map(nodesRef.current.map(n => [n.id, n]));
    nodesRef.current = worldEntities.map((e, i) => {
      if (existing.has(e.id)) return existing.get(e.id)!;
      // Place new nodes in a circle around center
      const angle = (i / Math.max(worldEntities.length, 1)) * Math.PI * 2;
      const r = Math.min(W, H) * 0.3;
      return {
        id: e.id,
        label: e.name,
        type: e.type,
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        vx: 0,
        vy: 0,
      };
    });
  }, [worldEntities.map(e => e.id).join(',')]);

  // Force simulation + render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const NODE_COLORS: Record<string, string> = {
      character: '#4A6FA5',
      location: '#2E8B57',
      faction: '#6B4C9A',
      artifact: '#C0392B',
      lore: '#D46A1A',
      magic: '#9B59B6',
      religion: '#F1C40F',
      species: '#27AE60',
    };

    // Once the layout settles we stop running the O(n²) spring physics every
    // frame (a node drag or hover re-runs the effect / un-settles it). The RAF
    // keeps rendering so highlights still draw, but the CPU-heavy simulation
    // doesn't burn a core indefinitely after the graph has converged.
    let settled = false;
    const SETTLE_ENERGY = 0.05;

    const tick = () => {
      const W = canvas.width;
      const H = canvas.height;
      const nodes = nodesRef.current;
      if (nodes.length === 0) {
        ctx.clearRect(0, 0, W, H);
        frameRef.current = requestAnimationFrame(tick);
        return;
      }

      const nodeMap = new Map(nodes.map(n => [n.id, n]));
      const isDragging = !!dragRef.current;
      if (!settled || isDragging) {
        // --- SPRING SIMULATION ---
        const REPULSION = 4000;
        const SPRING_LEN = 120;
        const SPRING_K = 0.05;
        const DAMPING = 0.85;
        const CENTER_PULL = 0.005;

        // Repulsion between all node pairs
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const dx = nodes[j].x - nodes[i].x;
            const dy = nodes[j].y - nodes[i].y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = REPULSION / (dist * dist);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            nodes[i].vx -= fx;
            nodes[i].vy -= fy;
            nodes[j].vx += fx;
            nodes[j].vy += fy;
          }
        }

        // Spring attraction along edges
        for (const edge of allEdges) {
          const a = nodeMap.get(edge.sourceId);
          const b = nodeMap.get(edge.targetId);
          if (!a || !b) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (dist - SPRING_LEN) * SPRING_K;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx += fx; a.vy += fy;
          b.vx -= fx; b.vy -= fy;
        }

        // Pull toward center + apply damping + integrate
        let energy = 0;
        for (const node of nodes) {
          if (dragRef.current?.nodeId === node.id) continue;
          node.vx += (W / 2 - node.x) * CENTER_PULL;
          node.vy += (H / 2 - node.y) * CENTER_PULL;
          node.vx *= DAMPING;
          node.vy *= DAMPING;
          node.x += node.vx;
          node.y += node.vy;
          energy += node.vx * node.vx + node.vy * node.vy;
          // Clamp to canvas bounds with padding
          node.x = Math.max(24, Math.min(W - 24, node.x));
          node.y = Math.max(24, Math.min(H - 24, node.y));
        }
        // Settle once motion is negligible (and the user isn't dragging).
        settled = !isDragging && energy < SETTLE_ENERGY;
      }

      // --- RENDER ---
      ctx.clearRect(0, 0, W, H);

      // Draw edges
      for (const edge of allEdges) {
        const a = nodeMap.get(edge.sourceId);
        const b = nodeMap.get(edge.targetId);
        if (!a || !b) continue;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = edge.auto
          ? 'rgba(255,255,255,0.12)'
          : 'rgba(208,188,255,0.45)';
        ctx.lineWidth = edge.auto ? 1 : 1.5;
        ctx.stroke();

        // Edge label for manual edges
        if (edge.label) {
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          ctx.font = '10px system-ui';
          ctx.fillStyle = 'rgba(208,188,255,0.7)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(edge.label, mx, my - 6);
        }
      }

      // Draw nodes
      const NODE_RADIUS = 18;
      for (const node of nodes) {
        const isHovered = node.id === hoveredNodeId;
        const color = NODE_COLORS[node.type] || '#888';

        ctx.beginPath();
        ctx.arc(node.x, node.y, isHovered ? NODE_RADIUS + 3 : NODE_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        if (isHovered) {
          ctx.strokeStyle = 'rgba(208,188,255,0.9)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Node label
        ctx.font = `${isHovered ? 'bold ' : ''}11px system-ui`;
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Truncate long names
        const label = node.label.length > 12 ? node.label.slice(0, 11) + '…' : node.label;
        ctx.fillText(label, node.x, node.y);
      }

      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [allEdges, hoveredNodeId]);

  // Resize canvas to match DOM size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    });
    ro.observe(canvas);
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    return () => ro.disconnect();
  }, []);

  // Mouse interaction
  const getNodeAtPoint = (x: number, y: number): RelNode | null => {
    for (const node of nodesRef.current) {
      const dx = x - node.x;
      const dy = y - node.y;
      if (dx * dx + dy * dy <= 20 * 20) return node;
    }
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const node = getNodeAtPoint(x, y);
    if (node) {
      dragRef.current = { nodeId: node.id, offsetX: x - node.x, offsetY: y - node.y };
      e.stopPropagation(); // prevent canvas widget drag
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (dragRef.current) {
      const node = nodesRef.current.find(n => n.id === dragRef.current!.nodeId);
      if (node) {
        node.x = x - dragRef.current.offsetX;
        node.y = y - dragRef.current.offsetY;
        node.vx = 0;
        node.vy = 0;
      }
      return;
    }

    const hovered = getNodeAtPoint(x, y);
    setHoveredNodeId(hovered?.id ?? null);
  };

  const handleMouseUp = () => {
    dragRef.current = null;
  };

  const addManualEdge = () => {
    if (!newEdge.sourceId || !newEdge.targetId || newEdge.sourceId === newEdge.targetId) return;
    const edge: RelEdge = {
      id: crypto.randomUUID(),
      sourceId: newEdge.sourceId,
      targetId: newEdge.targetId,
      label: newEdge.label,
      auto: false,
    };
    onChange({ ...content, manualEdges: [...manualEdges, edge] });
    setNewEdge({ sourceId: '', targetId: '', label: '' });
    setShowAddEdge(false);
  };

  const removeManualEdge = (id: string) => {
    onChange({ ...content, manualEdges: manualEdges.filter(e => e.id !== id) });
  };

  return (
    <div className={styles.relationshipWidget}>
      {/* Toolbar */}
      <div className={styles.relationshipToolbar}>
        <label className={styles.relationshipToggle}>
          <input
            type="checkbox"
            checked={autoDetect}
            onChange={e => onChange({ ...content, autoDetect: e.target.checked })}
          />
          <span>Auto-detect</span>
        </label>
        <span className={styles.relationshipStats}>
          {worldEntities.length} entities · {allEdges.length} connections
        </span>
        <button
          className={styles.relationshipAddBtn}
          onClick={() => setShowAddEdge(v => !v)}
        >
          + Link
        </button>
      </div>

      {/* Add edge form */}
      {showAddEdge && (
        <div className={styles.relationshipAddForm}>
          <select
            className={styles.relationshipSelect}
            value={newEdge.sourceId}
            onChange={e => setNewEdge(v => ({ ...v, sourceId: e.target.value }))}
          >
            <option value="">From entity…</option>
            {worldEntities.map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
          <select
            className={styles.relationshipSelect}
            value={newEdge.targetId}
            onChange={e => setNewEdge(v => ({ ...v, targetId: e.target.value }))}
          >
            <option value="">To entity…</option>
            {worldEntities.map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
          <input
            className={styles.relationshipLabelInput}
            placeholder="Relationship label (e.g. ally, enemy, parent)"
            value={newEdge.label}
            onChange={e => setNewEdge(v => ({ ...v, label: e.target.value }))}
          />
          <div className={styles.relationshipAddFormBtns}>
            <button className={styles.relationshipConfirmBtn} onClick={addManualEdge}>Add</button>
            <button className={styles.relationshipCancelBtn} onClick={() => setShowAddEdge(false)}>Cancel</button>
          </div>
          {/* Manual edge list */}
          {manualEdges.length > 0 && (
            <div className={styles.manualEdgeList}>
              {manualEdges.map(me => {
                const src = worldEntities.find(e => e.id === me.sourceId)?.name ?? me.sourceId;
                const tgt = worldEntities.find(e => e.id === me.targetId)?.name ?? me.targetId;
                return (
                  <div key={me.id} className={styles.manualEdgeItem}>
                    <span>{src} → {me.label ? `${me.label} → ` : ''}{tgt}</span>
                    <button className={styles.manualEdgeDelete} onClick={() => removeManualEdge(me.id)} aria-label="Remove relationship"><X size={12} /></button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Graph canvas */}
      {worldEntities.length === 0 ? (
        <div className={styles.relationshipEmpty}>
          <span>No entities in this world yet.</span>
          <span>Add entities to the World Bible to see them here.</span>
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          className={styles.relationshipCanvas}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      )}
    </div>
  );
}
