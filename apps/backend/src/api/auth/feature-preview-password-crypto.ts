import { scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const PREFIX = 'scrypt1';
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const;

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: typeof SCRYPT_PARAMS
) => Promise<Buffer>;

export async function verifyFeaturePreviewPassword(
  password: string,
  stored: string
): Promise<boolean> {
  if (!stored?.startsWith(`${PREFIX}.`)) {
    return false;
  }
  const parts = stored.split('.');
  if (parts.length !== 3) {
    return false;
  }
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[1], 'base64');
    expected = Buffer.from(parts[2], 'base64');
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) {
    return false;
  }
  const hash = await scryptAsync(password, salt, expected.length, SCRYPT_PARAMS);
  try {
    return timingSafeEqual(
      new Uint8Array(hash),
      new Uint8Array(expected)
    );
  } catch {
    return false;
  }
}
