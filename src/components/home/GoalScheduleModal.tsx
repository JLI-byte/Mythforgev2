"use client";

import React, { useEffect, useState } from 'react';
import { X, RotateCcw } from 'lucide-react';
import {
    WEEKDAY_LONG, emptyWeekdayTargets, normalizeWeekdayTargets,
    type GoalTargetConfig, type WeekdayTargets,
} from '@/lib/goalSchedule';
import styles from './GoalScheduleModal.module.css';

/**
 * Scheduled writing goals — "200 on Mondays, 1000 on Fridays".
 *
 * One everyday target plus optional per-weekday overrides. Edits are held
 * locally and applied on Save: every write recomputes goalMet across the whole
 * writing history, so it should happen once, not on every keystroke.
 */

interface GoalScheduleModalProps {
    config: GoalTargetConfig;
    onSave: (next: { dailyWordTarget: number; weekdayWordTargets: WeekdayTargets }) => void;
    onClose: () => void;
}

/** Empty field means "no override" — kept as strings so a row can be cleared while typing. */
type DraftRow = string;

export default function GoalScheduleModal({ config, onSave, onClose }: GoalScheduleModalProps) {
    const [everyday, setEveryday] = useState(String(config.dailyWordTarget || 500));
    const [rows, setRows] = useState<DraftRow[]>(() =>
        normalizeWeekdayTargets(config.weekdayWordTargets).map(v => (v === null ? '' : String(v))),
    );

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    const everydayValue = Number.parseInt(everyday, 10);
    const isEverydayValid = Number.isFinite(everydayValue) && everydayValue > 0;

    // A row is valid when it is blank (inherit) or a positive number.
    const invalidRow = rows.some(r => {
        if (r.trim() === '') return false;
        const n = Number.parseInt(r, 10);
        return !Number.isFinite(n) || n <= 0;
    });
    const canSave = isEverydayValid && !invalidRow;

    const setRow = (index: number, value: string) => {
        setRows(prev => prev.map((r, i) => (i === index ? value : r)));
    };

    const save = () => {
        if (!canSave) return;
        onSave({
            dailyWordTarget: everydayValue,
            weekdayWordTargets: normalizeWeekdayTargets(
                rows.map(r => (r.trim() === '' ? null : Number.parseInt(r, 10))),
            ),
        });
        onClose();
    };

    return (
        <div className={styles.overlay} onClick={onClose} role="presentation">
            <div
                className={styles.modal}
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="goal-schedule-title"
            >
                <header className={styles.header}>
                    <div>
                        <h2 id="goal-schedule-title" className={styles.title}>Scheduled goals</h2>
                        <p className={styles.subtitle}>
                            Set a different word target for particular days. Blank days use your everyday goal.
                        </p>
                    </div>
                    <button className={styles.close} onClick={onClose} aria-label="Close">
                        <X size={18} />
                    </button>
                </header>

                <div className={styles.body}>
                    <label className={styles.everydayRow}>
                        <span className={styles.everydayLabel}>Everyday goal</span>
                        <span className={styles.field}>
                            <input
                                className={`${styles.input} ${isEverydayValid ? '' : styles.inputInvalid}`}
                                type="number"
                                min={1}
                                inputMode="numeric"
                                value={everyday}
                                onChange={e => setEveryday(e.target.value)}
                                aria-label="Everyday word goal"
                            />
                            <span className={styles.unit}>words</span>
                        </span>
                    </label>

                    <div className={styles.divider} />

                    <ul className={styles.dayList}>
                        {WEEKDAY_LONG.map((day, index) => (
                            <li key={day} className={styles.dayRow}>
                                <span className={styles.dayLabel}>{day}</span>
                                <span className={styles.field}>
                                    <input
                                        className={styles.input}
                                        type="number"
                                        min={1}
                                        inputMode="numeric"
                                        value={rows[index]}
                                        placeholder={isEverydayValid ? String(everydayValue) : '—'}
                                        onChange={e => setRow(index, e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') save(); }}
                                        aria-label={`${day} word goal`}
                                    />
                                    <button
                                        className={styles.clear}
                                        onClick={() => setRow(index, '')}
                                        disabled={rows[index] === ''}
                                        title={`Use the everyday goal on ${day}`}
                                        aria-label={`Use the everyday goal on ${day}`}
                                    >
                                        <RotateCcw size={13} />
                                    </button>
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>

                <footer className={styles.footer}>
                    <button
                        className={styles.reset}
                        onClick={() => setRows(emptyWeekdayTargets().map(() => ''))}
                    >
                        Clear schedule
                    </button>
                    <div className={styles.footerActions}>
                        <button className={styles.cancel} onClick={onClose}>Cancel</button>
                        <button className={styles.save} onClick={save} disabled={!canSave}>Save</button>
                    </div>
                </footer>
            </div>
        </div>
    );
}
