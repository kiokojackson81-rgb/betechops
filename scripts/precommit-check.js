#!/usr/bin/env node
/*
 Conflict-marker guard.
 - Default mode scans staged files for merge-conflict markers and blocks commits.
 - `--all` scans the working tree so CI/builds can fail before shipping unresolved merges.
*/

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('child_process');

const IGNORED_DIRS = new Set([
  '.git',
  '.next',
  '.cache',
  '.pnpm-store',
  '.vercel',
  'node_modules',
  '.worker-dist',
  'dist_temp',
  'tmp',
  'logs',
  'backups',
]);

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
  const re = /^(<<<<<<< [^\n]+|=======|>>>>>>> [^\n]+)$/m;
  return re.test(text);
}

function listWorkingTreeFiles(rootDir) {
  const tracked = run('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: rootDir });
  if (!tracked.ok) return [];

  return tracked.out
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((file) => {
      const parts = file.split(/[\\/]+/);
      return !parts.some((part) => IGNORED_DIRS.has(part));
    });
}

function readWorkingTree(file, rootDir) {
  try {
    return fs.readFileSync(path.join(rootDir, file), 'utf8');
  } catch {
    return null;
  }
}

function main() {
  // If not in a git repo, skip
  const repoCheck = run('git', ['rev-parse', '--is-inside-work-tree']);
  if (!repoCheck.ok) process.exit(0);

  const repoRootRes = run('git', ['rev-parse', '--show-toplevel']);
  const repoRoot = repoRootRes.ok ? repoRootRes.out.trim() : process.cwd();
  const allMode = process.argv.includes('--all');
  const files = allMode ? listWorkingTreeFiles(repoRoot) : listStagedFiles();
  if (files.length === 0) process.exit(0);

  const offenders = [];
  for (const f of files) {
    const blob = allMode ? readWorkingTree(f, repoRoot) : readStaged(f);
    if (blob == null) continue;
    if (hasConflictMarkers(blob)) offenders.push(f);
  }

  if (offenders.length > 0) {
    console.error(allMode ? '[conflict-check] Merge-conflict markers detected in repository files:' : '[pre-commit] Merge-conflict markers detected in staged files:');
    for (const f of offenders) console.error(`  - ${f}`);
    console.error(allMode ? '\nResolve these files before building or deploying.' : '\nPlease resolve conflicts and stage the fixes before committing.');
    process.exit(1);
  }

  process.exit(0);
}

if (require.main === module) main();
