/**
 * Research scope-key resolver — LEAF MODULE (no store import).
 * A research board is keyed either to a single project (`project:<id>`) or to
 * a whole shelf/world (`world:<worldKey>`). Mirrors the World Bible's per-shelf
 * keying via worldKeyForProject.
 */
import { worldKeyForProject } from './worldKey';

export type ResearchScope = 'project' | 'world';

export function researchScopeKey(
  scope: ResearchScope,
  project?: { id: string; worldId?: string } | null,
): string | null {
  if (!project) return null;
  if (scope === 'project') return `project:${project.id}`;
  return `world:${worldKeyForProject(project)}`;
}
