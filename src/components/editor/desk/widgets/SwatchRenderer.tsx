"use client";

import React from 'react';
import styles from './SwatchRenderer.module.css';

interface Props {
    content: { title?: string; colors?: string[] };
    onChange: (c: Record<string, unknown>) => void;
}

const DEFAULT_COLOUR = '#888888';

/**
 * A palette pinned to the desk.
 *
 * Colours are plain hex strings so the card stays serialisable; the native
 * colour input does the picking rather than a bundled wheel.
 */
export function SwatchRenderer({ content, onChange }: Props) {
    // Local state leads the props. onChange is debounced by the caller, so two
    // colours added inside that window would both read the same props array
    // and the first would be lost.
    const [colors, setColors] = React.useState<string[]>(content.colors ?? []);
    const lastPushed = React.useRef(content.colors);

    React.useEffect(() => {
        if (content.colors !== lastPushed.current) {
            setColors(content.colors ?? []);
            lastPushed.current = content.colors;
        }
    }, [content.colors]);

    const commit = (next: string[]) => {
        setColors(next);
        lastPushed.current = next;
        onChange({ ...content, colors: next });
    };

    return (
        <div className={styles.swatch}>
            <header className={styles.head}>
                <input
                    className={styles.title}
                    value={content.title ?? ''}
                    placeholder="Palette"
                    aria-label="Palette name"
                    onChange={e => onChange({ ...content, title: e.target.value })}
                />
            </header>

            <div className={styles.chips}>
                {colors.length === 0 ? (
                    <p className={styles.empty}>No colours yet.</p>
                ) : colors.map((colour, i) => (
                    <div key={i} className={styles.chip}>
                        <input
                            type="color"
                            className={styles.picker}
                            value={colour}
                            aria-label={`Colour ${i + 1}`}
                            onChange={e => commit(colors.map((c, j) => (j === i ? e.target.value : c)))}
                        />
                        <span className={styles.hex}>{colour}</span>
                        <button
                            className={styles.remove}
                            aria-label={`Remove colour ${i + 1}`}
                            onClick={() => commit(colors.filter((_, j) => j !== i))}
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>

            <footer className={styles.foot}>
                <button
                    className={styles.add}
                    onClick={() => commit([...colors, DEFAULT_COLOUR])}
                >
                    ＋ Colour
                </button>
            </footer>
        </div>
    );
}
