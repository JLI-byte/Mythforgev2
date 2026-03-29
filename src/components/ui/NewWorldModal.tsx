"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useWorkspaceStore, COVER_COLORS, WorldGenre, World } from '@/store/workspaceStore';
import styles from './NewWorldModal.module.css';

// ─── Genre definitions ────────────────────────────────────────

const GENRES: {
  id: WorldGenre;
  icon: string;
  label: string;
  desc: string;
}[] = [
  { id: 'fantasy',          icon: '🏰', label: 'Fantasy',          desc: 'Magic, myth, and invented worlds' },
  { id: 'sci-fi',           icon: '🚀', label: 'Science Fiction',   desc: 'Technology, space, and the future' },
  { id: 'real-world',       icon: '🌍', label: 'Real World',        desc: 'Our world, factual or inspired by it' },
  { id: 'alternate-history',icon: '⚗️', label: 'Alternate History', desc: 'History took a different turn' },
  { id: 'horror',           icon: '🕷️', label: 'Horror',            desc: 'Fear, dread, and the unknown' },
  { id: 'contemporary',     icon: '🏙️', label: 'Contemporary',      desc: 'Modern life, literary or genre fiction' },
];

// ─── Writing mode definitions ─────────────────────────────────

type WritingMode = 'novel' | 'screenplay' | 'poetry' | 'markdown' | 'real-world';

const WRITING_MODES: {
  id: WritingMode;
  icon: string;
  label: string;
  desc: string;
}[] = [
  { id: 'novel',      icon: '📖', label: 'Novel',          desc: 'Chapters, scenes, long-form fiction' },
  { id: 'screenplay', icon: '🎬', label: 'Screenplay',     desc: 'Script format with scenes and elements' },
  { id: 'real-world', icon: '📰', label: 'Non-Fiction',    desc: 'Essays, memoir, journalism, research' },
  { id: 'poetry',     icon: '✍️', label: 'Poetry',         desc: 'Verse, stanzas, lyric writing' },
  { id: 'markdown',   icon: '📝', label: 'Notes / Lore',   desc: 'Reference, worldbuilding, lore docs' },
];

// ─── Pill selector component ──────────────────────────────────

function PillSelector<T extends string>({
  options, value, onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (val: T) => void;
}) {
  return (
    <div className={styles.pillRow}>
      {options.map(opt => (
        <button
          key={opt.id}
          className={`${styles.pill} ${value === opt.id ? styles.pillActive : ''}`}
          onClick={() => onChange(opt.id)}
          type="button"
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────

interface NewWorldModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewWorldModal({ isOpen, onClose }: NewWorldModalProps) {
  const projects = useWorkspaceStore(state => state.projects);
  const addWorld = useWorkspaceStore(state => state.addWorld);
  const addProject = useWorkspaceStore(state => state.addProject);
  const addDocument = useWorkspaceStore(state => state.addDocument);
  const addScene = useWorkspaceStore(state => state.addScene);
  const setActiveProject = useWorkspaceStore(state => state.setActiveProject);
  const setActiveDocument = useWorkspaceStore(state => state.setActiveDocument);
  const setActiveScene = useWorkspaceStore(state => state.setActiveScene);

  // Step
  const [step, setStep] = useState(1);

  // Step 1 — World identity
  const [worldName, setWorldName] = useState('');
  const [genre, setGenre] = useState<WorldGenre | null>(null);

  // Step 2 — World rules
  const [darkness, setDarkness] = useState<'dark' | 'balanced' | 'light'>('balanced');
  const [scale, setScale] = useState<'grounded' | 'balanced' | 'epic'>('balanced');
  const [humor, setHumor] = useState<'serious' | 'balanced' | 'comedic'>('balanced');
  const [magicExists, setMagicExists] = useState(false);
  const [techLevel, setTechLevel] = useState<World['techLevel']>('modern');
  const [timePeriod, setTimePeriod] = useState('');
  const [logline, setLogline] = useState('');

  // Step 3 — First project
  const [projectTitle, setProjectTitle] = useState('');
  const [writingMode, setWritingMode] = useState<WritingMode>('novel');

  const isDirty = worldName.trim().length > 0 || genre !== null;
  const coverColor = COVER_COLORS[projects.length % COVER_COLORS.length];

  // Sync project title to world name when blank
  useEffect(() => {
    if (step === 3 && !projectTitle) {
      setProjectTitle(worldName.trim());
    }
  }, [step, worldName, projectTitle]);

  // Conditional field visibility based on genre
  const showMagic = genre === 'fantasy' || genre === 'alternate-history' || genre === 'horror';
  const showTechLevel = genre !== 'real-world' && genre !== 'contemporary';
  const showTimePeriod = genre === 'real-world' || genre === 'contemporary' || genre === 'alternate-history';

  const reset = useCallback(() => {
    setStep(1);
    setWorldName('');
    setGenre(null);
    setDarkness('balanced');
    setScale('balanced');
    setHumor('balanced');
    setMagicExists(false);
    setTechLevel('modern');
    setTimePeriod('');
    setLogline('');
    setProjectTitle('');
    setWritingMode('novel');
  }, []);

  const handleClose = useCallback(() => {
    if (isDirty) {
      if (!window.confirm('Discard this new world?')) return;
    }
    reset();
    onClose();
  }, [isDirty, reset, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
      if (e.key === 'Enter') {
        if (step === 1 && step1Valid) setStep(2);
        else if (step === 2) setStep(3);
        else if (step === 3 && step3Valid) handleCreate();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, step, worldName, genre, projectTitle]);

  const step1Valid = worldName.trim().length > 0 && genre !== null;
  const step3Valid = projectTitle.trim().length > 0;

  const handleCreate = () => {
    if (!genre) return;

    const worldId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    const docId = crypto.randomUUID();
    const sceneId = crypto.randomUUID();

    const world: World = {
      id: worldId,
      name: worldName.trim(),
      genre,
      tone: { darkness, scale, humor },
      logline: logline.trim(),
      magicExists: showMagic ? magicExists : false,
      techLevel: showTechLevel ? techLevel : 'modern',
      timePeriod: showTimePeriod ? timePeriod.trim() : '',
      coverColor,
      createdAt: new Date(),
    };

    addWorld(world);
    addProject({
      id: projectId,
      name: projectTitle.trim(),
      writingMode,
      coverColor,
      worldId,
      createdAt: new Date(),
    });
    addDocument({
      id: docId,
      projectId,
      title: 'Chapter 1',
      content: '',
      createdAt: new Date(),
    });
    addScene({
      id: sceneId,
      documentId: docId,
      projectId,
      title: 'Scene 1',
      content: '',
      order: 0,
      createdAt: new Date(),
    });
    setActiveProject(projectId);
    setActiveDocument(docId);
    setActiveScene(sceneId);

    reset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        {/* ─── Header ─── */}
        <div className={styles.header}>
          <div className={styles.stepIndicator}>
            {[1, 2, 3].map(n => (
              <div
                key={n}
                className={`${styles.stepDot} ${step === n ? styles.stepDotActive : ''} ${step > n ? styles.stepDotDone : ''}`}
              />
            ))}
          </div>
          <div className={styles.headerTitle}>
            {step === 1 && 'Create a New World'}
            {step === 2 && 'Define the Rules'}
            {step === 3 && 'Start Your Story'}
          </div>
          <button className={styles.closeBtn} onClick={handleClose}>✕</button>
        </div>

        {/* ─── Step 1: World Identity ─── */}
        {step === 1 && (
          <div className={styles.stepBody}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>WORLD NAME</label>
              <input
                className={styles.textInput}
                type="text"
                placeholder="e.g. The Shattered Realm, 1920s New York..."
                value={worldName}
                onChange={e => setWorldName(e.target.value)}
                autoFocus
                maxLength={80}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>GENRE</label>
              <div className={styles.genreGrid}>
                {GENRES.map(g => (
                  <button
                    key={g.id}
                    className={`${styles.genreCard} ${genre === g.id ? styles.genreCardActive : ''}`}
                    onClick={() => setGenre(g.id)}
                    type="button"
                  >
                    <span className={styles.genreIcon}>{g.icon}</span>
                    <span className={styles.genreLabel}>{g.label}</span>
                    <span className={styles.genreDesc}>{g.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── Step 2: World Rules ─── */}
        {step === 2 && (
          <div className={styles.stepBody}>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>TONE — DARKNESS</label>
              <PillSelector
                options={[
                  { id: 'dark', label: 'Dark' },
                  { id: 'balanced', label: 'Balanced' },
                  { id: 'light', label: 'Light' },
                ]}
                value={darkness}
                onChange={setDarkness}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>TONE — SCALE</label>
              <PillSelector
                options={[
                  { id: 'grounded', label: 'Grounded' },
                  { id: 'balanced', label: 'Balanced' },
                  { id: 'epic', label: 'Epic' },
                ]}
                value={scale}
                onChange={setScale}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>TONE — HUMOR</label>
              <PillSelector
                options={[
                  { id: 'serious', label: 'Serious' },
                  { id: 'balanced', label: 'Balanced' },
                  { id: 'comedic', label: 'Comedic' },
                ]}
                value={humor}
                onChange={setHumor}
              />
            </div>

            {showMagic && (
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>MAGIC / SUPERNATURAL</label>
                <PillSelector
                  options={[
                    { id: 'true' as any, label: 'Exists' },
                    { id: 'false' as any, label: 'Does Not Exist' },
                  ]}
                  value={String(magicExists) as any}
                  onChange={(val: any) => setMagicExists(val === 'true')}
                />
              </div>
            )}

            {showTechLevel && (
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>TECHNOLOGY LEVEL</label>
                <PillSelector
                  options={[
                    { id: 'primitive', label: 'Primitive' },
                    { id: 'medieval', label: 'Medieval' },
                    { id: 'modern', label: 'Modern' },
                    { id: 'futuristic', label: 'Futuristic' },
                    { id: 'post-apocalyptic', label: 'Post-Apoc' },
                  ]}
                  value={techLevel}
                  onChange={setTechLevel}
                />
              </div>
            )}

            {showTimePeriod && (
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>TIME PERIOD</label>
                <input
                  className={styles.textInput}
                  type="text"
                  placeholder="e.g. 1920s, Present day, Victorian England..."
                  value={timePeriod}
                  onChange={e => setTimePeriod(e.target.value)}
                  maxLength={80}
                />
              </div>
            )}

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>
                LOGLINE
                <span className={styles.optional}> — optional</span>
              </label>
              <textarea
                className={styles.textarea}
                placeholder="Describe your world in one sentence..."
                value={logline}
                onChange={e => setLogline(e.target.value)}
                maxLength={200}
                rows={2}
              />
              <div className={styles.charCount}>{logline.length} / 200</div>
            </div>
          </div>
        )}

        {/* ─── Step 3: First Project ─── */}
        {step === 3 && (
          <div className={styles.stepBody}>
            <div className={styles.coverPreview} style={{ background: coverColor }}>
              <span className={styles.coverInitials}>
                {projectTitle.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'}
              </span>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>PROJECT TITLE</label>
              <input
                className={styles.textInput}
                type="text"
                placeholder="What are you writing?"
                value={projectTitle}
                onChange={e => setProjectTitle(e.target.value)}
                autoFocus
                maxLength={80}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>FORMAT</label>
              <div className={styles.modeGrid}>
                {WRITING_MODES.map(m => (
                  <button
                    key={m.id}
                    className={`${styles.modeCard} ${writingMode === m.id ? styles.modeCardActive : ''}`}
                    onClick={() => setWritingMode(m.id)}
                    type="button"
                  >
                    <span className={styles.modeIcon}>{m.icon}</span>
                    <span className={styles.modeLabel}>{m.label}</span>
                    <span className={styles.modeDesc}>{m.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── Footer navigation ─── */}
        <div className={styles.footer}>
          {step > 1 ? (
            <button className={styles.backBtn} onClick={() => setStep(s => s - 1)}>
              ← Back
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              className={styles.nextBtn}
              onClick={() => setStep(s => s + 1)}
              disabled={step === 1 && !step1Valid}
            >
              Next →
            </button>
          ) : (
            <button
              className={styles.createBtn}
              onClick={handleCreate}
              disabled={!step3Valid}
            >
              CREATE WORLD
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
