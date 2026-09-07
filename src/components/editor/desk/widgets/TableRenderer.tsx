"use client";

import React from 'react';
import {
    addColumn,
    addRow,
    makeGrid,
    removeColumn,
    removeRow,
    renameColumn,
    setCell,
    type Grid,
} from '@/lib/research/tableGrid';
import styles from './TableRenderer.module.css';

interface Props {
    content: { grid?: Grid };
    onChange: (c: Record<string, unknown>) => void;
}

const DEFAULT_COLS = 2;
const DEFAULT_ROWS = 2;

/**
 * A small rectangular table — a regnal list, a casualty count, a price sheet.
 *
 * Every edit routes through the pure helpers in lib/research/tableGrid so the
 * grid can never go ragged: a row with the wrong cell count renders wrong and
 * is close to impossible to repair by hand.
 */
export function TableRenderer({ content, onChange }: Props) {
    const grid = content.grid ?? makeGrid(DEFAULT_COLS, DEFAULT_ROWS);

    const commit = (next: Grid) => onChange({ ...content, grid: next });

    return (
        <div className={styles.card}>
            {/* The scroller, not the page, absorbs a wide table. */}
            <div className={styles.scroll}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            {grid.columns.map((name, col) => (
                                <th key={col} className={styles.headCell} scope="col">
                                    <span className={styles.headInner}>
                                        <input
                                            className={styles.input}
                                            value={name}
                                            aria-label={`Column ${col + 1} name`}
                                            onChange={e => commit(renameColumn(grid, col, e.target.value))}
                                        />
                                        <button
                                            className={styles.remove}
                                            aria-label={`Remove column ${name}`}
                                            onClick={() => commit(removeColumn(grid, col))}
                                        >
                                            &times;
                                        </button>
                                    </span>
                                </th>
                            ))}
                            <th className={styles.gutterHead} aria-hidden="true" />
                        </tr>
                    </thead>
                    <tbody>
                        {grid.rows.map((row, r) => (
                            <tr key={r}>
                                {row.map((value, c) => (
                                    <td key={c} className={styles.cell}>
                                        <input
                                            className={styles.input}
                                            value={value}
                                            aria-label={`Row ${r + 1}, column ${c + 1}`}
                                            onChange={e => commit(setCell(grid, r, c, e.target.value))}
                                        />
                                    </td>
                                ))}
                                <td className={styles.gutter}>
                                    <button
                                        className={styles.remove}
                                        aria-label={`Remove row ${r + 1}`}
                                        onClick={() => commit(removeRow(grid, r))}
                                    >
                                        &times;
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <footer className={styles.foot}>
                <button className={styles.add} onClick={() => commit(addRow(grid))}>
                    &#65291; Row
                </button>
                <button
                    className={styles.add}
                    onClick={() => commit(addColumn(grid, `Column ${grid.columns.length + 1}`))}
                >
                    &#65291; Column
                </button>
            </footer>
        </div>
    );
}
