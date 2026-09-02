"use client";

import React, { useId, useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import { spineFraction, type Shelf } from '@/lib/worldShelves';
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
}

/** How many cover slots fit across the panel before it crowds. */
const MAX_COVER_SLOTS = 5;

export function WorldShelf({
  shelves, size, selectedKey, onSelect, onOpenStory, onOpenBible, emptyAction,
}: WorldShelfProps) {
  // Declared before any early return — hooks must run unconditionally.
  const spineRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Namespaced so two shelves on one page (tile and, later, the full Bookshelf)
  // cannot collide on element ids.
  const baseId = useId();
  const panelId = `${baseId}-panel`;
  const tabId = (key: WorldKey) => `${baseId}-tab-${key}`;

  if (shelves.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>
          Your shelf is empty. Create a world and the stories you write in it live here.
        </p>
        {emptyAction}
      </div>
    );
  }

  // Selection always resolves to a real shelf, so the panel is never blank.
  const selected = shelves.find(s => s.key === selectedKey) ?? shelves[0];

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

  // When the stories outnumber the slots, give up one slot to say how many are
  // not shown rather than truncating in silence. hiddenCount is derived from
  // what actually rendered, so the badge and its tooltip cannot disagree.
  const visibleStories = selected.stories.length > MAX_COVER_SLOTS
    ? selected.stories.slice(0, MAX_COVER_SLOTS - 1)
    : selected.stories;
  const hiddenCount = selected.stories.length - visibleStories.length;

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
              style={{
                height: `${(spineFraction(shelf.stories.length) * 100).toFixed(2)}%`,
                background: shelf.coverColor,
              }}
              title={`${shelf.name} — ${plural(shelf.stories.length, 'story', 'stories')}`}
              onClick={() => onSelect(shelf.key)}
              onKeyDown={e => handleKeyDown(e, i)}
            >
              <span className={styles.spineLabel}>{shelf.name}</span>
            </button>
          );
        })}
      </div>

      <div
        className={styles.panel}
        id={panelId}
        role="tabpanel"
        aria-labelledby={tabId(selected.key)}
      >
        <h3 className={styles.panelName}>{selected.name}</h3>
        <p className={styles.panelMeta}>
          {plural(selected.stories.length, 'story', 'stories')}
          {' · '}
          {plural(selected.articleCount, 'article', 'articles')}
        </p>

        {selected.stories.length > 0 ? (
          <div className={styles.covers}>
            {visibleStories.map(story => (
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
            {hiddenCount > 0 && (
              <span
                className={styles.coverMore}
                title={`${plural(hiddenCount, 'more story', 'more stories')} in this world`}
              >
                +{hiddenCount}
              </span>
            )}
          </div>
        ) : (
          <p className={styles.noStories}>No stories in this world yet.</p>
        )}

        <button className={styles.bibleLink} onClick={() => onOpenBible(selected.key)}>
          Open world bible <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}
