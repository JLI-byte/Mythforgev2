export default function SeaSerpent({ width = 120 }: { width?: number }) {
    return (
        <svg width={width} height={width * 0.5} viewBox="0 0 120 60" fill="none" aria-hidden="true">
            <path d="M8 38 q8 -18 18 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M38 38 q8 -22 20 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M70 38 q7 -16 16 -4 q5 6 14 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M100 36 q8 -3 12 4 q-7 4 -12 1 Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <circle cx="106" cy="38" r="1" fill="currentColor" />
            <path d="M10 46 q10 4 20 0 M44 46 q10 4 20 0 M80 46 q10 4 20 0"
                stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" opacity="0.6" />
        </svg>
    );
}
