/**
 * WorkTypeArtwork — what a project looks like sitting in its shelf pocket.
 *
 * A story is a book cover, so it keeps the plain tinted rectangle it always
 * had. The other three are sheets of paper, and read as their medium instead:
 * a bradded title page, a bar-charted report, staves of music. LEAF MODULE
 * (no store, no state).
 *
 * All three papers leave their middle clear so the project's initials can sit
 * in the natural title position.
 *
 * The slot's bottom lip covers the paper's lower corners (that's what makes it
 * look tucked in), so nothing that has to read sits past y≈62 near the edges.
 */

/** Letter-ish page, shared by all three paper artworks. */
const PAGE_W = 68;
const PAGE_H = 88;

const PAPER = '#e9e6df';
const INK = '#26262b';
const FAINT = '#a9a49a';

interface WorkTypeArtworkProps {
    /** Work type id — 'screenplay' | 'script-report' | 'lyrics'. */
    typeId: string;
}

/** Screenplay: three-hole punched title page, bradded down the left edge. */
function Screenplay() {
    return (
        <>
            {[13, 34, 55].map(cy => (
                <g key={cy}>
                    <circle cx={5.5} cy={cy} r={2.6} fill={INK} />
                    <circle cx={5.5} cy={cy} r={1.1} fill={PAPER} />
                </g>
            ))}
            {/* byline, under the title the initials stand in for */}
            <rect x={25} y={53} width={18} height={1.8} fill={FAINT} />
            <rect x={28} y={58} width={12} height={1.8} fill={FAINT} />
            {/* contact block, bottom left as the format puts it */}
            {[68, 72.5, 77].map(y => (
                <rect key={y} x={16} y={y} width={19} height={1.4} fill={FAINT} />
            ))}
        </>
    );
}

/** Script / report: titled header band, body copy, a small chart. */
function Report() {
    return (
        <>
            <rect x={0} y={0} width={PAGE_W} height={13} fill={INK} />
            <rect x={6} y={5.5} width={24} height={2.4} fill={PAPER} opacity={0.75} />
            {[21, 26, 31].map(y => (
                <rect key={y} x={8} y={y} width={52} height={1.6} fill={FAINT} />
            ))}
            {[54, 59].map(y => (
                <rect key={y} x={8} y={y} width={52} height={1.6} fill={FAINT} />
            ))}
            <rect x={8} y={64} width={30} height={1.6} fill={FAINT} />
            {/* figure: the thing that makes it a report and not a letter */}
            <rect x={44} y={67} width={4} height={9} fill={INK} />
            <rect x={50} y={62} width={4} height={14} fill={INK} />
            <rect x={56} y={70} width={4} height={6} fill={INK} />
        </>
    );
}

/** Lyrics: two staves of music, clefless but noted, above and below the title. */
function MusicSheet() {
    const stave = (top: number) => (
        <g key={top}>
            {[0, 3.2, 6.4, 9.6, 12.8].map(dy => (
                <rect key={dy} x={6} y={top + dy} width={56} height={0.9} fill={FAINT} />
            ))}
            {/* time signature block at the head of the stave */}
            <rect x={9} y={top + 1.5} width={3} height={10} fill={INK} opacity={0.55} />
            {/* notes: head on a line or space, stem up */}
            {[
                { x: 20, y: top + 9.6 },
                { x: 31, y: top + 6.4 },
                { x: 42, y: top + 11.2 },
                { x: 53, y: top + 4.8 },
            ].map(n => (
                <g key={n.x}>
                    <rect x={n.x + 2.2} y={n.y - 9} width={0.9} height={9} fill={INK} />
                    <ellipse
                        cx={n.x}
                        cy={n.y}
                        rx={2.7}
                        ry={2}
                        fill={INK}
                        transform={`rotate(-20 ${n.x} ${n.y})`}
                    />
                </g>
            ))}
        </g>
    );
    return <>{[14, 55].map(stave)}</>;
}

export default function WorkTypeArtwork({ typeId }: WorkTypeArtworkProps) {
    if (typeId !== 'screenplay' && typeId !== 'script-report' && typeId !== 'lyrics') {
        return null;
    }
    return (
        <svg
            viewBox={`0 0 ${PAGE_W} ${PAGE_H}`}
            width="100%"
            height="100%"
            aria-hidden="true"
            focusable="false"
            style={{ position: 'absolute', inset: 0, display: 'block' }}
        >
            <rect x={0} y={0} width={PAGE_W} height={PAGE_H} fill={PAPER} />
            {typeId === 'screenplay' && <Screenplay />}
            {typeId === 'script-report' && <Report />}
            {typeId === 'lyrics' && <MusicSheet />}
        </svg>
    );
}
