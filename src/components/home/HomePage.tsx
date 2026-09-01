"use client";

import React, { useEffect, useMemo, useState } from 'react';
import {
  Library, NotebookPen, Globe, LayoutTemplate, ArrowRight, Plus,
  PenLine, Flame, AlertTriangle, Sparkles, Send, BookOpen, Settings,
} from 'lucide-react';
import {
  useWorkspaceStore, WorkspaceMode, ENTITY_TYPE_LABELS, type EntityType,
} from '@/store/workspaceStore';
import { createClient } from '@/lib/supabase/client';
import { researchScopeKey } from '@/lib/researchScope';
import { makeNoteCard } from '@/lib/researchBoard';
import { STANDALONE_KEY, type WorldKey } from '@/lib/worldKey';
import {
  dateKey, wordsOnDate, buildHeatmap, resolveResumeTarget, timeAgo,
  attentionCounts,
} from '@/lib/homeStats';
import {
  WEEKDAY_LONG, normalizeWeekdayTargets, targetForDateKey, targetForDayIndex,
} from '@/lib/goalSchedule';
import { WritingHeatmap } from './WritingHeatmap';
import GoalScheduleModal from './GoalScheduleModal';
import { GoalRing } from './GoalRing';
import { buildShelves } from '@/lib/worldShelves';
import { WorldShelf } from './WorldShelf';
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

export default function HomePage() {
  const setWorkspaceMode = useWorkspaceStore(s => s.setWorkspaceMode);
  const setActiveProject = useWorkspaceStore(s => s.setActiveProject);
  const setActiveDocument = useWorkspaceStore(s => s.setActiveDocument);
  const setActiveScene = useWorkspaceStore(s => s.setActiveScene);
  const setSelectedEntity = useWorkspaceStore(s => s.setSelectedEntity);
  const updateResearchState = useWorkspaceStore(s => s.updateResearchState);
  const updateGoalConfig = useWorkspaceStore(s => s.updateGoalConfig);

  const projects = useWorkspaceStore(s => s.projects);
  const documents = useWorkspaceStore(s => s.documents);
  const scenes = useWorkspaceStore(s => s.scenes);
  const entities = useWorkspaceStore(s => s.entities);
  const writingDays = useWorkspaceStore(s => s.writingDays);
  const goalConfig = useWorkspaceStore(s => s.goalConfig);
  const streakState = useWorkspaceStore(s => s.streakState);
  const researchStates = useWorkspaceStore(s => s.researchStates);
  const activeProjectId = useWorkspaceStore(s => s.activeProjectId);
  const worlds = useWorkspaceStore(s => s.worlds);
  const setActiveWorldKey = useWorkspaceStore(s => s.setActiveWorldKey);

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

  // Today's goal, which a weekday schedule may override.
  const todayIndex = new Date().getDay();
  const target = targetForDayIndex(goalConfig, todayIndex);
  const isScheduledToday =
    typeof goalConfig?.weekdayWordTargets?.[todayIndex] === 'number';

  const [schedulingGoals, setSchedulingGoals] = useState(false);

  /**
   * The dial always sets *today's* goal. If today has a scheduled override the
   * drag edits that weekday; otherwise it edits the everyday target.
   */
  const setTodayTarget = (value: number) => {
    if (isScheduledToday) {
      const next = normalizeWeekdayTargets(goalConfig.weekdayWordTargets);
      next[todayIndex] = value;
      updateGoalConfig({ weekdayWordTargets: next });
    } else {
      updateGoalConfig({ dailyWordTarget: value });
    }
  };
  const todayWords = useMemo(
    () => wordsOnDate(writingDays, dateKey(new Date())),
    [writingDays],
  );

  const heatmap = useMemo(
    () => buildHeatmap(writingDays, new Date(), HEATMAP_WEEKS,
      key => targetForDateKey(goalConfig, key)),
    [writingDays, goalConfig],
  );

  const attention = useMemo(() => attentionCounts(researchStates), [researchStates]);

  const activeProject = projects.find(p => p.id === activeProjectId) ?? null;

  // Shelves cover every world, not just the active one — the tile exists to move
  // between worlds, so scoping it to the current one would defeat the point.
  const shelves = useMemo(
    () => buildShelves(worlds ?? [], projects, entities),
    [worlds, projects, entities],
  );

  const [selectedShelfKey, setSelectedShelfKey] = useState<WorldKey | null>(null);

  const openStory = (projectId: string) => {
    setActiveProject(projectId);
    setWorkspaceMode('desk');
  };

  const openBible = (key: WorldKey) => {
    // The standalone shelf has no world of its own; null is its world key.
    setActiveWorldKey(key === STANDALONE_KEY ? null : key);
    setWorkspaceMode('worldBible');
  };

  // A single article to resurface — stable per mount, not per render.
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  useEffect(() => {
    if (entities.length > 0) {
      setSpotlightIndex(Math.floor(Math.random() * entities.length));
    }
  }, [entities.length]);
  const spotlight = entities[spotlightIndex] ?? null;

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

          {/* Today's goal — drag the inner ring to set it, cog for the weekly schedule */}
          <div className={`${styles.tile} ${styles.tileGoal}`}>
            <span className={styles.tileLabel}>
              {isScheduledToday ? WEEKDAY_LONG[todayIndex] : 'Today'}
            </span>
            <button
              className={styles.goalCog}
              onClick={() => setSchedulingGoals(true)}
              title="Scheduled goals"
              aria-label="Set scheduled goals"
            >
              <Settings size={15} />
            </button>
            <GoalRing written={todayWords} target={target} onCommit={setTodayTarget} />
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

          {/* Your worlds — spines you open to reach the stories inside */}
          <div className={`${styles.tile} ${styles.tileWorld}`}>
            <div className={styles.tileHead}>
              <span className={styles.tileLabel}><Globe size={14} /> Your worlds</span>
              <span className={styles.tileHint}>
                {shelves.length} {shelves.length === 1 ? 'shelf' : 'shelves'}
              </span>
            </div>
            <WorldShelf
              shelves={shelves}
              size="tile"
              selectedKey={selectedShelfKey}
              onSelect={setSelectedShelfKey}
              onOpenStory={openStory}
              onOpenBible={openBible}
              emptyAction={
                <button className={styles.tileLink} onClick={() => setWorkspaceMode('bookshelf')}>
                  Go to the Bookshelf <ArrowRight size={14} />
                </button>
              }
            />
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

      {schedulingGoals && (
        <GoalScheduleModal
          config={goalConfig}
          onSave={updateGoalConfig}
          onClose={() => setSchedulingGoals(false)}
        />
      )}
    </div>
  );
}
