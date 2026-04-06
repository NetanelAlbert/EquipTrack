import { jsPDF } from 'jspdf';

/** VFS filename; must match the second argument to addFont. */
export const REPORTS_PDF_FONT_FILE = 'NotoSansHebrew-Regular.ttf';
export const REPORTS_PDF_FONT_FAMILY = 'NotoSansHebrew';

/**
 * Loads Noto Sans Hebrew from app assets and registers it for Unicode
 * (Identity-H). Built-in Helvetica cannot render Hebrew or other
 * non-Latin scripts.
 */
export async function registerReportsPdfUnicodeFont(
  doc: jsPDF
): Promise<boolean> {
  try {
    const res = await fetch(`assets/fonts/${REPORTS_PDF_FONT_FILE}`);
    if (!res.ok) {
      return false;
    }
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    doc.addFileToVFS(REPORTS_PDF_FONT_FILE, binary);
    doc.addFont(
      REPORTS_PDF_FONT_FILE,
      REPORTS_PDF_FONT_FAMILY,
      'normal',
      'Identity-H'
    );
    doc.setFont(REPORTS_PDF_FONT_FAMILY, 'normal');
    return true;
  } catch {
    return false;
  }
}

const isRtlChar = (c: number) =>
  (c >= 0x0590 && c <= 0x05ff) || (c >= 0xfb1d && c <= 0xfb4f);
const isLtrChar = (c: number) =>
  (c >= 0x41 && c <= 0x5a) ||
  (c >= 0x61 && c <= 0x7a) ||
  (c >= 0x30 && c <= 0x39);

/**
 * Convert logical-order text to visual order for a left-to-right PDF
 * renderer.  Hebrew (RTL) runs are character-reversed so they display
 * correctly when the PDF engine lays out glyphs left-to-right.
 * LTR runs (Latin / digits) are kept as-is.  Overall run order is
 * reversed to reflect an RTL base direction.
 *
 * Use this for autoTable cell data when setR2L is OFF.
 */
export function toVisualOrder(text: string): string {
  if (!text) return text;

  const chars = Array.from(text);
  let hasRtl = false;
  for (const ch of chars) {
    if (isRtlChar(ch.codePointAt(0) ?? 0)) {
      hasRtl = true;
      break;
    }
  }
  if (!hasRtl) return text;

  type Dir = 'R' | 'L' | 'N';
  const types: Dir[] = chars.map((ch) => {
    const c = ch.codePointAt(0) ?? 0;
    if (isRtlChar(c)) return 'R';
    if (isLtrChar(c)) return 'L';
    return 'N';
  });

  for (let i = 0; i < types.length; i++) {
    if (types[i] !== 'N') continue;
    let prev: Dir = 'R';
    for (let j = i - 1; j >= 0; j--) {
      if (types[j] !== 'N') {
        prev = types[j];
        break;
      }
    }
    let next: Dir = 'R';
    for (let j = i + 1; j < types.length; j++) {
      if (types[j] !== 'N') {
        next = types[j];
        break;
      }
    }
    types[i] = prev === 'L' && next === 'L' ? 'L' : 'R';
  }

  const runs: { text: string; type: Dir }[] = [];
  let runStart = 0;
  for (let i = 1; i <= types.length; i++) {
    if (i === types.length || types[i] !== types[runStart]) {
      runs.push({
        text: chars.slice(runStart, i).join(''),
        type: types[runStart],
      });
      runStart = i;
    }
  }

  return runs
    .reverse()
    .map((r) =>
      r.type === 'R' ? r.text.split('').reverse().join('') : r.text
    )
    .join('');
}
