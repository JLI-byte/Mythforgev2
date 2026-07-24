/**
 * Turn a research-board widget into a chat attachment.
 *
 * Clicking "Ask the AI about this" on a board element runs it through here to
 * build the { label, content } the chat sends as focused context — so the
 * assistant knows exactly which thing on the board the user means.
 */
import type { DeskWidget, ChatAttachment } from '@/store/workspaceStore';

/** Human name for the element, shown in the attachment text. */
const TYPE_LABEL: Record<string, string> = {
    sticky: 'note',
    reference: 'link',
    image: 'image',
    biblePinit: 'image',
};

function str(v: unknown): string {
    return typeof v === 'string' ? v.trim() : '';
}

export function chatAttachmentForWidget(widget: DeskWidget): ChatAttachment {
    const c = (widget.content ?? {}) as Record<string, unknown>;
    const kind = TYPE_LABEL[widget.type] ?? 'item';

    let head = '';
    let body = '';
    switch (widget.type) {
        case 'sticky':
            head = str(c.text);
            body = str(c.text);
            break;
        case 'reference':
            head = str(c.title) || str(c.url);
            body = [str(c.title), str(c.url), str(c.body)].filter(Boolean).join('\n');
            break;
        case 'image':
        case 'biblePinit':
            head = str(c.label);
            body = head ? `Image captioned “${head}”.` : 'An image on the board (no caption).';
            break;
        default:
            body = [str(c.title), str(c.label), str(c.text), str(c.body), str(c.url)].filter(Boolean).join('\n');
            head = body;
    }

    body = body.trim();
    const firstLine = (head || body).split('\n')[0].trim();
    const labelSource = firstLine || `${kind[0].toUpperCase()}${kind.slice(1)}`;
    const label = labelSource.length > 40 ? `${labelSource.slice(0, 40)}…` : labelSource;

    const content = body
        ? `The ${kind} the user selected on the research board:\n${body}`
        : `An empty ${kind} the user selected on the research board.`;

    return { kind: 'text', label, content };
}
