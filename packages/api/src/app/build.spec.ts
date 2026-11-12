import { resolveBuildInfo, __resetBuildInfoCacheForTests } from './build';

describe('resolveBuildInfo', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    __resetBuildInfoCacheForTests();
    delete process.env.BUILD_COMMIT;
    delete process.env.BUILD_BRANCH;
    delete process.env.BUILD_DATE;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('prefers BUILD_* env vars over git', () => {
    process.env.BUILD_COMMIT = 'abcdef1234567890abcdef1234567890abcdef12';
    process.env.BUILD_BRANCH = 'release/v1.0';
    process.env.BUILD_DATE = '2026-04-20T12:00:00Z';

    const info = resolveBuildInfo();

    expect(info.commit).toBe('abcdef1234567890abcdef1234567890abcdef12');
    expect(info.commitShort).toBe('abcdef1');
    expect(info.branch).toBe('release/v1.0');
    expect(info.buildDate).toBe('2026-04-20T12:00:00Z');
  });

  it('resolves buildDate from git or env when available', () => {
    __resetBuildInfoCacheForTests();
    const info = resolveBuildInfo();
    if (info.commit) {
      expect(typeof info.buildDate).toBe('string');
    }
  });

  it('treats empty/whitespace env vars as unset', () => {
    process.env.BUILD_COMMIT = '   ';
    process.env.BUILD_BRANCH = '';
    process.env.BUILD_DATE = '   ';

    const info = resolveBuildInfo();

    expect(info.commit).not.toBe('   ');
    expect(info.branch).not.toBe('');
    expect(info.buildDate).not.toBe('   ');
  });

  it('normalizes detached-HEAD branch to null', () => {
    process.env.BUILD_BRANCH = 'HEAD';
    const info = resolveBuildInfo();
    expect(info.branch).toBeNull();
  });

  it('caches result across calls', () => {
    process.env.BUILD_COMMIT = 'cached1234567890cached1234567890cached12';
    const first = resolveBuildInfo();
    process.env.BUILD_COMMIT = 'different1234567890different1234567890de';
    const second = resolveBuildInfo();
    expect(second.commit).toBe(first.commit);
  });
});
