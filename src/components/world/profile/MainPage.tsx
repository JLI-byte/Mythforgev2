import React from 'react';
import { PageProps } from './CharacterProfile';
import EditableText from './editors/EditableText';
import ListEditor from './editors/ListEditor';
import styles from './CharacterProfile.module.css';

export default function MainPage({ profile, editing, update }: PageProps) {
    const dossier = profile.dossier ?? [];
    return (
        <div className={styles.pageScroll}>
            <h1>Main</h1>
            <h2>identity / origin / first impression</h2>

            <div className={styles.dossier}>
                <div className={styles.dossierName}>
                    <b>Full Name</b>
                    <EditableText as="span" editing={editing} value={profile.fullName ?? ''} placeholder="Full name"
                        onChange={(v) => update({ fullName: v })} />
                </div>
                <ListEditor
                    className={styles.dossierMeta}
                    editing={editing}
                    items={dossier}
                    onChange={(items) => update({ dossier: items })}
                    newItem={() => ({ label: 'Field', value: '' })}
                    addLabel="+ Add field"
                    renderItem={(f, i, onItem) => (
                        <p>
                            {editing
                                ? <EditableText editing label="Dossier field label" value={f.label} onChange={(v) => onItem({ label: v })} />
                                : <b>{f.label}</b>}
                            {editing
                                ? <EditableText editing label="Dossier field value" value={f.value} onChange={(v) => onItem({ value: v })} />
                                : <span>{f.value || '—'}</span>}
                        </p>
                    )}
                />
            </div>

            <div className={styles.introCard}>
                <b>first impression</b>
                <EditableText as="p" multiline editing={editing} label="First impression" value={profile.firstImpression ?? ''}
                    placeholder="No first impression yet." onChange={(v) => update({ firstImpression: v })} />
            </div>

            <div className={styles.text}>
                <EditableText as="p" multiline editing={editing} label="Biography" value={profile.bio ?? ''}
                    placeholder="No biography yet." onChange={(v) => update({ bio: v })} />
            </div>
        </div>
    );
}
