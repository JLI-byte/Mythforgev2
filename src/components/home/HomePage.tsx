"use client";

import React, { useEffect, useMemo, useState } from 'react';
import {
  Library, NotebookPen, Globe, LayoutTemplate, ArrowRight, Plus,
  PenLine, Flame, AlertTriangle, Sparkles, Send, BookOpen,
} from 'lucide-react';
import {
  useWorkspaceStore, WorkspaceMode, ENTITY_TYPE_LABELS, type EntityType,
} from '@/store/workspaceStore';
import { createClient } from '@/lib/supabase/client';
import { researchScopeKey } from '@/lib/researchScope';
import { makeNoteCard } from '@/lib/researchBoard';
import { worldKeyForProject, worldKeyForEntity } from '@/lib/worldKey';
import {
  dateKey, wordsOnDate, buildHeatmap, resolveResumeTarget, timeAgo,
  worldCounts, attentionCounts,
} from '@/lib/homeStats';
import { WritingHeatmap } from './WritingHeatmap';
import styles from './HomePage.module.css';

/**
 * HomePage — the logged-in home base the top-bar Home button lands on.
 *
 * A bento dashboard over data the app already tracks: where to resume writing,
 * today's goal, the writing streak and day heatmap, pending research flags,
 * World Bible size, and a quick-capture box that drops an idea straight onto
 * the project's research board.
 */

interface QuickLink {
  mode: WorkspaceMode;
  label: string;
  Icon: typeof Library;
}

const QUICK_LINKS: QuickLink[] = [
  { mode: 'bookshelf', label: 'Bookshelf', Icon: Library },
  { mode: 'desk', label: 'Writing Desk', Icon: NotebookPen },
  { mode: 'worldBible', label: 'World Bible', Icon: Globe },
  { mode: 'template', label: 'Draft Table', Icon: LayoutTemplate },
];

/** Weeks of history in the heatmap — about six months. */
const HEATMAP_WEEKS = 26;

/** Progress ring for today's word goal. */
function GoalRing({ written, target }: { written: number; target: number }) {
  const size = 104;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = target > 0 ? Math.min(1, written / target) : 0;
  const dash = circ * pct;

  return (
    <div className={styles.ringWrap}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={styles.ring}>
        <circle className={styles.ringTrack} cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle
          className={`${styles.ringFill} ${pct >= 1 ? styles.ringDone : ''}`}
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${dash} ${circ - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className={styles.ringCenter}>
        <span className={styles.ringValue}>{written.toLocaleString()}</span>
        <span className={styles.ringTarget}>of {target.toLocaleString()}</span>
      </div>
    </div>
  );
}

export default function HomePage() {
  const setWorkspaceMode = useWorkspaceStore(s => s.setWorkspaceMode);
  const setActiveProject = useWorkspaceStore(s => s.setActiveProject);
  const setActiveDocument = useWorkspaceStore(s => s.setActiveDocument);
  const setActiveScene = useWorkspaceStore(s => s.setActiveScene);
  const setSelectedEntity = useWorkspaceStore(s => s.setSelectedEntity);
  const updateResearchState = useWorkspaceStore(s => s.updateResearchState);

  const projects = useWorkspaceStore(s => s.projects);
  const documents = useWorkspaceStore(s => s.documents);
  const scenes = useWorkspaceStore(s => s.scenes);
  const entities = useWorkspaceStore(s => s.entities);
  const writingDays = useWorkspaceStore(s => s.writingDays);
  const goalConfig = useWorkspaceStore(s => s.goalConfig);
  const streakState = useWorkspaceStore(s => s.streakState);
  const researchStates = useWorkspaceStore(s => s.researchStates);
  const activeProjectId = useWorkspaceStore(s => s.activeProjectId);

  const [name, setName] = useState('Author');
  const [capture, setCapture] = useState('');
  const [captured, setCaptured] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (u) setName(u.user_metadata?.full_name || u.email?.split('@')[0] || 'Author');
    });
  }, []);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  // ── Derived stats ─────────────────────────────────────────
  const resume = useMemo(
    () => resolveResumeTarget({ projects, documents, scenes }),
    [projects, documents, scenes],
  );

  const target = goalConfig?.dailyWordTarget || 500;
  const todayWords = useMemo(
    () => wordsOnDate(writingDays, dateKey(new Date())),
    [writingDays],
  );

  const heatmap = useMemo(
    () => buildHeatmap(writingDays, new Date(), HEATMAP_WEEKS, target),
    [writingDays, target],
  );

  const attention = useMemo(() => attentionCounts(researchStates), [researchStates]);

  // World Bible scoped to the active project's world, matching the rest of the app.
  const activeProject = projects.find(p => p.id === activeProjectId) ?? null;
  const worldEntities = useMemo(() => {
    if (!activeProject) return entities;
    const key = worldKeyForProject(activeProject);
    return entities.filter(e => worldKeyForEntity(e) === key);
  }, [entities, activeProject]);

  const world = useMemo(() => worldCounts(worldEntities), [worldEntities]);

  // A single article to resurface — stable per mount, not per render.
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  useEffect(() => {
    if (worldEntities.length > 0) {
      setSpotlightIndex(Math.floor(Math.random() * worldEntities.length));
    }
  }, [worldEntities.length]);
  const spotlight = worldEntities[spotlightIndex] ?? null;

  const recent = [...projects]
    .sort((a, b) => {
      const at = new Date(a.updatedAt ?? a.createdAt).getTime();
      const bt = new Date(b.updatedAt ?? b.createdAt).getTime();
      return bt - at;
    })
    .slice(0, 6);

  // ── Actions ───────────────────────────────────────────────
  const openProject = (id: string) => {
    setActiveProject(id);
    setWorkspaceMode('desk');
  };

  const resumeWriting = () => {
    if (!resume) return;
    setActiveProject(resume.projectId);
    setActiveDocument(resume.documentId);
    setActiveScene(resume.sceneId ?? null);
    setWorkspaceMode('desk');
  };

  const openEntity = (id: string) => {
    setSelectedEntity(id);
    setWorkspaceMode('worldBible');
  };

  // Quick capture drops the idea on the active project's default research board.
  const captureIdea = () => {
    const text = capture.trim();
    const scopeKey = researchScopeKey('project', activeProject);
    if (!text || !scopeKey) return;
    const current = useWorkspaceStore.getState().researchStates[scopeKey]?.widgets ?? [];
    updateResearchState(scopeKey, { widgets: [...current, makeNoteCard(text, current.length)] });
    setCapture('');
    setCaptured(true);
    setTimeout(() => setCaptured(false), 2400);
  };

  return (
    <div className={styles.home}>
      <div className={styles.inner}>
        <header className={styles.hero}>
          <div>
            <p className={styles.greeting}>{greeting},</p>
            <h1 className={styles.name}>{name}</h1>
          </div>

          <div className={styles.captureRow}>
            <input
              className={styles.captureInput}
              value={capture}
              onChange={e => setCapture(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') captureIdea(); }}
              placeholder={activeProject
                ? `Capture an idea for ${activeProject.name}…`
                : 'Open a project to capture ideas…'}
              disabled={!activeProject}
            />
            <button
              className={styles.captureBtn}
              onClick={captureIdea}
              disabled={!activeProject || !capture.trim()}
              title="Send to the research board"
            >
              <Send size={15} />
            </button>
            {captured && <span className={styles.captureToast}>Added to your research board</span>}
          </div>
        </header>

        <section className={styles.bento}>
          {/* Resume — the hero tile */}
          <div className={`${styles.tile} ${styles.tileResume}`}>
            {resume ? (
              <>
                <span className={styles.tileLabel}><PenLine size={14} /> Pick up where you left off</span>
                <h2 className={styles.resumeTitle}>{resume.label}</h2>
                <p className={styles.resumeMeta}>
                  {resume.projectName} · {resume.wordCount.toLocaleString()} words · {timeAgo(resume.updatedAt)}
                </p>
                <button className={styles.resumeBtn} onClick={resumeWriting}>
                  Continue writing <ArrowRight size={16} />
                </button>
              </>
            ) : (
              <>
                <span className={styles.tileLabel}><PenLine size={14} /> Start writing</span>
                <h2 className={styles.resumeTitle}>Nothing written yet</h2>
                <p className={styles.resumeMeta}>Create a project and your last scene will wait for you here.</p>
                <button className={styles.resumeBtn} onClick={() => setWorkspaceMode('bookshelf')}>
                  Go to the Bookshelf <ArrowRight size={16} />
                </button>
              </>
            )}
          </div>

          {/* Today's goal */}
          <div className={`${styles.tile} ${styles.tileGoal}`}>
            <span className={styles.tileLabel}>Today</span>
            <GoalRing written={todayWords} target={target} />
            <p className={styles.tileFoot}>
              {todayWords >= target
                ? 'Daily goal met'
                : `${(target - todayWords).toLocaleString()} words to go`}
            </p>
          </div>

          {/* Streak */}
          <div className={`${styles.tile} ${styles.tileStreak}`}>
            <span className={styles.tileLabel}>Streak</span>
            <div className={styles.streakValue}>
              <Flame size={26} className={streakState.currentStreak > 0 ? styles.flameLit : styles.flameCold} />
              <span className={styles.streakNumber}>{streakState.currentStreak}</span>
            </div>
            <p className={styles.tileFoot}>
              day{streakState.currentStreak === 1 ? '' : 's'} · best {streakState.longestStreak}
            </p>
          </div>

          {/* Heatmap */}
          <div className={`${styles.tile} ${styles.tileHeatmap}`}>
            <div className={styles.tileHead}>
              <span className={styles.tileLabel}>Writing days</span>
              <span className={styles.tileHint}>
                {streakState.totalWordsAllTime.toLocaleString()} words all time
              </span>
            </div>
            <WritingHeatmap columns={heatmap} />
          </div>

          {/* Needs attention */}
          <div className={`${styles.tile} ${styles.tileAttention}`}>
            <span className={styles.tileLabel}><AlertTriangle size={14} /> Needs attention</span>
            {attention.flags + attention.suggestions > 0 ? (
              <ul className={styles.attentionList}>
                {attention.flags > 0 && (
                  <li><strong>{attention.flags}</strong> consistency flag{attention.flags === 1 ? '' : 's'}</li>
                )}
                {attention.suggestions > 0 && (
                  <li><strong>{attention.suggestions}</strong> suggested article{attention.suggestions === 1 ? '' : 's'}</li>
                )}
              </ul>
            ) : (
              <p className={styles.tileEmpty}>Nothing flagged. Ask the research assistant to review your world.</p>
            )}
            <button className={styles.tileLink} onClick={() => setWorkspaceMode('research')}>
              Open Research <ArrowRight size={14} />
            </button>
          </div>

          {/* World at a glance */}
          <div className={`${styles.tile} ${styles.tileWorld}`}>
            <div className={styles.tileHead}>
              <span className={styles.tileLabel}><Globe size={14} /> Your world</span>
              <span className={styles.tileHint}>{world.total} article{world.total === 1 ? '' : 's'}</span>
            </div>
            {world.byType.length > 0 ? (
              <ul className={styles.worldList}>
                {world.byType.slice(0, 5).map(({ type, count }) => (
                  <li key={type} className={styles.worldRow}>
                    <span className={styles.worldType}>
                      {ENTITY_TYPE_LABELS[type as EntityType] ?? type}
                    </span>
                    <span className={styles.worldCount}>{count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.tileEmpty}>No articles yet.</p>
            )}
            <button className={styles.tileLink} onClick={() => setWorkspaceMode('worldBible')}>
              Open World Bible <ArrowRight size={14} />
            </button>
          </div>

          {/* From your world */}
          <div className={`${styles.tile} ${styles.tileLore}`}>
            <span className={styles.tileLabel}><Sparkles size={14} /> From your world</span>
            {spotlight ? (
              <>
                <h3 className={styles.loreName}>{spotlight.name}</h3>
                <p className={styles.loreDesc}>
                  {spotlight.description?.trim()
                    ? spotlight.description
                    : ENTITY_TYPE_LABELS[spotlight.type as EntityType] ?? spotlight.type}
                </p>
                <button className={styles.tileLink} onClick={() => openEntity(spotlight.id)}>
                  <BookOpen size={14} /> Read it
                </button>
              </>
            ) : (
              <p className={styles.tileEmpty}>Write an article and it will resurface here.</p>
            )}
          </div>

          {/* Quick links */}
          <div className={`${styles.tile} ${styles.tileLinks}`}>
            <span className={styles.tileLabel}>Jump to</span>
            <div className={styles.linkGrid}>
              {QUICK_LINKS.map(link => (
                <button
                  key={link.mode}
                  className={styles.linkBtn}
                  onClick={() => setWorkspaceMode(link.mode)}
                >
                  <link.Icon size={17} strokeWidth={1.6} />
                  {link.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.recentSection}>
          <div className={styles.recentHead}>
            <h2 className={styles.recentTitle}>Recent projects</h2>
            <button className={styles.recentAll} onClick={() => setWorkspaceMode('bookshelf')}>
              View all
            </button>
          </div>

          {recent.length > 0 ? (
            <div className={styles.recentGrid}>
              {recent.map(p => (
                <button
                  key={p.id}
                  className={styles.projectCard}
                  onClick={() => openProject(p.id)}
                >
                  <span
                    className={styles.projectCover}
                    style={p.coverImageUrl
                      ? { backgroundImage: `url(${p.coverImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                      : { background: p.coverColor || '#3a3a44' }}
                  />
                  <span className={styles.projectName}>{p.name}</span>
                  <span className={styles.projectMode}>{p.writingMode}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className={styles.emptyRecent}>
              <p className={styles.emptyText}>No projects yet.</p>
              <button className={styles.newBtn} onClick={() => setWorkspaceMode('bookshelf')}>
                <Plus size={16} /> Start on the Bookshelf
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
