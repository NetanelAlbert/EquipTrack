import * as fs from 'fs';
import * as path from 'path';
import { jsPDF } from 'jspdf';
import { CheckInEvent, InventoryForm, InventoryItem, User } from '@equip-track/shared';
import { drawBidiText, measureLogicalTextWidth } from './pdf-bidi-text';
import { PdfUserContext, pdfResolvedUserName } from './pdf-user-context';

const PDF_FONT_VFS_NAME = 'NotoSansHebrew-Regular.ttf';
const PDF_FONT_FAMILY = 'NotoSansHebrew';

function resolveHebrewPdfFontPath(): string {
  const candidates = [
    path.join(__dirname, 'assets', 'fonts', PDF_FONT_VFS_NAME),
    path.join(process.cwd(), 'dist/apps/backend/assets/fonts', PDF_FONT_VFS_NAME),
    path.join(process.cwd(), 'apps/backend/src/assets/fonts', PDF_FONT_VFS_NAME),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  throw new Error(
    `Hebrew PDF font not found (${PDF_FONT_VFS_NAME}). Tried:\n${candidates.join('\n')}`
  );
}

function registerHebrewPdfFont(doc: jsPDF): void {
  const fontPath = resolveHebrewPdfFontPath();
  const binary = fs.readFileSync(fontPath).toString('binary');
  doc.addFileToVFS(PDF_FONT_VFS_NAME, binary);
  doc.addFont(PDF_FONT_VFS_NAME, PDF_FONT_FAMILY, 'normal', 'Identity-H');
  doc.addFont(PDF_FONT_VFS_NAME, PDF_FONT_FAMILY, 'bold', 'Identity-H');
  doc.setFont(PDF_FONT_FAMILY, 'normal');
}

/** Form content inner right edge (inside the main frame; aligns with table x = 195). */
const FORM_INNER_RIGHT = 194;

/** Left inset for footer page counter & similar. */
const FORM_INNER_LEFT = 17;

function textSectionTitleRtl(doc: jsPDF, logicalText: string, y: number): void {
  drawBidiText(doc, logicalText, FORM_INNER_RIGHT, y, { align: 'right' });
}

/**
 * Column widths (mm), logical order מס → קוד פריט → תיאור → כמות → מס סידורי (UPI);
 * sum must be 180. מצב / הערות removed as unused.
 */
const FORM_TABLE_COL_WIDTHS: readonly number[] = [14, 34, 52, 18, 62];

const FORM_TABLE_LEFT = 15;
const FORM_TABLE_RIGHT = 195;

/** Header row height (mm); must match legacy fixed row used for section title spacing. */
const FORM_TABLE_HEADER_ROW_HEIGHT_MM = 8;
/** Minimum height for an empty filler row (mm). */
const FORM_TABLE_MIN_DATA_ROW_HEIGHT_MM = 8;
/** Vertical offset from row top (mm) to first line baseline — tuned for 8 pt table text. */
const FORM_TABLE_CELL_FIRST_BASELINE_OFFSET_MM = 5;
/** Space below last line baseline to bottom border (descenders + margin). */
const FORM_TABLE_CELL_BOTTOM_BELOW_LAST_BASELINE_MM = 3;
/** Must match `lineHeightFactor` passed to `doc.text` for wrapped table cells. */
const FORM_TABLE_TEXT_LINE_HEIGHT_FACTOR = 1.2;
/** One blank row height between table block and approval section (matches prior layout). */
const FORM_TABLE_GAP_BEFORE_APPROVAL_MM = 8;

function ptToMm(pt: number): number {
  return pt * (25.4 / 72);
}

function wrappedTableLineStepMm(doc: jsPDF): number {
  return ptToMm(doc.getFontSize() * FORM_TABLE_TEXT_LINE_HEIGHT_FACTOR);
}

function rowHeightFromWrappedLineCount(doc: jsPDF, lineCount: number): number {
  return (
    FORM_TABLE_CELL_FIRST_BASELINE_OFFSET_MM +
    (lineCount - 1) * wrappedTableLineStepMm(doc) +
    FORM_TABLE_CELL_BOTTOM_BELOW_LAST_BASELINE_MM
  );
}

/** Column bounds with RTL visual order: index 0 = מס (rightmost), 4 = מס סידורי (leftmost). */
function getFormTableRtlColumnBounds(): { left: number; right: number }[] {
  let x = FORM_TABLE_RIGHT;
  const bounds: { left: number; right: number }[] = [];
  for (const w of FORM_TABLE_COL_WIDTHS) {
    bounds.push({ left: x - w, right: x });
    x -= w;
  }
  return bounds;
}

/** Vertical divider x positions between RTL table columns (excludes outer rect stroke). */
function getFormTableInnerVerticalLineXs(): number[] {
  const bounds = getFormTableRtlColumnBounds();
  return bounds.slice(0, -1).map((b) => b.left);
}

function productNameForPdf(
  productId: string,
  productNamesById: Readonly<Record<string, string>>
): string {
  const n = productNamesById[productId];
  return n?.trim() ? n : productId;
}

/** UPI list for unique items; em dash placeholder for bulk rows (visual clarity). */
function serialColumnForPdf(item: InventoryItem): string {
  if (item.upis && item.upis.length > 0) {
    return item.upis.join(', ');
  }
  return '\u2014';
}

function formTableCellAt(
  bounds: { left: number; right: number }[],
  index: number
): { left: number; right: number } {
  const c = bounds.at(index);
  if (!c) {
    throw new Error(`form table: column index ${index} out of range`);
  }
  return c;
}

/** Split cell text to wrapped lines using logical-order Unicode. */
function formTableCellLines(
  doc: jsPDF,
  text: string,
  cell: { left: number; right: number }
): string[] {
  const pad = 1.5;
  const innerW = cell.right - cell.left - 2 * pad;
  if (innerW <= 0 || text === '') {
    return [];
  }
  return doc.splitTextToSize(text, innerW);
}

/** Draw wrapped lines, right-aligned in an RTL table cell; `rowTopMm` is the row's top Y. */
function drawFormTableWrappedCell(
  doc: jsPDF,
  cell: { left: number; right: number },
  rowTopMm: number,
  lines: string[]
): void {
  if (lines.length === 0) {
    return;
  }
  const pad = 1.5;
  const firstBaseline = rowTopMm + FORM_TABLE_CELL_FIRST_BASELINE_OFFSET_MM;
  let yLine = firstBaseline;
  for (const line of lines) {
    drawBidiText(doc, line, cell.right - pad, yLine, { align: 'right' });
    yLine += wrappedTableLineStepMm(doc);
  }
}

function planFormEquipmentTable(
  doc: jsPDF,
  items: readonly InventoryItem[],
  productNamesById: Readonly<Record<string, string>>,
  maxRows: number
): {
  colBounds: { left: number; right: number }[];
  rowHeights: number[];
  cellLinesGrid: string[][][];
} {
  const colBounds = getFormTableRtlColumnBounds();
  const rowHeights: number[] = [];
  const cellLinesGrid: string[][][] = [];
  for (let index = 0; index < maxRows; index++) {
    if (index < items.length) {
      const item = items[index];
      const linesPerCol: string[][] = [
        formTableCellLines(doc, String(index + 1), formTableCellAt(colBounds, 0)),
        formTableCellLines(
          doc,
          item.productId.substring(0, 20),
          formTableCellAt(colBounds, 1)
        ),
        formTableCellLines(
          doc,
          productNameForPdf(item.productId, productNamesById),
          formTableCellAt(colBounds, 2)
        ),
        formTableCellLines(doc, String(item.quantity), formTableCellAt(colBounds, 3)),
        formTableCellLines(doc, serialColumnForPdf(item), formTableCellAt(colBounds, 4)),
      ];
      const maxLines = Math.max(1, ...linesPerCol.map((l) => l.length));
      rowHeights.push(rowHeightFromWrappedLineCount(doc, maxLines));
      cellLinesGrid.push(linesPerCol);
    } else {
      rowHeights.push(FORM_TABLE_MIN_DATA_ROW_HEIGHT_MM);
      cellLinesGrid.push([[], [], [], [], []]);
    }
  }
  return { colBounds, rowHeights, cellLinesGrid };
}

/**
 * Hebrew label on the right, underline to its left, value right-aligned in the blank (RTL field row).
 */
function drawLabeledFieldRtl(
  doc: jsPDF,
  labelLogical: string,
  value: string,
  boxLeft: number,
  boxRight: number,
  yBase: number
): void {
  const pad = 1;
  doc.setFont(PDF_FONT_FAMILY, 'normal');
  drawBidiText(doc, labelLogical, boxRight - pad, yBase, { align: 'right' });
  const labelW = measureLogicalTextWidth(doc, labelLogical);
  const lineEnd = boxRight - pad - labelW - 3;
  doc.line(boxLeft, yBase, lineEnd, yBase);
  drawBidiText(doc, value || '', lineEnd - 1.5, yBase - 1, {
    align: 'right',
  });
}

function drawForm1008Header(
  doc: jsPDF,
  opts: { formIdLine: string; titleLogical: string }
): void {
  doc.setFontSize(14);
  doc.setFont(PDF_FONT_FAMILY, 'bold');

  doc.rect(15, 15, 50, 20);
  doc.rect(75, 15, 60, 20);
  doc.rect(145, 15, 50, 20);

  const leftBoxRight = 64;
  doc.setFontSize(10);
  doc.setFont(PDF_FONT_FAMILY, 'normal');
  const printed = new Date();
  drawBidiText(
    doc,
    `מודפס במ"פ: ${printed.toLocaleString('he-IL')}`,
    leftBoxRight - 1,
    22,
    { align: 'right' }
  );
  drawBidiText(
    doc,
    `תאריך: ${printed.toLocaleDateString('he-IL')}`,
    leftBoxRight - 1,
    30,
    { align: 'right' }
  );

  doc.setFontSize(12);
  doc.setFont(PDF_FONT_FAMILY, 'bold');
  drawBidiText(doc, opts.titleLogical, 105, 22, { align: 'center' });
  doc.text('Form 1008', 105, 30, { align: 'center' });

  const rightBoxRight = 194;
  doc.setFontSize(10);
  doc.setFont(PDF_FONT_FAMILY, 'normal');
  drawBidiText(doc, 'מס טופס', rightBoxRight - 1, 22, { align: 'right' });
  drawBidiText(doc, opts.formIdLine, rightBoxRight - 1, 30, { align: 'right' });
}

/**
 * סוג הטופס row: title on the right; options read RTL — primary option rightmost with its checkbox
 * immediately to the left of its label (label flush right for each group).
 */
function drawFormTypeRow(doc: jsPDF, mode: 'checkout' | 'checkin'): void {
  doc.setFont(PDF_FONT_FAMILY, 'bold');
  doc.setFontSize(10);
  const title = 'סוג הטופס:';
  const titleW = measureLogicalTextWidth(doc, title);
  drawBidiText(doc, title, FORM_INNER_RIGHT, 50, { align: 'right' });

  doc.setFont(PDF_FONT_FAMILY, 'normal');
  const gapAfterTitle = 8;
  let anchor = FORM_INNER_RIGHT - titleW - gapAfterTitle;

  const placeOption = (labelLogical: string, checked: boolean): void => {
    drawBidiText(doc, labelLogical, anchor, 50, { align: 'right' });
    const lw = measureLogicalTextWidth(doc, labelLogical);
    const boxLeft = anchor - lw - 3 - 4;
    doc.rect(boxLeft, 46, 4, 4);
    if (checked) {
      doc.text('X', boxLeft + 1.5, 49.5);
    }
    anchor = boxLeft - 10;
  };

  if (mode === 'checkout') {
    placeOption('הוצאה', true);
    placeOption('החזרה', false);
  } else {
    placeOption('החזרה', true);
    placeOption('הוצאה', false);
  }
}

function drawPersonalDetailsBlock(
  doc: jsPDF,
  userData: User,
  ctx: PdfUserContext,
  titleY: number,
  row1Y: number,
  row2Y: number
): void {
  doc.setFont(PDF_FONT_FAMILY, 'bold');
  doc.setFontSize(10);
  textSectionTitleRtl(doc, 'פרטים אישיים:', titleY);

  doc.setFont(PDF_FONT_FAMILY, 'normal');
  doc.setFontSize(9);

  const mid = 105;
  const leftBlock = { left: FORM_INNER_LEFT, right: mid - 2 };
  const rightBlock = { left: mid + 2, right: FORM_INNER_RIGHT };

  drawLabeledFieldRtl(
    doc,
    'שם:',
    userData.name || '',
    rightBlock.left,
    rightBlock.right,
    row1Y
  );
  drawLabeledFieldRtl(
    doc,
    'דוא"ל:',
    userData.email || '',
    leftBlock.left,
    leftBlock.right,
    row1Y
  );

  drawLabeledFieldRtl(
    doc,
    'יחידה:',
    ctx.holderUnitName ?? '',
    rightBlock.left,
    rightBlock.right,
    row2Y
  );
  const phone = userData.phone?.trim();
  if (phone) {
    drawLabeledFieldRtl(
      doc,
      'טלפון:',
      phone,
      leftBlock.left,
      leftBlock.right,
      row2Y
    );
  }
}

function parseSignatureDataUrl(signature: string): {
  format: string;
  base64Data: string;
} | undefined {
  const dataUrlMatch = signature.match(/^data:image\/([a-zA-Z]*);base64,(.*)$/);
  if (!dataUrlMatch) {
    return undefined;
  }
  const [, imageFormat, base64Data] = dataUrlMatch;
  const supportedFormats = ['png', 'jpeg', 'jpg', 'gif', 'webp'];
  const format = imageFormat.toLowerCase();
  if (!supportedFormats.includes(format)) {
    console.warn(
      `Unsupported image format: ${imageFormat}. Supported formats: ${supportedFormats.join(
        ', '
      )}`
    );
    return undefined;
  }
  const pdfFormat = format === 'jpg' ? 'JPEG' : format.toUpperCase();
  return { format: pdfFormat, base64Data };
}

/** Right side of returner/recipient signature box (mm). */
const SIG_IMAGE_X_RIGHT = 158;
const SIG_IMAGE_W = 28;
const SIG_IMAGE_H = 9;

function drawFormFooterTriple(
  doc: jsPDF,
  centerLogical: string,
  rightLogical: string
): void {
  doc.setFont(PDF_FONT_FAMILY, 'normal');
  const longCenter = centerLogical.length > 52;
  doc.setFontSize(longCenter ? 6.5 : 7);
  const y = 280;
  drawBidiText(doc, 'עמוד 1 מתוך 1', FORM_INNER_LEFT, y, { align: 'left' });
  drawBidiText(doc, centerLogical, 105, y, { align: 'center' });
  drawBidiText(doc, rightLogical, FORM_INNER_RIGHT, y, { align: 'right' });
}

export class PdfService {
  /**
   * Generates a PDF for the 1008 form based on the provided form data and user information
   * Matches the Hebrew form structure from the original document
   */
  static generateFormPDF(
    form: InventoryForm,
    userData: User,
    signature: string,
    productNamesById: Readonly<Record<string, string>>,
    ctx: PdfUserContext
  ): Buffer {
    const doc = new jsPDF();
    registerHebrewPdfFont(doc);

    doc.rect(10, 10, 190, 277);

    drawForm1008Header(doc, {
      formIdLine: String(form.formID),
      titleLogical: 'טופס הוצאה',
    });

    doc.rect(15, 40, 180, 15);
    drawFormTypeRow(doc, 'checkout');

    doc.rect(15, 60, 180, 40);
    drawPersonalDetailsBlock(doc, userData, ctx, 70, 80, 90);

    doc.setFont(PDF_FONT_FAMILY, 'bold');
    doc.setFontSize(10);
    textSectionTitleRtl(doc, 'רשימת ציוד:', 115);

    const tableStartY = 120;
    const maxRows = 5;
    const tableHeaders = ['מס', 'קוד פריט', 'תיאור', 'כמות', 'מס סידורי'];

    doc.setFont(PDF_FONT_FAMILY, 'normal');
    doc.setFontSize(8);
    const tablePlan = planFormEquipmentTable(doc, form.items, productNamesById, maxRows);
    const { colBounds, rowHeights, cellLinesGrid } = tablePlan;
    const headerRowH = FORM_TABLE_HEADER_ROW_HEIGHT_MM;
    const totalBodyHeight = rowHeights.reduce((a, b) => a + b, 0);
    const tableBottomY = tableStartY + headerRowH + totalBodyHeight;

    doc.setFont(PDF_FONT_FAMILY, 'bold');
    doc.rect(FORM_TABLE_LEFT, tableStartY, 180, headerRowH);

    for (const lineX of getFormTableInnerVerticalLineXs()) {
      doc.line(lineX, tableStartY, lineX, tableBottomY);
    }

    doc.setFontSize(8);
    tableHeaders.forEach((h, i) => {
      const lines = formTableCellLines(doc, h, formTableCellAt(colBounds, i));
      drawFormTableWrappedCell(doc, formTableCellAt(colBounds, i), tableStartY, lines);
    });

    let rowTop = tableStartY + headerRowH;
    for (let index = 0; index < maxRows; index++) {
      const rowH = rowHeights[index] ?? FORM_TABLE_MIN_DATA_ROW_HEIGHT_MM;
      doc.rect(FORM_TABLE_LEFT, rowTop, 180, rowH);
      doc.setFont(PDF_FONT_FAMILY, 'normal');
      if (index < form.items.length) {
        const linesPerCol = cellLinesGrid[index];
        if (linesPerCol) {
          for (let c = 0; c < 5; c++) {
            drawFormTableWrappedCell(
              doc,
              formTableCellAt(colBounds, c),
              rowTop,
              linesPerCol[c] ?? []
            );
          }
        }
      }
      rowTop += rowH;
    }

    const approvalY = tableBottomY + FORM_TABLE_GAP_BEFORE_APPROVAL_MM;
    doc.rect(15, approvalY, 180, 40);

    doc.setFont(PDF_FONT_FAMILY, 'bold');
    doc.setFontSize(10);
    textSectionTitleRtl(doc, 'אישורים:', approvalY + 10);

    doc.setFont(PDF_FONT_FAMILY, 'normal');
    doc.setFontSize(9);

    if (form.approvedAtTimestamp && form.approvedByUserId) {
      drawBidiText(
        doc,
        `מאושר על ידי: ${pdfResolvedUserName(form.approvedByUserId, ctx)}`,
        FORM_INNER_RIGHT,
        approvalY + 20,
        { align: 'right' }
      );
      drawBidiText(
        doc,
        `תאריך אישור: ${new Date(form.approvedAtTimestamp).toLocaleDateString(
          'he-IL'
        )}`,
        FORM_INNER_RIGHT,
        approvalY + 30,
        { align: 'right' }
      );
    } else if (form.rejectionReason) {
      drawBidiText(doc, 'סטטוס: נדחה', FORM_INNER_RIGHT, approvalY + 20, {
        align: 'right',
      });
      drawBidiText(
        doc,
        `סיבה: ${form.rejectionReason}`,
        FORM_INNER_RIGHT,
        approvalY + 30,
        { align: 'right' }
      );
    } else {
      drawBidiText(doc, 'סטטוס: ממתין לאישור', FORM_INNER_RIGHT, approvalY + 20, {
        align: 'right',
      });
    }

    const sigY = approvalY + 50;
    const leftBoxInnerRight = 98;
    const rightBoxInnerRight = FORM_INNER_RIGHT;
    doc.rect(15, sigY, 85, 30);
    doc.rect(110, sigY, 85, 30);

    const sigParsed = parseSignatureDataUrl(signature);

    doc.setFont(PDF_FONT_FAMILY, 'bold');
    drawBidiText(doc, 'חתימת מקבל:', rightBoxInnerRight, sigY + 8, {
      align: 'right',
    });
    drawBidiText(doc, 'חתימת מפקד:', leftBoxInnerRight, sigY + 8, { align: 'right' });

    doc.setFont(PDF_FONT_FAMILY, 'normal');
    doc.setFontSize(9);
    drawBidiText(doc, userData.name || '', rightBoxInnerRight, sigY + 14, {
      align: 'right',
    });

    if (sigParsed) {
      try {
        doc.addImage(
          sigParsed.base64Data,
          sigParsed.format,
          SIG_IMAGE_X_RIGHT,
          sigY + 18,
          SIG_IMAGE_W,
          SIG_IMAGE_H
        );
      } catch (error) {
        console.warn('Failed to add signature to PDF:', error);
      }
    }

    const currentDate = new Date().toLocaleDateString('he-IL');
    if (sigParsed) {
      drawBidiText(
        doc,
        `תאריך: ${currentDate}`,
        rightBoxInnerRight,
        sigY + 28,
        { align: 'right' }
      );
    }
    drawBidiText(doc, 'תאריך: ', leftBoxInnerRight, sigY + 28, { align: 'right' });

    drawFormFooterTriple(
      doc,
      `מס טופס: ${form.formID}`,
      `נוצר בתאריך: ${new Date().toLocaleString('he-IL')}`
    );

    return Buffer.from(doc.output('arraybuffer'));
  }

  /**
   * Generates a check-in event PDF (return / החזרה).
   */
  static generateCheckInEventPdf(
    form: InventoryForm,
    event: CheckInEvent,
    userData: User,
    signature: string,
    productNamesById: Readonly<Record<string, string>>,
    ctx: PdfUserContext
  ): Buffer {
    const doc = new jsPDF();
    registerHebrewPdfFont(doc);

    doc.rect(10, 10, 190, 277);

    drawForm1008Header(doc, {
      formIdLine: event.checkInEventId,
      titleLogical: 'טופס החזרה',
    });

    doc.rect(15, 40, 180, 15);
    drawFormTypeRow(doc, 'checkin');

    doc.rect(15, 58, 180, 10);
    doc.setFontSize(9);
    doc.setFont(PDF_FONT_FAMILY, 'normal');
    drawBidiText(doc, `מס טופס מקור: ${form.formID}`, FORM_INNER_RIGHT, 65, {
      align: 'right',
    });

    doc.rect(15, 72, 180, 40);
    drawPersonalDetailsBlock(doc, userData, ctx, 82, 92, 102);

    doc.setFont(PDF_FONT_FAMILY, 'bold');
    doc.setFontSize(10);
    textSectionTitleRtl(doc, 'רשימת ציוד המוחזר:', 128);

    const tableStartY = 133;
    const maxRows = 5;
    const tableHeaders = ['מס', 'קוד פריט', 'תיאור', 'כמות', 'מס סידורי'];

    doc.setFont(PDF_FONT_FAMILY, 'normal');
    doc.setFontSize(8);
    const tablePlan = planFormEquipmentTable(doc, event.items, productNamesById, maxRows);
    const { colBounds, rowHeights, cellLinesGrid } = tablePlan;
    const headerRowH = FORM_TABLE_HEADER_ROW_HEIGHT_MM;
    const totalBodyHeight = rowHeights.reduce((a, b) => a + b, 0);
    const tableBottomY = tableStartY + headerRowH + totalBodyHeight;

    doc.setFont(PDF_FONT_FAMILY, 'bold');
    doc.rect(FORM_TABLE_LEFT, tableStartY, 180, headerRowH);

    for (const lineX of getFormTableInnerVerticalLineXs()) {
      doc.line(lineX, tableStartY, lineX, tableBottomY);
    }

    doc.setFontSize(8);
    tableHeaders.forEach((h, i) => {
      const lines = formTableCellLines(doc, h, formTableCellAt(colBounds, i));
      drawFormTableWrappedCell(doc, formTableCellAt(colBounds, i), tableStartY, lines);
    });

    let rowTop = tableStartY + headerRowH;
    for (let index = 0; index < maxRows; index++) {
      const rowH = rowHeights[index] ?? FORM_TABLE_MIN_DATA_ROW_HEIGHT_MM;
      doc.rect(FORM_TABLE_LEFT, rowTop, 180, rowH);
      doc.setFont(PDF_FONT_FAMILY, 'normal');
      if (index < event.items.length) {
        const linesPerCol = cellLinesGrid[index];
        if (linesPerCol) {
          for (let c = 0; c < 5; c++) {
            drawFormTableWrappedCell(
              doc,
              formTableCellAt(colBounds, c),
              rowTop,
              linesPerCol[c] ?? []
            );
          }
        }
      }
      rowTop += rowH;
    }

    const approvalY = tableBottomY + FORM_TABLE_GAP_BEFORE_APPROVAL_MM;
    doc.rect(15, approvalY, 180, 30);
    doc.setFont(PDF_FONT_FAMILY, 'bold');
    doc.setFontSize(10);
    textSectionTitleRtl(doc, 'אישורים:', approvalY + 10);
    doc.setFont(PDF_FONT_FAMILY, 'normal');
    doc.setFontSize(9);
    drawBidiText(
      doc,
      `מאושר על ידי: ${pdfResolvedUserName(event.createdByUserId, ctx)}`,
      FORM_INNER_RIGHT,
      approvalY + 20,
      { align: 'right' }
    );
    drawBidiText(
      doc,
      `תאריך אישור: ${new Date(event.createdAtTimestamp).toLocaleDateString(
        'he-IL'
      )}`,
      FORM_INNER_RIGHT,
      approvalY + 28,
      { align: 'right' }
    );

    const sigY = approvalY + 40;
    const leftBoxInnerRight = 98;
    const rightBoxInnerRight = FORM_INNER_RIGHT;
    doc.rect(15, sigY, 85, 30);
    doc.rect(110, sigY, 85, 30);

    const sigParsed = parseSignatureDataUrl(signature);

    doc.setFont(PDF_FONT_FAMILY, 'bold');
    drawBidiText(doc, 'חתימת מחזיר:', rightBoxInnerRight, sigY + 8, {
      align: 'right',
    });
    drawBidiText(doc, 'חתימת מחסנאי:', leftBoxInnerRight, sigY + 8, {
      align: 'right',
    });
    doc.setFont(PDF_FONT_FAMILY, 'normal');
    doc.setFontSize(9);
    drawBidiText(doc, userData.name || '', rightBoxInnerRight, sigY + 14, {
      align: 'right',
    });

    if (sigParsed) {
      try {
        doc.addImage(
          sigParsed.base64Data,
          sigParsed.format,
          SIG_IMAGE_X_RIGHT,
          sigY + 18,
          SIG_IMAGE_W,
          SIG_IMAGE_H
        );
      } catch (error) {
        console.warn('Failed to add signature to check-in PDF:', error);
      }
    }

    if (sigParsed) {
      drawBidiText(
        doc,
        `תאריך: ${new Date().toLocaleDateString('he-IL')}`,
        rightBoxInnerRight,
        sigY + 28,
        { align: 'right' }
      );
    }
    drawBidiText(doc, 'תאריך: ', leftBoxInnerRight, sigY + 28, { align: 'right' });

    drawFormFooterTriple(
      doc,
      `מס אירוע: ${event.checkInEventId}`,
      `נוצר בתאריך: ${new Date().toLocaleString('he-IL')}`
    );

    return Buffer.from(doc.output('arraybuffer'));
  }
}
