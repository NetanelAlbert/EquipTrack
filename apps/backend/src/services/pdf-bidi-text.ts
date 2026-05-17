import type { jsPDF } from 'jspdf';
import { splitLogicalBidiRuns } from '@equip-track/shared';

export type BidiRunDir = 'R' | 'L';

export interface BidiRun {
  /** Logical-order Unicode */
  text: string;
  dir: BidiRunDir;
  width: number;
}

export function splitBidiRuns(doc: jsPDF, text: string): BidiRun[] {
  return splitLogicalBidiRuns(text).map((r) => ({
    text: r.text,
    dir: r.dir,
    width: doc.getTextWidth(r.text),
  }));
}

export function bidiTextWidth(
  runs: readonly BidiRun[],
  gapPt: number
): number {
  if (runs.length === 0) {
    return 0;
  }
  return (
    runs.reduce((s, r) => s + r.width, 0) +
    gapPt * Math.max(0, runs.length - 1)
  );
}

export function measureLogicalTextWidth(
  doc: jsPDF,
  text: string,
  gapPt = 2
): number {
  return bidiTextWidth(splitBidiRuns(doc, text), gapPt);
}

/**
 * Render logical-order text with per-run {@link jsPDF.setR2L} so mixed
 * Hebrew+LTR lines display and extract correctly (Form 1008 PDFs).
 */
export function drawBidiText(
  doc: jsPDF,
  text: string,
  anchorX: number,
  y: number,
  opts: { align: 'left' | 'right' | 'center'; gapPt?: number }
): void {
  const gap = opts.gapPt ?? 2;
  const runs = splitBidiRuns(doc, text);
  if (runs.length === 0) {
    return;
  }
  const prevR2L = doc.getR2L();
  try {
    if (opts.align === 'right') {
      let rightX = anchorX;
      for (let i = 0; i < runs.length; i++) {
        const run = runs[i];
        if (!run) {
          continue;
        }
        doc.setR2L(run.dir === 'R');
        doc.text(run.text, rightX, y, { align: 'right' });
        rightX -= run.width;
        if (i < runs.length - 1) {
          rightX -= gap;
        }
      }
      return;
    }
    if (opts.align === 'left') {
      let leftX = anchorX;
      for (let i = 0; i < runs.length; i++) {
        const run = runs[i];
        if (!run) {
          continue;
        }
        doc.setR2L(run.dir === 'R');
        doc.text(run.text, leftX, y, { align: 'left' });
        leftX += run.width;
        if (i < runs.length - 1) {
          leftX += gap;
        }
      }
      return;
    }
    const total = bidiTextWidth(runs, gap);
    let rightX = anchorX + total / 2;
    for (let i = 0; i < runs.length; i++) {
      const run = runs[i];
      if (!run) {
        continue;
      }
      doc.setR2L(run.dir === 'R');
      doc.text(run.text, rightX, y, { align: 'right' });
      rightX -= run.width;
      if (i < runs.length - 1) {
        rightX -= gap;
      }
    }
  } finally {
    doc.setR2L(prevR2L);
  }
}
