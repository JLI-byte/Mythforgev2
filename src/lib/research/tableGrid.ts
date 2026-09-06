/**
 * LEAF MODULE — table cards.
 *
 * A grid of strings: headers plus rows. No formulas — Milanote has them, but a
 * writer tracking a regnal list or a casualty count does not need a
 * spreadsheet engine, and every cell being a string keeps search working.
 *
 * Every operation keeps the grid rectangular. A ragged grid renders wrong and
 * is very hard to repair by hand.
 */

export interface Grid {
    columns: string[];
    rows: string[][];
}

export function makeGrid(cols: number, rows: number): Grid {
    return {
        columns: Array.from({ length: cols }, (_, i) => `Column ${i + 1}`),
        rows: Array.from({ length: rows }, () => Array.from({ length: cols }, () => '')),
    };
}

export function setCell(grid: Grid, row: number, col: number, value: string): Grid {
    if (row < 0 || row >= grid.rows.length) return grid;
    if (col < 0 || col >= grid.columns.length) return grid;
    return {
        ...grid,
        rows: grid.rows.map((r, i) => (i === row ? r.map((c, j) => (j === col ? value : c)) : r)),
    };
}

export function addRow(grid: Grid): Grid {
    return { ...grid, rows: [...grid.rows, grid.columns.map(() => '')] };
}

export function addColumn(grid: Grid, name: string): Grid {
    return {
        columns: [...grid.columns, name],
        rows: grid.rows.map(r => [...r, '']),
    };
}

export function removeRow(grid: Grid, row: number): Grid {
    return { ...grid, rows: grid.rows.filter((_, i) => i !== row) };
}

export function removeColumn(grid: Grid, col: number): Grid {
    if (grid.columns.length <= 1) return grid;   // rows must belong to something
    return {
        columns: grid.columns.filter((_, i) => i !== col),
        rows: grid.rows.map(r => r.filter((_, i) => i !== col)),
    };
}

export function renameColumn(grid: Grid, col: number, name: string): Grid {
    return { ...grid, columns: grid.columns.map((c, i) => (i === col ? name : c)) };
}
