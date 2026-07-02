"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useWorkspaceStore, selectProjectWorldKey } from '@/store/workspaceStore';
import { worldKeyForEntity } from '@/lib/worldKey';
import styles from '../../ArticleGridEditor.module.css';

interface OrgNode {
  id: string;
  label: string;       // person/group name
  role: string;        // title/role e.g. "King", "Captain", "Elder"
  entityId: string;    // optional linked entity (empty = manual)
  color: string;       // node accent color (user pick or auto)
}

interface OrgEdge {
  id: string;
  parentId: string;
  childId: string;
}

export function OrgChartWidget({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const entities = useWorkspaceStore(s => s.entities);
  const projectWorldKey = useWorkspaceStore(selectProjectWorldKey);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAddNode, setShowAddNode] = useState(false);
  const [showAddEdge, setShowAddEdge] = useState(false);
  const [newNode, setNewNode] = useState({ label: '', role: '', entityId: '', color: '#4A6FA5' });
  const [newEdge, setNewEdge] = useState({ parentId: '', childId: '' });

  const nodes: OrgNode[] = content.nodes || [];
  const edges: OrgEdge[] = content.edges || [];
  const worldEntities = entities.filter(e => worldKeyForEntity(e) === projectWorldKey);

  // Layout: BFS from roots, assign generation + horizontal position
  const layout = React.useMemo(() => {
    if (nodes.length === 0) return new Map<string, { x: number; y: number }>();

    const childToParents = new Map<string, string[]>();
    const parentToChildren = new Map<string, string[]>();
    nodes.forEach(n => { childToParents.set(n.id, []); parentToChildren.set(n.id, []); });
    edges.forEach(e => {
      childToParents.get(e.childId)?.push(e.parentId);
      parentToChildren.get(e.parentId)?.push(e.childId);
    });

    const roots = nodes.filter(n => (childToParents.get(n.id) ?? []).length === 0);
    const gen = new Map<string, number>();
    const queue = roots.map(r => ({ id: r.id, g: 0 }));
    while (queue.length > 0) {
      const { id, g } = queue.shift()!;
      if (!gen.has(id) || gen.get(id)! < g) {
        gen.set(id, g);
        (parentToChildren.get(id) ?? []).forEach(cid => queue.push({ id: cid, g: g + 1 }));
      }
    }
    nodes.forEach(n => { if (!gen.has(n.id)) gen.set(n.id, 0); });

    const byGen = new Map<number, string[]>();
    gen.forEach((g, id) => {
      if (!byGen.has(g)) byGen.set(g, []);
      byGen.get(g)!.push(id);
    });

    const NODE_W = 130;
    const H_GAP = 20;
    const V_GAP = 90;
    const positions = new Map<string, { x: number; y: number }>();

    byGen.forEach((ids, g) => {
      const totalW = ids.length * NODE_W + (ids.length - 1) * H_GAP;
      const startX = Math.max(10, 340 - totalW / 2);
      ids.forEach((id, i) => {
        positions.set(id, {
          x: startX + i * (NODE_W + H_GAP) + NODE_W / 2,
          y: 36 + g * V_GAP,
        });
      });
    });

    return positions;
  }, [nodes, edges]);

  // Canvas render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const NODE_W = 130;
    const NODE_H = 48;

    let af: number;
    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      if (nodes.length === 0) {
        ctx.font = '12px system-ui';
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Add nodes to build the org chart', W / 2, H / 2);
        af = requestAnimationFrame(draw);
        return;
      }

      // Draw edges
      for (const edge of edges) {
        const p = layout.get(edge.parentId);
        const c = layout.get(edge.childId);
        if (!p || !c) continue;
        const midY = (p.y + NODE_H / 2 + c.y - NODE_H / 2) / 2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y + NODE_H / 2);
        ctx.lineTo(p.x, midY);
        ctx.lineTo(c.x, midY);
        ctx.lineTo(c.x, c.y - NODE_H / 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Draw nodes
      for (const node of nodes) {
        const pos = layout.get(node.id);
        if (!pos) continue;
        const x = pos.x - NODE_W / 2;
        const y = pos.y - NODE_H / 2;
        const isSelected = node.id === selectedId;
        const color = node.color || '#4A6FA5';

        ctx.beginPath();
        ctx.roundRect(x, y, NODE_W, NODE_H, 6);
        ctx.fillStyle = color + '33';
        ctx.fill();
        ctx.strokeStyle = isSelected ? 'rgba(208,188,255,0.9)' : color + 'aa';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.stroke();

        // Label (name)
        ctx.font = 'bold 11px system-ui';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const name = node.label.length > 16 ? node.label.slice(0, 15) + '…' : node.label;
        ctx.fillText(name, pos.x, pos.y - 8);

        // Role subtitle
        if (node.role) {
          ctx.font = '10px system-ui';
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          const role = node.role.length > 18 ? node.role.slice(0, 17) + '…' : node.role;
          ctx.fillText(role, pos.x, pos.y + 8);
        }
      }

      af = requestAnimationFrame(draw);
    };

    af = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(af);
  }, [nodes, edges, layout, selectedId]);

  // Resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; });
    ro.observe(canvas);
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    return () => ro.disconnect();
  }, []);

  // Click to select
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const NODE_W = 130;
    const NODE_H = 48;
    for (const node of nodes) {
      const pos = layout.get(node.id);
      if (!pos) continue;
      if (mx >= pos.x - NODE_W / 2 && mx <= pos.x + NODE_W / 2 &&
          my >= pos.y - NODE_H / 2 && my <= pos.y + NODE_H / 2) {
        setSelectedId(prev => prev === node.id ? null : node.id);
        return;
      }
    }
    setSelectedId(null);
  };

  const NODE_COLORS = ['#4A6FA5', '#6B4C9A', '#2E8B57', '#C0392B', '#D46A1A', '#1A7A8A', '#7A4A2E'];

  const addNode = () => {
    if (!newNode.label.trim()) return;
    const label = newNode.entityId
      ? (entities.find(e => e.id === newNode.entityId)?.name ?? newNode.label)
      : newNode.label;
    const node: OrgNode = {
      id: crypto.randomUUID(),
      label,
      role: newNode.role,
      entityId: newNode.entityId,
      color: newNode.color || NODE_COLORS[nodes.length % NODE_COLORS.length],
    };
    onChange({ ...content, nodes: [...nodes, node] });
    setNewNode({ label: '', role: '', entityId: '', color: NODE_COLORS[(nodes.length + 1) % NODE_COLORS.length] });
    setShowAddNode(false);
  };

  const removeNode = (id: string) => {
    onChange({
      ...content,
      nodes: nodes.filter(n => n.id !== id),
      edges: edges.filter(e => e.parentId !== id && e.childId !== id),
    });
    if (selectedId === id) setSelectedId(null);
  };

  const addEdge = () => {
    if (!newEdge.parentId || !newEdge.childId || newEdge.parentId === newEdge.childId) return;
    if (edges.some(e => e.parentId === newEdge.parentId && e.childId === newEdge.childId)) return;
    const edge: OrgEdge = { id: crypto.randomUUID(), parentId: newEdge.parentId, childId: newEdge.childId };
    onChange({ ...content, edges: [...edges, edge] });
    setNewEdge({ parentId: '', childId: '' });
    setShowAddEdge(false);
  };

  const selectedNode = nodes.find(n => n.id === selectedId);

  return (
    <div className={styles.orgChartWidget}>
      <div className={styles.orgChartToolbar}>
        <button className={styles.orgChartBtn} onClick={() => { setShowAddNode(v => !v); setShowAddEdge(false); }}>+ Node</button>
        <button className={styles.orgChartBtn} disabled={nodes.length < 2} onClick={() => { setShowAddEdge(v => !v); setShowAddNode(false); }}>+ Link</button>
        {selectedNode && (
          <button className={styles.orgChartDeleteBtn} onClick={() => removeNode(selectedNode.id)}>
            Remove "{selectedNode.label}"
          </button>
        )}
        <span className={styles.orgChartStats}>{nodes.length} nodes</span>
      </div>

      {showAddNode && (
        <div className={styles.orgChartForm}>
          <select className={styles.orgChartSelect} value={newNode.entityId}
            onChange={e => setNewNode(v => ({ ...v, entityId: e.target.value, label: e.target.value ? (entities.find(en => en.id === e.target.value)?.name ?? '') : v.label }))}>
            <option value="">Link entity (optional)</option>
            {worldEntities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <input className={styles.orgChartInput} placeholder="Name *" value={newNode.label} onChange={e => setNewNode(v => ({ ...v, label: e.target.value }))} />
          <input className={styles.orgChartInput} placeholder="Role / Title (e.g. Commander)" value={newNode.role} onChange={e => setNewNode(v => ({ ...v, role: e.target.value }))} />
          <div className={styles.orgChartColorRow}>
            <span className={styles.orgChartColorLabel}>Color:</span>
            {NODE_COLORS.map(c => (
              <button key={c} className={`${styles.orgChartColorSwatch} ${newNode.color === c ? styles.orgChartColorSwatchActive : ''}`}
                style={{ background: c }} onClick={() => setNewNode(v => ({ ...v, color: c }))} />
            ))}
          </div>
          <div className={styles.orgChartFormBtns}>
            <button className={styles.orgChartConfirmBtn} onClick={addNode}>Add</button>
            <button className={styles.orgChartCancelBtn} onClick={() => setShowAddNode(false)}>Cancel</button>
          </div>
        </div>
      )}

      {showAddEdge && (
        <div className={styles.orgChartForm}>
          <select className={styles.orgChartSelect} value={newEdge.parentId} onChange={e => setNewEdge(v => ({ ...v, parentId: e.target.value }))}>
            <option value="">Parent node…</option>
            {nodes.map(n => <option key={n.id} value={n.id}>{n.label}{n.role ? ` (${n.role})` : ''}</option>)}
          </select>
          <select className={styles.orgChartSelect} value={newEdge.childId} onChange={e => setNewEdge(v => ({ ...v, childId: e.target.value }))}>
            <option value="">Child node…</option>
            {nodes.map(n => <option key={n.id} value={n.id}>{n.label}{n.role ? ` (${n.role})` : ''}</option>)}
          </select>
          <div className={styles.orgChartFormBtns}>
            <button className={styles.orgChartConfirmBtn} onClick={addEdge}>Link</button>
            <button className={styles.orgChartCancelBtn} onClick={() => setShowAddEdge(false)}>Cancel</button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className={styles.orgChartCanvas} onClick={handleClick} />
    </div>
  );
}
