import React, { useState, useEffect, useRef, useMemo } from 'react';
import { cn } from '@librechat/client';
import {
  RotateCw,
  Terminal,
  Smartphone,
  Tablet,
  Monitor,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useLocalize } from '~/hooks';

export interface CanvasWebPreviewProps {
  content: string;
  language: string;
  className?: string;
  variant?: 'workspace' | 'inline';
}

export interface ConsoleEntry {
  id: string;
  level: 'log' | 'info' | 'warn' | 'error';
  text: string;
  timestamp: number;
}

type ViewportMode = 'responsive' | 'mobile' | 'tablet';

const CONSOLE_INTERCEPT_SCRIPT = `
(function() {
  function post(level, args) {
    try {
      var serialized = Array.prototype.slice.call(args).map(function(item) {
        if (typeof item === 'object') {
          try { return JSON.stringify(item, null, 2); } catch(e) { return String(item); }
        }
        return String(item);
      }).join(' ');
      window.parent.postMessage({
        type: 'CANVAS_CONSOLE_LOG',
        level: level,
        text: serialized,
        timestamp: Date.now()
      }, '*');
    } catch(err) {}
  }
  var origLog = console.log;
  var origWarn = console.warn;
  var origError = console.error;
  var origInfo = console.info;
  console.log = function() { post('log', arguments); if (origLog) origLog.apply(console, arguments); };
  console.warn = function() { post('warn', arguments); if (origWarn) origWarn.apply(console, arguments); };
  console.error = function() { post('error', arguments); if (origError) origError.apply(console, arguments); };
  console.info = function() { post('info', arguments); if (origInfo) origInfo.apply(console, arguments); };
  window.addEventListener('error', function(e) {
    post('error', [(e.message || 'Script error') + (e.lineno ? ' at line ' + e.lineno : '')]);
  });
})();
`;

function buildSrcDoc(content: string, language: string): string {
  const lang = (language || '').toLowerCase().trim();

  if (lang === 'svg' || (lang === 'xml' && /<svg[\s>]/i.test(content))) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script>${CONSOLE_INTERCEPT_SCRIPT}</script>
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: auto;
    }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100%;
      padding: 24px;
      background-color: var(--canvas-bg, #ffffff);
      background-image: radial-gradient(rgba(128, 128, 128, 0.2) 1px, transparent 1px);
      background-size: 16px 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    @media (prefers-color-scheme: dark) {
      body {
        --canvas-bg: #111113;
        background-image: radial-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 1px);
      }
    }
    .svg-wrapper {
      max-width: 100%;
      max-height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.08));
    }
    svg {
      max-width: 100%;
      max-height: 80vh;
      height: auto;
      display: block;
    }
  </style>
</head>
<body>
  <div class="svg-wrapper">
    ${content}
  </div>
</body>
</html>`;
  }

  if (lang === 'css') {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script>${CONSOLE_INTERCEPT_SCRIPT}</script>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 24px;
      color: #1c1c1e;
      background: #ffffff;
      line-height: 1.5;
    }
  </style>
  <style>
${content}
  </style>
</head>
<body>
  <div class="css-preview-showcase">
    <h1>Sample Heading 1</h1>
    <h2>Section Subheading</h2>
    <p>This is a paragraph demonstrating font rendering, colors, margins, and inline <a href="#test">links</a> styled by the CSS code.</p>
    <div style="margin: 16px 0; display: flex; gap: 8px; flex-wrap: wrap;">
      <button class="button btn primary" style="padding: 6px 12px; border-radius: 6px; cursor: pointer;">Primary Button</button>
      <button class="button btn secondary" style="padding: 6px 12px; border-radius: 6px; cursor: pointer;">Secondary Button</button>
      <input type="text" placeholder="Sample input" class="input text-input" style="padding: 6px 10px; border-radius: 6px; border: 1px solid #ccc;" />
    </div>
    <div class="card box container" style="margin-top: 16px; padding: 16px; border: 1px solid #e5e5ea; border-radius: 10px;">
      <h3>Card Title</h3>
      <p>Card body content previewing container styling and spacing.</p>
    </div>
  </div>
</body>
</html>`;
  }

  if (lang === 'javascript' || lang === 'typescript') {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script>${CONSOLE_INTERCEPT_SCRIPT}</script>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 20px;
      color: #1c1c1e;
      background: #ffffff;
    }
    #root, #app { min-height: 100px; }
  </style>
</head>
<body>
  <div id="root"></div>
  <div id="app"></div>
  <script type="module">
    try {
${content}
    } catch(err) {
      console.error(err.message);
    }
  </script>
</body>
</html>`;
  }

  // HTML document handling
  const hasHtmlTag = /<html[\s>]/i.test(content);
  const hasHeadTag = /<head[\s>]/i.test(content);
  const hasViewportMeta = /<meta[^>]+name=["']viewport["']/i.test(content);

  if (hasHtmlTag && hasHeadTag) {
    let result = content.replace(
      /<head([^>]*)>/i,
      `<head$1>\n  <script>${CONSOLE_INTERCEPT_SCRIPT}</script>`,
    );
    if (!hasViewportMeta) {
      result = result.replace(
        /<head([^>]*)>/i,
        `<head$1>\n  <meta name="viewport" content="width=device-width, initial-scale=1">`,
      );
    }
    return result;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script>${CONSOLE_INTERCEPT_SCRIPT}</script>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      -webkit-overflow-scrolling: touch;
    }
    *, *::before, *::after {
      box-sizing: inherit;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 16px;
      color: #1c1c1e;
      background: #ffffff;
    }
  </style>
</head>
<body>
${content}
</body>
</html>`;
}

function getLogClass(level: string): string {
  if (level === 'error') {
    return 'bg-status-error/10 text-status-error';
  }
  if (level === 'warn') {
    return 'bg-status-warning/10 text-status-warning';
  }
  return 'text-text-primary hover:bg-surface-secondary';
}

export function CanvasWebPreview({
  content,
  language,
  className,
  variant = 'workspace',
}: CanvasWebPreviewProps) {
  const localize = useLocalize();
  const [reloadKey, setReloadKey] = useState(0);
  const [viewportMode, setViewportMode] = useState<ViewportMode>('responsive');
  const [logs, setLogs] = useState<ConsoleEntry[]>([]);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const srcDoc = useMemo(() => buildSrcDoc(content, language), [content, language]);

  const handleReload = () => {
    setReloadKey((prev) => prev + 1);
  };

  const handleClearConsole = () => {
    setLogs([]);
  };

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'CANVAS_CONSOLE_LOG') {
        setLogs((prev) => [
          ...prev.slice(-99),
          {
            id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            level: e.data.level || 'log',
            text: e.data.text || '',
            timestamp: e.data.timestamp || Date.now(),
          },
        ]);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const viewportWidthClass = {
    responsive: 'w-full',
    mobile: 'w-[375px]',
    tablet: 'w-[768px]',
  }[viewportMode];

  const isFullBleed = variant === 'inline' || viewportMode === 'responsive';

  return (
    <div
      data-testid="canvas-web-preview-container"
      className={cn('bg-surface-primary flex h-full min-h-0 w-full flex-1 flex-col', className)}
    >
      {/* Accessory Control Header (Workspace only) */}
      {variant !== 'inline' && (
        <div className="border-border-light bg-surface-secondary text-text-secondary flex shrink-0 items-center justify-between border-b px-3 py-1.5 text-xs select-none">
          {/* Left: Viewport Size Switcher */}
          <div className="border-border-light bg-surface-primary/70 flex items-center gap-1 rounded-xl border p-0.5">
            <button
              type="button"
              data-testid="viewport-responsive-btn"
              title="Responsive (100%)"
              onClick={() => setViewportMode('responsive')}
              className={cn(
                'flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg p-1.5 transition-colors sm:min-h-0 sm:min-w-0',
                viewportMode === 'responsive'
                  ? 'bg-surface-secondary text-text-primary shadow-xs'
                  : 'text-text-tertiary hover:text-text-primary',
              )}
            >
              <Monitor className="size-3.5" />
            </button>
            <button
              type="button"
              data-testid="viewport-tablet-btn"
              title="Tablet (768px)"
              onClick={() => setViewportMode('tablet')}
              className={cn(
                'flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg p-1.5 transition-colors sm:min-h-0 sm:min-w-0',
                viewportMode === 'tablet'
                  ? 'bg-surface-secondary text-text-primary shadow-xs'
                  : 'text-text-tertiary hover:text-text-primary',
              )}
            >
              <Tablet className="size-3.5" />
            </button>
            <button
              type="button"
              data-testid="viewport-mobile-btn"
              title="Mobile (375px)"
              onClick={() => setViewportMode('mobile')}
              className={cn(
                'flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg p-1.5 transition-colors sm:min-h-0 sm:min-w-0',
                viewportMode === 'mobile'
                  ? 'bg-surface-secondary text-text-primary shadow-xs'
                  : 'text-text-tertiary hover:text-text-primary',
              )}
            >
              <Smartphone className="size-3.5" />
            </button>
          </div>

          {/* Right: Reload & Console Toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="preview-console-toggle"
              onClick={() => setIsConsoleOpen((prev) => !prev)}
              className={cn(
                'flex min-h-[36px] items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors sm:min-h-0',
                isConsoleOpen || logs.length > 0
                  ? 'border-border-medium bg-surface-primary text-text-primary shadow-xs'
                  : 'border-border-light text-text-secondary hover:text-text-primary',
              )}
            >
              <Terminal className="size-3" />
              <span>{localize('com_ui_canvas_interactive_console')}</span>
              {logs.length > 0 && (
                <span className="bg-surface-tertiary text-text-primary text-3xs rounded-full px-1.5 py-0.5 font-mono">
                  {logs.length}
                </span>
              )}
              {isConsoleOpen ? (
                <ChevronDown className="size-3 opacity-60" />
              ) : (
                <ChevronUp className="size-3 opacity-60" />
              )}
            </button>

            <button
              type="button"
              data-testid="preview-reload-btn"
              title={localize('com_ui_refresh') || 'Reload'}
              onClick={handleReload}
              className="hover:bg-surface-primary text-text-secondary hover:text-text-primary flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg p-1.5 transition-colors sm:min-h-0 sm:min-w-0"
            >
              <RotateCw className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Preview Frame Area */}
      <div
        className={cn(
          'min-h-0 flex-1',
          isFullBleed
            ? 'flex h-full w-full flex-col overflow-hidden bg-transparent p-0'
            : 'bg-surface-secondary flex justify-center overflow-auto p-2 sm:p-4',
        )}
      >
        <div
          className={cn(
            'bg-white transition-all duration-200',
            isFullBleed
              ? 'flex h-full w-full flex-1 flex-col overflow-hidden rounded-none border-0 shadow-none'
              : cn(
                  viewportWidthClass,
                  'border-border-medium h-full max-h-full overflow-hidden rounded-2xl border shadow-md',
                ),
          )}
        >
          <iframe
            key={reloadKey}
            ref={iframeRef}
            data-testid="canvas-live-iframe"
            title="Live Canvas Preview"
            srcDoc={srcDoc}
            sandbox="allow-scripts"
            className="block h-full w-full flex-1 border-0 bg-white"
            style={{ width: '100%', height: '100%', minHeight: '100%' }}
          />
        </div>
      </div>

      {/* Collapsible Console Drawer */}
      {variant !== 'inline' && isConsoleOpen && (
        <div
          data-testid="preview-console-drawer"
          className="border-border-light bg-surface-primary flex max-h-48 shrink-0 flex-col border-t text-xs"
        >
          <div className="border-border-light bg-surface-secondary text-text-secondary text-2xs flex items-center justify-between border-b px-3 py-1 font-mono">
            <span className="font-semibold">{localize('com_ui_canvas_interactive_console')}</span>
            {logs.length > 0 && (
              <button
                type="button"
                data-testid="preview-clear-console-btn"
                onClick={handleClearConsole}
                className="text-status-error flex items-center gap-1 transition-opacity hover:opacity-80"
              >
                <Trash2 className="size-3" />
                <span>{localize('com_ui_clear') || 'Clear'}</span>
              </button>
            )}
          </div>

          <div className="text-2xs flex-1 space-y-1 overflow-y-auto p-2 font-mono">
            {logs.length === 0 ? (
              <div className="text-text-tertiary py-2 text-center text-xs italic">
                {localize('com_ui_canvas_no_console_messages')}
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className={cn(
                    'rounded px-2 py-0.5 leading-relaxed break-all',
                    getLogClass(log.level),
                  )}
                >
                  <span className="text-text-tertiary text-3xs mr-2">
                    {new Date(log.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                  <span>{log.text}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default CanvasWebPreview;
