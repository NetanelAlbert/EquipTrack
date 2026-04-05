#!/usr/bin/env node
/**
 * SHA-256 of package-lock.json with workspace semver fields stripped.
 * Auto-version bumps change root + packages[""].version only; dependencies stay the same.
 * Use this for CI cache keys so version-only commits do not invalidate node_modules caches.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const lockPath = path.join(__dirname, '..', 'package-lock.json');
const raw = fs.readFileSync(lockPath, 'utf8');
const lock = JSON.parse(raw);

delete lock.version;
if (lock.packages && typeof lock.packages[''] === 'object') {
  const root = { ...lock.packages[''] };
  delete root.version;
  lock.packages = { ...lock.packages, '': root };
}

const json = JSON.stringify(lock);
const hash = crypto.createHash('sha256').update(json).digest('hex');
process.stdout.write(hash);
