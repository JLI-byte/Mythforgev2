import React from 'react';
import { ProfileMeter } from '@/store/workspaceStore';
import styles from './editors.module.css';

interface MeterFieldProps {
    editing: boolean;
    meter: ProfileMeter;
    onChange: (m: ProfileMeter) => void;
    barClassName: string;
}

export default function MeterField({ editing, meter, onChange, barClassName }: MeterFieldProps) {
    if (!editing) {
        return (
            <div className={barClassName} style={{ ['--level' as string]: `${meter.level}%` }}>
                <b>{meter.label}</b>
                <div><span /></div>
            </div>
        );
    }
    return (
        <div className={barClassName} style={{ ['--level' as string]: `${meter.level}%` }}>
            <input
                className={styles.meterLabelInput}
                value={meter.label}
                placeholder="label"
                onChange={(e) => onChange({ ...meter, label: e.target.value })}
            />
            <div className={styles.rangeRow}>
                <input
                    type="range"
                    min={0}
                    max={100}
                    value={meter.level}
                    onChange={(e) => onChange({ ...meter, level: Number(e.target.value) })}
                />
                <span>{meter.level}</span>
            </div>
        </div>
    );
}
