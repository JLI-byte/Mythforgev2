export default function QuillMark({ size = 28 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path
                d="M5 27 C8 16 18 6 27 4 c-1 9 -8 19 -18 24 l-4 -1 Z"
                stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"
            />
            <path d="M9 23 C14 18 19 13 23 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M4 29 h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
    );
}
