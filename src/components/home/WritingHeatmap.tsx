"use client";

import React from 'react';
import type { HeatmapCell } from '@/lib/homeStats';
import styles from './HomePage.module.css';

interface WritingHeatmapProps {
    /** Sunday-started week columns, oldest first. */
    columns: HeatmapCell[][];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Month label for a column, shown only when the month changes. */
function monthLabels(columns: HeatmapCell[][]): (string | null)[] {
    let last = -1;
    return columns.map(col => {
        const d = new Date(`${col[0].date}T00:00:00`);
        const m = d.getMonth();
        if (m !== last) {
            last = m;
            return MONTHS[m];
        }
        return null;
    });
}

/**
 * Contribution-style grid of writing days. Each column is a week, each cell a
 * day shaded by how much of the daily target was written.
 */
export function WritingHeatmap({ columns }: WritingHeatmapProps) {
    const labels = monthLabels(columns);
    const todayKey = (() => {
        const n = new Date();
        return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
    })();

    return (
        <div className={styles.heatmapWrap}>
            <div className={styles.heatmapMonths}>
                {labels.map((label, i) => (
                    <span key={i} className={styles.heatmapMonth}>{label ?? ''}</span>
                ))}
            </div>
            <div className={styles.heatmapGrid}>
                {columns.map((col, ci) => (
                    <div key={ci} className={styles.heatmapCol}>
                        {col.map(cell => (
                            <span
                                key={cell.date}
                                className={`${styles.heatCell} ${styles[`heat${cell.level}`]} ${cell.date === todayKey ? styles.heatToday : ''}`}
                                title={`${cell.date} — ${cell.words.toLocaleString()} word${cell.words === 1 ? '' : 's'}`}
                            />
                        ))}
                    </div>
                ))}
            </div>
            <div className={styles.heatmapLegend}>
                <span>Less</span>
                {[0, 1, 2, 3, 4].map(l => (
                    <span key={l} className={`${styles.heatCell} ${styles[`heat${l}`]}`} />
                ))}
                <span>More</span>
            </div>
        </div>
    );
}
