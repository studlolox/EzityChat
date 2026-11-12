import {
  buildSessionFilesManifest,
  prepareSessionFilesContext,
  SESSION_FILES_CONTEXT_KEY,
} from './sessionFiles';

describe('sessionFiles', () => {
  describe('buildSessionFilesManifest', () => {
    it('returns empty string when files array is empty or undefined', () => {
      expect(buildSessionFilesManifest([])).toBe('');
      expect(buildSessionFilesManifest(undefined as never)).toBe('');
    });

    it('formats a list of files with file_id, name, and type', () => {
      const files = [
        { file_id: 'f_1', filename: 'report.pdf', type: 'application/pdf' },
        { file_id: 'f_2', filename: 'data.csv', type: 'text/csv' },
      ];
      const manifest = buildSessionFilesManifest(files);

      expect(manifest).toContain('Session Files (available in this conversation thread):');
      expect(manifest).toContain('- file_id: "f_1" | name: "report.pdf" | type: "application/pdf"');
      expect(manifest).toContain('- file_id: "f_2" | name: "data.csv" | type: "text/csv"');
      expect(manifest).toContain('using their file_id');
    });

    it('deduplicates files by file_id', () => {
      const files = [
        { file_id: 'f_dup', filename: 'dup.txt', type: 'text/plain' },
        { file_id: 'f_dup', filename: 'dup.txt', type: 'text/plain' },
      ];
      const manifest = buildSessionFilesManifest(files);

      const matches = manifest.match(/f_dup/g);
      expect(matches).toHaveLength(1);
    });

    it('handles files with missing optional fields', () => {
      const files = [{ file_id: 'f_bare' }];
      const manifest = buildSessionFilesManifest(files);

      expect(manifest).toContain('- file_id: "f_bare" | name: "unnamed" | type: "unknown"');
    });
  });

  describe('prepareSessionFilesContext', () => {
    it('does not mutate dynamicToolContextMap if files are empty', () => {
      const agent: { dynamicToolContextMap?: Record<string, unknown> } = {};
      prepareSessionFilesContext(agent, []);
      expect(agent.dynamicToolContextMap).toBeUndefined();
    });

    it('injects session files manifest when files are provided', () => {
      const agent: { dynamicToolContextMap?: Record<string, unknown> } = {};
      prepareSessionFilesContext(agent, [
        { file_id: 'f_1', filename: 'image.png', type: 'image/png' },
      ]);

      expect(agent.dynamicToolContextMap?.[SESSION_FILES_CONTEXT_KEY]).toBeDefined();
      expect(agent.dynamicToolContextMap?.[SESSION_FILES_CONTEXT_KEY]).toContain('f_1');
    });

    it('clears stale session files manifest when called with empty files', () => {
      const agent: { dynamicToolContextMap?: Record<string, unknown> } = {
        dynamicToolContextMap: { [SESSION_FILES_CONTEXT_KEY]: 'stale' },
      };
      prepareSessionFilesContext(agent, []);
      expect(agent.dynamicToolContextMap?.[SESSION_FILES_CONTEXT_KEY]).toBeUndefined();
    });
  });
});
