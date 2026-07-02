import React from 'react';
import { PageProps } from './CharacterProfile';
import EditableText from './editors/EditableText';
import EditableImage from './editors/EditableImage';
import ListEditor from './editors/ListEditor';
import styles from './CharacterProfile.module.css';

export default function RelationsPage({ profile, editing, update }: PageProps) {
    const relations = profile.relations ?? [];
    const decor = profile.decorImages ?? [];
    return (
        <div className={styles.pageScroll}>
            <h1>Relations</h1>
            <h2>bonds / rivals / ties</h2>

            {relations.length === 0 && !editing ? (
                <p className={styles.placeholder}>No relations yet.</p>
            ) : (
                <ListEditor
                    className={styles.relationStack}
                    editing={editing}
                    items={relations}
                    onChange={(items) => update({ relations: items })}
                    newItem={() => ({ name: '', relation: '', text: '' })}
                    addLabel="+ Add relation"
                    renderItem={(r, i, onItem) => (
                        <div className={styles.relationCard}>
                            <div className={styles.relationInfo}>
                                <EditableImage editing={editing} value={r.image} onChange={(v) => onItem({ image: v })} alt={r.name ?? ''} />
                                <div>
                                    {editing
                                        ? <EditableText editing value={r.name ?? ''} placeholder="Name" onChange={(v) => onItem({ name: v })} />
                                        : r.name && <b>{r.name}</b>}
                                    {editing
                                        ? <EditableText editing value={r.relation ?? ''} placeholder="Relationship" onChange={(v) => onItem({ relation: v })} />
                                        : r.relation && <span>{r.relation}</span>}
                                </div>
                            </div>
                            <EditableText as="p" multiline editing={editing} value={r.text ?? ''} placeholder="Notes"
                                onChange={(v) => onItem({ text: v })} className={styles.relationText} />
                        </div>
                    )}
                />
            )}

            {editing && (
                <div className={styles.decorEditor}>
                    <h2>decorative images</h2>
                    <ListEditor
                        editing={editing}
                        items={decor}
                        onChange={(items) => update({ decorImages: items })}
                        newItem={() => ''}
                        addLabel="+ Add decor image"
                        renderItem={(src, i, _onItem) => (
                            <EditableImage
                                editing
                                value={src}
                                onChange={(v) => {
                                    const next = decor.slice();
                                    next[i] = v;
                                    update({ decorImages: next });
                                }}
                            />
                        )}
                    />
                </div>
            )}
        </div>
    );
}
