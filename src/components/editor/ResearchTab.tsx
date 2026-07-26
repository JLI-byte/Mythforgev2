"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { useWorkspaceStore, type Entity, type EntityType } from '@/store/workspaceStore';
import { researchScopeKey, type ResearchScope } from '@/lib/researchScope';
import { serializeBoard, makeNoteCard } from '@/lib/researchBoard';
import { addSuggestionToWidgets, serializeSuggestions, type ArticleSuggestion } from '@/lib/articleSuggestions';
import { addFlagToWidgets, serializeFlags, type ConsistencyFlag } from '@/lib/consistencyFlags';
import {
  buildArticleDoc,
  appendSectionsToDoc,
  resolveCategoryId,
  serializeWorld,
  makeCategoryRoot,
  resolveFolderIdByName,
  findEntityByName,
} from '@/lib/worldAuthoring';
import { worldKeyForProject, worldKeyForEntity, STANDALONE_KEY } from '@/lib/worldKey';
import { folderMemberSet } from '@/lib/folderTree';
import { getWorldBibleConfig } from '@/lib/worldBibleNav';
import WritingDesk from './WritingDesk';
import { ResearchEmptyState } from './ResearchEmptyState';
import { ResearchChatPanel, type ToolEvent } from './research/ResearchChatPanel';
import { ResearchBoardBar } from './research/ResearchBoardBar';
import styles from './WritingDesk.module.css';

/**
 * Research Tab — an AI chat panel (left) beside a blank spatial board (right).
 * The chat sees the active board and the active project's World Bible, and can
 * add note cards or author World Bible articles/categories on request.
 */
const CHAT_MIN_WIDTH = 240;
const CHAT_MAX_WIDTH = 640;
const CHAT_DEFAULT_WIDTH = 320;

export default function ResearchTab() {
  const [scope, setScope] = useState<ResearchScope>('project');
  const activeProject = useWorkspaceStore(s =>
    s.projects.find(p => p.id === s.activeProjectId) ?? null
  );
  // Each scope (project / world) is its own base key; within it the user can
  // pick a board. null = the scope's default "Main" board (reuses the base key).
  const baseScopeKey = researchScopeKey(scope, activeProject);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  useEffect(() => { setActiveBoardId(null); }, [baseScopeKey]);
  const scopeKey = activeBoardId && baseScopeKey ? `${baseScopeKey}::${activeBoardId}` : baseScopeKey;

  // Chat panel layout: resizable width + collapsed state, persisted locally.
  const [chatWidth, setChatWidth] = useState(CHAT_DEFAULT_WIDTH);
  const [chatCollapsed, setChatCollapsed] = useState(false);

  useEffect(() => {
    const w = Number(localStorage.getItem('lc-research-chat-width'));
    if (Number.isFinite(w) && w >= CHAT_MIN_WIDTH && w <= CHAT_MAX_WIDTH) setChatWidth(w);
    setChatCollapsed(localStorage.getItem('lc-research-chat-collapsed') === '1');
  }, []);
  useEffect(() => { localStorage.setItem('lc-research-chat-width', String(chatWidth)); }, [chatWidth]);
  useEffect(() => { localStorage.setItem('lc-research-chat-collapsed', chatCollapsed ? '1' : '0'); }, [chatCollapsed]);

  // Drag the divider to resize; listeners live on document so the drag keeps
  // tracking even when the cursor leaves the thin handle.
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = chatWidth;
    const onMove = (ev: MouseEvent) => {
      const next = Math.min(CHAT_MAX_WIDTH, Math.max(CHAT_MIN_WIDTH, startW + (ev.clientX - startX)));
      setChatWidth(next);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  // Read board + world imperatively at call time so the chat panel doesn't
  // re-render on every board or entity edit.
  const getContext = useCallback(() => {
    const s = useWorkspaceStore.getState();
    const widgets = scopeKey ? s.researchStates[scopeKey]?.widgets ?? [] : [];
    // Include pending suggestions and flags so the assistant won't repeat them.
    const pending = serializeSuggestions(widgets);
    const flags = serializeFlags(widgets);
    const board = [
      serializeBoard(widgets),
      pending ? `Already suggested (pending on the board):\n${pending}` : '',
      flags ? `Already flagged (pending on the board):\n${flags}` : '',
    ].filter(Boolean).join('\n\n');
    const project = s.projects.find(p => p.id === s.activeProjectId) ?? null;
    const worldKey = worldKeyForProject(project);
    const layout = getWorldBibleConfig(s.worldBibles, worldKey).layout;
    const worldEntities = s.entities.filter(e => worldKeyForEntity(e) === worldKey);
    const world = serializeWorld(layout.roots, worldEntities);
    const u = s.worldUnderstanding[worldKey];
    const understanding = u && (u.summary.trim() || u.preferences.trim())
      ? [u.summary.trim(), u.preferences.trim() ? `Learned preferences: ${u.preferences.trim()}` : ''].filter(Boolean).join('\n')
      : '';
    return { board, world, understanding };
  }, [scopeKey]);

  // Apply an AI action to the store. Returns a warning string when the action
  // can't be applied (unresolved name, no project, etc.) so the chat can tell
  // the user honestly instead of the model's optimistic "done" standing alone.
  const handleToolEvent = useCallback((evt: ToolEvent): string | void => {
    const s = useWorkspaceStore.getState();

    if (evt.type === 'card') {
      if (!scopeKey) return 'No active board to add the note to.';
      const current = s.researchStates[scopeKey]?.widgets ?? [];
      s.updateResearchState(scopeKey, {
        widgets: [...current, makeNoteCard(evt.text, current.length)],
      });
      return;
    }

    if (evt.type === 'save_image') {
      if (evt.target === 'board') {
        if (!scopeKey) return 'No active board to add the image to.';
        const current = s.researchStates[scopeKey]?.widgets ?? [];
        s.updateResearchState(scopeKey, {
          widgets: [...current, {
            id: crypto.randomUUID(),
            type: 'image',
            x: 80 + current.length * 24,
            y: 80 + current.length * 24,
            width: 300,
            height: 360,
            content: { src: evt.url, label: evt.label ?? '' },
          }],
        });
        return;
      }
      // target 'article' — set the image on an existing World Bible entity.
      const proj = s.projects.find(p => p.id === s.activeProjectId) ?? null;
      const key = worldKeyForProject(proj);
      const worldEntities = s.entities.filter(e => worldKeyForEntity(e) === key);
      const entity = findEntityByName(worldEntities, evt.articleName ?? '');
      if (!entity) return `Couldn't find an article named "${evt.articleName}".`;
      s.updateEntityImage(entity.id, evt.url);
      return;
    }

    if (evt.type === 'suggest') {
      if (!scopeKey) return;
      const proj = s.projects.find(p => p.id === s.activeProjectId) ?? null;
      const key = worldKeyForProject(proj);
      const worldEntities = s.entities.filter(e => worldKeyForEntity(e) === key);
      // Don't suggest something that already has an article.
      if (findEntityByName(worldEntities, evt.name)) return;
      const roots = getWorldBibleConfig(s.worldBibles, key).layout.roots;
      const suggestion: ArticleSuggestion = {
        id: crypto.randomUUID(),
        name: evt.name,
        type: evt.entityType,
        category: evt.category,
        isNewCategory: Boolean(evt.category) && !resolveFolderIdByName(roots, evt.category),
        reason: evt.reason,
      };
      const widgets = s.researchStates[scopeKey]?.widgets ?? [];
      const next = addSuggestionToWidgets(widgets, suggestion);
      if (next !== widgets) s.updateResearchState(scopeKey, { widgets: next });
      return;
    }

    if (evt.type === 'flag') {
      if (!scopeKey) return;
      const flag: ConsistencyFlag = {
        id: crypto.randomUUID(),
        kind: evt.kind,
        summary: evt.summary,
        detail: evt.detail,
      };
      const widgets = s.researchStates[scopeKey]?.widgets ?? [];
      const next = addFlagToWidgets(widgets, flag);
      if (next !== widgets) s.updateResearchState(scopeKey, { widgets: next });
      return;
    }

    if (evt.type === 'understanding') {
      const proj = s.projects.find(p => p.id === s.activeProjectId) ?? null;
      const key = worldKeyForProject(proj);
      // Understanding lives in the store keyed by world and is shown in the chat's
      // "What I Understand" tray — no board widget needed.
      s.setWorldUnderstanding(key, { summary: evt.summary, preferences: evt.preferences });
      return;
    }

    const project = s.projects.find(p => p.id === s.activeProjectId) ?? null;
    if (!project) return 'No active project — open one to build its world.';
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
      if (resolveFolderIdByName(layout.roots, evt.name)) {
        return `A category named "${evt.name}" already exists — skipped.`;
      }
      const parentId = resolveFolderIdByName(layout.roots, evt.parent);
      const newRoot = makeCategoryRoot(evt.name, evt.icon, parentId);
      s.setWorldBibleLayout(worldKey, { roots: [...layout.roots, newRoot] });
      if (evt.parent && !parentId) {
        return `Created "${evt.name}" at the top level — no parent category named "${evt.parent}".`;
      }
      return;
    }

    if (evt.type === 'move') {
      const worldEntities = s.entities.filter(e => worldKeyForEntity(e) === worldKey);
      const entity = findEntityByName(worldEntities, evt.article);
      if (!entity) return `Couldn't find an article named "${evt.article}".`;
      const folderId = resolveFolderIdByName(layout.roots, evt.category);
      if (!folderId) return `Couldn't find a category named "${evt.category}".`;
      s.updateEntity(entity.id, { categoryId: folderId });
      return;
    }

    // Article edit / rename / delete resolve by name within this world.
    if (evt.type === 'edit' || evt.type === 'rename_article' || evt.type === 'delete_article') {
      const worldEntities = s.entities.filter(e => worldKeyForEntity(e) === worldKey);
      const entity = findEntityByName(worldEntities, evt.name);
      if (!entity) return `Couldn't find an article named "${evt.name}".`;

      if (evt.type === 'rename_article') {
        s.updateEntity(entity.id, { name: evt.new_name.trim() });
      } else if (evt.type === 'delete_article') {
        s.deleteEntity(entity.id);
      } else {
        const updates: Partial<Entity> = {};
        if (typeof evt.description === 'string') updates.description = evt.description;
        if (evt.append_sections?.length) updates.articleDoc = appendSectionsToDoc(entity.articleDoc, evt.append_sections);
        if (evt.tags?.length) updates.tags = [...new Set([...(entity.tags ?? []), ...evt.tags])];
        s.updateEntity(entity.id, updates);
      }
      return;
    }

    if (evt.type === 'rename_category') {
      const folderId = resolveFolderIdByName(layout.roots, evt.name);
      if (!folderId) return `Couldn't find a category named "${evt.name}".`;
      const clash = resolveFolderIdByName(layout.roots, evt.new_name);
      if (clash && clash !== folderId) {
        return `A category named "${evt.new_name}" already exists — rename skipped.`;
      }
      s.setWorldBibleLayout(worldKey, {
        roots: layout.roots.map(r => (r.id === folderId ? { ...r, label: evt.new_name.trim() } : r)),
      });
      return;
    }

    if (evt.type === 'delete_category') {
      const folderId = resolveFolderIdByName(layout.roots, evt.name);
      if (!folderId) return `Couldn't find a category named "${evt.name}".`;
      // Remove the folder and its descendants; unfile any articles they held.
      const removed = folderMemberSet(layout.roots, folderId);
      s.setWorldBibleLayout(worldKey, { roots: layout.roots.filter(r => !removed.has(r.id)) });
      s.entities.forEach(e => {
        if (worldKeyForEntity(e) === worldKey && e.categoryId && removed.has(e.categoryId)) {
          s.updateEntity(e.id, { categoryId: undefined });
        }
      });
    }
  }, [scopeKey]);

  return (
    <div className={styles.researchLayout}>
      {chatCollapsed ? (
        <button
          className={styles.researchChatReopen}
          onClick={() => setChatCollapsed(false)}
          title="Show research assistant"
        >
          💬
        </button>
      ) : (
        <>
          <ResearchChatPanel
            scopeKey={scopeKey}
            getContext={getContext}
            onToolEvent={handleToolEvent}
            width={chatWidth}
            onCollapse={() => setChatCollapsed(true)}
          />
          <div
            className={styles.researchResizer}
            onMouseDown={startResize}
            title="Drag to resize"
            role="separator"
            aria-orientation="vertical"
          />
        </>
      )}
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
            {baseScopeKey && (
              <ResearchBoardBar
                baseScopeKey={baseScopeKey}
                activeBoardId={activeBoardId}
                onSelect={setActiveBoardId}
              />
            )}
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
