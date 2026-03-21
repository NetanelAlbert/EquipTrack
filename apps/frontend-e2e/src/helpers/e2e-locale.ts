/**
 * Must stay aligned with apps/frontend/src/utils/consts.ts STORAGE_KEYS.LANGUAGE
 * and LanguageService supported codes.
 */
export const E2E_LANGUAGE_STORAGE_KEY = 'equip-track-language' as const;

/** Language used for Playwright E2E so assertions match English copy. */
export const E2E_TEST_APP_LANGUAGE = 'en' as const;
