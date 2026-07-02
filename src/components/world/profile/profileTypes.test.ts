import { describe, it, expect } from 'vitest';
import { createDefaultProfile } from '@/store/workspaceStore';

describe('createDefaultProfile', () => {
    it('seeds the seven standard dossier fields with empty values', () => {
        const p = createDefaultProfile();
        expect(p.dossier?.map(f => f.label)).toEqual([
            'Age', 'Gender', 'Sexuality', 'Origin', 'Job', 'Role', 'Status',
        ]);
        expect(p.dossier?.every(f => f.value === '')).toBe(true);
    });

    it('initializes empty collections', () => {
        const p = createDefaultProfile();
        expect(p.personaRows).toEqual([]);
        expect(p.meters).toEqual([]);
        expect(p.relations).toEqual([]);
    });
});
