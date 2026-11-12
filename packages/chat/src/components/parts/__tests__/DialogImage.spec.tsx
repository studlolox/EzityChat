/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import DialogImage from '../DialogImage';

jest.mock('@librechat/client', () => {
  const actual = jest.requireActual<typeof import('@librechat/client')>('@librechat/client');
  return {
    ...actual,
    useLocalize: () => (key: string) => key,
    useRemScale: () => 1,
    useMediaQuery: () => false,
  };
});

/** The lightbox is a raw Radix dialog at z-250, not an OGDialog, so a tooltip left on the
 *  stylesheet default (150) would paint behind its overlay. */
const LIGHTBOX_Z_INDEX = 250;

describe('DialogImage tooltips', () => {
  it('layers the close tooltip above the lightbox', async () => {
    render(
      <DialogImage isOpen onOpenChange={jest.fn()} src="/media.png" downloadImage={jest.fn()} />,
    );

    const close = screen.getByRole('button', { name: 'com_ui_close' });
    fireEvent.mouseEnter(close);
    fireEvent.mouseMove(close);

    const tooltip = await screen.findByRole('tooltip', undefined, { timeout: 3000 });
    expect(Number(tooltip.style.zIndex)).toBeGreaterThan(LIGHTBOX_Z_INDEX);
  });

  it('layers the download tooltip above the lightbox', async () => {
    render(
      <DialogImage isOpen onOpenChange={jest.fn()} src="/media.png" downloadImage={jest.fn()} />,
    );

    const download = screen.getByRole('button', { name: 'com_ui_download' });
    fireEvent.mouseEnter(download);
    fireEvent.mouseMove(download);

    const tooltip = await screen.findByRole('tooltip', undefined, { timeout: 3000 });
    expect(Number(tooltip.style.zIndex)).toBeGreaterThan(LIGHTBOX_Z_INDEX);
  });

  it('rotates the image 90 degrees when clicking rotate', () => {
    render(
      <DialogImage isOpen onOpenChange={jest.fn()} src="/media.png" downloadImage={jest.fn()} />,
    );

    const rotateBtn = screen.getByRole('button', { name: 'com_ui_rotate_cw' });
    fireEvent.click(rotateBtn);

    const img = screen.getByAltText('Image');
    const container = img.parentElement;
    expect(container?.getAttribute('style')).toContain('rotate(90deg)');
  });

  it('toggles inpaint studio mode and reveals canvas and studio toolbar', () => {
    render(
      <DialogImage isOpen onOpenChange={jest.fn()} src="/media.png" downloadImage={jest.fn()} />,
    );

    const inpaintToggle = screen.getByRole('button', { name: 'com_ui_inpaint_mode' });
    fireEvent.click(inpaintToggle);

    expect(screen.getByRole('button', { name: 'com_ui_brush' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'com_ui_eraser' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'com_ui_undo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'com_ui_clear_mask' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('com_ui_inpaint_placeholder')).toBeInTheDocument();
  });

  it('submits conversational edit prompt to onEditImage callback', async () => {
    const onEditMock = jest.fn();
    render(
      <DialogImage
        isOpen
        onOpenChange={jest.fn()}
        src="/media.png"
        downloadImage={jest.fn()}
        onEditImage={onEditMock}
      />,
    );

    const inpaintToggle = screen.getByRole('button', { name: 'com_ui_inpaint_mode' });
    act(() => {
      fireEvent.click(inpaintToggle);
    });

    const input = screen.getByPlaceholderText('com_ui_inpaint_placeholder');
    act(() => {
      fireEvent.change(input, { target: { value: 'make the coat crimson red' } });
    });

    const submitBtn = screen.getByRole('button', { name: 'com_ui_submit_edit' });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(onEditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'make the coat crimson red',
        imageSrc: '/media.png',
      }),
    );
  });

  it('renders touch-none on the container to prevent native browser page zoom', () => {
    render(
      <DialogImage isOpen onOpenChange={jest.fn()} src="/media.png" downloadImage={jest.fn()} />,
    );

    const img = screen.getByAltText('Image');
    const container = img.closest('.relative.touch-none');
    expect(container).toBeInTheDocument();
  });

  it('toggles zoom on double-tap touch', () => {
    render(
      <DialogImage isOpen onOpenChange={jest.fn()} src="/media.png" downloadImage={jest.fn()} />,
    );

    const img = screen.getByAltText('Image');
    const container = img.closest('.relative.touch-none') as HTMLElement;
    expect(container).not.toBeNull();

    const touchPoint = { clientX: 100, clientY: 100 };

    // First tap
    act(() => {
      fireEvent.touchStart(container, {
        touches: [touchPoint],
        targetTouches: [touchPoint],
        changedTouches: [touchPoint],
      });
    });

    // Quick second tap (double-tap)
    act(() => {
      fireEvent.touchStart(container, {
        touches: [touchPoint],
        targetTouches: [touchPoint],
        changedTouches: [touchPoint],
      });
    });

    const wrapper = img.parentElement;
    expect(wrapper?.getAttribute('style')).toContain('scale(2)');

    // Double tap again to reset zoom
    act(() => {
      fireEvent.touchStart(container, {
        touches: [touchPoint],
        targetTouches: [touchPoint],
        changedTouches: [touchPoint],
      });
    });
    act(() => {
      fireEvent.touchStart(container, {
        touches: [touchPoint],
        targetTouches: [touchPoint],
        changedTouches: [touchPoint],
      });
    });

    expect(wrapper?.getAttribute('style')).toContain('scale(1)');
  });

  it('handles two-finger pinch-to-zoom and one-finger pan on touch', () => {
    render(
      <DialogImage isOpen onOpenChange={jest.fn()} src="/media.png" downloadImage={jest.fn()} />,
    );

    const img = screen.getByAltText('Image');
    const container = img.closest('.relative.touch-none') as HTMLElement;

    const t1 = { clientX: 100, clientY: 100 };
    const t2 = { clientX: 200, clientY: 100 };

    // Start 2-finger pinch with distance 100
    act(() => {
      fireEvent.touchStart(container, {
        touches: [t1, t2],
        targetTouches: [t1, t2],
        changedTouches: [t1, t2],
      });
    });

    // Move fingers apart to distance 200 (2x scale)
    const moveEvent = new Event('touchmove', { cancelable: true }) as unknown as TouchEvent & {
      touches: Array<{ clientX: number; clientY: number }>;
    };
    Object.defineProperty(moveEvent, 'touches', {
      value: [
        { clientX: 50, clientY: 100 },
        { clientX: 250, clientY: 100 },
      ],
    });
    act(() => {
      container.dispatchEvent(moveEvent);
    });

    const wrapper = img.parentElement;
    expect(wrapper?.getAttribute('style')).toContain('scale(2)');
    expect(moveEvent.defaultPrevented).toBe(true);

    // Release fingers down to 1 finger for panning
    const singleTouch = { clientX: 150, clientY: 100 };
    act(() => {
      fireEvent.touchEnd(container, {
        touches: [singleTouch],
        targetTouches: [singleTouch],
        changedTouches: [singleTouch],
      });
    });

    // Pan with the remaining finger
    const panEvent = new Event('touchmove', { cancelable: true }) as unknown as TouchEvent & {
      touches: Array<{ clientX: number; clientY: number }>;
    };
    Object.defineProperty(panEvent, 'touches', {
      value: [{ clientX: 170, clientY: 120 }],
    });
    act(() => {
      container.dispatchEvent(panEvent);
    });

    expect(panEvent.defaultPrevented).toBe(true);
  });
});
