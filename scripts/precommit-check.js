#!/usr/bin/env node
/*
 Pre-commit guard: block commits containing merge-conflict markers in staged files.
 - Scans staged (added/modified/copied) files, reads staged blob content, and looks for <<<<<<<, =======, >>>>>>> markers.
 - Exits non-zero if any are found, printing a concise report.
*/

const { execFileSync, execSync } = require('child_process');

function run(cmd, args, opts = {}) {
  try {
    const out = execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    return { ok: true, out };
  } catch (e) {
    return { ok: false, err: e };
  }
}

function listStagedFiles() {
  const res = run('git', ['diff', '--cached', '--name-only', '--diff-filter=ACM']);
  if (!res.ok) return [];
  return res.out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

function readStaged(file) {
  const res = run('git', ['show', `:${file}`]);
  if (!res.ok) return null;
  return res.out;
}

function hasConflictMarkers(text) {
  // Quick binary check
  if (text.includes('\u0000')) return false;
  // Detect standard conflict markers at line starts
  const re = /^(<<<<<<< |=======|>>>>>>> )/m;
  return re.test(text);
}

function main() {
  // If not in a git repo, skip
  const repoCheck = run('git', ['rev-parse', '--is-inside-work-tree']);
  if (!repoCheck.ok) process.exit(0);

  const files = listStagedFiles();
  if (files.length === 0) process.exit(0);

  const offenders = [];
  for (const f of files) {
    const blob = readStaged(f);
    if (blob == null) continue;
    if (hasConflictMarkers(blob)) offenders.push(f);
  }

  if (offenders.length > 0) {
    console.error('[pre-commit] Merge-conflict markers detected in staged files:');
    for (const f of offenders) console.error(`  - ${f}`);
    console.error('\nPlease resolve conflicts and stage the fixes before committing.');
    process.exit(1);
  }

  process.exit(0);
}

if (require.main === module) main();
