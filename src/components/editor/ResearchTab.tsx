"use client";

import React, { useCallback, useState } from 'react';
import { useWorkspaceStore, type Entity, type EntityType } from '@/store/workspaceStore';
import { researchScopeKey, type ResearchScope } from '@/lib/researchScope';
import { serializeBoard, makeNoteCard } from '@/lib/researchBoard';
import {
  buildArticleDoc,
  resolveCategoryId,
  serializeWorld,
  makeCategoryRoot,
  resolveFolderIdByName,
  findEntityByName,
} from '@/lib/worldAuthoring';
import { worldKeyForProject, worldKeyForEntity, STANDALONE_KEY } from '@/lib/worldKey';
import { getWorldBibleConfig } from '@/lib/worldBibleNav';
import WritingDesk from './WritingDesk';
import { ResearchEmptyState } from './ResearchEmptyState';
import { ResearchChatPanel, type ToolEvent } from './research/ResearchChatPanel';
import styles from './WritingDesk.module.css';

/**
 * Research Tab — an AI chat panel (left) beside a blank spatial board (right).
 * The chat sees the active board and the active project's World Bible, and can
 * add note cards or author World Bible articles/categories on request.
 */
export default function ResearchTab() {
  const [scope, setScope] = useState<ResearchScope>('project');
  const activeProject = useWorkspaceStore(s =>
    s.projects.find(p => p.id === s.activeProjectId) ?? null
  );
  const scopeKey = researchScopeKey(scope, activeProject);

  // Read board + world imperatively at call time so the chat panel doesn't
  // re-render on every board or entity edit.
  const getContext = useCallback(() => {
    const s = useWorkspaceStore.getState();
    const board = scopeKey ? serializeBoard(s.researchStates[scopeKey]?.widgets ?? []) : '';
    const project = s.projects.find(p => p.id === s.activeProjectId) ?? null;
    const worldKey = worldKeyForProject(project);
    const layout = getWorldBibleConfig(s.worldBibles, worldKey).layout;
    const worldEntities = s.entities.filter(e => worldKeyForEntity(e) === worldKey);
    const world = serializeWorld(layout.roots, worldEntities);
    return { board, world };
  }, [scopeKey]);

  const handleToolEvent = useCallback((evt: ToolEvent) => {
    const s = useWorkspaceStore.getState();

    if (evt.type === 'card') {
      if (!scopeKey) return;
      const current = s.researchStates[scopeKey]?.widgets ?? [];
      s.updateResearchState(scopeKey, {
        widgets: [...current, makeNoteCard(evt.text, current.length)],
      });
      return;
    }

    const project = s.projects.find(p => p.id === s.activeProjectId) ?? null;
    if (!project) return; // articles/categories need a project's world
    const worldKey = worldKeyForProject(project);
    const worldId = worldKey === STANDALONE_KEY ? undefined : worldKey;
    const layout = getWorldBibleConfig(s.worldBibles, worldKey).layout;

    if (evt.type === 'article') {
      const type = evt.entityType as EntityType;
      const entity: Entity = {
        id: crypto.randomUUID(),
        projectId: project.id,
        worldId,
        categoryId: resolveCategoryId(layout.roots, evt.category, type),
        name: evt.name,
        type,
        description: evt.description,
        articleDoc: buildArticleDoc(evt.sections ?? []),
        createdAt: new Date(),
      };
      s.addEntity(entity);
      return;
    }

    if (evt.type === 'category') {
      const parentId = resolveFolderIdByName(layout.roots, evt.parent);
      const newRoot = makeCategoryRoot(evt.name, evt.icon, parentId);
      s.setWorldBibleLayout(worldKey, { roots: [...layout.roots, newRoot] });
      return;
    }

    if (evt.type === 'move') {
      const worldEntities = s.entities.filter(e => worldKeyForEntity(e) === worldKey);
      const entity = findEntityByName(worldEntities, evt.article);
      const folderId = resolveFolderIdByName(layout.roots, evt.category);
      if (entity && folderId) s.updateEntity(entity.id, { categoryId: folderId });
    }
  }, [scopeKey]);

  return (
    <div className={styles.researchLayout}>
      <ResearchChatPanel scopeKey={scopeKey} getContext={getContext} onToolEvent={handleToolEvent} />
      <div className={styles.researchMain}>
        {scopeKey ? (
          <>
            <div className={styles.researchScopeBar}>
              <button
                className={`${styles.researchScopeBtn} ${scope === 'project' ? styles.researchScopeBtnActive : ''}`}
                onClick={() => setScope('project')}
              >
                This Project
              </button>
              <button
                className={`${styles.researchScopeBtn} ${scope === 'world' ? styles.researchScopeBtnActive : ''}`}
                onClick={() => setScope('world')}
              >
                This World
              </button>
            </div>
            <div className={styles.researchCanvasHost}>
              <WritingDesk variant="research" scopeKey={scopeKey} />
            </div>
          </>
        ) : (
          <ResearchEmptyState />
        )}
      </div>
    </div>
  );
}
