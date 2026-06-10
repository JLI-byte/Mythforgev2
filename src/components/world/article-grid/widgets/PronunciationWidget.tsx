"use client";

import { useState } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import styles from '../../ArticleGridEditor.module.css';

interface PronunciationEntry {
  id: string;
  name: string;           // the word/name e.g. "Aerindel"
  phonetic: string;       // IPA or custom notation e.g. "ay-RIN-del"
  syllables: string;      // syllable breakdown e.g. "Ae·rin·del"
  notes: string;          // optional e.g. "stress the second syllable"
  entityId: string;       // optional linked entity
}

export function PronunciationWidget({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const entities = useWorkspaceStore(s => s.entities);
  const activeProjectId = useWorkspaceStore(s => s.activeProjectId);

  const entries: PronunciationEntry[] = content.entries || [];
  const [showAdd, setShowAdd] = useState(false);
  const [newEntry, setNewEntry] = useState({ name: '', phonetic: '', syllables: '', notes: '', entityId: '' });
  const [editingId, setEditingId] = useState<string | null>(null);

  const projectEntities = entities.filter(e => e.projectId === activeProjectId);

  const addEntry = () => {
    if (!newEntry.name.trim()) return;
    const entry: PronunciationEntry = {
      id: crypto.randomUUID(),
      name: newEntry.name,
      phonetic: newEntry.phonetic,
      syllables: newEntry.syllables,
      notes: newEntry.notes,
      entityId: newEntry.entityId,
    };
    onChange({ ...content, entries: [...entries, entry] });
    setNewEntry({ name: '', phonetic: '', syllables: '', notes: '', entityId: '' });
    setShowAdd(false);
  };

  const removeEntry = (id: string) => {
    onChange({ ...content, entries: entries.filter(e => e.id !== id) });
  };

  const updateEntry = (id: string, field: keyof PronunciationEntry, value: string) => {
    onChange({
      ...content,
      entries: entries.map(e => e.id === id ? { ...e, [field]: value } : e),
    });
  };

  return (
    <div className={styles.pronWidget}>
      <div className={styles.pronToolbar}>
        <span className={styles.pronTitle}>Pronunciation Guide</span>
        <button className={styles.pronAddBtn} onClick={() => setShowAdd(v => !v)}>+ Add</button>
      </div>

      {showAdd && (
        <div className={styles.pronForm}>
          <select className={styles.pronSelect} value={newEntry.entityId}
            onChange={e => setNewEntry(v => ({
              ...v, entityId: e.target.value,
              name: e.target.value ? (entities.find(en => en.id === e.target.value)?.name ?? '') : v.name,
            }))}>
            <option value="">Link entity (optional)</option>
            {projectEntities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <input className={styles.pronInput} placeholder="Name *  (e.g. Aerindel)" value={newEntry.name} onChange={e => setNewEntry(v => ({ ...v, name: e.target.value }))} />
          <input className={styles.pronInput} placeholder="Phonetic  (e.g. ay-RIN-del)" value={newEntry.phonetic} onChange={e => setNewEntry(v => ({ ...v, phonetic: e.target.value }))} />
          <input className={styles.pronInput} placeholder="Syllables  (e.g. Ae·rin·del)" value={newEntry.syllables} onChange={e => setNewEntry(v => ({ ...v, syllables: e.target.value }))} />
          <input className={styles.pronInput} placeholder="Notes  (e.g. stress second syllable)" value={newEntry.notes} onChange={e => setNewEntry(v => ({ ...v, notes: e.target.value }))} />
          <div className={styles.pronFormBtns}>
            <button className={styles.pronConfirmBtn} onClick={addEntry}>Add</button>
            <button className={styles.pronCancelBtn} onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      )}

      {entries.length === 0 && !showAdd ? (
        <div className={styles.pronEmpty}>
          <span>🗣️</span>
          <span>Add entries to build your pronunciation guide</span>
        </div>
      ) : (
        <div className={styles.pronList}>
          {entries.map(entry => (
            <div key={entry.id} className={styles.pronEntry}>
              <div className={styles.pronEntryHeader}>
                {editingId === entry.id ? (
                  <input
                    className={styles.pronEntryNameInput}
                    value={entry.name}
                    onChange={e => updateEntry(entry.id, 'name', e.target.value)}
                    onBlur={() => setEditingId(null)}
                    autoFocus
                  />
                ) : (
                  <span className={styles.pronEntryName} onDoubleClick={() => setEditingId(entry.id)}>
                    {entry.name}
                  </span>
                )}
                <button className={styles.pronEntryDelete} onClick={() => removeEntry(entry.id)}>×</button>
              </div>
              {entry.phonetic && (
                <div className={styles.pronEntryPhonetic}>/{entry.phonetic}/</div>
              )}
              {entry.syllables && (
                <div className={styles.pronEntrySyllables}>{entry.syllables}</div>
              )}
              {entry.notes && (
                <div className={styles.pronEntryNotes}>{entry.notes}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
