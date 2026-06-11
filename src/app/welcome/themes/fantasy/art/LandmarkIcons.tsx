/*
 * Landmark scenes for the journey stops. Each is an etched mini-scene whose
 * paths draw in as the stop scrolls into view (sceneInk classes, scrubbed by
 * animation-timeline: view in fantasy-scroll.css) plus a character animation:
 * the quill writes, the flame flickers, the vault lid cracks open on scroll.
 */

const S = {
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    fill: 'none',
} as const;

export function DeskIcon({ size = 84 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden="true">
            <path className="sceneInk sceneInk--1" pathLength={1}
                d="M10 60 h76 M18 60 v18 M78 60 v18 M28 60 v-9 h40 v9" {...S} />
            <path className="sceneInk sceneInk--2" pathLength={1}
                d="M30 52 l22 -3 l-2 -9 l-21 3 Z" {...S} strokeWidth={1.3} />
            <g className="quillWrite">
                <path className="sceneInk sceneInk--2" pathLength={1}
                    d="M60 16 c9 2 13 11 14 22 l-15 -8 Z" {...S} />
                <path className="sceneInk sceneInk--3" pathLength={1}
                    d="M59 30 l-12 16" {...S} strokeWidth={1.3} />
            </g>
            <path className="sceneInk sceneInk--3" pathLength={1}
                d="M34 47 q5 1.5 10 0"
                stroke="var(--vermilion, #c8401f)" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        </svg>
    );
}

export function ArchiveIcon({ size = 84 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden="true">
            <path className="sceneInk sceneInk--1" pathLength={1}
                d="M12 30 q18 -11 36 0 v37 q-18 -11 -36 0 Z" {...S} />
            <path className="sceneInk sceneInk--1" pathLength={1}
                d="M84 30 q-18 -11 -36 0 v37 q18 -11 36 0 Z" {...S} />
            <path className="sceneInk sceneInk--2" pathLength={1}
                d="M20 40 q10 -4 20 0 M20 48 q10 -4 20 0 M20 56 q10 -4 20 0"
                {...S} strokeWidth={1.1} />
            <path className="sceneInk sceneInk--3" pathLength={1}
                d="M56 44 q10 -4 20 0 M56 52 q10 -4 20 0"
                {...S} strokeWidth={1.1} />
            <path className="sceneInk sceneInk--3" pathLength={1}
                d="M62 26 v13 l5 -5 l5 5 v-13"
                stroke="var(--vermilion, #c8401f)" strokeWidth="1.4" fill="none"
                strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function HearthIcon({ size = 84 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden="true">
            <path className="sceneInk sceneInk--1" pathLength={1}
                d="M14 78 v-26 q34 -36 68 0 v26" {...S} />
            <path className="sceneInk sceneInk--1" pathLength={1} d="M8 78 h80" {...S} />
            <g className="flameFlicker">
                <path className="sceneInk sceneInk--2" pathLength={1}
                    d="M48 38 c-11 13 6 15 0 25 c13 -7 8 -16 0 -25 Z"
                    stroke="var(--vermilion, #c8401f)" strokeWidth="1.6" fill="none"
                    strokeLinecap="round" strokeLinejoin="round" />
                <path className="sceneInk sceneInk--3" pathLength={1}
                    d="M48 49 c-5 6 3 7 0 11 c6 -3 3 -7 0 -11 Z"
                    stroke="var(--gold-leaf, #b08d2f)" strokeWidth="1.2" fill="none"
                    strokeLinecap="round" strokeLinejoin="round" />
            </g>
            <circle className="sparkRise sparkRise--a" cx="41" cy="46" r="1.3"
                fill="var(--vermilion, #c8401f)" />
            <circle className="sparkRise sparkRise--b" cx="56" cy="48" r="1"
                fill="var(--gold-leaf, #b08d2f)" />
        </svg>
    );
}

export function VaultIcon({ size = 84 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden="true">
            <path className="sparkle"
                d="M48 38 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 Z"
                fill="var(--gold-leaf, #b08d2f)" />
            <g className="lidOpen">
                <path className="sceneInk sceneInk--2" pathLength={1}
                    d="M16 50 q32 -27 64 0" {...S} />
                <path className="sceneInk sceneInk--3" pathLength={1}
                    d="M16 50 h64" {...S} strokeWidth={1.1} />
            </g>
            <path className="sceneInk sceneInk--1" pathLength={1}
                d="M16 50 h64 v28 h-64 Z M34 50 v28 M62 50 v28" {...S} />
            <circle className="sceneInk sceneInk--2" pathLength={1} cx="48" cy="62" r="3" {...S} strokeWidth={1.4} />
            <path className="sceneInk sceneInk--2" pathLength={1} d="M48 65 v4" {...S} strokeWidth={1.4} />
        </svg>
    );
}
