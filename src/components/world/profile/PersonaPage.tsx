import React from 'react';
import { CharacterProfile } from '@/store/workspaceStore';
import styles from './CharacterProfile.module.css';

export default function PersonaPage({ profile }: { profile: CharacterProfile }) {
    const rows = profile.personaRows ?? [];
    const meters = profile.meters ?? [];
    const core = profile.corePersonality;
    return (
        <div className={styles.pageScroll}>
            <h1>Persona</h1>
            <h2>temper / desire / personality</h2>

            {core && (core.text || core.heading || core.image) && (
                <div className={styles.personaFeature}>
                    {core.image && <img src={core.image} alt="" />}
                    <div>
                        <b>Core Personality</b>
                        {core.heading && <h3>{core.heading}</h3>}
                        {core.text && <p>{core.text}</p>}
                    </div>
                </div>
            )}

            {rows.map((row, i) => (
                <div key={i} className={`${styles.personaRow} ${i % 2 === 1 ? styles.reverse : ''}`}>
                    <div className={styles.personaTextCard}>
                        {row.label && <b>{row.label}</b>}
                        {row.heading && <h3>{row.heading}</h3>}
                        {row.text && <p>{row.text}</p>}
                    </div>
                    {row.image && <img src={row.image} alt="" />}
                </div>
            ))}

            {meters.length > 0 && (
                <div className={styles.personaMeters}>
                    {meters.map((m, i) => (
                        <div key={i} className={styles.meterItem} style={{ ['--level' as string]: `${m.level}%` }}>
                            <b>{m.label}</b>
                            <div><span /></div>
                        </div>
                    ))}
                </div>
            )}

            {(profile.dos || profile.donts) && (
                <div className={styles.personaNotes}>
                    <div><b>Do's</b><p>{profile.dos || '—'}</p></div>
                    <div><b>Don'ts</b><p>{profile.donts || '—'}</p></div>
                </div>
            )}

            {rows.length === 0 && meters.length === 0 && !core && (
                <p className={styles.placeholder}>No persona details yet.</p>
            )}
        </div>
    );
}
