"use client";

import React, { useEffect, useState, useRef, useCallback, MutableRefObject } from 'react';
import { Editor } from '@tiptap/react';
import { entitySuggestPluginKey, EntitySuggestState } from '@/lib/EntitySuggest';
import { useWorkspaceStore } from '@/store/workspaceStore';
import styles from './EntitySuggestDropdown.module.css';

interface Props {
  editorRef: MutableRefObject<Editor | null>;
}

export default function EntitySuggestDropdown({ editorRef }: Props) {
  const entities = useWorkspaceStore(s => s.entities);
  const activeProjectId = useWorkspaceStore(s => s.activeProjectId);

  const [pluginState, setPluginState] = useState<EntitySuggestState>({
    active: false, query: '', from: 0, to: 0,
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync ref current to state to trigger effect re-runs when parent re-renders with a new editor
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null);
  if (editorRef.current !== activeEditor) {
    setActiveEditor(editorRef.current);
  }

  // Poll plugin state on every editor transaction
  useEffect(() => {
    if (!activeEditor) return;
    const update = () => {
      const state = entitySuggestPluginKey.getState(activeEditor.state) as EntitySuggestState;
      if (!state) return;
      setPluginState(state);
      setSelectedIndex(0);

      if (state.active) {
        // Position the dropdown at the @ character
        const coords = activeEditor.view.coordsAtPos(state.from);
        setPosition({ top: coords.bottom + window.scrollY + 6, left: coords.left + window.scrollX });
      } else {
        setPosition(null);
      }
    };

    activeEditor.on('transaction', update);
    return () => { activeEditor.off('transaction', update); };
  }, [activeEditor]);

  // Filter entities to current project matching query
  const filtered = React.useMemo(() => {
    if (!pluginState.active || !activeProjectId) return [];
    const q = pluginState.query.toLowerCase();
    return entities
      .filter(e => e.projectId === activeProjectId)
      .filter(e => e.name.toLowerCase().includes(q))
      .slice(0, 8); // max 8 results
  }, [entities, activeProjectId, pluginState.active, pluginState.query]);

  const selectEntity = useCallback((entityId: string, entityName: string) => {
    if (!activeEditor) return;

    const { from, to } = pluginState;

    // Replace @query with entity name and apply EntityMark
    activeEditor
      .chain()
      .focus()
      .deleteRange({ from, to }) // delete @query
      .insertContent({
        type: 'text',
        text: entityName,
        marks: [{ type: 'entityMark', attrs: { entityId } }],
      })
      .run();

    // Close dropdown by resetting plugin state
    activeEditor.view.dispatch(
      activeEditor.state.tr.setMeta(entitySuggestPluginKey, {
        active: false, query: '', from: 0, to: 0,
      })
    );
  }, [activeEditor, pluginState]);

  // Keyboard handling — arrow keys, Enter, Escape
  useEffect(() => {
    if (!pluginState.active || !activeEditor) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!pluginState.active) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const entity = filtered[selectedIndex];
        if (entity) selectEntity(entity.id, entity.name);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        activeEditor.view.dispatch(
          activeEditor.state.tr.setMeta(entitySuggestPluginKey, {
            active: false, query: '', from: 0, to: 0,
          })
        );
      }
    };

    // Attach to the editor DOM element so it captures before TipTap
    const editorEl = activeEditor.view.dom;
    editorEl.addEventListener('keydown', handleKeyDown, true);
    return () => editorEl.removeEventListener('keydown', handleKeyDown, true);
  }, [pluginState.active, filtered, selectedIndex, selectEntity, activeEditor]);

  if (!pluginState.active || !position) return null;

  return (
    <div
      ref={dropdownRef}
      className={styles.dropdown}
      style={{ top: position.top, left: position.left }}
    >
      {filtered.length === 0 ? (
        <div className={styles.noResults}>
          No entities match "{pluginState.query || '@'}"
        </div>
      ) : (
        filtered.map((entity, i) => (
          <button
            key={entity.id}
            className={`${styles.item} ${i === selectedIndex ? styles.itemActive : ''}`}
            onMouseDown={(e) => {
              e.preventDefault(); // prevent editor blur
              selectEntity(entity.id, entity.name);
            }}
            onMouseEnter={() => setSelectedIndex(i)}
          >
            <span className={styles.itemIcon}>
              {getEntityIcon(entity.type)}
            </span>
            <span className={styles.itemName}>{entity.name}</span>
            <span className={styles.itemType}>{entity.type}</span>
          </button>
        ))
      )}
    </div>
  );
}

function getEntityIcon(type: string): string {
  const icons: Record<string, string> = {
    character: '👤',
    location: '📍',
    faction: '⚔️',
    artifact: '💎',
    lore: '📜',
    magic: '✨',
    religion: '🙏',
    species: '🧬',
  };
  return icons[type] ?? '📋';
}
