"use client";

import React from 'react';
import type { DossierSection } from '@/lib/research/dossier';
import styles from './DossierPanel.module.css';

interface Props {
    sections: DossierSection[];
}

/**
 * A dossier, read-only. Nothing here is editable and nothing touches the store:
 * this is a reference read while writing, so a stray keystroke must not alter
 * the research it is showing.
 */
export function DossierRenderer({ sections }: Props) {
    if (sections.length === 0) {
        return <p className={styles.empty}>Nothing on this board yet.</p>;
    }

    return (
        <div className={styles.sections}>
            {sections.map(section => (
                <section key={section.boardId} className={styles.section}>
                    <h3
                        className={styles.boardName}
                        style={{ '--depth': section.depth } as React.CSSProperties}
                    >
                        {section.boardName}
                        <span className={styles.count}>{section.cards.length}</span>
                    </h3>

                    <ul className={styles.list}>
                        {section.cards.map(card => (
                            <li key={card.id} className={styles.card}>
                                <span className={styles.cardTitle}>
                                    {card.title}
                                    {card.unsorted && <span className={styles.chip}>unsorted</span>}
                                </span>
                                {card.body && <span className={styles.cardBody}>{card.body}</span>}
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
        </div>
    );
}
