import { jsPDF } from 'jspdf';
import {
  drawBidiText,
  measureLogicalTextWidth,
  splitBidiRuns,
} from './pdf-bidi-text';

describe('pdf-bidi-text', () => {
  let doc: jsPDF;

  beforeEach(() => {
    doc = new jsPDF({ unit: 'mm', format: 'a4' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
  });

  it('splitBidiRuns assigns directions for Hebrew vs Latin segments', () => {
    doc.setFont('helvetica', 'normal');
    const runs = splitBidiRuns(doc, 'Hello עברית');
    expect(runs.length).toBe(2);
    expect(runs[0]?.dir).toBe('L');
    expect(runs[1]?.dir).toBe('R');
    expect(runs[0]?.width).toBeGreaterThan(0);
    expect(runs[1]?.width).toBeGreaterThan(0);
  });

  it('measureLogicalTextWidth sums runs with gaps', () => {
    const w = measureLogicalTextWidth(doc, 'Aע', 2);
    expect(w).toBeGreaterThan(doc.getTextWidth('A') + doc.getTextWidth('ע'));
  });

  it('drawBidiText restores prior R2L flag', () => {
    doc.setR2L(false);
    drawBidiText(doc, 'שלום', 100, 20, { align: 'left' });
    expect(doc.getR2L()).toBe(false);
  });
});
