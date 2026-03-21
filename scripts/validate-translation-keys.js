#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const frontendSrcDir = path.join(repoRoot, 'apps', 'frontend', 'src');
const i18nDir = path.join(frontendSrcDir, 'assets', 'i18n');
const sourceExtensions = new Set(['.ts', '.html']);

const extractionPatterns = [
  /(['"`])([^'"`\r\n]+?)\1\s*\|\s*translate\b/g, // template pipe: 'key' | translate
  /(['"`])([^'"`\r\n]+?)\1\s*\+\s*[^|\r\n]+?\|\s*translate\b/g, // template pipe with dynamic suffix
  /\b(?:this\.)?translateService\s*\.\s*(?:instant|get|stream)\s*\(\s*(['"`])([^'"`\r\n]+?)\1/g, // service calls
  /\b(?:this\.)?(?:translateService\s*\.\s*(?:instant|get|stream)|translate)\s*\(\s*(['"`])([^'"`\r\n]+?)\1\s*\+\s*[^)\r\n]+?\)/g, // service/wrapper with dynamic suffix
  /\b(?:this\.)?translate\s*\(\s*(['"`])([^'"`\r\n]+?)\1/g, // wrapper calls like this.translate('key')
  /\b[\w$]*[Kk]ey\s*:\s*(['"`])([^'"`\r\n]+?)\1/g, // object props: labelKey: 'navigation.home'
  /\b[\w$]*[Kk]ey\s*=\s*(['"`])([^'"`\r\n]+?)\1/g, // assignments: const titleKey = '...'
];

function collectFiles(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
      continue;
    }

    if (sourceExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function normalizeExtractedKey(rawKey) {
  const trimmed = rawKey.trim();
  if (!trimmed || !trimmed.includes('.')) {
    return null;
  }

  let candidate = trimmed;
  const interpolationStart = candidate.indexOf('${');
  if (interpolationStart >= 0) {
    candidate = candidate.slice(0, interpolationStart);
  }

  if (!candidate || !/^[A-Za-z0-9_.-]+$/.test(candidate)) {
    return null;
  }

  if (candidate.endsWith('.') || candidate.endsWith('-')) {
    return { type: 'prefix', value: candidate };
  }

  return { type: 'key', value: candidate };
}

function flattenTranslationKeys(value, prefix = '') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  const keys = [];
  for (const [childKey, childValue] of Object.entries(value)) {
    const nextPrefix = prefix ? `${prefix}.${childKey}` : childKey;
    keys.push(...flattenTranslationKeys(childValue, nextPrefix));
  }

  return keys;
}

function loadLanguageKeySets(i18nDirectory) {
  if (!fs.existsSync(i18nDirectory)) {
    throw new Error(`Missing i18n directory: ${i18nDirectory}`);
  }

  const jsonFiles = fs
    .readdirSync(i18nDirectory)
    .filter((fileName) => fileName.endsWith('.json'))
    .sort();

  if (jsonFiles.length === 0) {
    throw new Error(`No language files found in ${i18nDirectory}`);
  }

  return jsonFiles.map((fileName) => {
    const filePath = path.join(i18nDirectory, fileName);
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(fileContents);
    const flatKeys = new Set(flattenTranslationKeys(parsed));
    return { fileName, keys: flatKeys };
  });
}

function extractUsedTranslationKeys(sourceDirectory) {
  if (!fs.existsSync(sourceDirectory)) {
    throw new Error(`Missing source directory: ${sourceDirectory}`);
  }

  const exactKeys = new Set();
  const dynamicPrefixes = new Set();

  const sourceFiles = collectFiles(sourceDirectory);
  for (const sourceFile of sourceFiles) {
    const fileContents = fs.readFileSync(sourceFile, 'utf8');

    for (const pattern of extractionPatterns) {
      pattern.lastIndex = 0;
      let match = pattern.exec(fileContents);

      while (match) {
        const rawKey = match[2];
        const normalized = normalizeExtractedKey(rawKey);

        if (normalized) {
          if (normalized.type === 'prefix') {
            dynamicPrefixes.add(normalized.value);
          } else {
            exactKeys.add(normalized.value);
          }
        }

        match = pattern.exec(fileContents);
      }
    }
  }

  return { exactKeys, dynamicPrefixes };
}

function validateTranslations() {
  const { exactKeys, dynamicPrefixes } = extractUsedTranslationKeys(frontendSrcDir);

  if (exactKeys.size === 0 && dynamicPrefixes.size === 0) {
    throw new Error(
      `No translation keys detected in ${frontendSrcDir}. Check extraction patterns or source paths.`
    );
  }

  const localeSets = loadLanguageKeySets(i18nDir);
  const failures = [];

  for (const locale of localeSets) {
    const missingExactKeys = [...exactKeys].filter((key) => !locale.keys.has(key)).sort();
    const missingPrefixKeys = [...dynamicPrefixes]
      .filter((prefix) => ![...locale.keys].some((key) => key.startsWith(prefix)))
      .sort();

    if (missingExactKeys.length > 0 || missingPrefixKeys.length > 0) {
      failures.push({
        locale: locale.fileName,
        missingExactKeys,
        missingPrefixKeys,
      });
    }
  }

  if (failures.length > 0) {
    console.error('Translation key validation failed.\n');

    for (const failure of failures) {
      console.error(`- ${failure.locale}`);
      if (failure.missingExactKeys.length > 0) {
        console.error('  Missing keys:');
        for (const key of failure.missingExactKeys) {
          console.error(`    - ${key}`);
        }
      }
      if (failure.missingPrefixKeys.length > 0) {
        console.error('  Missing dynamic key prefixes:');
        for (const prefix of failure.missingPrefixKeys) {
          console.error(`    - ${prefix}*`);
        }
      }
      console.error('');
    }

    process.exit(1);
  }

  console.log(
    `Translation key validation passed (${exactKeys.size} exact keys, ${dynamicPrefixes.size} dynamic prefixes).`
  );
}

validateTranslations();
