const isRtlChar = (c: number) =>
  (c >= 0x0590 && c <= 0x05ff) || (c >= 0xfb1d && c <= 0xfb4f);
const isLtrChar = (c: number) =>
  (c >= 0x41 && c <= 0x5a) ||
  (c >= 0x61 && c <= 0x7a) ||
  (c >= 0x30 && c <= 0x39);

/**
 * Convert logical-order text to visual order for a left-to-right PDF
 * renderer. Hebrew (RTL) runs are character-reversed so they display
 * correctly when the PDF engine lays out glyphs left-to-right.
 * LTR runs (Latin / digits) are kept as-is. Overall run order is
 * reversed to reflect an RTL base direction.
 *
 * Use with jsPDF {@code setR2L(false)} for table cells and positioned
 * text (same approach as reports PDF export).
 */
export function toVisualOrder(text: string): string {
  if (!text) {
    return text;
  }

  const chars = Array.from(text);
  let hasRtl = false;
  for (const ch of chars) {
    if (isRtlChar(ch.codePointAt(0) ?? 0)) {
      hasRtl = true;
      break;
    }
  }
  if (!hasRtl) {
    return text;
  }

  type Dir = 'R' | 'L' | 'N';
  const types: Dir[] = chars.map((ch) => {
    const c = ch.codePointAt(0) ?? 0;
    if (isRtlChar(c)) {
      return 'R';
    }
    if (isLtrChar(c)) {
      return 'L';
    }
    return 'N';
  });

  for (let i = 0; i < types.length; i++) {
    if (types[i] !== 'N') {
      continue;
    }
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
