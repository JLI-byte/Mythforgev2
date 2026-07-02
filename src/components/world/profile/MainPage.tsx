import React from 'react';
import { CharacterProfile } from '@/store/workspaceStore';
import styles from './CharacterProfile.module.css';

export default function MainPage({ profile, name }: { profile: CharacterProfile; name: string }) {
    const dossier = profile.dossier ?? [];
    return (
        <div className={styles.pageScroll}>
            <h1>Main</h1>
            <h2>identity / origin / first impression</h2>

            <div className={styles.dossier}>
                <div className={styles.dossierName}>
                    <b>Full Name</b>
                    <span>{profile.fullName || name}</span>
                </div>
                <div className={styles.dossierMeta}>
                    {dossier.map((f, i) => (
                        <p key={i}><b>{f.label}</b><span>{f.value || '—'}</span></p>
                    ))}
                </div>
            </div>

            {profile.firstImpression ? (
                <div className={styles.introCard}>
                    <b>first impression</b>
                    <p>{profile.firstImpression}</p>
                </div>
            ) : (
                <p className={styles.placeholder}>No first impression yet.</p>
            )}

            {profile.bio ? (
                <div className={styles.text}><p>{profile.bio}</p></div>
            ) : (
                <p className={styles.placeholder}>No biography yet.</p>
            )}
        </div>
    );
}
