#!/usr/bin/env node
/**
 * Verifies npm registry provenance for every lockfile in the repository.
 *
 * A machine-level ~/.npmrc pointing at an internal Microsoft package proxy
 * silently rewrites every `resolved` URL during install. That corrupts
 * provenance for this public repository and breaks `npm ci` for outside
 * contributors, who cannot reach the internal feed. Each install root declares
 * the public registry explicitly; this check fails if that protection is lost
 * or a contaminated lockfile is committed.
 *
 * Run with:  npm run check:lockfiles
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const INTERNAL_FEED =
  /ms-feed-\d+\.pkgs\.visualstudio\.com|packagefeedproxy\.microsoft\.io|pkgs\.dev\.azure\.com/gi;
const PUBLIC_REGISTRY = /^\s*registry\s*=\s*https:\/\/registry\.npmjs\.org\/?\s*$/m;
const SKIP = new Set(['node_modules', '.git', 'dist', '.astro', '.next', 'build']);

/** @param {string} dir @param {string[]} found */
function findLockfiles(dir, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP.has(entry.name)) findLockfiles(join(dir, entry.name), found);
    } else if (entry.name === 'package-lock.json' || entry.name === 'pnpm-lock.yaml') {
      found.push(join(dir, entry.name));
    }
  }
  return found;
}

const lockfiles = findLockfiles(repoRoot);
const failures = [];

if (lockfiles.length === 0) {
  failures.push('No lockfile found. The discovery walk is broken.');
}

for (const lockfile of lockfiles) {
  const rel = relative(repoRoot, lockfile).replace(/\\/g, '/');
  const root = dirname(lockfile);

  const matches = readFileSync(lockfile, 'utf8').match(INTERNAL_FEED) ?? [];
  if (matches.length > 0) {
    const hosts = [...new Set(matches)].join(', ');
    failures.push(
      `${rel}: ${matches.length} internal package-feed URL(s) (${hosts}). ` +
        'Regenerate with --registry=https://registry.npmjs.org',
    );
  }

  const npmrc = join(root, '.npmrc');
  if (!existsSync(npmrc)) {
    failures.push(
      `${rel}: no sibling .npmrc. npm reads project config from the working ` +
        'directory and does not walk up the tree, so every install root needs ' +
        'its own registry declaration.',
    );
  } else if (!PUBLIC_REGISTRY.test(readFileSync(npmrc, 'utf8'))) {
    failures.push(`${rel}: sibling .npmrc does not pin registry.npmjs.org`);
  }
}

if (failures.length > 0) {
  console.error('Lockfile provenance check failed:\n');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`Lockfile provenance OK (${lockfiles.length} lockfile(s) checked).`);
