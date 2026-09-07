import React from 'react';
import { PageProps } from './CharacterProfile';
import EditableText from './editors/EditableText';
import EditableImage from './editors/EditableImage';
import ListEditor from './editors/ListEditor';
import MeterField from './editors/MeterField';
import styles from './CharacterProfile.module.css';

export default function PersonaPage({ profile, editing, update }: PageProps) {
    const core = profile.corePersonality ?? {};
    const rows = profile.personaRows ?? [];
    const meters = profile.meters ?? [];
    return (
        <div className={styles.pageScroll}>
            <h1>Persona</h1>
            <h2>temper / desire / personality</h2>

            <div className={styles.personaFeature}>
                <EditableImage editing={editing} value={core.image}
                    onChange={(v) => update({ corePersonality: { ...core, image: v } })} />
                <div>
                    <b>Core Personality</b>
                    <EditableText as="h3" editing={editing} value={core.heading ?? ''} placeholder="Heading"
                        onChange={(v) => update({ corePersonality: { ...core, heading: v } })} />
                    <EditableText as="p" multiline editing={editing} value={core.text ?? ''} placeholder="Describe the core personality."
                        onChange={(v) => update({ corePersonality: { ...core, text: v } })} />
                </div>
            </div>

            <ListEditor
                editing={editing}
                items={rows}
                onChange={(items) => update({ personaRows: items })}
                newItem={() => ({ label: 'Trait', heading: '', text: '' })}
                addLabel="+ Add trait"
                renderItem={(row, i, onItem) => (
                    <div className={`${styles.personaRow} ${i % 2 === 1 ? styles.reverse : ''}`}>
                        <div className={styles.personaTextCard}>
                            {editing
                                ? <EditableText editing value={row.label ?? ''} placeholder="Label" onChange={(v) => onItem({ label: v })} />
                                : row.label && <b>{row.label}</b>}
                            <EditableText as="h3" editing={editing} value={row.heading ?? ''} placeholder="Heading" onChange={(v) => onItem({ heading: v })} />
                            <EditableText as="p" multiline editing={editing} value={row.text ?? ''} placeholder="Text" onChange={(v) => onItem({ text: v })} />
                        </div>
                        <EditableImage editing={editing} value={row.image} onChange={(v) => onItem({ image: v })} />
                    </div>
                )}
            />

            <ListEditor
                className={styles.personaMeters}
                editing={editing}
                items={meters}
                onChange={(items) => update({ meters: items })}
                newItem={() => ({ label: 'Trait', level: 50 })}
                addLabel="+ Add meter"
                renderItem={(m, i, onItem) => (
                    <MeterField editing={editing} meter={m} barClassName={styles.meterItem}
                        onChange={(nm) => onItem(nm)} />
                )}
            />

            <div className={styles.personaNotes}>
                <div>
                    <b>Do&rsquo;s</b>
                    <EditableText as="p" multiline editing={editing} label="Do’s" value={profile.dos ?? ''} placeholder="—"
                        onChange={(v) => update({ dos: v })} />
                </div>
                <div>
                    <b>Don&rsquo;ts</b>
                    <EditableText as="p" multiline editing={editing} label="Don’ts" value={profile.donts ?? ''} placeholder="—"
                        onChange={(v) => update({ donts: v })} />
                </div>
            </div>
        </div>
    );
}
