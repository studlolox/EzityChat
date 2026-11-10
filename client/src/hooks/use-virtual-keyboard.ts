import { useState, useEffect, useCallback } from 'react';

export interface UseVirtualKeyboardOptions {
  onViewportChange?: () => void;
}

export function useVirtualKeyboard(options?: UseVirtualKeyboardOptions) {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isComposerFocused, setIsComposerFocused] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  const activeKeyboard = isTouchDevice && (isKeyboardOpen || isComposerFocused);

  const checkKeyboard = useCallback(() => {
    if (typeof window === 'undefined') return;

    const isTouch =
      window.matchMedia('(pointer: coarse)').matches ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0;

    if (!isTouch) {
      setIsTouchDevice(false);
      setIsKeyboardOpen(false);
      setViewportHeight(null);
      document.documentElement.style.removeProperty('--visual-viewport-height');
      return;
    }

    setIsTouchDevice(true);

    const activeEl = document.activeElement;
    const isInputFocused = Boolean(
      activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable),
    );

    const vv = window.visualViewport;

    if (!isInputFocused) {
      setIsKeyboardOpen(false);
      setIsComposerFocused(false);
      setViewportHeight(null);
      document.documentElement.style.removeProperty('--visual-viewport-height');
      if (window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }
      return;
    }

    if (vv) {
      const isShrunk =
        window.innerHeight - vv.height > 80 || window.screen.height - vv.height > 120;
      const keyboardOpen = isShrunk || isInputFocused;
      setIsKeyboardOpen(keyboardOpen);
      if (keyboardOpen) {
        setViewportHeight(vv.height);
        document.documentElement.style.setProperty('--visual-viewport-height', `${vv.height}px`);
      } else {
        setViewportHeight(null);
        document.documentElement.style.removeProperty('--visual-viewport-height');
      }
      if (window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }
    } else {
      setIsKeyboardOpen(isInputFocused);
      setViewportHeight(null);
      document.documentElement.style.removeProperty('--visual-viewport-height');
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkIsTouch = () =>
      window.matchMedia('(pointer: coarse)').matches ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0;

    setIsTouchDevice(checkIsTouch());

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (isInput && checkIsTouch()) {
        setIsKeyboardOpen(true);
      }
      checkKeyboard();
    };

    const handleFocusOut = () => {
      checkKeyboard();
      setTimeout(checkKeyboard, 80);
      setTimeout(checkKeyboard, 350);
    };

    const handleVisualViewportChange = () => {
      checkKeyboard();
      if (options?.onViewportChange) {
        options.onViewportChange();
      }
    };

    const vv = window.visualViewport;
    if (vv && checkIsTouch()) {
      vv.addEventListener('resize', handleVisualViewportChange);
      vv.addEventListener('scroll', handleVisualViewportChange);
      checkKeyboard();
    }

    document.addEventListener('focusin', handleFocusIn, { capture: true });
    document.addEventListener('focusout', handleFocusOut, { capture: true });

    return () => {
      if (vv) {
        vv.removeEventListener('resize', handleVisualViewportChange);
        vv.removeEventListener('scroll', handleVisualViewportChange);
      }
      document.removeEventListener('focusin', handleFocusIn, { capture: true });
      document.removeEventListener('focusout', handleFocusOut, { capture: true });
    };
  }, [checkKeyboard, options]);

  return {
    isKeyboardOpen,
    setIsKeyboardOpen,
    isComposerFocused,
    setIsComposerFocused,
    isTouchDevice,
    viewportHeight,
    setViewportHeight,
    activeKeyboard,
    checkKeyboard,
  };
}

export default useVirtualKeyboard;
