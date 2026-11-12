const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function getGit(args) {
  try {
    return execSync(`git ${args}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

const commit = process.env.BUILD_COMMIT || getGit('rev-parse HEAD');
const branch = process.env.BUILD_BRANCH || getGit('rev-parse --abbrev-ref HEAD');
const buildDate =
  process.env.BUILD_DATE || getGit('log -1 --format=%cI') || new Date().toISOString();

if (commit || branch || buildDate) {
  const info = {
    commit: commit || null,
    commitShort: commit ? commit.slice(0, 7) : null,
    branch: branch === 'HEAD' ? null : branch,
    buildDate: buildDate || null,
  };
  const targetPath = path.resolve(process.cwd(), '.build-info.json');
  fs.writeFileSync(targetPath, JSON.stringify(info, null, 2) + '\n');
  console.log(
    '[stamp-build-info] Stamped build info into .build-info.json:',
    info.commitShort,
    info.branch,
    info.buildDate,
  );
}
