import {
  hashPreviewPasswordForTests,
  verifyPreviewPassword,
} from './preview-password-crypto';

describe('preview-password-crypto', () => {
  it('verifies a hash produced by hashPreviewPasswordForTests', () => {
    const plain = 'test-secret-password';
    const stored = hashPreviewPasswordForTests(plain);
    expect(verifyPreviewPassword(plain, stored)).toBe(true);
    expect(verifyPreviewPassword('wrong', stored)).toBe(false);
  });

  it('rejects invalid stored format', () => {
    expect(verifyPreviewPassword('x', undefined)).toBe(false);
    expect(verifyPreviewPassword('x', 'bad')).toBe(false);
  });
});
