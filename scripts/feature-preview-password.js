/**
 * Scrypt-based password hashing for PR preview environments only.
 * Used by seed-e2e-data (when STAGE matches pr-<number>) and verified in the backend.
 */
const crypto = require('crypto');
const { promisify } = require('util');

const PREFIX = 'scrypt1';
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const KEYLEN = 64;

const scryptAsync = promisify(crypto.scrypt);

/**
 * @param {string} password
 * @returns {Promise<string>}
 */
async function hashFeaturePreviewPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scryptAsync(password, salt, KEYLEN, SCRYPT_PARAMS);
  return `${PREFIX}.${salt.toString('base64')}.${hash.toString('base64')}`;
}

/**
 * @param {string} password
 * @param {string} stored
 * @returns {Promise<boolean>}
 */
async function verifyFeaturePreviewPassword(password, stored) {
  if (!stored || typeof stored !== 'string' || !stored.startsWith(`${PREFIX}.`)) {
    return false;
  }
  const parts = stored.split('.');
  if (parts.length !== 3) {
    return false;
  }
  const salt = Buffer.from(parts[1], 'base64');
  const expected = Buffer.from(parts[2], 'base64');
  if (salt.length === 0 || expected.length === 0) {
    return false;
  }
  const hash = await scryptAsync(password, salt, expected.length, SCRYPT_PARAMS);
  try {
    return crypto.timingSafeEqual(hash, expected);
  } catch {
    return false;
  }
}

module.exports = {
  hashFeaturePreviewPassword,
  verifyFeaturePreviewPassword,
};
