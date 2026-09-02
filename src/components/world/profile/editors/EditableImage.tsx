import React from 'react';
import { fileToDataUrl } from './imageUpload';
import styles from './editors.module.css';

interface EditableImageProps {
    editing: boolean;
    value?: string;
    onChange: (v: string) => void;
    className?: string;
    alt?: string;
}

export default function EditableImage({ editing, value, onChange, className, alt = '' }: EditableImageProps) {
    const img = value
        ? <img src={value} alt={alt} className={className} />
        : <div className={`${className ?? ''} ${styles.emptyImage}`}>no image</div>;

    if (!editing) return value ? img : null;

    const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) onChange(await fileToDataUrl(f));
    };

    return (
        <div className={styles.imageWrap}>
            {img}
            <div className={styles.imageControls}>
                <input
                    type="text"
                    aria-label="Image URL"
                    value={value ?? ''}
                    placeholder="image URL"
                    onChange={(e) => onChange(e.target.value)}
                />
                <label className={styles.uploadBtn}>
                    ⬆
                    <input type="file" accept="image/*" aria-label="Upload image" hidden onChange={onFile} />
                </label>
            </div>
        </div>
    );
}
