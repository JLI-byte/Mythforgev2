"use client";

import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { useWorkspaceStore, selectProjectWorldKey } from '@/store/workspaceStore';
import { worldKeyForEntity } from '@/lib/worldKey';
import styles from '../../ArticleGridEditor.module.css';

interface ArcBeat {
  id: string;
  label: string;        // scene/chapter label e.g. "Ch 1", "The Betrayal"
  value: number;        // emotional: -5 to 5 | goal: 0 to (stages.length - 1)
  notes: string;        // optional tooltip/note
}

export function CharacterArcWidget({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const entities = useWorkspaceStore(s => s.entities);
  const projectWorldKey = useWorkspaceStore(selectProjectWorldKey);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showAddBeat, setShowAddBeat] = useState(false);
  const [editingBeatId, setEditingBeatId] = useState<string | null>(null);
  const [newBeat, setNewBeat] = useState({ label: '', value: 0, notes: '' });
  const [hoveredBeatIdx, setHoveredBeatIdx] = useState<number | null>(null);

  const mode: 'emotional' | 'goal' = content.mode || 'emotional';
  const entityId: string = content.entityId || '';
  const beats: ArcBeat[] = content.beats || [];
  const goalStages: string[] = content.goalStages || ['Unaware', 'Aware', 'Pursuing', 'Achieved'];

  const worldCharacters = entities.filter(e =>
    worldKeyForEntity(e) === projectWorldKey && e.type === 'character'
  );

  const linkedEntity = entities.find(e => e.id === entityId);

  // Value range based on mode
  const minVal = mode === 'emotional' ? -5 : 0;
  const maxVal = mode === 'emotional' ? 5 : goalStages.length - 1;

  // ── Canvas render ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrame: number;

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      const PAD = { top: 24, right: 20, bottom: 40, left: 48 };
      const chartW = W - PAD.left - PAD.right;
      const chartH = H - PAD.top - PAD.bottom;

      ctx.clearRect(0, 0, W, H);

      // ── Background grid ──
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;

      // Horizontal grid lines
      const range = maxVal - minVal;
      const steps = mode === 'emotional' ? 10 : goalStages.length - 1;
      for (let i = 0; i <= steps; i++) {
        const y = PAD.top + chartH - (i / steps) * chartH;
        ctx.beginPath();
        ctx.moveTo(PAD.left, y);
        ctx.lineTo(PAD.left + chartW, y);
        ctx.stroke();
      }

      // ── Y-axis labels ──
      ctx.font = '10px system-ui';
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      if (mode === 'emotional') {
        // Labels: -5, 0, +5 and midpoints
        for (let v = minVal; v <= maxVal; v++) {
          const y = PAD.top + chartH - ((v - minVal) / range) * chartH;
          if (v === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.fillText('0', PAD.left - 6, y);
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
          } else if (v % 5 === 0 || v === minVal || v === maxVal) {
            ctx.fillText(v > 0 ? `+${v}` : `${v}`, PAD.left - 6, y);
          }
        }
        // Zero line highlight
        const zeroY = PAD.top + chartH - ((0 - minVal) / range) * chartH;
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(PAD.left, zeroY);
        ctx.lineTo(PAD.left + chartW, zeroY);
        ctx.stroke();
      } else {
        // Goal mode — label each stage
        goalStages.forEach((stage, i) => {
          const y = PAD.top + chartH - (i / (goalStages.length - 1)) * chartH;
          ctx.fillText(stage.length > 8 ? stage.slice(0, 7) + '…' : stage, PAD.left - 6, y);
        });
      }

      // ── X-axis line ──
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD.left, PAD.top + chartH);
      ctx.lineTo(PAD.left + chartW, PAD.top + chartH);
      ctx.stroke();

      if (beats.length === 0) {
        ctx.font = '12px system-ui';
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Add beats to plot the arc', W / 2, H / 2);
        animFrame = requestAnimationFrame(draw);
        return;
      }

      // ── Beat positions ──
      const beatX = (i: number) => PAD.left + (beats.length === 1 ? chartW / 2 : (i / (beats.length - 1)) * chartW);
      const beatY = (v: number) => PAD.top + chartH - ((v - minVal) / range) * chartH;

      // ── Line + fill ──
      if (beats.length > 1) {
        // Gradient fill under the line
        const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + chartH);
        grad.addColorStop(0, 'rgba(208,188,255,0.18)');
        grad.addColorStop(1, 'rgba(208,188,255,0)');

        ctx.beginPath();
        ctx.moveTo(beatX(0), beatY(beats[0].value));
        // Smooth curve using cardinal spline
        for (let i = 1; i < beats.length; i++) {
          const x0 = beatX(i - 1), y0 = beatY(beats[i - 1].value);
          const x1 = beatX(i), y1 = beatY(beats[i].value);
          const cpX = (x0 + x1) / 2;
          ctx.bezierCurveTo(cpX, y0, cpX, y1, x1, y1);
        }
        // Fill down to baseline
        ctx.lineTo(beatX(beats.length - 1), PAD.top + chartH);
        ctx.lineTo(beatX(0), PAD.top + chartH);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // Stroke line
        ctx.beginPath();
        ctx.moveTo(beatX(0), beatY(beats[0].value));
        for (let i = 1; i < beats.length; i++) {
          const x0 = beatX(i - 1), y0 = beatY(beats[i - 1].value);
          const x1 = beatX(i), y1 = beatY(beats[i].value);
          const cpX = (x0 + x1) / 2;
          ctx.bezierCurveTo(cpX, y0, cpX, y1, x1, y1);
        }
        ctx.strokeStyle = 'rgba(208,188,255,0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // ── Beat dots + labels ──
      beats.forEach((beat, i) => {
        const x = beatX(i);
        const y = beatY(beat.value);
        const isHovered = i === hoveredBeatIdx;

        ctx.beginPath();
        ctx.arc(x, y, isHovered ? 7 : 5, 0, Math.PI * 2);
        ctx.fillStyle = isHovered ? '#d0bcff' : 'rgba(208,188,255,0.9)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(14,14,14,0.6)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // X-axis label
        ctx.font = isHovered ? 'bold 10px system-ui' : '10px system-ui';
        ctx.fillStyle = isHovered ? 'rgba(208,188,255,1)' : 'rgba(255,255,255,0.45)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const shortLabel = beat.label.length > 8 ? beat.label.slice(0, 7) + '…' : beat.label;
        ctx.fillText(shortLabel, x, PAD.top + chartH + 6);

        // Hover tooltip
        if (isHovered && beat.notes) {
          const tipW = Math.min(160, beat.notes.length * 6 + 20);
          const tipX = Math.min(x - tipW / 2, W - tipW - 4);
          const tipY = y - 36;
          ctx.fillStyle = 'rgba(30,28,30,0.92)';
          ctx.beginPath();
          ctx.roundRect(tipX, tipY, tipW, 24, 4);
          ctx.fill();
          ctx.font = '10px system-ui';
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(
            beat.notes.length > 22 ? beat.notes.slice(0, 21) + '…' : beat.notes,
            tipX + 8, tipY + 12
          );
        }
      });

      animFrame = requestAnimationFrame(draw);
    };

    animFrame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrame);
  }, [beats, mode, goalStages, hoveredBeatIdx, minVal, maxVal]);

  // Canvas mouse → hover nearest beat
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || beats.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const PAD_LEFT = 48;
    const chartW = canvas.width - PAD_LEFT - 20;

    let closest: number | null = null;
    let closestDist = Infinity;
    beats.forEach((_, i) => {
      const x = PAD_LEFT + (beats.length === 1 ? chartW / 2 : (i / (beats.length - 1)) * chartW);
      const dist = Math.abs(mx - x);
      if (dist < closestDist && dist < 24) { closestDist = dist; closest = i; }
    });
    setHoveredBeatIdx(closest);
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

  const addBeat = () => {
    if (!newBeat.label.trim()) return;
    const beat: ArcBeat = {
      id: crypto.randomUUID(),
      label: newBeat.label,
      value: newBeat.value,
      notes: newBeat.notes,
    };
    onChange({ ...content, beats: [...beats, beat] });
    setNewBeat({ label: '', value: mode === 'emotional' ? 0 : 0, notes: '' });
    setShowAddBeat(false);
  };

  const removeBeat = (id: string) => {
    onChange({ ...content, beats: beats.filter(b => b.id !== id) });
  };

  const updateGoalStages = (raw: string) => {
    const stages = raw.split(',').map(s => s.trim()).filter(Boolean);
    if (stages.length >= 2) onChange({ ...content, goalStages: stages });
  };

  return (
    <div className={styles.arcWidget}>
      {/* Toolbar */}
      <div className={styles.arcToolbar}>
        {/* Character selector */}
        <select
          className={styles.arcSelect}
          value={entityId}
          onChange={e => onChange({ ...content, entityId: e.target.value })}
        >
          <option value="">No character linked</option>
          {worldCharacters.map(e => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>

        {/* Mode toggle */}
        <div className={styles.arcModeToggle}>
          <button
            className={`${styles.arcModeBtn} ${mode === 'emotional' ? styles.arcModeBtnActive : ''}`}
            onClick={() => onChange({ ...content, mode: 'emotional' })}
          >
            😮 Emotional
          </button>
          <button
            className={`${styles.arcModeBtn} ${mode === 'goal' ? styles.arcModeBtnActive : ''}`}
            onClick={() => onChange({ ...content, mode: 'goal' })}
          >
            🎯 Goal
          </button>
        </div>

        <button className={styles.arcAddBtn} onClick={() => setShowAddBeat(v => !v)}>
          + Beat
        </button>
      </div>

      {/* Goal stages editor */}
      {mode === 'goal' && (
        <div className={styles.arcStagesRow}>
          <span className={styles.arcStagesLabel}>Stages:</span>
          <input
            className={styles.arcStagesInput}
            defaultValue={goalStages.join(', ')}
            placeholder="Unaware, Aware, Pursuing, Achieved"
            onBlur={e => updateGoalStages(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') updateGoalStages(e.currentTarget.value); }}
          />
        </div>
      )}

      {/* Add beat form */}
      {showAddBeat && (
        <div className={styles.arcBeatForm}>
          <input
            className={styles.arcInput}
            placeholder="Beat label (e.g. Ch 1, The Betrayal)"
            value={newBeat.label}
            onChange={e => setNewBeat(v => ({ ...v, label: e.target.value }))}
          />
          {mode === 'emotional' ? (
            <div className={styles.arcSliderRow}>
              <span className={styles.arcSliderLabel}>
                {newBeat.value > 0 ? '+' : ''}{newBeat.value}
              </span>
              <input
                type="range"
                min={-5} max={5} step={1}
                className={styles.arcSlider}
                value={newBeat.value}
                onChange={e => setNewBeat(v => ({ ...v, value: parseInt(e.target.value) }))}
              />
              <span className={styles.arcSliderTick}>
                {newBeat.value <= -3 ? '😢' : newBeat.value <= -1 ? '😟' : newBeat.value === 0 ? '😐' : newBeat.value <= 2 ? '🙂' : '😄'}
              </span>
            </div>
          ) : (
            <select
              className={styles.arcSelect}
              value={newBeat.value}
              onChange={e => setNewBeat(v => ({ ...v, value: parseInt(e.target.value) }))}
            >
              {goalStages.map((stage, i) => (
                <option key={i} value={i}>{stage}</option>
              ))}
            </select>
          )}
          <input
            className={styles.arcInput}
            placeholder="Notes (optional, shown on hover)"
            value={newBeat.notes}
            onChange={e => setNewBeat(v => ({ ...v, notes: e.target.value }))}
          />
          <div className={styles.arcBeatFormBtns}>
            <button className={styles.arcConfirmBtn} onClick={addBeat}>Add Beat</button>
            <button className={styles.arcCancelBtn} onClick={() => setShowAddBeat(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Beat list (compact, below canvas) */}
      {beats.length > 0 && (
        <div className={styles.arcBeatList}>
          {beats.map((beat, i) => (
            <span
              key={beat.id}
              className={`${styles.arcBeatChip} ${i === hoveredBeatIdx ? styles.arcBeatChipHovered : ''}`}
            >
              {beat.label}
              {mode === 'emotional'
                ? ` (${beat.value > 0 ? '+' : ''}${beat.value})`
                : ` (${goalStages[beat.value] ?? beat.value})`}
              <button
                className={styles.arcBeatChipDelete}
                onClick={() => removeBeat(beat.id)}
                aria-label="Remove beat"
              ><X size={12} /></button>
            </span>
          ))}
        </div>
      )}

      {/* Chart canvas */}
      <canvas
        ref={canvasRef}
        className={styles.arcCanvas}
        onMouseMove={handleCanvasMouseMove}
        onMouseLeave={() => setHoveredBeatIdx(null)}
      />
    </div>
  );
}
