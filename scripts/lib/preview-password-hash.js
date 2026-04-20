/**
 * Shared scrypt hashing for preview-only user passwords (seed scripts + backend verify).
 * Format must stay in sync with apps/backend/src/api/auth/preview-password-crypto.ts
 */
const crypto = require('crypto');

const PREFIX = 'scrypt1';

/**
 * @param {string} plain
 * @returns {string}
 */
function hashPreviewPassword(plain) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(plain, salt, 64);
  return `${PREFIX}:${salt.toString('base64')}:${derived.toString('base64')}`;
}

module.exports = { hashPreviewPassword, PREFIX };
