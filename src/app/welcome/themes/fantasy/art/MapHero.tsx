import React from 'react';
import CompassRose from './CompassRose';

const ink = {
    stroke: 'currentColor',
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
};

function d(delay: number) {
    return { '--d': `${delay}s` } as React.CSSProperties;
}

export default function MapHero() {
    return (
        <svg
            className="mapHeroSvg"
            viewBox="0 0 1440 900"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
        >
            <mask id="lc-route-mask">
                <path
                    d="M150 620 C320 700 520 560 700 630 S1060 720 1240 600 S1400 520 1480 560"
                    pathLength={1} className="inkPath" style={d(1.4)}
                    stroke="#fff" strokeWidth="10" fill="none"
                />
            </mask>

            <path d="M-20 520 C120 470 260 560 380 500 S620 420 760 470 S1040 560 1180 500 S1380 440 1460 480"
                {...ink} strokeWidth="1.6" pathLength={1} className="inkPath" style={d(0)} />
            <path d="M-20 560 C140 520 250 590 400 545"
                {...ink} strokeWidth="0.8" pathLength={1} className="inkPath" style={d(0.5)} />

            <path d="M1040 690 q34 -30 86 -14 q44 14 20 42 q-34 32 -84 12 q-30 -14 -22 -40 Z"
                {...ink} strokeWidth="1.4" pathLength={1} className="inkPath" style={d(0.9)} />

            <g {...ink} strokeWidth="1.4">
                <path d="M210 330 l30 -46 l30 46 M258 330 l38 -60 l38 60 M328 330 l28 -42 l28 42"
                    pathLength={1} className="inkPath" style={d(0.6)} />
                <path d="M880 250 l26 -40 l26 40 M922 250 l34 -54 l34 54"
                    pathLength={1} className="inkPath" style={d(0.9)} />
            </g>

            <path d="M250 336 q20 60 -10 120 q-24 50 10 96"
                {...ink} strokeWidth="1" pathLength={1} className="inkPath" style={d(1.1)} />

            <path
                d="M150 620 C320 700 520 560 700 630 S1060 720 1240 600 S1400 520 1480 560"
                stroke="var(--vermilion, #c8401f)" strokeWidth="2" fill="none"
                strokeDasharray="8 8" strokeLinecap="round" mask="url(#lc-route-mask)"
            />
            <path d="M144 612 l12 14 M156 612 l-12 14" stroke="var(--vermilion, #c8401f)"
                strokeWidth="2" strokeLinecap="round" pathLength={1} className="inkPath" style={d(1.3)} />

            <g {...ink} strokeWidth="1" opacity="0.65">
                <path d="M540 720 q9 -8 18 0 q9 8 18 0 M600 760 q9 -8 18 0 q9 8 18 0 M460 770 q9 -8 18 0"
                    pathLength={1} className="inkPath" style={d(1.8)} />
            </g>

            <path d="M1238 592 l10 12 M1248 592 l-10 12" stroke="var(--gold-leaf, #b08d2f)"
                strokeWidth="2.4" strokeLinecap="round" pathLength={1} className="inkPath" style={d(2.2)} />

            <g transform="translate(1180, 90)" className="mapCompass">
                <CompassRose size={170} animated />
            </g>
        </svg>
    );
}
