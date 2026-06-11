export default function WaxSeal({ size = 56 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
            <path
                d="M32 4 c7 0 9 4 14 5 c5 1 9 5 9 11 c0 4 3 7 3 12 c0 5 -4 8 -5 13 c-1 6 -6 9 -12 9 c-4 0 -6 4 -11 4 c-5 0 -7 -4 -11 -5 c-6 -1 -10 -5 -10 -11 c0 -4 -3 -7 -3 -12 c0 -5 4 -8 5 -13 c1 -6 6 -9 12 -9 c4 0 5 -4 9 -4 Z"
                fill="var(--vermilion, #c8401f)" stroke="var(--vermilion-deep, #a32d12)" strokeWidth="2"
            />
            <circle cx="32" cy="32" r="18" fill="none" stroke="#e9b39f" strokeWidth="1" opacity="0.7" />
            <text x="32" y="40" textAnchor="middle" fontSize="22" fill="#f6ddd2"
                fontFamily="var(--font-fell), serif">L</text>
        </svg>
    );
}
