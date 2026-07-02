"use client";

import { useWorkspaceStore, selectProjectWorldKey } from '@/store/workspaceStore';
import { worldKeyForEntity } from '@/lib/worldKey';
import styles from '../../ArticleGridEditor.module.css';

interface TimelineEvent {
  id: string;
  date: string;        // free-form text e.g. "Year 312", "Day 5", "After the Fall"
  label: string;       // event title
  description: string; // optional detail text
  entityId: string;    // optional linked entity ID (empty string = no link)
}

interface TimelineContent {
  events: TimelineEvent[];
  orientation: 'horizontal' | 'vertical';
}

export function TimelineWidget({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const entities = useWorkspaceStore(s => s.entities);
  const projectWorldKey = useWorkspaceStore(selectProjectWorldKey);

  const events: TimelineEvent[] = content.events || [];
  const orientation: 'horizontal' | 'vertical' = content.orientation || 'horizontal';

  const worldEntities = entities.filter(e => worldKeyForEntity(e) === projectWorldKey);

  const addEvent = () => {
    const newEvent: TimelineEvent = {
      id: crypto.randomUUID(),
      date: '',
      label: '',
      description: '',
      entityId: '',
    };
    onChange({ ...content, events: [...events, newEvent] });
  };

  const updateEvent = (id: string, field: keyof TimelineEvent, value: string) => {
    onChange({
      ...content,
      events: events.map(e => e.id === id ? { ...e, [field]: value } : e),
    });
  };

  const removeEvent = (id: string) => {
    onChange({ ...content, events: events.filter(e => e.id !== id) });
  };

  const toggleOrientation = () => {
    onChange({ ...content, orientation: orientation === 'horizontal' ? 'vertical' : 'horizontal' });
  };

  return (
    <div className={styles.timelineWidget}>
      {/* Controls row */}
      <div className={styles.timelineControls}>
        <button
          className={styles.timelineOrientBtn}
          onClick={toggleOrientation}
          title={orientation === 'horizontal' ? 'Switch to vertical' : 'Switch to horizontal'}
        >
          {orientation === 'horizontal' ? '⇅ Vertical' : '⇄ Horizontal'}
        </button>
        <button className={styles.timelineAddBtn} onClick={addEvent}>
          + Add Event
        </button>
      </div>

      {/* Timeline display */}
      {events.length === 0 ? (
        <div className={styles.timelineEmpty}>
          <span>No events yet — click + Add Event</span>
        </div>
      ) : orientation === 'horizontal' ? (
        /* ── HORIZONTAL MODE ── */
        <div className={styles.timelineHoriz}>
          {/* Spine line */}
          <div className={styles.timelineSpine} />
          <div className={styles.timelineHorizTrack}>
            {events.map((ev, i) => (
              <div key={ev.id} className={styles.timelineHorizEvent}>
                {/* Dot on spine */}
                <div className={styles.timelineDot} />
                {/* Card — alternate above/below */}
                <div className={`${styles.timelineHorizCard} ${i % 2 === 0 ? styles.timelineCardAbove : styles.timelineCardBelow}`}>
                  <input
                    className={styles.timelineDateInput}
                    value={ev.date}
                    placeholder="Date / Era"
                    onChange={e => updateEvent(ev.id, 'date', e.target.value)}
                  />
                  <input
                    className={styles.timelineLabelInput}
                    value={ev.label}
                    placeholder="Event title"
                    onChange={e => updateEvent(ev.id, 'label', e.target.value)}
                  />
                  <textarea
                    className={styles.timelineDescInput}
                    value={ev.description}
                    placeholder="Description (optional)"
                    onChange={e => updateEvent(ev.id, 'description', e.target.value)}
                    rows={2}
                  />
                  <select
                    className={styles.timelineEntitySelect}
                    value={ev.entityId}
                    onChange={e => updateEvent(ev.id, 'entityId', e.target.value)}
                  >
                    <option value="">No linked entity</option>
                    {worldEntities.map(entity => (
                      <option key={entity.id} value={entity.id}>{entity.name}</option>
                    ))}
                  </select>
                  <button
                    className={styles.timelineEventDelete}
                    onClick={() => removeEvent(ev.id)}
                    title="Remove event"
                  >×</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* ── VERTICAL MODE ── */
        <div className={styles.timelineVert}>
          {events.map((ev, i) => (
            <div key={ev.id} className={styles.timelineVertEvent}>
              {/* Left column: date + dot + spine */}
              <div className={styles.timelineVertLeft}>
                <span className={styles.timelineVertDate}>{ev.date || '—'}</span>
                <div className={styles.timelineVertDot} />
                {i < events.length - 1 && <div className={styles.timelineVertSpine} />}
              </div>
              {/* Right column: card */}
              <div className={styles.timelineVertCard}>
                <div className={styles.timelineVertCardHeader}>
                  <input
                    className={styles.timelineLabelInput}
                    value={ev.label}
                    placeholder="Event title"
                    onChange={e => updateEvent(ev.id, 'label', e.target.value)}
                  />
                  <button
                    className={styles.timelineEventDelete}
                    onClick={() => removeEvent(ev.id)}
                    title="Remove event"
                  >×</button>
                </div>
                <input
                  className={styles.timelineDateInput}
                  value={ev.date}
                  placeholder="Date / Era"
                  onChange={e => updateEvent(ev.id, 'date', e.target.value)}
                />
                <textarea
                  className={styles.timelineDescInput}
                  value={ev.description}
                  placeholder="Description (optional)"
                  onChange={e => updateEvent(ev.id, 'description', e.target.value)}
                  rows={2}
                />
                <select
                  className={styles.timelineEntitySelect}
                  value={ev.entityId}
                  onChange={e => updateEvent(ev.id, 'entityId', e.target.value)}
                >
                  <option value="">No linked entity</option>
                  {worldEntities.map(entity => (
                    <option key={entity.id} value={entity.id}>{entity.name}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
