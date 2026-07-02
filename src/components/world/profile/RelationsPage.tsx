import React from 'react';
import { CharacterProfile } from '@/store/workspaceStore';
import styles from './CharacterProfile.module.css';

export default function RelationsPage({ profile }: { profile: CharacterProfile }) {
    const relations = profile.relations ?? [];
    return (
        <div className={styles.pageScroll}>
            <h1>Relations</h1>
            <h2>bonds / rivals / ties</h2>

            {relations.length === 0 ? (
                <p className={styles.placeholder}>No relations yet.</p>
            ) : (
                <div className={styles.relationStack}>
                    {relations.map((r, i) => (
                        <div key={i} className={styles.relationCard}>
                            <div className={styles.relationInfo}>
                                {r.image && <img src={r.image} alt={r.name || ''} />}
                                <div>
                                    {r.name && <b>{r.name}</b>}
                                    {r.relation && <span>{r.relation}</span>}
                                </div>
                            </div>
                            {r.text && <p className={styles.relationText}>{r.text}</p>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
