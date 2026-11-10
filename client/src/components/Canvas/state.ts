import { atom } from 'jotai';

export const canvasOpenAtom = atom<boolean>(false);
export const activeCanvasDocIdAtom = atom<string | null>(null);
export const activeBoardIdAtom = atom<string | null>(null);
export const canvasModeAtom = atom<'document' | 'board'>('document');
export const canvasViewModeAtom = atom<'edit' | 'preview'>('edit');
