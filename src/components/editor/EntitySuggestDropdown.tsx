"use client";

import React, { useEffect, useState, useRef, useCallback, MutableRefObject } from 'react';
import { createPortal } from 'react-dom';
import { Editor } from '@tiptap/react';
import { entitySuggestPluginKey, EntitySuggestState } from '@/lib/EntitySuggest';
import { useWorkspaceStore, selectProjectWorldKey } from '@/store/workspaceStore';
import { worldKeyForEntity } from '@/lib/worldKey';
import styles from './EntitySuggestDropdown.module.css';

interface Props {
  editorRef: MutableRefObject<Editor | null>;
}

export default function EntitySuggestDropdown({ editorRef }: Props) {
  const entities = useWorkspaceStore(s => s.entities);
  const projectWorldKey = useWorkspaceStore(selectProjectWorldKey);
  const openInlineCreator = useWorkspaceStore(s => s.openInlineCreator);

  const [pluginState, setPluginState] = useState<EntitySuggestState>({
    active: false, trigger: '@', query: '', from: 0, to: 0,
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  /** Where a [[ creation should be inserted once the modal saves. */
  const pendingRangeRef = useRef<{ from: number; to: number } | null>(null);

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
        // coordsAtPos returns viewport coordinates, and the dropdown is
        // position:fixed — adding scroll would count it twice.
        const coords = activeEditor.view.coordsAtPos(state.from);
        setPosition({ top: coords.bottom + 6, left: coords.left });
      } else {
        setPosition(null);
      }
    };

    activeEditor.on('transaction', update);
    return () => { activeEditor.off('transaction', update); };
  }, [activeEditor]);

  // Filter entities to current project's world matching query
  const filtered = React.useMemo(() => {
    if (!pluginState.active) return [];
    const q = pluginState.query.toLowerCase();
    return entities
      .filter(e => worldKeyForEntity(e) === projectWorldKey)
      .filter(e => e.name.toLowerCase().includes(q))
      .slice(0, 8); // max 8 results
  }, [entities, projectWorldKey, pluginState.active, pluginState.query]);

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
        active: false, trigger: '@', query: '', from: 0, to: 0,
      })
    );
  }, [activeEditor, pluginState]);

  /** Insert an entity's name, marked, over a remembered range. */
  const insertEntityAt = useCallback((from: number, to: number, entityId: string, entityName: string) => {
    if (!activeEditor) return;
    activeEditor
      .chain()
      .focus()
      .deleteRange({ from, to })
      .insertContentAt(from, {
        type: 'text',
        text: entityName,
        marks: [{ type: 'entityMark', attrs: { entityId } }],
      })
      .run();
  }, [activeEditor]);

  /** "Create «name»" — hand off to the World Bible's inline creator. */
  const startCreate = useCallback(() => {
    if (!activeEditor) return;
    // Remember the range but do not delete it: if the writer cancels, what they
    // typed must still be there.
    pendingRangeRef.current = { from: pluginState.from, to: pluginState.to };
    activeEditor.view.dispatch(
      activeEditor.state.tr.setMeta(entitySuggestPluginKey, {
        active: false, trigger: '@', query: '', from: 0, to: 0,
      })
    );
    openInlineCreator(pluginState.query.trim());
  }, [activeEditor, pluginState.from, pluginState.to, pluginState.query, openInlineCreator]);

  // The inline creator saved an entry we asked for — drop it in where [[ was.
  useEffect(() => {
    if (!activeEditor) return;

    const onCreated = (e: Event) => {
      const range = pendingRangeRef.current;
      pendingRangeRef.current = null;
      const detail = (e as CustomEvent<{ id: string; name: string }>).detail;
      if (!range || !detail?.id) return;
      insertEntityAt(range.from, range.to, detail.id, detail.name);
    };

    const onReturnFocus = () => {
      // Cancelled: leave what was typed alone, just give the cursor back.
      pendingRangeRef.current = null;
      activeEditor.chain().focus().run();
    };

    window.addEventListener('lorecanvas:entityCreated', onCreated);
    window.addEventListener('lorecanvas:returnFocusToEditor', onReturnFocus);
    return () => {
      window.removeEventListener('lorecanvas:entityCreated', onCreated);
      window.removeEventListener('lorecanvas:returnFocusToEditor', onReturnFocus);
    };
  }, [activeEditor, insertEntityAt]);

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
        else if (pluginState.trigger === '[[') startCreate();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        activeEditor.view.dispatch(
          activeEditor.state.tr.setMeta(entitySuggestPluginKey, {
            active: false, trigger: '@', query: '', from: 0, to: 0,
          })
        );
      }
    };

    // Attach to the editor DOM element so it captures before TipTap
    const editorEl = activeEditor.view.dom;
    editorEl.addEventListener('keydown', handleKeyDown, true);
    return () => editorEl.removeEventListener('keydown', handleKeyDown, true);
  }, [pluginState.active, pluginState.trigger, filtered, selectedIndex, selectEntity, startCreate, activeEditor]);

  if (!pluginState.active || !position) return null;

  const showCreate = pluginState.trigger === '[[';

  // Portalled to the body: the desk's canvas layer is transformed (which would
  // re-anchor and scale a position:fixed child) and its viewport clips
  // overflow. Neither can be allowed to move or crop the picker.
  const menu = (
    <div
      ref={dropdownRef}
      className={styles.dropdown}
      style={{ top: position.top, left: position.left }}
    >
      {showCreate && (
        <button
          className={styles.item}
          onMouseDown={(e) => { e.preventDefault(); startCreate(); }}
        >
          <span className={styles.itemIcon}>+</span>
          <span className={styles.itemName}>
            {pluginState.query.trim() ? `Create "${pluginState.query.trim()}"` : 'Create a new entry'}
          </span>
          <span className={styles.itemType}>new</span>
        </button>
      )}

      {filtered.length === 0 ? (
        !showCreate && (
          <div className={styles.noResults}>
            No entities match &quot;{pluginState.query || '@'}&quot;
          </div>
        )
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

  return typeof document !== 'undefined' ? createPortal(menu, document.body) : menu;
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
