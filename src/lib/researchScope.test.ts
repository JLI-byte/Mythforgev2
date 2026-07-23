import { describe, it, expect } from 'vitest';
import { researchScopeKey } from './researchScope';

describe('researchScopeKey', () => {
  it('keys project scope by project id', () => {
    expect(researchScopeKey('project', { id: 'p1' })).toBe('project:p1');
  });

  it('keys world scope by the project world id', () => {
    expect(researchScopeKey('world', { id: 'p1', worldId: 'w1' })).toBe('world:w1');
  });

  it('keys world scope to standalone when the project has no world', () => {
    expect(researchScopeKey('world', { id: 'p1' })).toBe('world:standalone');
  });

  it('returns null when there is no active project', () => {
    expect(researchScopeKey('project', null)).toBeNull();
    expect(researchScopeKey('world', null)).toBeNull();
  });
});
