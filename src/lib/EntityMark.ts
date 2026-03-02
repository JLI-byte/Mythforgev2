import { Mark, mergeAttributes } from '@tiptap/core';

export interface EntityMarkOptions {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        entityMark: {
            /**
             * Set an entity mark with the given entity ID.
             */
            setEntityMark: (options: { entityId: string }) => ReturnType;
            /**
             * Remove an entity mark.
             */
            unsetEntityMark: () => ReturnType;
        }
    }
}

/**
 * EntityMark
 * 
 * A custom Tiptap Mark used to visually tag text blocks that match known world entities.
 * 
 * WHY A CUSTOM MARK?
 * Relying on arbitrary HTML or external spans breaks the predictable ProseMirror 
 * state tree. By registering a formal Mark, Tiptap understands exactly how to serialize, 
 * deserialize, and treat the tagged text during rapid typing, copy/paste, and hydration.
 * It strictly renders a `span` with the `.entity-tag` class and embeds the `entityId` 
 * as a data attribute, allowing React DOM event delegation to trivially pick it up for 
 * driving the HoverPreview overlays without polluting the ProseMirror core with UI state logic.
 */
export const EntityMark = Mark.create<EntityMarkOptions>({
    name: 'entityMark',

    addOptions() {
        return {
            HTMLAttributes: {},
        }
    },

    addAttributes() {
        return {
            entityId: {
                default: null,
                parseHTML: element => element.getAttribute('data-entity-id'),
                renderHTML: attributes => {
                    if (!attributes.entityId) {
                        return {};
                    }

                    return {
                        'data-entity-id': attributes.entityId,
                    }
                },
            },
        }
    },

    parseHTML() {
        return [
            {
                tag: 'span.entity-tag',
            },
        ]
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { class: 'entity-tag' }), 0]
    },

    addCommands() {
        return {
            setEntityMark: attributes => ({ commands }) => {
                return commands.setMark(this.name, attributes)
            },
            unsetEntityMark: () => ({ commands }) => {
                return commands.unsetMark(this.name)
            },
        }
    },
})
