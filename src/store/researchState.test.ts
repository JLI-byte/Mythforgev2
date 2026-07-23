import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkspaceStore } from './workspaceStore';

describe('updateResearchState', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({ researchStates: {} });
  });

  it('creates a board at the given scope key', () => {
    useWorkspaceStore.getState().updateResearchState('project:p1', {
      widgets: [{ id: 'w1', type: 'sticky', x: 0, y: 0, width: 200, height: 200, content: {} }],
    });
    const board = useWorkspaceStore.getState().researchStates['project:p1'];
    expect(board.widgets).toHaveLength(1);
    expect(board.zoom).toBe(1);
  });

  it('does not touch other scope keys', () => {
    useWorkspaceStore.getState().updateResearchState('project:p1', { zoom: 2 });
    useWorkspaceStore.getState().updateResearchState('world:w1', { zoom: 0.5 });
    const states = useWorkspaceStore.getState().researchStates;
    expect(states['project:p1'].zoom).toBe(2);
    expect(states['world:w1'].zoom).toBe(0.5);
  });
});
