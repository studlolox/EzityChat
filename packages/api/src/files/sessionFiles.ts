import type { TFile } from 'librechat-data-provider';

export interface SessionFileCandidate {
  file_id: string;
  filename?: string;
  type?: string;
  bytes?: number;
  origin?: string;
}

export const SESSION_FILES_CONTEXT_KEY = 'session_files_manifest';

/**
 * Builds a concise, token-efficient manifest of files available in the current conversation thread.
 */
export function buildSessionFilesManifest(
  files: readonly (TFile | SessionFileCandidate)[],
): string {
  if (!files || files.length === 0) {
    return '';
  }

  const seen = new Set<string>();
  const lines: string[] = ['Session Files (available in this conversation thread):'];

  for (const file of files) {
    if (!file?.file_id || seen.has(file.file_id)) {
      continue;
    }
    seen.add(file.file_id);
    const name = file.filename || 'unnamed';
    const type = file.type || 'unknown';
    lines.push(`- file_id: "${file.file_id}" | name: "${name}" | type: "${type}"`);
  }

  if (seen.size === 0) {
    return '';
  }

  lines.push(
    'You may reference, view, edit, or process any of these files on demand using their file_id with corresponding tools.',
  );

  return lines.join('\n');
}

/**
 * Injects session files manifest into the agent's dynamicToolContextMap if files exist.
 */
export function prepareSessionFilesContext(
  agent: { dynamicToolContextMap?: Record<string, unknown> },
  files?: readonly (TFile | SessionFileCandidate)[],
): void {
  if (agent.dynamicToolContextMap) {
    delete agent.dynamicToolContextMap[SESSION_FILES_CONTEXT_KEY];
  }

  if (!files || files.length === 0) {
    return;
  }

  const manifest = buildSessionFilesManifest(files);
  if (!manifest) {
    return;
  }

  agent.dynamicToolContextMap ??= {};
  agent.dynamicToolContextMap[SESSION_FILES_CONTEXT_KEY] = manifest;
}
