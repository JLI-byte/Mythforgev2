import { Node } from '@tiptap/core';

export const SceneHeading = Node.create({
    name: 'sceneHeading',
    group: 'block',
    content: 'inline*',
    parseHTML() {
        return [{ tag: 'div[data-screenplay-type="sceneHeading"]' }];
    },
    renderHTML() {
        return ['div', { 'data-screenplay-type': 'sceneHeading' }, 0];
    }
});

export const Action = Node.create({
    name: 'action',
    group: 'block',
    content: 'inline*',
    parseHTML() {
        return [{ tag: 'div[data-screenplay-type="action"]' }];
    },
    renderHTML() {
        return ['div', { 'data-screenplay-type': 'action' }, 0];
    }
});

export const Character = Node.create({
    name: 'character',
    group: 'block',
    content: 'inline*',
    parseHTML() {
        return [{ tag: 'div[data-screenplay-type="character"]' }];
    },
    renderHTML() {
        return ['div', { 'data-screenplay-type': 'character' }, 0];
    }
});

export const Parenthetical = Node.create({
    name: 'parenthetical',
    group: 'block',
    content: 'inline*',
    parseHTML() {
        return [{ tag: 'div[data-screenplay-type="parenthetical"]' }];
    },
    renderHTML() {
        return ['div', { 'data-screenplay-type': 'parenthetical' }, 0];
    }
});

export const Dialogue = Node.create({
    name: 'dialogue',
    group: 'block',
    content: 'inline*',
    parseHTML() {
        return [{ tag: 'div[data-screenplay-type="dialogue"]' }];
    },
    renderHTML() {
        return ['div', { 'data-screenplay-type': 'dialogue' }, 0];
    }
});

export const Transition = Node.create({
    name: 'transition',
    group: 'block',
    content: 'inline*',
    parseHTML() {
        return [{ tag: 'div[data-screenplay-type="transition"]' }];
    },
    renderHTML() {
        return ['div', { 'data-screenplay-type': 'transition' }, 0];
    }
});

export const ScreenplayNodes = [
    SceneHeading,
    Action,
    Character,
    Parenthetical,
    Dialogue,
    Transition
];
