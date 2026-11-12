import { tags as t } from '@lezer/highlight';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import type { Extension } from '@codemirror/state';

export const CANVAS_LANGUAGES = [
  'markdown',
  'plaintext',
  'typescript',
  'javascript',
  'python',
  'json',
  'html',
  'css',
  'sql',
  'sh',
  'yaml',
  'svg',
  'xml',
] as const;

export type CanvasLanguage = (typeof CANVAS_LANGUAGES)[number];

export interface LanguageConfig {
  id: CanvasLanguage;
  displayName: string;
  showLineNumbers: boolean;
  wrapLines: boolean;
  loader: () => Promise<Extension>;
}

export const LANGUAGE_CONFIGS: Record<CanvasLanguage, LanguageConfig> = {
  markdown: {
    id: 'markdown',
    displayName: 'Markdown',
    showLineNumbers: false,
    wrapLines: true,
    loader: async () => {
      const { markdown } = await import('@codemirror/lang-markdown');
      return markdown();
    },
  },
  plaintext: {
    id: 'plaintext',
    displayName: 'Plain text',
    showLineNumbers: false,
    wrapLines: true,
    loader: async () => [],
  },
  typescript: {
    id: 'typescript',
    displayName: 'TypeScript',
    showLineNumbers: true,
    wrapLines: false,
    loader: async () => {
      const { javascript } = await import('@codemirror/lang-javascript');
      return javascript({ typescript: true });
    },
  },
  javascript: {
    id: 'javascript',
    displayName: 'JavaScript',
    showLineNumbers: true,
    wrapLines: false,
    loader: async () => {
      const { javascript } = await import('@codemirror/lang-javascript');
      return javascript({ jsx: true });
    },
  },
  python: {
    id: 'python',
    displayName: 'Python',
    showLineNumbers: true,
    wrapLines: false,
    loader: async () => {
      const { python } = await import('@codemirror/lang-python');
      return python();
    },
  },
  json: {
    id: 'json',
    displayName: 'JSON',
    showLineNumbers: true,
    wrapLines: false,
    loader: async () => {
      const { json } = await import('@codemirror/lang-json');
      return json();
    },
  },
  html: {
    id: 'html',
    displayName: 'HTML',
    showLineNumbers: true,
    wrapLines: false,
    loader: async () => {
      const { html } = await import('@codemirror/lang-html');
      return html();
    },
  },
  css: {
    id: 'css',
    displayName: 'CSS',
    showLineNumbers: true,
    wrapLines: false,
    loader: async () => {
      const { css } = await import('@codemirror/lang-css');
      return css();
    },
  },
  sql: {
    id: 'sql',
    displayName: 'SQL',
    showLineNumbers: true,
    wrapLines: false,
    loader: async () => {
      const { sql } = await import('@codemirror/lang-sql');
      return sql();
    },
  },
  sh: {
    id: 'sh',
    displayName: 'Shell',
    showLineNumbers: true,
    wrapLines: false,
    loader: async () => [],
  },
  yaml: {
    id: 'yaml',
    displayName: 'YAML',
    showLineNumbers: true,
    wrapLines: false,
    loader: async () => {
      const { yaml } = await import('@codemirror/lang-yaml');
      return yaml();
    },
  },
  svg: {
    id: 'svg',
    displayName: 'SVG',
    showLineNumbers: true,
    wrapLines: false,
    loader: async () => {
      const { html } = await import('@codemirror/lang-html');
      return html();
    },
  },
  xml: {
    id: 'xml',
    displayName: 'XML',
    showLineNumbers: true,
    wrapLines: false,
    loader: async () => {
      const { html } = await import('@codemirror/lang-html');
      return html();
    },
  },
};

/**
 * Normalizes language string and optionally sniffs content (e.g. detecting SVG tags).
 */
export function normalizeCanvasLanguage(lang?: string, content?: string): CanvasLanguage {
  const l = (lang || '').toLowerCase().trim();

  if (l === 'svg') return 'svg';
  if (l === 'html' || l === 'htm') return 'html';

  if (l === 'xml') {
    if (content && /<svg[\s>]/i.test(content)) {
      return 'svg';
    }
    return 'xml';
  }

  if (content && /^\s*<svg[\s>]/i.test(content)) {
    return 'svg';
  }
  if (content && (/^\s*<!doctype html>/i.test(content) || /^\s*<html[\s>]/i.test(content))) {
    return 'html';
  }

  if (['ts', 'typescript', 'tsx'].includes(l)) return 'typescript';
  if (['js', 'javascript', 'jsx', 'mjs', 'cjs'].includes(l)) return 'javascript';
  if (['py', 'python'].includes(l)) return 'python';
  if (l === 'json') return 'json';
  if (['css', 'scss', 'less'].includes(l)) return 'css';
  if (['sql', 'mysql', 'pgsql', 'postgres'].includes(l)) return 'sql';
  if (['sh', 'bash', 'zsh', 'shell'].includes(l)) return 'sh';
  if (['yaml', 'yml'].includes(l)) return 'yaml';
  if (['md', 'markdown'].includes(l)) return 'markdown';
  if (['text', 'txt', 'plaintext'].includes(l)) return 'plaintext';

  return (l as CanvasLanguage) in LANGUAGE_CONFIGS ? (l as CanvasLanguage) : 'plaintext';
}

export function getLanguageConfig(lang: CanvasLanguage): LanguageConfig {
  return LANGUAGE_CONFIGS[lang] || LANGUAGE_CONFIGS.plaintext;
}

export function getLanguageDisplayName(lang: CanvasLanguage): string {
  return getLanguageConfig(lang).displayName;
}

export function resolveLanguagePolicy(lang: CanvasLanguage): {
  showLineNumbers: boolean;
  wrapLines: boolean;
} {
  const config = getLanguageConfig(lang);
  return {
    showLineNumbers: config.showLineNumbers,
    wrapLines: config.wrapLines,
  };
}

export function isCodeLanguage(lang: CanvasLanguage): boolean {
  return lang !== 'markdown' && lang !== 'plaintext';
}

export function isWebPreviewableLanguage(lang: CanvasLanguage, content?: string): boolean {
  if (['svg', 'html', 'css', 'javascript', 'typescript'].includes(lang)) {
    return true;
  }
  if (content && (/<svg[\s>]/i.test(content) || /<html[\s>]/i.test(content))) {
    return true;
  }
  return false;
}

export async function loadLanguageExtension(lang: CanvasLanguage): Promise<Extension> {
  const config = getLanguageConfig(lang);
  try {
    return await config.loader();
  } catch (err) {
    console.warn(
      `[Canvas] Failed to load language extension for "${lang}", falling back to plain text:`,
      err,
    );
    return [];
  }
}

/** Custom Lezer highlight style that integrates nicely with dark/light themes */
export const canvasHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: 'var(--text-accent, #3b82f6)', fontWeight: '600' },
  { tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName], color: 'inherit' },
  { tag: [t.function(t.variableName), t.labelName], color: '#6366f1' },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: '#f59e0b' },
  { tag: [t.definition(t.name), t.separator], color: 'inherit' },
  {
    tag: [
      t.typeName,
      t.className,
      t.number,
      t.changed,
      t.annotation,
      t.modifier,
      t.self,
      t.namespace,
    ],
    color: '#10b981',
  },
  {
    tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)],
    color: '#ec4899',
  },
  { tag: [t.meta, t.comment], color: 'var(--text-tertiary, #888)', fontStyle: 'italic' },
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.link, color: '#3b82f6', textDecoration: 'underline' },
  { tag: t.heading, fontWeight: 'bold', color: 'var(--text-primary, #fff)' },
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: '#8b5cf6' },
  { tag: [t.processingInstruction, t.string, t.inserted], color: '#10b981' },
  { tag: t.invalid, color: '#ef4444' },
]);

export const canvasSyntaxHighlighting = syntaxHighlighting(canvasHighlightStyle, {
  fallback: true,
});
