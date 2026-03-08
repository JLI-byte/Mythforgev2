/**
 * GoalsContent — Inner content for the Writing Goals panel
 *
 * Sprint 47B: Five-zone scrollable layout:
 *   Zone 1: Goal Setup Banner (shown when !goalConfigured)
 *   Zone 2: Today Card with progress ring, streak, session info
 *   Zone 3: Calendar Heatmap for current month
 *   Zone 4: Active Project Progress bars
 *   Zone 5: Achievements badge grid
 *
 * Reads all data from useWorkspaceStore — no props needed.
 */
"use client";

import React, { useState, useMemo } from 'react';
import styles from './GoalsContent.module.css';
import { useWorkspaceStore, BADGE_DEFINITIONS } from '@/store/workspaceStore';

// =============================================
// Helper: get today's date as YYYY-MM-DD
// =============================================
function getToday(): string {
    return new Date().toISOString().split('T')[0];
}

// =============================================
// Helper: build calendar grid for current month
// =============================================
interface CalendarDay {
    date: string;      // YYYY-MM-DD
    dayNum: number;    // 1-31
    isFuture: boolean;
    isToday: boolean;
}

function buildMonthGrid(): CalendarDay[] {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const today = getToday();

    // First day of month (0=Sun, adjust to Mon-start)
    const firstDay = new Date(year, month, 1);
    let startDow = firstDay.getDay() - 1; // Mon=0
    if (startDow < 0) startDow = 6; // Sun → 6

    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Build padding (empty) + real days
    const grid: CalendarDay[] = [];

    // Padding for days before the 1st
    for (let i = 0; i < startDow; i++) {
        grid.push({ date: '', dayNum: 0, isFuture: false, isToday: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dateObj = new Date(year, month, d);
        grid.push({
            date: dateStr,
            dayNum: d,
            isFuture: dateObj > now && dateStr !== today,
            isToday: dateStr === today,
        });
    }

    return grid;
}

// =============================================
// Progress ring bar colors by writing mode
// =============================================
const MODE_COLORS: Record<string, string> = {
    novel: '#4A6FA5',
    screenplay: '#6B4C9A',
    poetry: '#8B6914',
    markdown: '#2E8B57',
};

// =============================================
// SVG Progress Ring sub-component
// =============================================
function ProgressRing({
    progress,
    wordsToday,
    target,
}: {
    progress: number;
    wordsToday: number;
    target: number;
}) {
    const size = 80;
    const strokeWidth = 6;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - Math.min(progress, 1));

    // Color based on progress percentage
    let strokeColor = 'var(--muted)';
    if (progress >= 1) strokeColor = '#F5C842';
    else if (progress >= 0.5) strokeColor = '#4A6FA5';

    return (
        <div className={styles.ringWrap}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {/* Background circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="var(--border)"
                    strokeWidth={strokeWidth}
                />
                {/* Progress circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
            </svg>
            {/* Center text overlay */}
            <div className={styles.ringText}>
                <span className={styles.ringWords}>{wordsToday}</span>
                <span className={styles.ringTarget}>/ {target}</span>
            </div>
        </div>
    );
}

// =============================================
// Main GoalsContent component
// =============================================
export default function GoalsContent() {
    const goalConfig = useWorkspaceStore(s => s.goalConfig);
    const streakState = useWorkspaceStore(s => s.streakState);
    const writingDays = useWorkspaceStore(s => s.writingDays);
    const earnedBadges = useWorkspaceStore(s => s.earnedBadges);
    const projects = useWorkspaceStore(s => s.projects);
    const updateGoalConfig = useWorkspaceStore(s => s.updateGoalConfig);

    // Goal setup banner state
    const [selectedTarget, setSelectedTarget] = useState(200);
    const targetOptions = [100, 200, 500, 1000];

    // Today's stats
    const today = getToday();
    const todayDays = writingDays.filter(d => d.date === today);
    const wordsToday = todayDays.reduce((sum, d) => sum + d.wordsWritten, 0);
    const minutesToday = todayDays.reduce((sum, d) => sum + d.minutesWritten, 0);
    const progress = goalConfig.dailyWordTarget > 0
        ? wordsToday / goalConfig.dailyWordTarget
        : 0;
    const remaining = Math.max(goalConfig.dailyWordTarget - wordsToday, 0);
    const goalMetToday = wordsToday >= goalConfig.dailyWordTarget && goalConfig.dailyWordTarget > 0;

    // Calendar data
    const calendarGrid = useMemo(() => buildMonthGrid(), []);
    const dayHeaders = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

    // Build a map of date → aggregated stats for calendar coloring
    const dayStatsMap = useMemo(() => {
        const map: Record<string, { wordsWritten: number; goalMet: boolean }> = {};
        for (const d of writingDays) {
            if (!map[d.date]) {
                map[d.date] = { wordsWritten: 0, goalMet: false };
            }
            map[d.date].wordsWritten += d.wordsWritten;
            if (d.goalMet) map[d.date].goalMet = true;
        }
        return map;
    }, [writingDays]);

    // Badge data
    const allBadgeKeys = Object.keys(BADGE_DEFINITIONS) as (keyof typeof BADGE_DEFINITIONS)[];
    const earnedIds = new Set(earnedBadges.map(b => b.badgeId));
    // Sort: earned first, then locked
    const sortedBadgeKeys = [
        ...allBadgeKeys.filter(k => earnedIds.has(k)),
        ...allBadgeKeys.filter(k => !earnedIds.has(k)),
    ];

    /** Get calendar day CSS class based on writing stats */
    const getDayClass = (day: CalendarDay): string => {
        if (day.dayNum === 0) return styles.calDayEmpty;
        if (day.isFuture) return styles.calDayFuture;

        const stats = dayStatsMap[day.date];
        const classes = [styles.calDay];

        if (day.isToday) classes.push(styles.calDayToday);

        if (!stats) {
            classes.push(styles.calDayNone);
        } else if (stats.wordsWritten >= goalConfig.dailyWordTarget * 1.5) {
            classes.push(styles.calDayExceeded);
        } else if (stats.goalMet) {
            classes.push(styles.calDayMet);
        } else if (stats.wordsWritten > 0) {
            classes.push(styles.calDayPartial);
        } else {
            classes.push(styles.calDayNone);
        }

        return classes.join(' ');
    };

    return (
        <div className={styles.container}>

            {/* ==========================================
                ZONE 1 — Goal Setup Banner
                Only shown when goal not yet configured
               ========================================== */}
            {!goalConfig.goalConfigured && (
                <div className={styles.setupBanner}>
                    <h3 className={styles.setupTitle}>Set your daily writing goal</h3>
                    <p className={styles.setupSubtext}>How many words feel right for a good day?</p>

                    <div className={styles.setupOptions}>
                        {targetOptions.map(opt => (
                            <button
                                key={opt}
                                className={`${styles.setupOption} ${selectedTarget === opt ? styles.setupOptionSelected : ''}`}
                                onClick={() => setSelectedTarget(opt)}
                            >
                                {opt}
                            </button>
                        ))}
                    </div>

                    <p className={styles.setupHint}>You can change this anytime in settings</p>

                    <button
                        className={styles.setupStartBtn}
                        onClick={() => updateGoalConfig({
                            dailyWordTarget: selectedTarget,
                            goalConfigured: true,
                        })}
                    >
                        Start Writing
                    </button>
                </div>
            )}

            {/* ==========================================
                ZONE 2 — Today Card (hero)
               ========================================== */}
            <div className={styles.todayCard}>
                {/* Left: progress ring */}
                <ProgressRing
                    progress={progress}
                    wordsToday={wordsToday}
                    target={goalConfig.dailyWordTarget}
                />

                {/* Center: streak + goal status */}
                <div className={styles.todayCenter}>
                    <div className={styles.streakDisplay}>
                        <span className={styles.streakNumber}>
                            🔥 {streakState.currentStreak}
                        </span>
                        <span className={styles.streakLabel}>day streak</span>
                    </div>
                    {goalMetToday ? (
                        <span className={styles.goalMet}>Goal met today ✓</span>
                    ) : (
                        <span className={styles.goalRemaining}>
                            {remaining.toLocaleString()} words to go
                        </span>
                    )}
                </div>

                {/* Right: session info */}
                <div className={styles.todayRight}>
                    <div className={styles.sessionStat}>
                        <span className={styles.sessionNumber}>{minutesToday} min</span>
                        <span className={styles.sessionLabel}>today</span>
                    </div>
                    <div className={styles.sessionStat}>
                        <span className={styles.sessionNumber}>
                            {streakState.totalWordsAllTime.toLocaleString()}
                        </span>
                        <span className={styles.sessionLabel}>total words</span>
                    </div>
                </div>
            </div>

            {/* ==========================================
                ZONE 3 — Calendar Heatmap
               ========================================== */}
            <h4 className={styles.sectionHeader}>This Month</h4>
            <div className={styles.calendarWrap}>
                {/* Day letter headers */}
                <div className={styles.calHeaders}>
                    {dayHeaders.map((d, i) => (
                        <span key={i} className={styles.calHeaderDay}>{d}</span>
                    ))}
                </div>
                {/* Day grid */}
                <div className={styles.calGrid}>
                    {calendarGrid.map((day, i) => (
                        <div
                            key={i}
                            className={getDayClass(day)}
                            title={day.date ? `${day.date}: ${dayStatsMap[day.date]?.wordsWritten ?? 0} words` : ''}
                        >
                            {day.dayNum > 0 && (
                                <span className={styles.calDayNum}>{day.dayNum}</span>
                            )}
                        </div>
                    ))}
                </div>
                {/* Stats below calendar */}
                <div className={styles.calStats}>
                    <span>🔥 {streakState.currentStreak} day streak</span>
                    <span>⭐ Best: {streakState.longestStreak} days</span>
                </div>
            </div>

            {/* ==========================================
                ZONE 4 — Active Project Progress
               ========================================== */}
            <h4 className={styles.sectionHeader}>Projects</h4>
            {projects.length > 0 ? (
                <div className={styles.projectsList}>
                    {projects.map(project => {
                        const projectWords = writingDays
                            .filter(d => d.projectId === project.id)
                            .reduce((sum, d) => sum + d.wordsWritten, 0);
                        const pct = Math.min(projectWords / 50000, 1) * 100;
                        const barColor = MODE_COLORS[project.writingMode] || '#4A6FA5';

                        return (
                            <div key={project.id} className={styles.projectCard}>
                                <div className={styles.projectTop}>
                                    <span className={styles.projectName}>{project.name}</span>
                                    <span className={styles.projectWords}>
                                        {projectWords.toLocaleString()} words
                                    </span>
                                </div>
                                <div className={styles.progressBar}>
                                    <div
                                        className={styles.progressFill}
                                        style={{ width: `${pct}%`, backgroundColor: barColor }}
                                    />
                                </div>
                                <span className={styles.projectPct}>
                                    {Math.round(pct)}% of a novel&apos;s length
                                </span>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <p className={styles.emptyState}>
                    Start a project to track your progress
                </p>
            )}

            {/* ==========================================
                ZONE 5 — Achievements
               ========================================== */}
            <div className={styles.achievementsHeader}>
                <h4 className={styles.sectionHeader} style={{ padding: 0 }}>Achievements</h4>
                <span className={styles.achievementsCount}>
                    {earnedBadges.length}/{allBadgeKeys.length} earned
                </span>
            </div>
            <div className={styles.badgeGrid}>
                {sortedBadgeKeys.map(key => {
                    const badge = BADGE_DEFINITIONS[key];
                    const isEarned = earnedIds.has(key);

                    return (
                        <div
                            key={key}
                            className={`${styles.badgeCard} ${isEarned ? styles.badgeEarned : styles.badgeLocked}`}
                        >
                            {/* Earned checkmark */}
                            {isEarned && (
                                <span className={styles.badgeCheck}>✓</span>
                            )}
                            <span className={`${styles.badgeIcon} ${!isEarned ? styles.badgeIconLocked : ''}`}>
                                {badge.icon}
                            </span>
                            <div className={styles.badgeInfo}>
                                <span className={styles.badgeName}>{badge.name}</span>
                                <span className={styles.badgeDesc}>{badge.description}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
