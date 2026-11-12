import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { logger } from '@librechat/data-schemas';

export interface BuildInfo {
  commit: string | null;
  commitShort: string | null;
  branch: string | null;
  buildDate: string | null;
}

let cached: BuildInfo | null = null;

function safeGit(args: string[]): string | null {
  try {
    const out = execFileSync('git', args, {
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2000,
      encoding: 'utf8',
    });
    const trimmed = out.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

function readBuildInfoFile(): Partial<BuildInfo> | null {
  try {
    const candidatePaths = [
      path.resolve(process.cwd(), '.build-info.json'),
      path.resolve(process.cwd(), 'client', 'dist', '.build-info.json'),
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8');
        return JSON.parse(raw);
      }
    }
    return null;
  } catch {
    return null;
  }
}

function normalize(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Resolves the current deployment's build info from (in order): explicit env vars,
 * stamped build-info file, then local git metadata. Used by `/api/config` to expose
 * commit/branch/date to clients when `interface.buildInfo` is enabled.
 */
export function resolveBuildInfo(): BuildInfo {
  if (cached) {
    return cached;
  }

  const fileInfo = readBuildInfoFile();

  const commit =
    normalize(process.env.BUILD_COMMIT) ??
    normalize(fileInfo?.commit) ??
    safeGit(['rev-parse', 'HEAD']);

  const branch =
    normalize(process.env.BUILD_BRANCH) ??
    normalize(fileInfo?.branch) ??
    safeGit(['rev-parse', '--abbrev-ref', 'HEAD']);

  const buildDate =
    normalize(process.env.BUILD_DATE) ??
    normalize(fileInfo?.buildDate) ??
    safeGit(['log', '-1', '--format=%cI']);

  const info: BuildInfo = {
    commit,
    commitShort: commit ? commit.slice(0, 7) : null,
    branch: branch === 'HEAD' ? null : branch,
    buildDate,
  };

  cached = info;

  if (!info.commit && !info.branch && !info.buildDate) {
    logger.debug(
      '[buildInfo] no BUILD_* env vars set and git metadata unavailable; buildInfo will be empty',
    );
  }

  return info;
}

/** Test hook — resets the in-process cache. Not exported from the package barrel. */
export function __resetBuildInfoCacheForTests(): void {
  cached = null;
}
