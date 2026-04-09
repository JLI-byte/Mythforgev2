import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const entitySuggestPluginKey = new PluginKey('entitySuggest');

export interface EntitySuggestState {
  active: boolean;
  query: string;         // text after @ being typed
  from: number;          // position of the @ character in doc
  to: number;            // current cursor position
}

const initialState: EntitySuggestState = {
  active: false,
  query: '',
  from: 0,
  to: 0,
};

/**
 * EntitySuggest — TipTap extension that detects @query typing
 * and exposes plugin state for the React dropdown to read.
 */
export const EntitySuggest = Extension.create({
  name: 'entitySuggest',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: entitySuggestPluginKey,

        state: {
          init(): EntitySuggestState {
            return { ...initialState };
          },

          apply(tr, prev): EntitySuggestState {
            const meta = tr.getMeta(entitySuggestPluginKey);
            if (meta !== undefined) return meta;
            if (!tr.docChanged && !tr.selectionSet) return prev;

            const { selection } = tr;
            if (selection.empty === false) return { ...initialState };

            const pos = selection.from;
            const textBefore = tr.doc.textBetween(
              Math.max(0, pos - 100),
              pos,
              '\n',
              '\0'
            );

            // Find the last @ that hasn't been closed by a space-sequence or newline
            // We allow spaces if there are characters after the @, but two consecutive 
            // spaces should break the sequence.
            const match = textBefore.match(/@([\w\s]*)$/);
            if (!match) return { ...initialState };

            const query = match[1];
            // If there's a space at the end of the query string and it's longer than 20 chars, 
            // or if it ends with double space, kill it.
            if (query.endsWith('  ') || (query.length > 30)) return { ...initialState };

            const from = pos - query.length - 1; // position of @

            return { active: true, query, from, to: pos };
          },
        },

        props: {
          // Intercept Enter/Escape/Arrow keys when dropdown is active
          // The React component handles these via a keydown listener
          // so no decoration needed here — just expose the state.
          decorations(state) {
            const pluginState = entitySuggestPluginKey.getState(state) as EntitySuggestState;
            if (!pluginState?.active) return DecorationSet.empty;

            // Highlight the @query text while typing
            return DecorationSet.create(state.doc, [
              Decoration.inline(pluginState.from, pluginState.to, {
                class: 'entity-suggest-query',
              }),
            ]);
          },
        },
      }),
    ];
  },
});
