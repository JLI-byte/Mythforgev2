import { describe, it, expect } from 'vitest';
import {
    makeGrid, setCell, addRow, addColumn, removeRow, removeColumn, renameColumn, type Grid,
} from './tableGrid';

const g: Grid = {
    columns: ['Name', 'Role'],
    rows: [['Maren', 'Captain'], ['Idris', 'Sergeant']],
};

describe('makeGrid', () => {
    it('builds an empty grid of the given shape', () => {
        const r = makeGrid(2, 3);
        expect(r.columns).toHaveLength(2);
        expect(r.rows).toHaveLength(3);
        expect(r.rows[0]).toEqual(['', '']);
    });
});

describe('setCell', () => {
    it('writes one cell', () => {
        expect(setCell(g, 1, 0, 'Sgt.').rows[1][0]).toBe('Sgt.');
    });
    it('leaves the rest untouched', () => {
        expect(setCell(g, 1, 0, 'x').rows[0]).toEqual(['Maren', 'Captain']);
    });
    it('ignores an out-of-range cell rather than growing the grid', () => {
        expect(setCell(g, 9, 9, 'x')).toEqual(g);
    });
});

describe('addRow', () => {
    it('appends a row as wide as the columns', () => {
        const r = addRow(g);
        expect(r.rows).toHaveLength(3);
        expect(r.rows[2]).toEqual(['', '']);
    });
});

describe('addColumn', () => {
    it('appends a column and widens every row', () => {
        const r = addColumn(g, 'Age');
        expect(r.columns).toEqual(['Name', 'Role', 'Age']);
        expect(r.rows.every(row => row.length === 3)).toBe(true);
    });
});

describe('removeRow', () => {
    it('drops one row', () => {
        expect(removeRow(g, 0).rows).toEqual([['Idris', 'Sergeant']]);
    });
});

describe('removeColumn', () => {
    it('drops the column and the matching cell in every row', () => {
        const r = removeColumn(g, 1);
        expect(r.columns).toEqual(['Name']);
        expect(r.rows).toEqual([['Maren'], ['Idris']]);
    });
    it('refuses to remove the last column, which would strand the rows', () => {
        const one: Grid = { columns: ['Only'], rows: [['x']] };
        expect(removeColumn(one, 0)).toEqual(one);
    });
});

describe('renameColumn', () => {
    it('renames a header', () => {
        expect(renameColumn(g, 0, 'Who').columns[0]).toBe('Who');
    });
});
