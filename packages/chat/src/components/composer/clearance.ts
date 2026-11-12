/**
 * Room the composer band leaves beneath itself from `sm` up. A footer bar sits
 * there whenever `footerBelow` holds, and the band reserves it: doubled while
 * the centred landing composer floats, dropped back the moment a submission
 * starts the thread. With no bar beneath it, the band keeps only enough to
 * clear the surface's own shadow, on the welcome screen as in a conversation.
 * Below `sm` the composer floats with a subtle margin from the floor or virtual keyboard.
 */
export default function composerClearance({
  isLandingPage,
  footerBelow,
  floating,
}: {
  isLandingPage: boolean;
  footerBelow: boolean;
  floating: boolean;
}): string {
  if (!footerBelow) {
    return 'mb-2 sm:mb-4';
  }
  if (isLandingPage && floating) {
    return 'transition-all duration-200 mb-6 sm:mb-28';
  }
  return 'mb-2 sm:mb-10';
}
