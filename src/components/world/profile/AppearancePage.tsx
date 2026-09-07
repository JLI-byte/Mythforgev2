import React from 'react';
import { PageProps } from './CharacterProfile';
import EditableText from './editors/EditableText';
import EditableImage from './editors/EditableImage';
import ListEditor from './editors/ListEditor';
import styles from './CharacterProfile.module.css';

export default function AppearancePage({ profile, editing, update }: PageProps) {
    const palette = profile.palette ?? [];
    const lookbook = profile.lookbook ?? [];
    const sections = profile.appearanceSections ?? [];
    return (
        <div className={styles.pageScroll}>
            <h1>Appearance</h1>
            <h2>face / style / signature details</h2>

            <ListEditor
                className={styles.palette}
                editing={editing}
                items={palette}
                onChange={(items) => update({ palette: items })}
                newItem={() => ({ name: 'Colour', hex: '#84222b' })}
                addLabel="+ Add colour"
                renderItem={(s, i, onItem) => (
                    <div className={styles.colorSwatch} style={{ ['--swatch' as string]: s.hex }}>
                        {editing
                            ? <input type="color" aria-label={s.name ? `${s.name} colour` : 'Palette colour'} value={s.hex} onChange={(e) => onItem({ hex: e.target.value })} />
                            : <i />}
                        {editing
                            ? <EditableText editing label="Colour name" value={s.name} onChange={(v) => onItem({ name: v })} />
                            : <b>{s.name}</b>}
                        <span>{s.hex}</span>
                    </div>
                )}
            />

            <ListEditor
                className={styles.lookbook}
                editing={editing}
                items={lookbook}
                onChange={(items) => update({ lookbook: items })}
                newItem={() => ({ label: 'Item', value: '' })}
                addLabel="+ Add look"
                renderItem={(l, i, onItem) => (
                    <div className={`${styles.lookItem} ${i === 0 ? styles.large : ''}`}>
                        <EditableImage editing={editing} value={l.image} onChange={(v) => onItem({ image: v })} alt={l.label} />
                        {editing
                            ? <EditableText editing label="Look label" value={l.label} onChange={(v) => onItem({ label: v })} />
                            : <b>{l.label}</b>}
                        {editing
                            ? <EditableText editing value={l.value ?? ''} placeholder="detail" onChange={(v) => onItem({ value: v })} />
                            : l.value && <span>{l.value}</span>}
                    </div>
                )}
            />

            <div className={styles.appearanceBlock}>
                <b>Visual Impression</b>
                <EditableText as="p" multiline editing={editing} label="Visual impression" value={profile.visualImpression ?? ''}
                    placeholder="No visual impression yet." onChange={(v) => update({ visualImpression: v })} />
            </div>

            <ListEditor
                className={styles.appearanceSections}
                editing={editing}
                items={sections}
                onChange={(items) => update({ appearanceSections: items })}
                newItem={() => ({ label: 'Section', note: '', moodboard: [] })}
                addLabel="+ Add section"
                renderItem={(sec, i, onItem) => (
                    <div className={styles.appearanceSection}>
                        <div className={styles.appearanceSectionHead}>
                            {editing
                                ? <EditableText editing label="Section label" value={sec.label} onChange={(v) => onItem({ label: v })} />
                                : <b>{sec.label}</b>}
                            {editing
                                ? <EditableText editing value={sec.note ?? ''} placeholder="note" onChange={(v) => onItem({ note: v })} />
                                : sec.note && <span>{sec.note}</span>}
                        </div>
                        <ListEditor
                            className={styles.appearanceMoodboard}
                            editing={editing}
                            items={sec.moodboard ?? []}
                            onChange={(mb) => onItem({ moodboard: mb })}
                            newItem={() => ({ image: '', caption: '' })}
                            addLabel="+ Add image"
                            renderItem={(m, j, onMood) => (
                                <div className={styles.moodItem}>
                                    <EditableImage editing={editing} value={m.image} onChange={(v) => onMood({ image: v })} />
                                    <EditableText as="p" editing={editing} value={m.caption ?? ''} placeholder="caption"
                                        onChange={(v) => onMood({ caption: v })} />
                                </div>
                            )}
                        />
                    </div>
                )}
            />
        </div>
    );
}
