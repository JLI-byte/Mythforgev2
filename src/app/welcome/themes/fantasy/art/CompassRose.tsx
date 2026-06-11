import React from 'react';

interface CompassRoseProps {
    size?: number;
    animated?: boolean;
}

export default function CompassRose({ size = 150, animated = false }: CompassRoseProps) {
    const cls = animated ? 'inkPath' : undefined;
    return (
        <svg width={size} height={size} viewBox="0 0 150 150" fill="none" aria-hidden="true">
            <circle cx="75" cy="75" r="56" stroke="currentColor" strokeWidth="1.2"
                pathLength={1} className={cls} style={{ '--d': '0.2s' } as React.CSSProperties} />
            <circle cx="75" cy="75" r="44" stroke="currentColor" strokeWidth="0.6"
                pathLength={1} className={cls} style={{ '--d': '0.45s' } as React.CSSProperties} />
            <path d="M75 19 L82 68 L131 75 L82 82 L75 131 L68 82 L19 75 L68 68 Z"
                stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"
                pathLength={1} className={cls} style={{ '--d': '0.7s' } as React.CSSProperties} />
            <path d="M75 38 L79 68 L75 75 L71 68 Z"
                stroke="var(--gold-leaf, #b08d2f)" strokeWidth="1.6" strokeLinejoin="round"
                pathLength={1} className={cls} style={{ '--d': '1.1s' } as React.CSSProperties} />
            <text x="75" y="14" textAnchor="middle" fontSize="11" fill="currentColor"
                fontFamily="var(--font-fell), serif">N</text>
        </svg>
    );
}
