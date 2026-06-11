/*
 * Landmark scenes for the journey stops — large illustrated vignettes
 * (viewBox 260x200, sized by the .stopScene container). Paths etch in as the
 * stop scrolls into view (sceneInk waves, scrubbed by animation-timeline in
 * fantasy-scroll.css). Each scene also has character animation: the quill
 * writes, the link arc connects pages, the hearth burns, the vault opens.
 */

const S = {
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    fill: 'none',
} as const;

const VERMILION = 'var(--vermilion, #c8401f)';
const GOLD = 'var(--gold-leaf, #b08d2f)';

export function DeskIcon() {
    return (
        <svg viewBox="0 0 260 200" fill="none" aria-hidden="true">
            <path className="sceneInk sceneInk--1" pathLength={1} d="M24 172 h212"
                {...S} strokeWidth={0.8} opacity={0.5} />

            <path className="sceneInk sceneInk--1" pathLength={1}
                d="M40 122 h152 M54 122 v50 M178 122 v50" {...S} strokeWidth={2.2} />
            <path className="sceneInk sceneInk--2" pathLength={1}
                d="M64 122 v-14 h104 v14" {...S} strokeWidth={1.4} />
            <circle className="sceneInk sceneInk--2" pathLength={1} cx="116" cy="115" r="1.8"
                {...S} strokeWidth={1.2} />

            <path className="sceneInk sceneInk--2" pathLength={1}
                d="M70 116 l46 -5 l-3 -18 l-45 5 Z" {...S} strokeWidth={1.4} />
            <path className="sceneInk sceneInk--4" pathLength={1}
                d="M77 103 q10 2 20 0" stroke={VERMILION} strokeWidth="1.4" fill="none" strokeLinecap="round" />
            <path className="sceneInk sceneInk--5" pathLength={1}
                d="M79 109 q12 2 25 0" stroke={VERMILION} strokeWidth="1.4" fill="none" strokeLinecap="round" />

            <g className="quillWrite">
                <path className="sceneInk sceneInk--3" pathLength={1}
                    d="M138 58 c11 3 15 14 16 28 l-18 -10 Z" {...S} strokeWidth={1.8} />
                <path className="sceneInk sceneInk--3" pathLength={1}
                    d="M141 66 l7 6 M138 72 l8 7" {...S} strokeWidth={1} />
                <path className="sceneInk sceneInk--3" pathLength={1}
                    d="M136 76 l-17 26" {...S} strokeWidth={1.4} />
            </g>

            <path className="sceneInk sceneInk--3" pathLength={1}
                d="M150 116 v-6 q0 -9 9 -9 q9 0 9 9 v6 Z" {...S} strokeWidth={1.6} />

            <path className="sceneInk sceneInk--2" pathLength={1}
                d="M196 122 v-30 h12 v30 M202 92 v-5" {...S} strokeWidth={1.6} />
            <circle className="glowPulse" cx="202" cy="81" r="11" fill={GOLD} opacity="0.22"
                style={{ filter: 'blur(5px)' }} />
            <g className="flameFlicker flameFlicker--b">
                <path className="sceneInk sceneInk--4" pathLength={1}
                    d="M202 76 c-4 5 1.5 6 0 10 c4.5 -3 3 -7 0 -10 Z"
                    stroke={VERMILION} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </g>

            <circle className="moteFloat moteFloat--a" cx="62" cy="66" r="1.5" fill={GOLD} opacity="0.7" />
            <circle className="moteFloat moteFloat--b" cx="222" cy="56" r="1.2" fill={GOLD} opacity="0.6" />
        </svg>
    );
}

export function ArchiveIcon() {
    return (
        <svg viewBox="0 0 260 200" fill="none" aria-hidden="true">
            <path className="sceneInk sceneInk--1" pathLength={1}
                d="M34 158 q48 -24 96 -1 M226 158 q-48 -24 -96 -1"
                {...S} strokeWidth={0.9} opacity={0.6} />

            <path className="sceneInk sceneInk--1" pathLength={1}
                d="M32 62 q48 -26 98 -2 v94 q-50 -24 -98 2 Z" {...S} />
            <path className="sceneInk sceneInk--1" pathLength={1}
                d="M228 62 q-48 -26 -98 -2 v94 q50 -24 98 2 Z" {...S} />
            <path className="sceneInk sceneInk--1" pathLength={1} d="M130 60 v94"
                {...S} strokeWidth={1.2} />

            <path className="sceneInk sceneInk--2" pathLength={1}
                d="M50 86 q30 -10 62 -4" {...S} strokeWidth={1.1} />
            <path className="sceneInk sceneInk--2" pathLength={1}
                d="M50 98 q30 -10 62 -4" {...S} strokeWidth={1.1} />
            <path className="sceneInk sceneInk--3" pathLength={1}
                d="M50 110 q30 -10 62 -4" {...S} strokeWidth={1.1} />

            <path className="sceneInk sceneInk--3" pathLength={1}
                d="M148 82 q30 -10 60 -4" {...S} strokeWidth={1.1} />
            <path className="sceneInk sceneInk--3" pathLength={1}
                d="M148 94 q30 -10 60 -4" {...S} strokeWidth={1.1} />
            <path className="sceneInk sceneInk--4" pathLength={1}
                d="M148 118 q30 -10 60 -4" {...S} strokeWidth={1.1} />

            <path className="sceneInk sceneInk--4" pathLength={1} d="M86 124 h24"
                stroke={VERMILION} strokeWidth="1.8" fill="none" strokeLinecap="round" />
            <path className="sceneInk sceneInk--4" pathLength={1} d="M170 106 h24"
                stroke={VERMILION} strokeWidth="1.8" fill="none" strokeLinecap="round" />
            <path className="sceneInk sceneInk--5" pathLength={1}
                d="M110 122 C 126 94 148 88 170 104"
                stroke={VERMILION} strokeWidth="1.5" fill="none" strokeLinecap="round" />
            <path className="sceneInk sceneInk--5" pathLength={1}
                d="M170 104 l-7 -4 M170 104 l-8 3"
                stroke={VERMILION} strokeWidth="1.5" fill="none" strokeLinecap="round" />

            <circle className="moteFloat moteFloat--a" cx="72" cy="40" r="1.4" fill={GOLD} opacity="0.7" />
            <circle className="moteFloat moteFloat--b" cx="192" cy="34" r="1.1" fill={GOLD} opacity="0.6" />
        </svg>
    );
}

export function HearthIcon() {
    return (
        <svg viewBox="0 0 260 200" fill="none" aria-hidden="true">
            <path className="sceneInk sceneInk--1" pathLength={1} d="M30 172 h200" {...S} />
            <path className="sceneInk sceneInk--1" pathLength={1}
                d="M58 172 v-64 q72 -78 144 0 v64" {...S} strokeWidth={2.2} />
            <path className="sceneInk sceneInk--2" pathLength={1}
                d="M84 172 v-38 q46 -52 92 0 v38" {...S} strokeWidth={1.4} />
            <path className="sceneInk sceneInk--2" pathLength={1}
                d="M72 124 l11 -7 M92 100 l9 -8 M122 84 l5 -10 M152 88 l-3 -11"
                {...S} strokeWidth={1} opacity={0.7} />

            <path className="sceneInk sceneInk--3" pathLength={1}
                d="M104 162 l52 -8 M106 152 l50 12" {...S} strokeWidth={2} />

            <ellipse className="glowPulse" cx="130" cy="138" rx="36" ry="24" fill={GOLD}
                opacity="0.2" style={{ filter: 'blur(9px)' }} />

            <g className="flameFlicker flameFlicker--a">
                <path className="sceneInk sceneInk--3" pathLength={1}
                    d="M130 96 c-17 24 9 26 0 44 c19 -11 13 -29 0 -44 Z"
                    stroke={VERMILION} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </g>
            <g className="flameFlicker flameFlicker--b">
                <path className="sceneInk sceneInk--4" pathLength={1}
                    d="M114 122 c-8 11 4 12 0 20 c9 -5 6 -13 0 -20 Z"
                    stroke={VERMILION} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <path className="sceneInk sceneInk--4" pathLength={1}
                    d="M130 118 c-7 9 4 10 0 16 c8 -4 5 -11 0 -16 Z"
                    stroke={GOLD} strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </g>
            <g className="flameFlicker flameFlicker--c">
                <path className="sceneInk sceneInk--4" pathLength={1}
                    d="M148 124 c-8 10 4 11 0 18 c9 -5 6 -12 0 -18 Z"
                    stroke={VERMILION} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </g>

            <path className="smokeDrift" d="M130 88 q-7 -10 0 -20 q7 -10 0 -20"
                stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinecap="round" opacity="0.45" />

            <circle className="sparkRise sparkRise--a" cx="118" cy="116" r="1.5" fill={VERMILION} />
            <circle className="sparkRise sparkRise--b" cx="142" cy="120" r="1.1" fill={GOLD} />
            <circle className="sparkRise sparkRise--c" cx="130" cy="110" r="1" fill={VERMILION} />
        </svg>
    );
}

export function VaultIcon() {
    return (
        <svg viewBox="0 0 260 200" fill="none" aria-hidden="true">
            <path className="sceneInk sceneInk--1" pathLength={1} d="M36 176 h188"
                {...S} strokeWidth={0.8} opacity={0.5} />

            <g className="rayReveal">
                <path d="M114 100 L88 52 M130 96 L124 42 M146 98 L162 46 M160 104 L190 62"
                    stroke={GOLD} strokeWidth="1.3" strokeLinecap="round" opacity="0.8" />
            </g>

            <path className="sparkle sparkle--a"
                d="M98 54 l1.7 4.2 l4.2 1.7 l-4.2 1.7 l-1.7 4.2 l-1.7 -4.2 l-4.2 -1.7 l4.2 -1.7 Z"
                fill={GOLD} />
            <path className="sparkle sparkle--b"
                d="M172 46 l1.4 3.6 l3.6 1.4 l-3.6 1.4 l-1.4 3.6 l-1.4 -3.6 l-3.6 -1.4 l3.6 -1.4 Z"
                fill={GOLD} />
            <path className="sparkle sparkle--c"
                d="M140 28 l1.6 4 l4 1.6 l-4 1.6 l-1.6 4 l-1.6 -4 l-4 -1.6 l4 -1.6 Z"
                fill={GOLD} />

            <path className="pageFly pageFly--a" d="M118 70 l18 -7 l5 11 l-18 7 Z"
                stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round" />
            <path className="pageFly pageFly--b" d="M148 60 l14 -5 l4 8 l-14 5 Z"
                stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinejoin="round" />

            <g className="lidOpen">
                <path className="sceneInk sceneInk--2" pathLength={1}
                    d="M64 112 q66 -58 132 0" {...S} strokeWidth={2.2} />
                <path className="sceneInk sceneInk--2" pathLength={1} d="M64 112 h132"
                    {...S} strokeWidth={1.2} />
                <path className="sceneInk sceneInk--3" pathLength={1}
                    d="M84 100 q46 -36 92 0" {...S} strokeWidth={1} opacity={0.7} />
            </g>

            <path className="sceneInk sceneInk--1" pathLength={1}
                d="M64 112 h132 v60 h-132 Z M98 112 v60 M162 112 v60" {...S} strokeWidth={2.2} />
            <path className="sceneInk sceneInk--2" pathLength={1}
                d="M122 112 h16 v18 h-16 Z" {...S} strokeWidth={1.6} />
            <circle className="sceneInk sceneInk--3" pathLength={1} cx="130" cy="120" r="3"
                {...S} strokeWidth={1.4} />
            <path className="sceneInk sceneInk--3" pathLength={1} d="M130 123 v5"
                {...S} strokeWidth={1.4} />
        </svg>
    );
}
