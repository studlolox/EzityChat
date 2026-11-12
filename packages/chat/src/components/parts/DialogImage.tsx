import { useState, useEffect, useCallback, useRef } from 'react';
import { PanelLeftOpen, PanelLeftClose } from 'lucide';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Button,
  MorphIcon,
  TooltipAnchor,
  useLocalize,
  useMediaQuery,
  useRemScale,
} from '@librechat/client';
import {
  X,
  ArrowDownToLine,
  RotateCcw,
  RotateCw,
  Paintbrush,
  Eraser,
  Undo2,
  Trash2,
  Sparkles,
  Loader2,
} from 'lucide-react';

/** The lightbox is z-250 and not an OGDialog, so its tooltips would keep the default 150 and sit behind it. */
const TOOLTIP_Z_INDEX = 300;

const imageSizeCache = new Map<string, string>();

const getQualityStyles = (quality: string): string => {
  if (quality === 'high') {
    return 'bg-status-success-subtle text-status-success';
  }
  if (quality === 'low') {
    return 'bg-status-warning-subtle text-status-warning';
  }
  return 'bg-status-neutral-subtle text-status-neutral';
};

export interface MaskPoint {
  x: number;
  y: number;
}

export interface MaskStroke {
  tool: 'brush' | 'eraser';
  lineWidth: number;
  points: MaskPoint[];
}

export interface InpaintEditParams {
  prompt: string;
  maskDataUrl?: string;
  maskBlob?: Blob;
  imageSrc: string;
  args?: Record<string, unknown>;
}

export default function DialogImage({
  isOpen,
  onOpenChange,
  src = '',
  downloadImage,
  args,
  triggerRef,
  showDetails = true,
  title,
  onEditImage,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  src?: string;
  downloadImage: () => void;
  args?: {
    prompt?: string;
    quality?: string;
    size?: string;
    [key: string]: unknown;
  };
  triggerRef?: React.RefObject<HTMLButtonElement>;
  /** Off for an uploaded file, which has no generation details to show. */
  showDetails?: boolean;
  /** Names the dialog and the image for assistive tech, e.g. the file name. */
  title?: string;
  /** Callback invoked when the user submits an inpaint / image edit. */
  onEditImage?: (params: InpaintEditParams) => Promise<void> | void;
}): React.ReactElement | null {
  const localize = useLocalize();
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [imageSize, setImageSize] = useState<string | null>(null);

  // Zoom, pan & rotation state
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Refs for tracking fresh state in touch handlers
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const panXRef = useRef(panX);
  panXRef.current = panX;
  const panYRef = useRef(panY);
  panYRef.current = panY;

  // Touch gesture tracking for mobile pinch-to-zoom and pan
  const lastPinchDistRef = useRef<number | null>(null);
  const lastPinchMidpointRef = useRef<{ x: number; y: number } | null>(null);
  const touchPanStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastTapTimeRef = useRef<number>(0);

  // Inpainting & Visual Studio state
  const [isMaskingMode, setIsMaskingMode] = useState(false);
  const isMaskingModeRef = useRef(isMaskingMode);
  isMaskingModeRef.current = isMaskingMode;
  const [maskTool, setMaskTool] = useState<'brush' | 'eraser'>('brush');
  const [brushSize, setBrushSize] = useState(32);
  const [strokes, setStrokes] = useState<MaskStroke[]>([]);
  const [editPrompt, setEditPrompt] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<MaskStroke | null>(null);

  const getImageSize = useCallback(async (url: string) => {
    const cached = imageSizeCache.get(url);
    if (cached) {
      return cached;
    }
    try {
      if (typeof fetch === 'undefined') {
        return null;
      }
      const response = await fetch(url, { method: 'HEAD' });
      const contentLength = response.headers.get('Content-Length');

      if (contentLength) {
        const bytes = parseInt(contentLength, 10);
        const result = formatFileSize(bytes);
        imageSizeCache.set(url, result);
        return result;
      }

      const fullResponse = await fetch(url);
      const blob = await fullResponse.blob();
      const result = formatFileSize(blob.size);
      imageSizeCache.set(url, result);
      return result;
    } catch (error) {
      console.error('Error getting image size:', error);
      return null;
    }
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
  }, []);

  const resetAllTransforms = useCallback(() => {
    resetZoom();
    setRotation(0);
  }, [resetZoom]);

  const getCursorClass = (): string => {
    if (isMaskingMode) return 'cursor-crosshair';
    if (zoom <= 1) return 'cursor-default';
    return isDragging ? 'cursor-grabbing' : 'cursor-grab';
  };

  const handleDoubleClick = useCallback(
    (e?: React.MouseEvent<HTMLDivElement>) => {
      if (isMaskingMode) return;
      if (zoom > 1) {
        resetZoom();
      } else if (e && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const containerCenterX = rect.width / 2;
        const containerCenterY = rect.height / 2;
        const deltaX = (mouseX - containerCenterX) * (2 - 1);
        const deltaY = (mouseY - containerCenterY) * (2 - 1);
        setZoom(2);
        setPanX(-deltaX);
        setPanY(-deltaY);
      } else {
        setZoom(2);
      }
    },
    [isMaskingMode, zoom, resetZoom],
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (isMaskingMode) return;
      e.preventDefault();
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(Math.max(zoom * zoomFactor, 1), 5);

      if (newZoom === zoom) return;

      if (newZoom === 1) {
        setZoom(1);
        setPanX(0);
        setPanY(0);
        return;
      }

      const containerCenterX = rect.width / 2;
      const containerCenterY = rect.height / 2;

      const zoomRatio = newZoom / zoom;
      const deltaX = (mouseX - containerCenterX - panX) * (zoomRatio - 1);
      const deltaY = (mouseY - containerCenterY - panY) * (zoomRatio - 1);

      setZoom(newZoom);
      setPanX(panX - deltaX);
      setPanY(panY - deltaY);
    },
    [isMaskingMode, zoom, panX, panY],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isMaskingMode || zoom <= 1) return;
      e.preventDefault();
      setIsDragging(true);
      setDragStart({
        x: e.clientX - panX,
        y: e.clientY - panY,
      });
    },
    [isMaskingMode, zoom, panX, panY],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isMaskingMode || !isDragging || zoom <= 1) return;
      const newPanX = e.clientX - dragStart.x;
      const newPanY = e.clientY - dragStart.y;
      setPanX(newPanX);
      setPanY(newPanY);
    },
    [isMaskingMode, isDragging, dragStart, zoom],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement> | TouchEvent) => {
      if (isMaskingModeRef.current) return;

      if (e.touches.length === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const dist = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
        lastPinchDistRef.current = dist;

        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          lastPinchMidpointRef.current = {
            x: (touch1.clientX + touch2.clientX) / 2 - rect.left,
            y: (touch1.clientY + touch2.clientY) / 2 - rect.top,
          };
        }
        touchPanStartRef.current = null;
        setIsDragging(false);
      } else if (e.touches.length === 1) {
        lastPinchDistRef.current = null;
        lastPinchMidpointRef.current = null;

        const touch = e.touches[0];
        const now = Date.now();
        // Double-tap detection for mobile
        if (now - lastTapTimeRef.current < 300) {
          lastTapTimeRef.current = 0;
          if (zoomRef.current > 1) {
            resetZoom();
          } else if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const tapX = touch.clientX - rect.left;
            const tapY = touch.clientY - rect.top;
            const containerCenterX = rect.width / 2;
            const containerCenterY = rect.height / 2;
            const deltaX = (tapX - containerCenterX) * (2 - 1);
            const deltaY = (tapY - containerCenterY) * (2 - 1);
            setZoom(2);
            setPanX(-deltaX);
            setPanY(-deltaY);
          } else {
            setZoom(2);
          }
          return;
        }
        lastTapTimeRef.current = now;

        if (zoomRef.current > 1) {
          touchPanStartRef.current = {
            x: touch.clientX - panXRef.current,
            y: touch.clientY - panYRef.current,
          };
          setIsDragging(true);
        }
      }
    },
    [resetZoom],
  );

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement> | TouchEvent) => {
    if (isMaskingModeRef.current) return;

    if (e.touches.length === 2) {
      if (e.cancelable) {
        e.preventDefault();
      }
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const currentDist = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY,
      );

      if (!containerRef.current || !lastPinchDistRef.current || lastPinchDistRef.current <= 0) {
        lastPinchDistRef.current = currentDist;
        return;
      }

      const rect = containerRef.current.getBoundingClientRect();
      const currentMidX = (touch1.clientX + touch2.clientX) / 2 - rect.left;
      const currentMidY = (touch1.clientY + touch2.clientY) / 2 - rect.top;

      const deltaScale = currentDist / lastPinchDistRef.current;
      lastPinchDistRef.current = currentDist;

      const prevZoom = zoomRef.current;
      const newZoom = Math.min(Math.max(prevZoom * deltaScale, 1), 5);

      if (newZoom === 1) {
        setZoom(1);
        setPanX(0);
        setPanY(0);
        lastPinchMidpointRef.current = { x: currentMidX, y: currentMidY };
        return;
      }

      const containerCenterX = rect.width / 2;
      const containerCenterY = rect.height / 2;

      const zoomRatio = newZoom / prevZoom;
      const deltaX = (currentMidX - containerCenterX - panXRef.current) * (zoomRatio - 1);
      const deltaY = (currentMidY - containerCenterY - panYRef.current) * (zoomRatio - 1);

      const lastMid = lastPinchMidpointRef.current ?? { x: currentMidX, y: currentMidY };
      const midDeltaX = currentMidX - lastMid.x;
      const midDeltaY = currentMidY - lastMid.y;
      lastPinchMidpointRef.current = { x: currentMidX, y: currentMidY };

      setZoom(newZoom);
      setPanX((prev) => prev - deltaX + midDeltaX);
      setPanY((prev) => prev - deltaY + midDeltaY);
    } else if (e.touches.length === 1 && touchPanStartRef.current && zoomRef.current > 1) {
      if (e.cancelable) {
        e.preventDefault();
      }
      const touch = e.touches[0];
      const newPanX = touch.clientX - touchPanStartRef.current.x;
      const newPanY = touch.clientY - touchPanStartRef.current.y;
      setPanX(newPanX);
      setPanY(newPanY);
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement> | TouchEvent) => {
    if (isMaskingModeRef.current) return;

    if (e.touches.length === 0) {
      lastPinchDistRef.current = null;
      lastPinchMidpointRef.current = null;
      touchPanStartRef.current = null;
      setIsDragging(false);
    } else if (e.touches.length === 1) {
      lastPinchDistRef.current = null;
      lastPinchMidpointRef.current = null;
      if (zoomRef.current > 1) {
        const touch = e.touches[0];
        touchPanStartRef.current = {
          x: touch.clientX - panXRef.current,
          y: touch.clientY - panYRef.current,
        };
        setIsDragging(true);
      } else {
        touchPanStartRef.current = null;
        setIsDragging(false);
      }
    }
  }, []);

  const cleanupRef = useRef<(() => void) | null>(null);

  const attachContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      containerRef.current = node;
      if (!node) return;

      const preventGesture = (e: Event) => {
        e.preventDefault();
      };

      const onTouchStart = (e: TouchEvent) => handleTouchStart(e);
      const onTouchMove = (e: TouchEvent) => handleTouchMove(e);
      const onTouchEnd = (e: TouchEvent) => handleTouchEnd(e);

      node.addEventListener('touchstart', onTouchStart, { passive: true });
      node.addEventListener('touchmove', onTouchMove, { passive: false });
      node.addEventListener('touchend', onTouchEnd, { passive: true });
      node.addEventListener('touchcancel', onTouchEnd, { passive: true });
      node.addEventListener('gesturestart', preventGesture);
      node.addEventListener('gesturechange', preventGesture);

      cleanupRef.current = () => {
        node.removeEventListener('touchstart', onTouchStart);
        node.removeEventListener('touchmove', onTouchMove);
        node.removeEventListener('touchend', onTouchEnd);
        node.removeEventListener('touchcancel', onTouchEnd);
        node.removeEventListener('gesturestart', preventGesture);
        node.removeEventListener('gesturechange', preventGesture);
      };
    },
    [handleTouchStart, handleTouchMove, handleTouchEnd],
  );

  // Stroke rendering function (handles both visual overlay and offscreen binary export)
  const renderStrokes = useCallback(
    (
      canvas: HTMLCanvasElement,
      strokeList: MaskStroke[],
      scaleX = 1,
      scaleY = 1,
      isOffscreenBinary = false,
    ) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (isOffscreenBinary) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      for (const stroke of strokeList) {
        if (!stroke.points || stroke.points.length === 0) continue;
        ctx.save();
        ctx.lineWidth = stroke.lineWidth * Math.max(scaleX, scaleY);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (isOffscreenBinary) {
          if (stroke.tool === 'brush') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = '#FFFFFF';
            ctx.fillStyle = '#FFFFFF';
          } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = '#000000';
            ctx.fillStyle = '#000000';
          }
        } else {
          if (stroke.tool === 'brush') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = 'rgba(168, 85, 247, 0.6)';
            ctx.fillStyle = 'rgba(168, 85, 247, 0.6)';
          } else {
            ctx.globalCompositeOperation = 'destination-out';
          }
        }

        ctx.beginPath();
        const firstPt = stroke.points[0];
        ctx.moveTo(firstPt.x * scaleX, firstPt.y * scaleY);

        if (stroke.points.length === 1) {
          ctx.arc(
            firstPt.x * scaleX,
            firstPt.y * scaleY,
            (stroke.lineWidth * Math.max(scaleX, scaleY)) / 2,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        } else {
          for (let i = 1; i < stroke.points.length; i++) {
            const pt = stroke.points[i];
            ctx.lineTo(pt.x * scaleX, pt.y * scaleY);
          }
          ctx.stroke();
        }
        ctx.restore();
      }
    },
    [],
  );

  // Sync canvas size to displayed image size
  const syncCanvasDimensions = useCallback(() => {
    const img = imageRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    if (img.clientWidth > 0 && img.clientHeight > 0) {
      canvas.width = img.clientWidth;
      canvas.height = img.clientHeight;
      renderStrokes(canvas, strokes);
    }
  }, [strokes, renderStrokes]);

  useEffect(() => {
    if (isMaskingMode) {
      syncCanvasDimensions();
    }
  }, [isMaskingMode, syncCanvasDimensions]);

  useEffect(() => {
    if (canvasRef.current && isMaskingMode) {
      renderStrokes(canvasRef.current, strokes);
    }
  }, [strokes, isMaskingMode, renderStrokes]);

  // Coordinate mapper from pointer position to canvas coordinates
  const getCanvasCoordinates = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>): MaskPoint | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;

      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const rawX = (e.clientX - rect.left) * scaleX;
      const rawY = (e.clientY - rect.top) * scaleY;

      return {
        x: Math.max(0, Math.min(canvas.width, rawX)),
        y: Math.max(0, Math.min(canvas.height, rawY)),
      };
    },
    [],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      const pt = getCanvasCoordinates(e);
      if (!pt) return;

      isDrawingRef.current = true;
      const newStroke: MaskStroke = {
        tool: maskTool,
        lineWidth: brushSize,
        points: [pt],
      };
      currentStrokeRef.current = newStroke;
      setStrokes((prev) => [...prev, newStroke]);
    },
    [getCanvasCoordinates, maskTool, brushSize],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current || !currentStrokeRef.current) return;
      e.preventDefault();
      e.stopPropagation();

      const pt = getCanvasCoordinates(e);
      if (!pt) return;

      currentStrokeRef.current.points.push(pt);
      setStrokes((prev) => {
        const next = [...prev];
        next[next.length - 1] = { ...currentStrokeRef.current! };
        return next;
      });
    },
    [getCanvasCoordinates],
  );

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    currentStrokeRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }, []);

  const handleUndo = useCallback(() => {
    setStrokes((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setStrokes([]);
  }, []);

  // Export binary PNG mask for gateway inpainting
  const exportBinaryMask = useCallback(async (): Promise<{
    dataUrl: string;
    blob: Blob;
  } | null> => {
    const img = imageRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas || strokes.length === 0) return null;

    const naturalW = img.naturalWidth || canvas.width;
    const naturalH = img.naturalHeight || canvas.height;

    const offscreen = document.createElement('canvas');
    offscreen.width = naturalW;
    offscreen.height = naturalH;

    const scaleX = naturalW / canvas.width;
    const scaleY = naturalH / canvas.height;

    renderStrokes(offscreen, strokes, scaleX, scaleY, true);

    const dataUrl = offscreen.toDataURL('image/png');
    const blob = await new Promise<Blob | null>((resolve) =>
      offscreen.toBlob(resolve, 'image/png'),
    );
    if (!blob) return null;

    return { dataUrl, blob };
  }, [strokes, renderStrokes]);

  // Submit inpainting / conversational image edit
  const handleSubmitEdit = useCallback(async () => {
    const cleanPrompt = editPrompt.trim();
    if (!cleanPrompt || isSubmittingEdit) return;

    setIsSubmittingEdit(true);
    setEditError(null);

    try {
      let maskDataUrl: string | undefined;
      let maskBlob: Blob | undefined;

      if (strokes.length > 0) {
        const maskResult = await exportBinaryMask();
        if (maskResult) {
          maskDataUrl = maskResult.dataUrl;
          maskBlob = maskResult.blob;
        }
      }

      if (onEditImage) {
        await onEditImage({
          prompt: cleanPrompt,
          maskDataUrl,
          maskBlob,
          imageSrc: src,
          args,
        });
      }

      setIsMaskingMode(false);
      setStrokes([]);
      setEditPrompt('');
      onOpenChange(false);
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Failed to submit image edit');
    } finally {
      setIsSubmittingEdit(false);
    }
  }, [
    editPrompt,
    isSubmittingEdit,
    strokes.length,
    exportBinaryMask,
    onEditImage,
    src,
    args,
    onOpenChange,
  ]);

  // Handle click on empty background areas to close
  const handleBackgroundClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) {
        return;
      }
      if (isMaskingMode || zoom > 1) {
        return;
      }
      onOpenChange(false);
    },
    [isMaskingMode, onOpenChange, zoom],
  );

  useEffect(() => {
    if (!isOpen) {
      setIsMaskingMode(false);
      setStrokes([]);
      setEditPrompt('');
      setEditError(null);
      resetAllTransforms();
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isMaskingMode) {
          setIsMaskingMode(false);
        } else if (zoom > 1) {
          resetZoom();
        } else {
          onOpenChange(false);
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, isMaskingMode, zoom, resetZoom, resetAllTransforms, onOpenChange]);

  useEffect(() => {
    if (isOpen && src) {
      getImageSize(src).then(setImageSize);
      resetAllTransforms();
    }
  }, [isOpen, src, getImageSize, resetAllTransforms]);

  useEffect(() => {
    if (zoom === 1) {
      setPanX(0);
      setPanY(0);
    }
  }, [zoom]);

  // Lock body scroll when dialog is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const imageDetailsLabel = isPromptOpen
    ? localize('com_ui_hide_image_details')
    : localize('com_ui_show_image_details');

  const remScale = useRemScale();
  const detailsFitBesideImage = useMediaQuery(`(min-width: ${640 * remScale}px)`);
  const detailsBeside = isPromptOpen && detailsFitBesideImage && !isMaskingMode;

  const getImageMaxWidth = () => (detailsBeside ? 'calc(90vw - 20rem)' : '90vw');

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="bg-surface-media-overlay/90 fixed inset-0 z-[250] touch-none"
          onClick={handleBackgroundClick}
        />
        <DialogPrimitive.Content
          className="fixed inset-0 z-[250] flex items-center justify-center outline-hidden select-none"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            closeButtonRef.current?.focus();
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            triggerRef?.current?.focus();
          }}
          onPointerDownOutside={(e) => e.preventDefault()}
          onClick={handleBackgroundClick}
        >
          {title != null && (
            <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          )}

          {/* Close button - top left */}
          <div className="absolute inset-s-4 top-4 z-20">
            <TooltipAnchor
              zIndex={TOOLTIP_Z_INDEX}
              description={localize('com_ui_close')}
              render={
                <Button
                  ref={closeButtonRef}
                  onClick={() => onOpenChange(false)}
                  variant="media"
                  size="bare"
                  className="h-10 w-10"
                  aria-label={localize('com_ui_close')}
                >
                  <X className="size-6" aria-hidden="true" />
                </Button>
              }
            />
          </div>

          {/* Inpaint Studio Floating Toolbar (Centered Top) */}
          {isMaskingMode && (
            <div
              className="bg-surface-primary/95 border-border-medium absolute inset-x-0 top-4 z-30 mx-auto flex w-fit items-center justify-center gap-2 rounded-2xl border px-4 py-2 shadow-2xl backdrop-blur-md"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Brush Button */}
              <TooltipAnchor
                zIndex={TOOLTIP_Z_INDEX}
                description={localize('com_ui_brush')}
                render={
                  <Button
                    onClick={() => setMaskTool('brush')}
                    variant={maskTool === 'brush' ? 'default' : 'ghost'}
                    size="bare"
                    className="h-9 w-9"
                    aria-label={localize('com_ui_brush')}
                  >
                    <Paintbrush className="size-4" aria-hidden="true" />
                  </Button>
                }
              />

              {/* Eraser Button */}
              <TooltipAnchor
                zIndex={TOOLTIP_Z_INDEX}
                description={localize('com_ui_eraser')}
                render={
                  <Button
                    onClick={() => setMaskTool('eraser')}
                    variant={maskTool === 'eraser' ? 'default' : 'ghost'}
                    size="bare"
                    className="h-9 w-9"
                    aria-label={localize('com_ui_eraser')}
                  >
                    <Eraser className="size-4" aria-hidden="true" />
                  </Button>
                }
              />

              <div className="bg-border-medium mx-1 h-5 w-px" />

              {/* Brush Size Slider */}
              <div className="flex items-center gap-2 px-1">
                <input
                  type="range"
                  min="8"
                  max="96"
                  step="4"
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="accent-surface-submit w-20 cursor-pointer"
                  aria-label={localize('com_ui_brush_size')}
                />
                <span className="text-text-secondary w-7 text-right font-mono text-xs">
                  {brushSize}
                </span>
              </div>

              <div className="bg-border-medium mx-1 h-5 w-px" />

              {/* Undo Button */}
              <TooltipAnchor
                zIndex={TOOLTIP_Z_INDEX}
                description={localize('com_ui_undo')}
                render={
                  <Button
                    onClick={handleUndo}
                    disabled={strokes.length === 0}
                    variant="ghost"
                    size="bare"
                    className="h-9 w-9"
                    aria-label={localize('com_ui_undo')}
                  >
                    <Undo2 className="size-4" aria-hidden="true" />
                  </Button>
                }
              />

              {/* Clear Mask Button */}
              <TooltipAnchor
                zIndex={TOOLTIP_Z_INDEX}
                description={localize('com_ui_clear_mask')}
                render={
                  <Button
                    onClick={handleClear}
                    disabled={strokes.length === 0}
                    variant="destructive-soft"
                    size="bare"
                    className="h-9 w-9"
                    aria-label={localize('com_ui_clear_mask')}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                }
              />

              <div className="bg-border-medium mx-1 h-5 w-px" />

              {/* Exit Masking Mode */}
              <TooltipAnchor
                zIndex={TOOLTIP_Z_INDEX}
                description={localize('com_ui_close')}
                render={
                  <Button
                    onClick={() => setIsMaskingMode(false)}
                    variant="ghost"
                    size="bare"
                    className="h-9 w-9"
                    aria-label={localize('com_ui_close')}
                  >
                    <X className="size-4" aria-hidden="true" />
                  </Button>
                }
              />
            </div>
          )}

          {/* Action buttons - top right */}
          <div
            className={`absolute top-4 z-20 flex items-center gap-2 transition-all duration-300 ${
              detailsBeside ? 'inset-e-[21rem]' : 'inset-e-4'
            }`}
          >
            {/* Inpaint Mode Toggle */}
            <TooltipAnchor
              zIndex={TOOLTIP_Z_INDEX}
              description={localize('com_ui_inpaint_mode')}
              render={
                <Button
                  onClick={() => {
                    setIsMaskingMode((prev) => !prev);
                    if (!isMaskingMode) {
                      resetZoom();
                      setIsPromptOpen(false);
                    }
                  }}
                  variant={isMaskingMode ? 'default' : 'media'}
                  size="bare"
                  className="h-10 w-10"
                  aria-label={localize('com_ui_inpaint_mode')}
                >
                  <Paintbrush className="size-5" aria-hidden="true" />
                </Button>
              }
            />

            {/* Rotate Clockwise */}
            {!isMaskingMode && (
              <TooltipAnchor
                zIndex={TOOLTIP_Z_INDEX}
                description={localize('com_ui_rotate_cw')}
                render={
                  <Button
                    onClick={() => setRotation((prev) => (prev + 90) % 360)}
                    variant="media"
                    size="bare"
                    className="h-10 w-10"
                    aria-label={localize('com_ui_rotate_cw')}
                  >
                    <RotateCw className="size-5" aria-hidden="true" />
                  </Button>
                }
              />
            )}

            {/* Reset Zoom */}
            {(zoom > 1 || rotation !== 0) && !isMaskingMode && (
              <TooltipAnchor
                zIndex={TOOLTIP_Z_INDEX}
                description={localize('com_ui_reset_zoom')}
                render={
                  <Button
                    onClick={resetAllTransforms}
                    variant="media"
                    size="bare"
                    className="h-10 w-10"
                    aria-label={localize('com_ui_reset_zoom')}
                  >
                    <RotateCcw className="size-5" aria-hidden="true" />
                  </Button>
                }
              />
            )}

            {/* Download */}
            <TooltipAnchor
              zIndex={TOOLTIP_Z_INDEX}
              description={localize('com_ui_download')}
              render={
                <Button
                  onClick={() => downloadImage()}
                  variant="media"
                  size="bare"
                  className="h-10 w-10"
                  aria-label={localize('com_ui_download')}
                >
                  <ArrowDownToLine className="size-5" aria-hidden="true" />
                </Button>
              }
            />

            {/* Prompt Details */}
            {showDetails && !isMaskingMode && (
              <TooltipAnchor
                zIndex={TOOLTIP_Z_INDEX}
                description={imageDetailsLabel}
                render={
                  <Button
                    onClick={() => setIsPromptOpen(!isPromptOpen)}
                    variant="media"
                    size="bare"
                    className="h-10 w-10"
                    aria-label={imageDetailsLabel}
                  >
                    <MorphIcon
                      icon={isPromptOpen ? PanelLeftOpen : PanelLeftClose}
                      className="size-5"
                    />
                  </Button>
                }
              />
            )}
          </div>

          {/* Image Stage Container */}
          <div
            className={`transition-all duration-300 ${detailsBeside ? 'me-80' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              ref={attachContainerRef}
              className={`relative touch-none ${getCursorClass()}`}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onDoubleClick={handleDoubleClick}
            >
              <div
                className="relative inline-block transition-transform duration-100 ease-out"
                style={{
                  transform: `translate(${panX}px, ${panY}px) scale(${zoom}) rotate(${rotation}deg)`,
                  transformOrigin: 'center center',
                }}
              >
                <img
                  ref={imageRef}
                  src={src}
                  alt={title ?? 'Image'}
                  decoding="async"
                  onLoad={syncCanvasDimensions}
                  className="block max-h-[85vh] rounded-md object-contain"
                  style={{
                    maxWidth: getImageMaxWidth(),
                  }}
                  draggable={false}
                />

                {/* Overlaid Inpainting Canvas */}
                {isMaskingMode && (
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 z-10 size-full cursor-crosshair touch-none rounded-md"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Conversational Edit Prompt Bar (Bottom) */}
          {isMaskingMode && (
            <div
              className="bg-surface-primary/95 border-border-medium absolute inset-x-4 bottom-6 z-40 mx-auto flex max-w-xl flex-col gap-2 rounded-2xl border p-2 shadow-2xl backdrop-blur-md"
              onClick={(e) => e.stopPropagation()}
            >
              {editError && (
                <div className="text-status-error px-2 py-0.5 text-xs font-medium">{editError}</div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmitEdit();
                    }
                  }}
                  placeholder={localize('com_ui_inpaint_placeholder')}
                  className="bg-surface-tertiary text-text-primary placeholder:text-text-secondary border-border-light focus:ring-border-heavy flex-1 rounded-xl border px-3.5 py-2.5 text-sm outline-hidden transition-all focus:ring-2"
                  disabled={isSubmittingEdit}
                />
                <Button
                  onClick={handleSubmitEdit}
                  disabled={!editPrompt.trim() || isSubmittingEdit}
                  variant="submit"
                  size="sm"
                  aria-label={localize('com_ui_submit_edit')}
                >
                  {isSubmittingEdit ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  <span>{localize('com_ui_submit_edit')}</span>
                </Button>
              </div>
            </div>
          )}

          {/* Side Panel for Generation Details */}
          {showDetails && !isMaskingMode && (
            <div
              data-side-panel
              className={`bg-surface-primary border-text-on-media/10 fixed inset-e-0 top-0 z-30 h-full w-80 max-w-full transform touch-pan-y border-s shadow-2xl transition-transform duration-300 ${
                isPromptOpen ? 'translate-x-0' : 'translate-x-full rtl:-translate-x-full'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-full overflow-y-auto p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-text-primary text-lg font-semibold">
                    {localize('com_ui_image_details')}
                  </h3>
                  <Button
                    onClick={() => setIsPromptOpen(false)}
                    variant="ghost"
                    size="bare"
                    className={detailsBeside ? 'hidden' : 'h-10 w-10'}
                    aria-label={localize('com_ui_hide_image_details')}
                  >
                    <X className="size-5" aria-hidden="true" />
                  </Button>
                </div>
                <div className="bg-border-medium mb-4 h-px"></div>

                <div className="space-y-6">
                  {/* Prompt Section */}
                  <div>
                    <h4 className="text-text-primary mb-2 text-sm font-medium">
                      {localize('com_ui_prompt')}
                    </h4>
                    <div className="bg-surface-tertiary rounded-md p-3">
                      <p className="text-text-primary text-sm leading-relaxed">
                        {args?.prompt || 'No prompt available'}
                      </p>
                    </div>
                  </div>

                  {/* Generation Settings */}
                  <div>
                    <h4 className="text-text-primary mb-3 text-sm font-medium">
                      {localize('com_ui_generation_settings')}
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-text-primary text-sm">
                          {localize('com_ui_size')}:
                        </span>
                        <span className="text-text-primary text-sm font-medium">
                          {args?.size || 'Unknown'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-text-primary text-sm">
                          {localize('com_ui_quality')}:
                        </span>
                        <span
                          className={`rounded px-2 py-1 text-xs font-medium capitalize ${getQualityStyles(
                            (args?.quality as string) || '',
                          )}`}
                        >
                          {(args?.quality as string) || 'Standard'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-text-primary text-sm">
                          {localize('com_ui_file_size')}:
                        </span>
                        <span className="text-text-primary text-sm font-medium">
                          {imageSize || 'Loading...'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
