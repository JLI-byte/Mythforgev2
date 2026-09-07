"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useWorkspaceStore, selectProjectWorldKey } from '@/store/workspaceStore';
import { worldKeyForEntity } from '@/lib/worldKey';
import styles from '../../ArticleGridEditor.module.css';

interface FamilyMember {
  id: string;
  name: string;          // display name
  entityId: string;      // linked entity ID — empty string = manual name only
  gender: 'male' | 'female' | 'other' | '';
  notes: string;         // optional short note (e.g. "deceased", "adopted")
}

interface FamilyEdge {
  id: string;
  parentId: string;
  childId: string;
  relation: 'biological' | 'adopted' | 'step';
}

export function FamilyTreeWidget({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const entities = useWorkspaceStore(s => s.entities);
  const projectWorldKey = useWorkspaceStore(selectProjectWorldKey);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddEdge, setShowAddEdge] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', entityId: '', gender: '' as FamilyMember['gender'], notes: '' });
  const [newEdge, setNewEdge] = useState({ parentId: '', childId: '', relation: 'biological' as FamilyEdge['relation'] });

  const members: FamilyMember[] = content.members || [];
  const edges: FamilyEdge[] = content.edges || [];
  const worldEntities = entities.filter(e => worldKeyForEntity(e) === projectWorldKey);

  // ── Layout computation ──
  const layout = React.useMemo(() => {
    if (members.length === 0) return new Map<string, { x: number; y: number }>();

    // Build child→parents map
    const childToParents = new Map<string, string[]>();
    const parentToChildren = new Map<string, string[]>();
    members.forEach(m => {
      childToParents.set(m.id, []);
      parentToChildren.set(m.id, []);
    });
    edges.forEach(e => {
      childToParents.get(e.childId)?.push(e.parentId);
      parentToChildren.get(e.parentId)?.push(e.childId);
    });

    // Assign generations via BFS from roots
    const roots = members.filter(m => (childToParents.get(m.id) ?? []).length === 0);
    const gen = new Map<string, number>();
    const queue = roots.map(r => ({ id: r.id, g: 0 }));
    while (queue.length > 0) {
      const { id, g } = queue.shift()!;
      if (gen.has(id) && gen.get(id)! >= g) continue;
      gen.set(id, g);
      for (const childId of parentToChildren.get(id) ?? []) {
        queue.push({ id: childId, g: g + 1 });
      }
    }
    // Assign generation 0 to any unreachable members
    members.forEach(m => { if (!gen.has(m.id)) gen.set(m.id, 0); });

    // Group by generation
    const byGen = new Map<number, string[]>();
    gen.forEach((g, id) => {
      if (!byGen.has(g)) byGen.set(g, []);
      byGen.get(g)!.push(id);
    });

    const maxGen = Math.max(...Array.from(byGen.keys()), 0);
    const VERT_GAP = 100;
    const NODE_W = 120;
    const positions = new Map<string, { x: number; y: number }>();

    byGen.forEach((ids, g) => {
      const totalW = ids.length * NODE_W + (ids.length - 1) * 40;
      const startX = Math.max(10, 340 - totalW / 2); // center around 340px
      ids.forEach((id, i) => {
        positions.set(id, {
          x: startX + i * (NODE_W + 40) + NODE_W / 2,
          y: 40 + g * VERT_GAP,
        });
      });
    });

    return positions;
  }, [members, edges]);

  // ── Canvas render ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const GENDER_COLORS = {
      male: '#4A6FA5',
      female: '#9B59B6',
      other: '#2E8B57',
      '': '#555',
    };
    const NODE_W = 120;
    const NODE_H = 44;

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      if (members.length === 0) {
        ctx.font = '13px system-ui';
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Add members to build the family tree', W / 2, H / 2);
        return;
      }

      // Draw edges
      for (const edge of edges) {
        const p = layout.get(edge.parentId);
        const c = layout.get(edge.childId);
        if (!p || !c) continue;

        ctx.beginPath();
        const midY = (p.y + NODE_H / 2 + c.y - NODE_H / 2) / 2;
        ctx.moveTo(p.x, p.y + NODE_H / 2);
        ctx.lineTo(p.x, midY);
        ctx.lineTo(c.x, midY);
        ctx.lineTo(c.x, c.y - NODE_H / 2);
        ctx.strokeStyle = edge.relation === 'biological'
          ? 'rgba(255,255,255,0.2)'
          : 'rgba(208,188,255,0.35)';
        ctx.lineWidth = edge.relation === 'biological' ? 1.5 : 1;
        ctx.setLineDash(edge.relation === 'adopted' ? [4, 3] : []);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw nodes
      for (const member of members) {
        const pos = layout.get(member.id);
        if (!pos) continue;
        const x = pos.x - NODE_W / 2;
        const y = pos.y - NODE_H / 2;
        const isSelected = member.id === selectedId;
        const color = GENDER_COLORS[member.gender || ''];

        // Card background
        ctx.beginPath();
        ctx.roundRect(x, y, NODE_W, NODE_H, 6);
        ctx.fillStyle = color + '33'; // 20% opacity fill
        ctx.fill();
        ctx.strokeStyle = isSelected ? 'rgba(208,188,255,0.9)' : color + '88';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.stroke();

        // Name
        ctx.font = 'bold 11px system-ui';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const displayName = member.name.length > 14 ? member.name.slice(0, 13) + '…' : member.name;
        ctx.fillText(displayName, pos.x, pos.y - (member.notes ? 6 : 0));

        // Notes
        if (member.notes) {
          ctx.font = '10px system-ui';
          ctx.fillStyle = 'rgba(255,255,255,0.45)';
          ctx.fillText(member.notes, pos.x, pos.y + 8);
        }
      }

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [members, edges, layout, selectedId]);

  // Canvas click → select node
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const NODE_W = 120;
    const NODE_H = 44;

    for (const member of members) {
      const pos = layout.get(member.id);
      if (!pos) continue;
      if (
        x >= pos.x - NODE_W / 2 && x <= pos.x + NODE_W / 2 &&
        y >= pos.y - NODE_H / 2 && y <= pos.y + NODE_H / 2
      ) {
        setSelectedId(prev => prev === member.id ? null : member.id);
        return;
      }
    }
    setSelectedId(null);
  };

  // Resize canvas
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

  const addMember = () => {
    const name = newMember.entityId
      ? (entities.find(e => e.id === newMember.entityId)?.name ?? newMember.name)
      : newMember.name;
    if (!name.trim()) return;
    const member: FamilyMember = {
      id: crypto.randomUUID(),
      name,
      entityId: newMember.entityId,
      gender: newMember.gender,
      notes: newMember.notes,
    };
    onChange({ ...content, members: [...members, member] });
    setNewMember({ name: '', entityId: '', gender: '', notes: '' });
    setShowAddMember(false);
  };

  const removeMember = (id: string) => {
    onChange({
      ...content,
      members: members.filter(m => m.id !== id),
      edges: edges.filter(e => e.parentId !== id && e.childId !== id),
    });
    if (selectedId === id) setSelectedId(null);
  };

  const addEdge = () => {
    if (!newEdge.parentId || !newEdge.childId || newEdge.parentId === newEdge.childId) return;
    // Prevent duplicate
    const exists = edges.some(e => e.parentId === newEdge.parentId && e.childId === newEdge.childId);
    if (exists) return;
    const edge: FamilyEdge = {
      id: crypto.randomUUID(),
      parentId: newEdge.parentId,
      childId: newEdge.childId,
      relation: newEdge.relation,
    };
    onChange({ ...content, edges: [...edges, edge] });
    setNewEdge({ parentId: '', childId: '', relation: 'biological' });
    setShowAddEdge(false);
  };

  const selectedMember = members.find(m => m.id === selectedId);

  return (
    <div className={styles.familyTreeWidget}>
      {/* Toolbar */}
      <div className={styles.familyTreeToolbar}>
        <button className={styles.familyTreeBtn} onClick={() => { setShowAddMember(v => !v); setShowAddEdge(false); }}>
          + Person
        </button>
        <button
          className={styles.familyTreeBtn}
          onClick={() => { setShowAddEdge(v => !v); setShowAddMember(false); }}
          disabled={members.length < 2}
        >
          + Relationship
        </button>
        {selectedMember && (
          <button className={styles.familyTreeDeleteBtn} onClick={() => removeMember(selectedMember.id)}>
            Remove "{selectedMember.name}"
          </button>
        )}
        <span className={styles.familyTreeStats}>
          {members.length} member{members.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Add member form */}
      {showAddMember && (
        <div className={styles.familyTreeForm}>
          <select
            className={styles.familyTreeSelect}
            aria-label="Link member to entity"
            value={newMember.entityId}
            onChange={e => setNewMember(v => ({
              ...v,
              entityId: e.target.value,
              name: e.target.value
                ? (entities.find(en => en.id === e.target.value)?.name ?? '')
                : v.name,
            }))}
          >
            <option value="">Link to entity (optional)</option>
            {worldEntities
              .filter(e => !members.some(m => m.entityId === e.id))
              .map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <input
            className={styles.familyTreeInput}
            aria-label="Member name"
            placeholder="Name (required if no entity)"
            value={newMember.name}
            onChange={e => setNewMember(v => ({ ...v, name: e.target.value }))}
          />
          <select
            className={styles.familyTreeSelect}
            aria-label="Member gender"
            value={newMember.gender}
            onChange={e => setNewMember(v => ({ ...v, gender: e.target.value as FamilyMember['gender'] }))}
          >
            <option value="">Gender (optional)</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
          <input
            className={styles.familyTreeInput}
            aria-label="Member note"
            placeholder="Note e.g. 'deceased', 'adopted' (optional)"
            value={newMember.notes}
            onChange={e => setNewMember(v => ({ ...v, notes: e.target.value }))}
          />
          <div className={styles.familyTreeFormBtns}>
            <button className={styles.familyTreeConfirmBtn} onClick={addMember}>Add</button>
            <button className={styles.familyTreeCancelBtn} onClick={() => setShowAddMember(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Add relationship form */}
      {showAddEdge && (
        <div className={styles.familyTreeForm}>
          <select
            className={styles.familyTreeSelect}
            aria-label="Parent"
            value={newEdge.parentId}
            onChange={e => setNewEdge(v => ({ ...v, parentId: e.target.value }))}
          >
            <option value="">Parent…</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select
            className={styles.familyTreeSelect}
            aria-label="Child"
            value={newEdge.childId}
            onChange={e => setNewEdge(v => ({ ...v, childId: e.target.value }))}
          >
            <option value="">Child…</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select
            className={styles.familyTreeSelect}
            aria-label="Relationship kind"
            value={newEdge.relation}
            onChange={e => setNewEdge(v => ({ ...v, relation: e.target.value as FamilyEdge['relation'] }))}
          >
            <option value="biological">Biological</option>
            <option value="adopted">Adopted (dashed)</option>
            <option value="step">Step</option>
          </select>
          <div className={styles.familyTreeFormBtns}>
            <button className={styles.familyTreeConfirmBtn} onClick={addEdge}>Add</button>
            <button className={styles.familyTreeCancelBtn} onClick={() => setShowAddEdge(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className={styles.familyTreeCanvas}
        onClick={handleCanvasClick}
      />
    </div>
  );
}
