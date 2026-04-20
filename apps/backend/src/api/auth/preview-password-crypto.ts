import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const PREFIX = 'scrypt1';

/**
 * Verifies a password against a value produced by {@link hashPreviewPassword} in scripts/lib/preview-password-hash.js.
 */
export function verifyPreviewPassword(
  plain: string,
  stored: string | undefined
): boolean {
  if (!stored || typeof stored !== 'string') {
    return false;
  }
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== PREFIX) {
    return false;
  }
  try {
    const salt = new Uint8Array(Buffer.from(parts[1], 'base64'));
    const expected = new Uint8Array(Buffer.from(parts[2], 'base64'));
    const derived = scryptSync(plain, salt, 64);
    const derivedU8 = new Uint8Array(derived);
    if (derivedU8.length !== expected.length) {
      return false;
    }
    return timingSafeEqual(derivedU8, expected);
  } catch {
    return false;
  }
}

/** Dev-only helper for tests; production uses Node script hashing in seed. */
export function hashPreviewPasswordForTests(plain: string): string {
  const salt = randomBytes(16);
  const saltU8 = new Uint8Array(salt);
  const derived = scryptSync(plain, saltU8, 64);
  return `${PREFIX}:${Buffer.from(saltU8).toString('base64')}:${Buffer.from(new Uint8Array(derived)).toString('base64')}`;
}
