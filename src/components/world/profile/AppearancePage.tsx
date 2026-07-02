import React from 'react';
import { CharacterProfile } from '@/store/workspaceStore';
import styles from './CharacterProfile.module.css';

export default function AppearancePage({ profile }: { profile: CharacterProfile }) {
    const palette = profile.palette ?? [];
    const lookbook = profile.lookbook ?? [];
    const sections = profile.appearanceSections ?? [];
    const empty = palette.length === 0 && lookbook.length === 0 && sections.length === 0 && !profile.visualImpression;
    return (
        <div className={styles.pageScroll}>
            <h1>Appearance</h1>
            <h2>face / style / signature details</h2>

            {palette.length > 0 && (
                <div className={styles.palette}>
                    {palette.map((s, i) => (
                        <div key={i} className={styles.colorSwatch} style={{ ['--swatch' as string]: s.hex }}>
                            <i /><b>{s.name}</b><span>{s.hex}</span>
                        </div>
                    ))}
                </div>
            )}

            {lookbook.length > 0 && (
                <div className={styles.lookbook}>
                    {lookbook.map((l, i) => (
                        <div key={i} className={`${styles.lookItem} ${i === 0 ? styles.large : ''}`}>
                            {l.image && <img src={l.image} alt={l.label} />}
                            <b>{l.label}</b>
                            {l.value && <span>{l.value}</span>}
                        </div>
                    ))}
                </div>
            )}

            {profile.visualImpression && (
                <div className={styles.appearanceBlock}>
                    <b>Visual Impression</b>
                    <p>{profile.visualImpression}</p>
                </div>
            )}

            {sections.length > 0 && (
                <div className={styles.appearanceSections}>
                    {sections.map((sec, i) => (
                        <div key={i} className={styles.appearanceSection}>
                            <div className={styles.appearanceSectionHead}>
                                <b>{sec.label}</b>
                                {sec.note && <span>{sec.note}</span>}
                            </div>
                            <div className={styles.appearanceMoodboard}>
                                {(sec.moodboard ?? []).map((m, j) => (
                                    <div key={j} className={styles.moodItem}>
                                        {m.image && <img src={m.image} alt="" />}
                                        {m.caption && <p>{m.caption}</p>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {empty && <p className={styles.placeholder}>No appearance details yet.</p>}
        </div>
    );
}
