const S = {
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    fill: 'none',
} as const;

export function DeskIcon({ size = 48 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
            <path d="M7 30 h34 M11 30 v9 M37 30 v9 M14 30 v-5 h20 v5" {...S} />
            <path d="M30 10 c5 1 7 6 8 12 l-10 -4 Z" {...S} />
            <path d="M28 18 l-5 7" {...S} strokeWidth={1.2} />
        </svg>
    );
}

export function ArchiveIcon({ size = 48 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
            <path d="M6 13 q9 -6 18 0 v23 q-9 -6 -18 0 Z" {...S} />
            <path d="M42 13 q-9 -6 -18 0 v23 q9 -6 18 0 Z" {...S} />
            <path d="M11 19 q5 -2.5 9 0 M11 25 q5 -2.5 9 0 M28 19 q5 -2.5 9 0" {...S} strokeWidth={1} />
        </svg>
    );
}

export function HearthIcon({ size = 48 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
            <path d="M9 40 v-15 q15 -17 30 0 v15" {...S} />
            <path d="M5 40 h38" {...S} />
            <path d="M24 22 c-6 7 3 8 0 13 c7 -3 4 -8 0 -13 Z" {...S} strokeWidth={1.4} />
        </svg>
    );
}

export function VaultIcon({ size = 48 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
            <path d="M8 23 h32 v15 h-32 Z" {...S} />
            <path d="M8 23 q16 -13 32 0" {...S} />
            <circle cx="24" cy="30" r="2.6" {...S} strokeWidth={1.4} />
            <path d="M24 32.6 v3" {...S} strokeWidth={1.4} />
        </svg>
    );
}
