"use client";

import { useState, useRef, useEffect, useMemo } from 'react';
import { Clock, Maximize2, Minimize2, Pause, Play, RotateCcw, Timer } from 'lucide-react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import styles from '../../WritingDesk.module.css';

export function ProgressRenderer({ content, onChange }: { content: any; onChange: (c: any) => void; }) {
  const activeProjectId = useWorkspaceStore(s => s.activeProjectId);
  const scenes = useWorkspaceStore(s => s.scenes);
  const totalWords = useMemo(() => 
    scenes.filter(s => s.projectId === activeProjectId).reduce((acc, s) => acc + (s.wordCount || 0), 0),
    [scenes, activeProjectId]
  );
  
  // Local state for dailyTarget so the number input doesn't call onChange on every keypress
  const [localTarget, setLocalTarget] = useState(content.dailyTarget || 2000);
  const targetDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPropTarget = useRef(content.dailyTarget);

  useEffect(() => {
    if (content.dailyTarget !== lastPropTarget.current) {
      setLocalTarget(content.dailyTarget || 2000);
      lastPropTarget.current = content.dailyTarget;
    }
  }, [content.dailyTarget]);

  useEffect(() => () => { if (targetDebounceRef.current) clearTimeout(targetDebounceRef.current); }, []);

  const progressPercent = Math.min(100, (totalWords % localTarget / localTarget) * 100);

  // Timer logic
  const [now, setNow] = useState(Date.now());
  const isRunning = content.timerRunning || false;
  const timerStart = content.timerStart || null;
  const timerElapsed = content.timerElapsed || 0;

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  const totalElapsedMs = isRunning ? timerElapsed + (now - (timerStart || now)) : timerElapsed;
  const seconds = Math.floor((totalElapsedMs / 1000) % 60);
  const minutes = Math.floor((totalElapsedMs / (1000 * 60)) % 60);
  const hours = Math.floor(totalElapsedMs / (1000 * 60 * 60));

  const formatTime = (h: number, m: number, s: number) => 
    `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

  const toggleTimer = () => {
    if (isRunning) {
      onChange({ ...content, timerRunning: false, timerElapsed: totalElapsedMs, timerStart: null });
    } else {
      onChange({ ...content, timerRunning: true, timerStart: Date.now(), sessionStartCount: totalWords });
    }
  };

  const resetTimer = () => {
    onChange({ ...content, timerRunning: false, timerElapsed: 0, timerStart: null });
  };

  const sessionWords = totalWords - (content.sessionStartCount || totalWords);
  const pace = totalElapsedMs > 60000 ? Math.round((sessionWords / (totalElapsedMs / 3600000))) : 0;

  const isCompact = content.isCompact || false;

  if (isCompact) {
    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progressPercent / 100) * circumference;
    
    return (
      <div className={styles.progressCompact}>
        <div className={styles.compactRing}>
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
            <circle cx="40" cy="40" r={radius} fill="none" stroke="var(--accent)" strokeWidth="6" 
                    strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" transform="rotate(-90 40 40)" />
          </svg>
          <div className={styles.compactValue}>{totalWords}</div>
        </div>
        <button className={styles.compactToggleBtn} onClick={() => onChange({ ...content, isCompact: false })} aria-label="Expand widget"><Maximize2 size={13} /></button>
      </div>
    );
  }

  return (
    <div className={styles.progress}>
      <div className={styles.structureHeader} style={{ marginBottom: '-10px', padding: '0 4px' }}>
        <div className={styles.progressLabel} style={{ marginTop: 0, opacity: 0.6 }}>Momentum Engine</div>
        <button className={styles.sceneControlCompactToggle} onClick={() => onChange({ ...content, isCompact: true })} aria-label="Collapse widget"><Minimize2 size={13} /></button>
      </div>

      <div className={styles.progressStat}>
        <div className={styles.progressValue}>{totalWords.toLocaleString()}</div>
        <div className={styles.progressLabel}>Total Project Words</div>
      </div>

      <div className={styles.progressBarGroup}>
        <div className={styles.progressBarContainer}>
          <div className={styles.progressBarFill} style={{ width: `${progressPercent}%` }} />
        </div>
        <div className={styles.progressGoals}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>GOAL:</span>
            <input 
              aria-label="Daily word goal"
              type="number" 
              className={styles.beatTitleInput} 
              style={{ width: '60px', fontSize: '0.6875rem', padding: '0 4px', border: 'none', background: 'rgba(255,255,255,0.03)' }} 
              value={localTarget} 
              onChange={e => {
                const val = parseInt(e.target.value) || 0;
                setLocalTarget(val);
                lastPropTarget.current = val;
                if (targetDebounceRef.current) clearTimeout(targetDebounceRef.current);
                targetDebounceRef.current = setTimeout(() => onChange({ ...content, dailyTarget: val }), 600);
              }} 
            />
          </div>
          <span>{Math.round(progressPercent)}%</span>
        </div>
      </div>

      <div className={styles.timer}>
        <div className={styles.timerLabel}>{content.timerMode === 'pomodoro' ? 'POMODORO SPRINT' : 'SESSION CLOCK'}</div>
        <div className={styles.timerDisplay}>{formatTime(hours, minutes, seconds)}</div>
        <div className={styles.timerControls}>
          <button className={`${styles.timerBtn} ${isRunning ? styles.timerBtnActive : ''}`} onClick={toggleTimer} aria-label={isRunning ? 'Pause timer' : 'Start timer'}>
            {isRunning ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button className={styles.timerBtn} onClick={resetTimer} aria-label="Reset timer">
            <RotateCcw size={14} />
          </button>
          <button className={styles.timerBtn} onClick={() => onChange({ ...content, timerMode: content.timerMode === 'pomodoro' ? 'session' : 'pomodoro' })} aria-label={content.timerMode === 'pomodoro' ? 'Switch to session clock' : 'Switch to pomodoro sprint'}>
            {content.timerMode === 'pomodoro' ? <Timer size={14} /> : <Clock size={14} />}
          </button>
        </div>
      </div>

      <div className={styles.progressPace}>
        {pace > 0 ? `🔥 Pacing at ${pace} words/hour` : 'Start writing to measure pace...'}
      </div>

      <div className={styles.motivation}>
        {totalWords === 0 ? "Every masterpiece starts with a single word." : 
         progressPercent > 80 ? "You're in the home stretch!" :
         progressPercent > 50 ? "Past the halfway mark. Keep going!" :
         pace > 1000 ? "You're on fire! Don't stop now." :
         "The ink is flowing. Keep the momentum."}
      </div>
    </div>
  );
}
