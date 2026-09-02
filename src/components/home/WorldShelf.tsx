"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { Shelf } from '@/lib/worldShelves';
import type { WorldKey } from '@/lib/worldKey';
import styles from './WorldShelf.module.css';

/**
 * A shelf of world spines, with the selected world opened beside them.
 *
 * Purely presentational — it takes a prepared Shelf[] and reports clicks. That
 * is what lets the Home tile and, later, the Bookshelf page render the same
 * component at different sizes without either owning the other's data wiring.
 */

interface WorldShelfProps {
  shelves: Shelf[];
  size: 'tile' | 'page';
  selectedKey: WorldKey | null;
  onSelect: (key: WorldKey) => void;
  onOpenStory: (projectId: string) => void;
  onOpenBible: (key: WorldKey) => void;
  /** Rendered under the message when there are no shelves at all. */
  emptyAction?: React.ReactNode;
  /** Supplied to offer world creation; omit for a read-only shelf. */
  onCreateWorld?: (name: string) => void;
  /** Supplied to offer book creation in the opened world. */
  onNewStory?: () => void;
}

/** How much of the visible width a chevron press travels. */
const PAGE_FRACTION = 0.8;

export function WorldShelf({
  shelves, size, selectedKey, onSelect, onOpenStory, onOpenBible, emptyAction,
  onCreateWorld, onNewStory,
}: WorldShelfProps) {
  // Every hook runs before the early return — they must be unconditional.
  const spineRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  // Namespaced so two shelves on one page (tile and, later, the full Bookshelf)
  // cannot collide on element ids.
  const baseId = useId();
  const panelId = `${baseId}-panel`;
  const tabId = (key: WorldKey) => `${baseId}-tab-${key}`;
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [canScroll, setCanScroll] = useState({ back: false, forward: false });

  // Resolved before the early return so the scroll effects can depend on it.
  // Undefined only when there are no shelves at all, which returns below.
  const selected = shelves.find(s => s.key === selectedKey) ?? shelves[0];

  /** Which chevrons are worth showing, from where the row actually sits. */
  const syncScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    // A pixel of slack: sub-pixel layout leaves scrollLeft fractionally short of
    // the true end, which would strand the forward chevron permanently enabled.
    setCanScroll({
      back: el.scrollLeft > 1,
      forward: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    });
  }, []);

  useEffect(() => {
    syncScroll();
    window.addEventListener('resize', syncScroll);
    return () => window.removeEventListener('resize', syncScroll);
  }, [syncScroll, selected?.key, selected?.stories.length]);

  const page = (direction: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({
      left: direction * el.clientWidth * PAGE_FRACTION,
      behavior: reduced ? 'auto' : 'smooth',
    });
  };

  const cancelCreate = () => { setDraftName(''); setCreating(false); };

  const submitWorld = () => {
    const name = draftName.trim();
    if (!name || !onCreateWorld) return;
    onCreateWorld(name);
    cancelCreate();
  };

  const createForm = (
    <div className={styles.createForm}>
      <p className={styles.createLabel}>Name your world</p>
      <input
        className={styles.createInput}
        value={draftName}
        autoFocus
        placeholder="Aethel"
        aria-label="World name"
        onChange={e => setDraftName(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') submitWorld();
          if (e.key === 'Escape') cancelCreate();
        }}
      />
      <p className={styles.createHint}>
        Genre and tone get sensible defaults — refine them on the Bookshelf.
      </p>
      <div className={styles.createActions}>
        <button className={styles.createSave} onClick={submitWorld} disabled={!draftName.trim()}>
          Create
        </button>
        <button className={styles.createCancel} onClick={cancelCreate}>Cancel</button>
      </div>
    </div>
  );

  if (shelves.length === 0 || !selected) {
    return (
      <div className={styles.empty}>
        {creating && onCreateWorld ? createForm : (
          <>
            <p className={styles.emptyText}>
              Your shelf is empty. Create a world and the stories you write in it live here.
            </p>
            {onCreateWorld && (
              <button className={styles.createSave} onClick={() => setCreating(true)}>
                Create a world
              </button>
            )}
            {emptyAction}
          </>
        )}
      </div>
    );
  }

  // Arrow keys walk the shelf, which is what a row of spines invites.
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = Math.min(shelves.length - 1, index + 1);
    else if (e.key === 'ArrowLeft') next = Math.max(0, index - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = shelves.length - 1;
    if (next === null) return;
    e.preventDefault();
    onSelect(shelves[next].key);
    spineRefs.current[next]?.focus();
  };

  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  return (
    <div className={`${styles.shelf} ${size === 'page' ? styles.sizePage : ''}`}>
      <div className={styles.spines} role="tablist" aria-label="Your worlds">
        {shelves.map((shelf, i) => {
          const isSelected = shelf.key === selected.key;
          return (
            <button
              key={shelf.key}
              ref={el => { spineRefs.current[i] = el; }}
              id={tabId(shelf.key)}
              role="tab"
              aria-selected={isSelected}
              aria-controls={panelId}
              // Roving tabindex: one Tab stop for the whole shelf, arrows move within it.
              tabIndex={isSelected ? 0 : -1}
              className={`${styles.spine} ${isSelected ? styles.spineSelected : ''}`}
              style={{ background: shelf.coverColor }}
              title={`${shelf.name} — ${plural(shelf.stories.length, 'story', 'stories')}`}
              onClick={() => onSelect(shelf.key)}
              onKeyDown={e => handleKeyDown(e, i)}
            >
              <span className={styles.spineLabel}>{shelf.name}</span>
            </button>
          );
        })}
        {onCreateWorld && (
          <button
            className={styles.addSpine}
            title="New world"
            aria-label="New world"
            onClick={() => setCreating(true)}
          >
            <Plus size={16} />
          </button>
        )}
      </div>

      <div
        className={styles.panel}
        id={panelId}
        role="tabpanel"
        aria-labelledby={tabId(selected.key)}
      >
        {creating && onCreateWorld ? createForm : (
          <>
            <h3 className={styles.panelName}>{selected.name}</h3>
            <p className={styles.panelMeta}>
              {plural(selected.stories.length, 'story', 'stories')}
              {' · '}
              {plural(selected.articleCount, 'article', 'articles')}
            </p>

            {selected.stories.length === 0 && (
              <p className={styles.noStories}>No stories in this world yet.</p>
            )}

            {/* The row survives an empty world so the new-book slot is still
                reachable there — an empty shelf is exactly where you want it. */}
            {(selected.stories.length > 0 || onNewStory) && (
              <div className={styles.coversRow}>
                <div
                  className={styles.coversScroller}
                  ref={scrollerRef}
                  onScroll={syncScroll}
                >
                  {/* Every story is here. Overflow scrolls rather than truncating,
                      and the header's "view all" is the way out to the rest. */}
                  {selected.stories.map(story => (
                    <button
                      key={story.id}
                      className={styles.cover}
                      style={story.coverImageUrl
                        ? { backgroundImage: `url(${story.coverImageUrl})` }
                        : { background: story.coverColor }}
                      title={story.name}
                      aria-label={`Open ${story.name}`}
                      onClick={() => onOpenStory(story.id)}
                    />
                  ))}
                </div>

                {/* Pointer-only, hover-revealed, and only when there is somewhere
                    to go. Touch and trackpad users just swipe. */}
                {canScroll.back && (
                  <button
                    className={`${styles.pager} ${styles.pagerBack}`}
                    aria-label="Scroll stories back"
                    tabIndex={-1}
                    onClick={() => page(-1)}
                  >
                    <ChevronLeft size={18} />
                  </button>
                )}
                {canScroll.forward && (
                  <button
                    className={`${styles.pager} ${styles.pagerForward}`}
                    aria-label="Scroll stories forward"
                    tabIndex={-1}
                    onClick={() => page(1)}
                  >
                    <ChevronRight size={18} />
                  </button>
                )}

                {/* Outside the scroller on purpose: creation is chrome, and it
                    must stay reachable however far the row has been scrolled. */}
                {onNewStory && (
                  <button
                    className={styles.addCover}
                    title={`New book in ${selected.name}`}
                    aria-label={`New book in ${selected.name}`}
                    onClick={onNewStory}
                  >
                    <Plus size={18} />
                  </button>
                )}
              </div>
            )}

            <button className={styles.bibleLink} onClick={() => onOpenBible(selected.key)}>
              Open world bible <ArrowRight size={13} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
