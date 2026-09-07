"use client";

import React, { useId } from 'react';
import styles from '../../ArticleGridEditor.module.css';

/**
 * Count syllables in an English word using a heuristic approach.
 * Accurate enough for poetry/song writing purposes.
 */
function countSyllablesInWord(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length === 0) return 0;
  if (word.length <= 3) return 1;

  // Remove trailing silent e
  word = word.replace(/e$/, '');
  // Count vowel groups
  const vowelGroups = word.match(/[aeiouy]+/g);
  let count = vowelGroups ? vowelGroups.length : 1;

  // Subtract for common patterns that reduce syllable count
  if (word.endsWith('le') && word.length > 2 && !/[aeiouy]/.test(word[word.length - 3])) count++;
  if (word.endsWith('ed') && !word.endsWith('ted') && !word.endsWith('ded')) count = Math.max(1, count - 1);

  return Math.max(1, count);
}

function analyzeText(text: string): { word: string; syllables: number }[] {
  if (!text.trim()) return [];
  return text.trim().split(/\s+/).map(raw => ({
    word: raw,
    syllables: countSyllablesInWord(raw),
  }));
}

/**
 * Get the ending sound of a word for rhyme detection.
 * Returns the last vowel + everything after it.
 */
function getEndSound(word: string): string {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  const match = word.match(/[aeiouy][^aeiouy]*$/);
  return match ? match[0] : word.slice(-2);
}

/**
 * Assign rhyme scheme labels (A, B, C...) to an array of line-ending words.
 */
function getRhymeScheme(lines: string[]): string[] {
  const soundMap = new Map<string, string>();
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let nextIdx = 0;

  return lines.map(line => {
    const words = line.trim().split(/\s+/);
    const lastWord = words[words.length - 1] || '';
    if (!lastWord) return '';
    const sound = getEndSound(lastWord);
    if (!soundMap.has(sound)) {
      soundMap.set(sound, letters[nextIdx % 26]);
      nextIdx++;
    }
    return soundMap.get(sound)!;
  });
}

export function SyllableWidget({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const fieldId = useId();
  const text: string = content.text || '';
  const showBreakdown: boolean = content.showBreakdown ?? true;

  const analysis = React.useMemo(() => analyzeText(text), [text]);
  const totalSyllables = analysis.reduce((sum, w) => sum + w.syllables, 0);
  const wordCount = analysis.length;

  return (
    <div className={styles.syllableWidget}>
      <div className={styles.syllableToolbar}>
        <span className={styles.syllableStats}>
          {totalSyllables} syllable{totalSyllables !== 1 ? 's' : ''} · {wordCount} word{wordCount !== 1 ? 's' : ''}
        </span>
        <label className={styles.syllableToggle} htmlFor={`${fieldId}-breakdown`}>
          <input
            id={`${fieldId}-breakdown`}
            type="checkbox"
            checked={showBreakdown}
            onChange={e => onChange({ ...content, showBreakdown: e.target.checked })}
          />
          <span>Breakdown</span>
        </label>
      </div>

      <textarea
        className={styles.syllableTextarea}
        aria-label="Text to count syllables"
        placeholder="Type or paste text to count syllables..."
        value={text}
        onChange={e => onChange({ ...content, text: e.target.value })}
      />

      {showBreakdown && analysis.length > 0 && (
        <div className={styles.syllableBreakdown}>
          {analysis.map((item, i) => (
            <span key={i} className={styles.syllableWord}>
              <span className={styles.syllableWordText}>{item.word}</span>
              <span className={styles.syllableWordCount}>{item.syllables}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

interface LyricLine { id: string; text: string; }
interface LyricStanza { id: string; lines: LyricLine[]; }

export function LyricWidget({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const fieldId = useId();
  const stanzas: LyricStanza[] = content.stanzas || [{ id: crypto.randomUUID(), lines: [{ id: crypto.randomUUID(), text: '' }] }];
  const showSyllables: boolean = content.showSyllables ?? true;
  const showRhyme: boolean = content.showRhyme ?? true;

  const updateLine = (stanzaId: string, lineId: string, text: string) => {
    onChange({
      ...content,
      stanzas: stanzas.map(s => s.id === stanzaId
        ? { ...s, lines: s.lines.map(l => l.id === lineId ? { ...l, text } : l) }
        : s
      ),
    });
  };

  const addLine = (stanzaId: string) => {
    onChange({
      ...content,
      stanzas: stanzas.map(s => s.id === stanzaId
        ? { ...s, lines: [...s.lines, { id: crypto.randomUUID(), text: '' }] }
        : s
      ),
    });
  };

  const removeLine = (stanzaId: string, lineId: string) => {
    onChange({
      ...content,
      stanzas: stanzas.map(s => s.id === stanzaId
        ? { ...s, lines: s.lines.filter(l => l.id !== lineId) }
        : s
      ).filter(s => s.lines.length > 0),
    });
  };

  const addStanza = () => {
    onChange({
      ...content,
      stanzas: [...stanzas, { id: crypto.randomUUID(), lines: [{ id: crypto.randomUUID(), text: '' }] }],
    });
  };

  // Compute rhyme scheme across all lines flattened
  const allLines = stanzas.flatMap(s => s.lines.map(l => l.text));
  const rhymeScheme = showRhyme ? getRhymeScheme(allLines) : [];
  let lineIndex = 0;

  return (
    <div className={styles.lyricWidget}>
      <div className={styles.lyricToolbar}>
        <label className={styles.lyricToggle} htmlFor={`${fieldId}-syllables`}>
          <input id={`${fieldId}-syllables`} type="checkbox" checked={showSyllables} onChange={e => onChange({ ...content, showSyllables: e.target.checked })} />
          <span>Syllables</span>
        </label>
        <label className={styles.lyricToggle} htmlFor={`${fieldId}-rhyme`}>
          <input id={`${fieldId}-rhyme`} type="checkbox" checked={showRhyme} onChange={e => onChange({ ...content, showRhyme: e.target.checked })} />
          <span>Rhyme</span>
        </label>
        <button className={styles.lyricAddStanzaBtn} onClick={addStanza}>+ Stanza</button>
      </div>

      <div className={styles.lyricBody}>
        {stanzas.map((stanza, si) => (
          <div key={stanza.id} className={styles.lyricStanza}>
            {si > 0 && <div className={styles.lyricStanzaDivider} />}
            {stanza.lines.map(line => {
              const syllableCount = showSyllables
                ? analyzeText(line.text).reduce((s, w) => s + w.syllables, 0)
                : null;
              const rhyme = showRhyme ? rhymeScheme[lineIndex] : '';
              lineIndex++;

              return (
                <div key={line.id} className={styles.lyricLine}>
                  {showRhyme && (
                    <span className={styles.lyricRhymeLabel}>{rhyme}</span>
                  )}
                  <input
                    className={styles.lyricLineInput}
                    aria-label="Lyric line"
                    value={line.text}
                    placeholder="Write a line..."
                    onChange={e => updateLine(stanza.id, line.id, e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); addLine(stanza.id); }
                      if (e.key === 'Backspace' && line.text === '' && stanza.lines.length > 1) {
                        e.preventDefault(); removeLine(stanza.id, line.id);
                      }
                    }}
                  />
                  {showSyllables && (
                    <span className={styles.lyricSylCount}>{syllableCount ?? 0}</span>
                  )}
                </div>
              );
            })}
            <button className={styles.lyricAddLineBtn} onClick={() => addLine(stanza.id)}>+ line</button>
          </div>
        ))}
      </div>
    </div>
  );
}
