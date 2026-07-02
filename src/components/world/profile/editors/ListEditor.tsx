import React from 'react';
import styles from './editors.module.css';

interface ListEditorProps<T> {
    editing: boolean;
    items: T[];
    onChange: (items: T[]) => void;
    newItem: () => T;
    addLabel: string;
    renderItem: (item: T, index: number, onItem: (patch: Partial<T>) => void) => React.ReactNode;
    className?: string;
}

export default function ListEditor<T>({
    editing, items, onChange, newItem, addLabel, renderItem, className,
}: ListEditorProps<T>) {
    const setItem = (i: number, patch: Partial<T>) => {
        const next = items.slice();
        next[i] = { ...next[i], ...patch };
        onChange(next);
    };
    const remove = (i: number) => onChange(items.filter((_, j) => j !== i));

    return (
        <div className={className}>
            {items.map((item, i) =>
                editing ? (
                    <div key={i} className={styles.itemWrap}>
                        <button type="button" className={styles.removeBtn} onClick={() => remove(i)} aria-label="Remove">×</button>
                        {renderItem(item, i, (patch) => setItem(i, patch))}
                    </div>
                ) : (
                    <React.Fragment key={i}>{renderItem(item, i, () => {})}</React.Fragment>
                ),
            )}
            {editing && (
                <button type="button" className={styles.addBtn} onClick={() => onChange([...items, newItem()])}>
                    {addLabel}
                </button>
            )}
        </div>
    );
}
