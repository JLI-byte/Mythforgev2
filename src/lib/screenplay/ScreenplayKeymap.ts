import { Extension } from '@tiptap/core';

export const ScreenplayKeymap = Extension.create({
    name: 'screenplayKeymap',

    addKeyboardShortcuts() {
        return {
            Tab: () => {
                const currentType = this.editor.state.selection.$anchor.parent.type.name;

                // Forward cycle map
                let nextType;
                if (currentType === 'sceneHeading') nextType = 'action';
                else if (currentType === 'action') nextType = 'character';
                else if (currentType === 'character') nextType = 'dialogue';
                else if (currentType === 'parenthetical') nextType = 'dialogue';
                else if (currentType === 'dialogue') nextType = 'action';
                else if (currentType === 'transition') nextType = 'sceneHeading';
                else return false;

                // Set node to nextType
                this.editor.chain().focus().setNode(nextType).run();
                return true;
            },

            'Shift-Tab': () => {
                const currentType = this.editor.state.selection.$anchor.parent.type.name;

                // Backward cycle map
                let prevType;
                if (currentType === 'action') prevType = 'sceneHeading';
                else if (currentType === 'character') prevType = 'action';
                else if (currentType === 'dialogue') prevType = 'character';
                else if (currentType === 'parenthetical') prevType = 'character'; // parenthetical backwards to character?
                else if (currentType === 'sceneHeading') prevType = 'transition';
                else if (currentType === 'transition') prevType = 'dialogue';
                else return false;

                // Set node to prevType
                this.editor.chain().focus().setNode(prevType).run();
                return true;
            },

            Enter: () => {
                const currentType = this.editor.state.selection.$anchor.parent.type.name;

                let nextType;
                if (currentType === 'sceneHeading') nextType = 'action';
                else if (currentType === 'character') nextType = 'dialogue';
                else if (currentType === 'parenthetical') nextType = 'dialogue';
                else if (currentType === 'dialogue') nextType = 'action';
                else if (currentType === 'action') nextType = 'action';
                else if (currentType === 'transition') nextType = 'sceneHeading';
                else return false;

                // Insert a new block of the correct contextual next type
                this.editor.commands.insertContentAt(this.editor.state.selection.to, { type: nextType, content: [] });
                return true;
            }
        };
    }
});
