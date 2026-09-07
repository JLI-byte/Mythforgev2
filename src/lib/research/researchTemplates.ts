/**
 * LEAF MODULE — starter boards for the Research stage.
 *
 * Drafting has Writing Methods; Research had nothing, so every board began
 * blank. These are the shapes a writer builds by hand anyway.
 *
 * The id generator is injected so the whole thing stays pure and a test can
 * assert on the ids it produced.
 */

import type { DeskWidget } from '@/store/workspaceStore';
import { COLUMN_WIDTH } from './columns';

export interface ResearchTemplate {
    id: string;
    name: string;
    description: string;
}

export const RESEARCH_TEMPLATES: ResearchTemplate[] = [
    { id: 'place-study',    name: 'Place study',    description: 'Geography, daily life, power, and what the reader must feel' },
    { id: 'character-dig',  name: 'Character dig',  description: 'What they want, what they fear, and what they are wrong about' },
    { id: 'event-timeline', name: 'Event timeline', description: 'Before, during and after, with the open questions kept apart' },
    { id: 'source-review',  name: 'Source review',  description: 'Reading list, verified facts, and contradictions to chase' },
];

/** column title -> the notes it starts with */
const LAYOUTS: Record<string, [string, string[]][]> = {
    'place-study': [
        ['Geography',      ['Terrain and approach', 'Weather through the year']],
        ['Daily life',     ['Who works, and at what', 'What is eaten, and when']],
        ['Power',          ['Who decides', 'Who enforces']],
        ['On the page',    ['What the reader should smell', 'The detail only a local would know']],
    ],
    'character-dig': [
        ['Want',           ['Stated want', 'Actual want']],
        ['Fear',           ['What they avoid', 'What it costs them']],
        ['Wrong about',    ['The belief', 'What breaks it']],
        ['Voice',          ['Words they use', 'Words they never use']],
    ],
    'event-timeline': [
        ['Before',         ['What made it possible', 'Who saw it coming']],
        ['During',         ['Hour by hour', 'Who was where']],
        ['After',          ['Who tells the story', 'What is misremembered']],
        ['Open questions', ['']],
    ],
    'source-review': [
        ['To read',        ['']],
        ['Verified',       ['']],
        ['Contradictions', ['']],
        ['Discarded',      ['Why it was wrong']],
    ],
};

const COLUMN_GAP = 40;
const COLUMN_TOP = 80;
const COLUMN_HEIGHT = 360;

export function buildTemplate(templateId: string, nextId: () => string): DeskWidget[] {
    const layout = LAYOUTS[templateId];
    if (!layout) return [];

    const widgets: DeskWidget[] = [];

    layout.forEach(([title, notes], i) => {
        const columnId = nextId();
        widgets.push({
            id: columnId,
            type: 'column',
            x: 80 + i * (COLUMN_WIDTH + COLUMN_GAP),
            y: COLUMN_TOP,
            width: COLUMN_WIDTH,
            height: COLUMN_HEIGHT,
            content: { title },
        });

        notes.filter(Boolean).forEach((text, j) => {
            widgets.push({
                id: nextId(),
                type: 'sticky',
                x: 0, y: 0, width: 200, height: 120,
                content: { text },
                parentId: columnId,
                columnOrder: j,
            });
        });
    });

    return widgets;
}
