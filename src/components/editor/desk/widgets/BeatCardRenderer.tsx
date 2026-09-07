"use client";

import { useState, useRef, useEffect } from 'react';
import styles from '../../WritingDesk.module.css';

/**
 * Beat Card — a guided outlining card spawned by a writing method.
 *
 * Teaches by scaffolding: beat label + ⓘ guidance popover + a greyed example
 * placeholder. Once the writer types, the scaffold gets out of the way.
 * A blank beat card (drawn by hand from the palette) works too — it just has
 * no method metadata.
 */
export function BeatCardRenderer({ content, onChange }: { content: any; onChange: (c: any) => void; }) {
    const [localContent, setLocalContent] = useState(content);
    const [showGuidance, setShowGuidance] = useState(false);
    const lastPropContent = useRef(content);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (content !== lastPropContent.current) {
            setLocalContent(content);
            lastPropContent.current = content;
        }
    }, [content]);

    useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

    const handleChange = (updates: Record<string, any>) => {
        const next = { ...localContent, ...updates };
        setLocalContent(next);
        lastPropContent.current = next;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => onChange(next), 600);
    };

    const label = localContent.beatLabel || 'Beat';
    const group = localContent.beatGroup;
    const guidance = localContent.guidance;
    const hasSequence = typeof localContent.beatIndex === 'number' && typeof localContent.beatCount === 'number';

    return (
        <div className={styles.beatWidget}>
            <div className={styles.beatWidgetHeader}>
                <div className={styles.beatWidgetTitles}>
                    {group && <span className={styles.beatWidgetGroup}>{group}</span>}
                    <input
                        className={styles.beatWidgetLabel}
                        value={label}
                        onChange={e => handleChange({ beatLabel: e.target.value })}
                        onMouseDown={e => e.stopPropagation()}
                        aria-label="Beat title"
                    />
                </div>
                <div className={styles.beatWidgetMeta}>
                    {hasSequence && (
                        <span className={styles.beatWidgetStep}>{localContent.beatIndex + 1}/{localContent.beatCount}</span>
                    )}
                    {guidance && (
                        <button
                            className={`${styles.beatWidgetInfoBtn} ${showGuidance ? styles.beatWidgetInfoBtnActive : ''}`}
                            onMouseDown={e => e.stopPropagation()}
                            onClick={() => setShowGuidance(v => !v)}
                            title="What goes here?"
                            aria-label="Show beat guidance"
                        >
                            i
                        </button>
                    )}
                </div>
            </div>

            {showGuidance && guidance && (
                <div className={styles.beatWidgetGuidance}>{guidance}</div>
            )}

            <textarea
                aria-label="Beat text"
                className={styles.beatWidgetTextarea}
                placeholder={localContent.placeholder || 'What happens in this beat?'}
                value={localContent.text || ''}
                onChange={e => handleChange({ text: e.target.value })}
                onMouseDown={e => e.stopPropagation()}
            />
        </div>
    );
}
