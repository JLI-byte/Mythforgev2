import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { matchEntityTrigger, type EntityTrigger } from '@/lib/entityTrigger';

export const entitySuggestPluginKey = new PluginKey('entitySuggest');

export interface EntitySuggestState {
  active: boolean;
  /** Which trigger opened it: '@' links an entry, '[[' offers to create one. */
  trigger: EntityTrigger;
  query: string;         // text after the trigger being typed
  from: number;          // position of the trigger's first character in doc
  to: number;            // current cursor position
}

const initialState: EntitySuggestState = {
  active: false,
  trigger: '@',
  query: '',
  from: 0,
  to: 0,
};

/**
 * EntitySuggest — TipTap extension that detects `@name` and `[[name` typing
 * and exposes plugin state for the React dropdown to read. The matching itself
 * lives in entityTrigger.ts, so it can be tested without an editor.
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

            const match = matchEntityTrigger(textBefore);
            if (!match) return { ...initialState };

            return {
              active: true,
              trigger: match.trigger,
              query: match.query,
              from: pos - match.length,
              to: pos,
            };
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
