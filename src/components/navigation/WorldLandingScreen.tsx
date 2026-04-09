"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { NewWorldModal } from '@/components/ui/NewWorldModal';
import { useWorkspaceStore } from '@/store/workspaceStore';
import styles from './WorldLandingScreen.module.css';

/**
 * WorldLandingScreen — Entry screen when no project is active.
 * Sprint 60B: Collapsible world groups, projects sorted by type then date.
 */

const MODE_LABELS: Record<string, string> = {
  'novel':       'Novels',
  'screenplay':  'Screenplays',
  'markdown':    'Markdown / Notes',
  'poetry':      'Poetry & Music',
  'real-world':  'Real World / Non-Fiction',
};

const MODE_ORDER = ['novel', 'screenplay', 'real-world', 'poetry', 'markdown'];

// ============================================================
// RIPPLE CANVAS — Interactive water-surface dot grid
// ============================================================

const DOT_SPACING = 28;
const RIPPLE_RADIUS = 120;
const RIPPLE_STRENGTH = 18;
const DECAY = 0.97;
const PROPAGATION = 0.18;
const DOT_RADIUS = 1.5;
const DOT_COLOR = 'rgba(255, 255, 255, 0.28)';
const DOT_LIT_COLOR = 'rgba(208, 188, 255, 0.75)';
// Minimum energy magnitude — values below this snap to zero to prevent
// dots getting frozen in a lit state due to floating-point accumulation.
const ENERGY_FLOOR = 0.05;

function RippleCanvas({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const frameRef = useRef<number>(0);
  const bufA = useRef<Float32Array>(new Float32Array(0));
  const bufB = useRef<Float32Array>(new Float32Array(0));
  const cols = useRef(0);
  const rows = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      canvas.width = w;
      canvas.height = h;
      cols.current = Math.ceil(w / DOT_SPACING) + 2;
      rows.current = Math.ceil(h / DOT_SPACING) + 2;
      const size = cols.current * rows.current;
      bufA.current = new Float32Array(size);
      bufB.current = new Float32Array(size);
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onMouseLeave = () => {
      mouseRef.current = null;
    };

    const tick = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) { frameRef.current = requestAnimationFrame(tick); return; }

      const C = cols.current;
      const R = rows.current;
      const a = bufA.current;
      const b = bufB.current;
      const W = canvas.width;
      const H = canvas.height;

      if (mouseRef.current) {
        const mx = mouseRef.current.x;
        const my = mouseRef.current.y;
        const gc = Math.round(mx / DOT_SPACING);
        const gr = Math.round(my / DOT_SPACING);
        const reach = Math.ceil(RIPPLE_RADIUS / DOT_SPACING);
        for (let dr = -reach; dr <= reach; dr++) {
          for (let dc = -reach; dc <= reach; dc++) {
            const c = gc + dc;
            const r = gr + dr;
            if (c < 0 || c >= C || r < 0 || r >= R) continue;
            const px = c * DOT_SPACING - mx;
            const py = r * DOT_SPACING - my;
            const dist = Math.sqrt(px * px + py * py);
            if (dist < RIPPLE_RADIUS) {
              a[r * C + c] += (1 - dist / RIPPLE_RADIUS) * RIPPLE_STRENGTH;
            }
          }
        }
      }

      for (let r = 1; r < R - 1; r++) {
        for (let c = 1; c < C - 1; c++) {
          const i = r * C + c;
          const neighbors =
            a[r * C + (c - 1)] +
            a[r * C + (c + 1)] +
            a[(r - 1) * C + c] +
            a[(r + 1) * C + c];
          const val = (neighbors * PROPAGATION + a[i] * (1 - PROPAGATION * 4)) * DECAY;
          // Snap near-zero values to exactly zero so dots stop glowing
          b[i] = Math.abs(val) < ENERGY_FLOOR ? 0 : val;
        }
      }

      // Explicitly decay boundary cells (ignored by propagation loop)
      // to ensure energy bleeds out and dots don't freeze lit at the edges.
      for (let c = 0; c < C; c++) {
        b[0 * C + c] = a[0 * C + c] * DECAY;
        b[(R - 1) * C + c] = a[(R - 1) * C + c] * DECAY;
        if (Math.abs(b[0 * C + c]) < ENERGY_FLOOR) b[0 * C + c] = 0;
        if (Math.abs(b[(R - 1) * C + c]) < ENERGY_FLOOR) b[(R - 1) * C + c] = 0;
      }
      for (let r = 1; r < R - 1; r++) {
        b[r * C + 0] = a[r * C + 0] * DECAY;
        b[r * C + (C - 1)] = a[r * C + (C - 1)] * DECAY;
        if (Math.abs(b[r * C + 0]) < ENERGY_FLOOR) b[r * C + 0] = 0;
        if (Math.abs(b[r * C + (C - 1)]) < ENERGY_FLOOR) b[r * C + (C - 1)] = 0;
      }

      const tmp = bufA.current;
      bufA.current = bufB.current;
      bufB.current = tmp;
      const cur = bufA.current;

      ctx.clearRect(0, 0, W, H);
      for (let r = 0; r < R; r++) {
        for (let c = 0; c < C; c++) {
          const disp = cur[r * C + c];
          const x = c * DOT_SPACING;
          const y = r * DOT_SPACING + disp;
          const intensity = Math.min(1, Math.abs(disp) / 8);
          ctx.beginPath();
          ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
          ctx.fillStyle = intensity > 0.05 ? DOT_LIT_COLOR : DOT_COLOR;
          ctx.fill();
        }
      }

      frameRef.current = requestAnimationFrame(tick);
    };

    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseleave', onMouseLeave);

    const ro = new ResizeObserver(resize);
    ro.observe(container);

    requestAnimationFrame(() => {
      resize();
      frameRef.current = requestAnimationFrame(tick);
    });

    return () => {
      cancelAnimationFrame(frameRef.current);
      ro.disconnect();
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [containerRef]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}


interface WorldLandingScreenProps {
  onEnter?: () => void;
}

import { NewProjectModal } from '@/components/ui/NewProjectModal';
import { ImportModal } from '@/components/ui/ImportModal';
import ExportModal from '@/components/ui/ExportModal';

export default function WorldLandingScreen({ onEnter }: WorldLandingScreenProps) {
  const [showNewWorld, setShowNewWorld] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const screenRef = useRef<HTMLDivElement>(null);
  const worlds = useWorkspaceStore(state => state.worlds);
  const projects = useWorkspaceStore(state => state.projects);
  const documents = useWorkspaceStore(state => state.documents);
  const scenes = useWorkspaceStore(state => state.scenes);
  const entities = useWorkspaceStore(state => state.entities);
  const setActiveProject = useWorkspaceStore(state => state.setActiveProject);
  const setActiveDocument = useWorkspaceStore(state => state.setActiveDocument);
  const setWorkspaceMode = useWorkspaceStore(state => state.setWorkspaceMode);

  const [expandedWorlds, setExpandedWorlds] = useState<Set<string>>(new Set());

  const toggleWorld = (worldId: string) => {
    setExpandedWorlds(prev => {
      const next = new Set(prev);
      if (next.has(worldId)) next.delete(worldId);
      else next.add(worldId);
      return next;
    });
  };

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(MODE_ORDER)
  );

  const toggleGroup = (mode: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(mode)) next.delete(mode);
      else next.add(mode);
      return next;
    });
  };

  const handleSelectProject = (projectId: string) => {
    setActiveProject(projectId);
    const projectDocs = documents
      .filter(d => d.projectId === projectId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    if (projectDocs.length > 0) setActiveDocument(projectDocs[0].id);
    setWorkspaceMode('desk');
    onEnter?.();
  };

  const handleResumeWriting = () => {
    if (projects.length === 0) return;
    const recent = [...projects].sort((a, b) =>
      new Date(b.updatedAt ?? b.createdAt).getTime() -
      new Date(a.updatedAt ?? a.createdAt).getTime()
    );
    handleSelectProject(recent[0].id);
    onEnter?.();
  };

  const getProjectStats = (projectId: string) => {
    const wordCount = scenes
      .filter(s => s.projectId === projectId)
      .reduce((sum, s) => sum + (s.wordCount ?? 0), 0);
    const entityCount = entities.filter(e => e.projectId === projectId).length;
    return { wordCount, entityCount };
  };

  const getGroupedProjects = (worldProjects: typeof projects) => {
    return MODE_ORDER.map(mode => ({
      mode,
      label: MODE_LABELS[mode] ?? mode,
      projects: worldProjects
        .filter(p => p.writingMode === mode)
        .sort((a, b) =>
          new Date(b.updatedAt ?? b.createdAt).getTime() -
          new Date(a.updatedAt ?? a.createdAt).getTime()
        ),
    }));
  };

  const worldList = [
    ...worlds,
    ...(projects.some(p => !p.worldId) ? [{ id: 'uncategorized', name: 'Uncategorized World' }] : [])
  ];

  return (
    <div className={styles.screen} ref={screenRef}>
      <RippleCanvas containerRef={screenRef} />

      <div className={styles.layout}>
        {/* ---- LEFT PANEL ---- */}
        <div className={styles.leftPanel}>
          <div className={styles.wordmark}>
            <div className={styles.wordmarkIcon}>M</div>
            <div>
              <div className={styles.wordmarkTitle}>MythForge</div>
              <div className={styles.wordmarkSub}>WORLD BUILDING STUDIO</div>
            </div>
          </div>

          <div className={styles.tagline}>
            <h1 className={styles.taglineHeading}>Build worlds.<br />Write stories.</h1>
            <p className={styles.taglineSub}>
              A freeform canvas for novelists, screenwriters, and worldbuilders.
              Your lore, your worlds, your way.
            </p>
          </div>

          <div className={styles.ctaGroup}>
            <button
              className={styles.ctaPrimary}
              onClick={() => setShowNewProject(true)}
            >
              → START NEW WRITING
            </button>
            <button
              className={styles.ctaSecondary}
              onClick={handleResumeWriting}
              disabled={projects.length === 0}
            >
              ↺ RESUME WRITING
            </button>
            <div className={styles.ctaSubGroup}>
              <button
                className={styles.ctaSecondary}
                onClick={() => setShowImport(true)}
              >
                📥 IMPORT
              </button>
              <button
                className={styles.ctaSecondary}
                onClick={() => setShowExport(true)}
                disabled={projects.length === 0}
              >
                📤 EXPORT
              </button>
            </div>
            <p className={styles.ctaHint}>
              {projects.length > 0
                ? `${projects.length} ${projects.length === 1 ? 'project' : 'projects'} across ${worlds.length} ${worlds.length === 1 ? 'world' : 'worlds'}`
                : 'Create your first world to begin'}
            </p>
          </div>

          <div className={styles.leftFooter}>
            <span>Part of the</span>
            <span className={styles.isoLabel}>ISO ecosystem</span>
          </div>
        </div>

        {/* ---- RIGHT PANEL ---- */}
        <div className={styles.rightPanel}>
          <div className={styles.rightHeader}>
            <span className={styles.rightLabel}>YOUR WORLDS</span>
            <span className={styles.rightCount}>{projects.length} total</span>
          </div>

          <div className={styles.worldHierarchy}>
            {worldList.map(world => {
              const worldProjects = projects.filter(p =>
                world.id === 'uncategorized' ? !p.worldId : p.worldId === world.id
              );
              const isExpanded = expandedWorlds.has(world.id);
              
              const totalWords = worldProjects.reduce((sum, p) => sum + getProjectStats(p.id).wordCount, 0);

              return (
                <div 
                  key={world.id} 
                  className={`${styles.worldCardRow} ${isExpanded ? styles.worldCardRowExpanded : ''}`}
                  style={{ '--world-accent': (world as any).coverColor || '#a078ff' } as React.CSSProperties}
                >
                  <button 
                    className={styles.worldCardHeader} 
                    onClick={() => toggleWorld(world.id)}
                  >
                    <div className={styles.worldCardHeaderLeft}>
                      <div className={styles.worldIndicator} />
                      <div className={styles.worldCardInfo}>
                        <div className={styles.worldCardName}>{world.name}</div>
                        <div className={styles.worldCardMeta}>
                          {(world as any).genre || 'General'} • {worldProjects.length} projects • {totalWords.toLocaleString()} words
                        </div>
                      </div>
                    </div>
                    <div className={styles.worldCardHeaderRight}>
                      {(world as any).logline && (
                        <div className={styles.worldLogline}>{(world as any).logline}</div>
                      )}
                      <span className={styles.worldExpandIcon}>{isExpanded ? '−' : '+'}</span>
                    </div>
                  </button>

                  <div className={styles.worldCardBody}>
                    <div className={styles.projectGrid}>
                      {worldProjects.length === 0 && (
                        <p className={styles.emptyHint}>No projects in this world yet.</p>
                      )}
                      {worldProjects.map(project => {
                        const { wordCount } = getProjectStats(project.id);
                        return (
                          <button
                            key={project.id}
                            className={styles.projectItem}
                            onClick={() => handleSelectProject(project.id)}
                          >
                            <div className={styles.projectCover} style={{ background: project.coverColor }}>
                              <span className={styles.projectInitials}>
                                {project.name.slice(0, 1).toUpperCase()}
                              </span>
                            </div>
                            <div className={styles.projectInfo}>
                              <div className={styles.projectTitle}>{project.name}</div>
                              <div className={styles.projectStats}>
                                {wordCount.toLocaleString()} words
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}

            <button 
              className={styles.addWorldCard}
              onClick={() => setShowNewWorld(true)}
            >
              <span className={styles.addWorldIcon}>+</span>
              <span className={styles.addWorldLabel}>Create New World</span>
            </button>
          </div>
        </div>
      </div>

      <NewWorldModal
        isOpen={showNewWorld}
        onClose={() => setShowNewWorld(false)}
      />

      <NewProjectModal
        isOpen={showNewProject}
        onClose={() => setShowNewProject(false)}
      />

      <ImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
      />

      {showExport && (
        <ExportModal
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}
