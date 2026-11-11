import { atom } from 'jotai';
import { atomFamily } from 'jotai/utils';

/**
 * Per-conversation active state for the "Create image" toggle.
 * When active, submitting the prompt signals the assistant to generate an image.
 */
export const createImageAtomFamily = atomFamily((_conversationId: string | null) => {
  return atom<boolean>(false);
});

/**
 * Pinned state for the "Create image" chip in the composer.
 */
export const createImagePinnedAtom = atom<boolean>(false);
