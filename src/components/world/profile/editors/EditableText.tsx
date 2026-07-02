import React from 'react';
import styles from './editors.module.css';

interface EditableTextProps {
    editing: boolean;
    value: string;
    onChange: (v: string) => void;
    multiline?: boolean;
    placeholder?: string;
    as?: 'span' | 'p' | 'b' | 'h3';
    className?: string;
}

export default function EditableText({
    editing, value, onChange, multiline, placeholder, as = 'span', className,
}: EditableTextProps) {
    if (editing) {
        return multiline ? (
            <textarea
                className={styles.textarea}
                value={value}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
            />
        ) : (
            <input
                className={styles.input}
                type="text"
                value={value}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
            />
        );
    }
    const Tag = as;
    if (!value) return placeholder ? <Tag className={className}>{placeholder}</Tag> : null;
    return <Tag className={className}>{value}</Tag>;
}
