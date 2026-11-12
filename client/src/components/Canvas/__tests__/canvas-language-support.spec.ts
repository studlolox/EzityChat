import {
  normalizeCanvasLanguage,
  getLanguageDisplayName,
  resolveLanguagePolicy,
  isCodeLanguage,
  isWebPreviewableLanguage,
} from '../canvas-language-support';

describe('canvas-language-support', () => {
  describe('normalizeCanvasLanguage', () => {
    it('detects SVG explicitly and from XML content with svg tag', () => {
      expect(normalizeCanvasLanguage('svg')).toBe('svg');
      expect(normalizeCanvasLanguage('xml', '<svg viewBox="0 0 100 100"></svg>')).toBe('svg');
      expect(
        normalizeCanvasLanguage(
          undefined,
          '<svg xmlns="http://www.w3.org/2000/svg"><circle/></svg>',
        ),
      ).toBe('svg');
    });

    it('normalizes programming language aliases', () => {
      expect(normalizeCanvasLanguage('ts')).toBe('typescript');
      expect(normalizeCanvasLanguage('tsx')).toBe('typescript');
      expect(normalizeCanvasLanguage('js')).toBe('javascript');
      expect(normalizeCanvasLanguage('py')).toBe('python');
      expect(normalizeCanvasLanguage('md')).toBe('markdown');
      expect(normalizeCanvasLanguage('yml')).toBe('yaml');
      expect(normalizeCanvasLanguage('html')).toBe('html');
    });

    it('defaults unknown languages to plaintext', () => {
      expect(normalizeCanvasLanguage('unknown-lang-xyz')).toBe('plaintext');
    });
  });

  describe('isWebPreviewableLanguage', () => {
    it('identifies web previewable languages correctly', () => {
      expect(isWebPreviewableLanguage('svg')).toBe(true);
      expect(isWebPreviewableLanguage('html')).toBe(true);
      expect(isWebPreviewableLanguage('css')).toBe(true);
      expect(isWebPreviewableLanguage('javascript')).toBe(true);
      expect(isWebPreviewableLanguage('typescript')).toBe(true);
      expect(isWebPreviewableLanguage('python')).toBe(false);
      expect(isWebPreviewableLanguage('markdown')).toBe(false);
    });

    it('identifies web previewable content by sniffing tags', () => {
      expect(isWebPreviewableLanguage('xml', '<svg></svg>')).toBe(true);
      expect(isWebPreviewableLanguage('plaintext', '<html><body>Hello</body></html>')).toBe(true);
    });
  });

  describe('resolveLanguagePolicy and metadata', () => {
    it('sets correct line wrapping and line numbers policy', () => {
      expect(resolveLanguagePolicy('markdown')).toEqual({
        showLineNumbers: false,
        wrapLines: true,
      });
      expect(resolveLanguagePolicy('python')).toEqual({
        showLineNumbers: true,
        wrapLines: false,
      });
      expect(resolveLanguagePolicy('svg')).toEqual({
        showLineNumbers: true,
        wrapLines: false,
      });
    });

    it('distinguishes code languages from markdown', () => {
      expect(isCodeLanguage('python')).toBe(true);
      expect(isCodeLanguage('svg')).toBe(true);
      expect(isCodeLanguage('markdown')).toBe(false);
      expect(isCodeLanguage('plaintext')).toBe(false);
    });

    it('returns human-readable display names', () => {
      expect(getLanguageDisplayName('svg')).toBe('SVG');
      expect(getLanguageDisplayName('python')).toBe('Python');
      expect(getLanguageDisplayName('typescript')).toBe('TypeScript');
      expect(getLanguageDisplayName('html')).toBe('HTML');
    });
  });
});
