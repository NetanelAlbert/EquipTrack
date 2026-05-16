import * as fs from 'fs';
import * as path from 'path';
import { jsPDF } from 'jspdf';
import { CheckInEvent, InventoryForm, InventoryItem, User, toVisualOrder } from '@equip-track/shared';

const PDF_FONT_VFS_NAME = 'NotoSansHebrew-Regular.ttf';
const PDF_FONT_FAMILY = 'NotoSansHebrew';

/** Logical Hebrew / mixed strings → visual order for LTR jsPDF layout (see PR #100 reports PDF). */
function v(s: string | undefined | null): string {
  return toVisualOrder(s ?? '');
}

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

/** Renders a Hebrew label (with {@link v}) plus LTR tail, flush to `rightX`. */
function textHebrewLabelThenLtrFromRight(
  doc: jsPDF,
  hebrewLabelLogical: string,
  ltrRest: string,
  rightX: number,
  y: number,
  gapPt = 2
): void {
  const label = v(hebrewLabelLogical);
  const ltr = ltrRest ?? '';
  const wLabel = doc.getTextWidth(label);
  const wLtr = ltr ? doc.getTextWidth(ltr) : 0;
  const total = wLabel + (ltr ? gapPt + wLtr : 0);
  let x = rightX - total;
  doc.text(label, x, y);
  if (ltr) {
    x += wLabel + gapPt;
    doc.text(ltr, x, y);
  }
}

/** Form content inner right edge (inside the main frame; aligns with table x = 195). */
const FORM_INNER_RIGHT = 194;

/** Left inset for footer page counter & similar. */
const FORM_INNER_LEFT = 17;

/**
 * Hebrew section titles — anchored to the right (RTL block alignment).
 */
function textSectionTitleRtl(doc: jsPDF, logicalText: string, y: number): void {
  doc.text(v(logicalText), FORM_INNER_RIGHT, y, { align: 'right' });
}

/**
 * Column widths (mm), logical order מס → קוד פריט → תיאור → כמות → מס סידורי (UPI);
 * sum must be 180. מצב / הערות removed as unused.
 */
const FORM_TABLE_COL_WIDTHS: readonly number[] = [14, 34, 52, 18, 62];

const FORM_TABLE_LEFT = 15;
const FORM_TABLE_RIGHT = 195;

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

/** UPI list for unique items; empty for bulk-only lines (cell left blank). */
function serialColumnForPdf(item: InventoryItem): string {
  if (item.upis && item.upis.length > 0) {
    return item.upis.join(', ');
  }
  return '';
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

function textInFormTableCell(
  doc: jsPDF,
  cell: { left: number; right: number },
  y: number,
  text: string,
  opts?: { visual?: boolean }
): void {
  if (text === '') {
    return;
  }
  const pad = 1.5;
  const innerW = cell.right - cell.left - 2 * pad;
  if (innerW <= 0) {
    return;
  }
  const useVisual = opts?.visual !== false;
  const line = useVisual ? v(text) : text;
  doc.text(line, cell.right - pad, y, {
    align: 'right',
    maxWidth: innerW,
  });
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
  yBase: number,
  opts?: { valueVisual?: boolean }
): void {
  const pad = 1;
  const label = v(labelLogical);
  const useV = opts?.valueVisual !== false;
  const valText = useV ? v(value) : value;
  doc.setFont(PDF_FONT_FAMILY, 'normal');
  doc.text(label, boxRight - pad, yBase, { align: 'right' });
  const labelW = doc.getTextWidth(label);
  const lineEnd = boxRight - pad - labelW - 3;
  doc.line(boxLeft, yBase, lineEnd, yBase);
  doc.text(valText, lineEnd - 1.5, yBase - 1, {
    align: 'right',
    maxWidth: Math.max(0, lineEnd - boxLeft - 2),
  });
}

/** Header strip: three boxes — left & right RTL inside cell; center title centered. */
function drawForm1008Header(
  doc: jsPDF,
  formIdLine: string
): void {
  doc.setFontSize(14);
  doc.setFont(PDF_FONT_FAMILY, 'bold');

  doc.rect(15, 15, 50, 20);
  doc.rect(75, 15, 60, 20);
  doc.rect(145, 15, 50, 20);

  const leftBoxRight = 64;
  doc.setFontSize(10);
  doc.setFont(PDF_FONT_FAMILY, 'normal');
  doc.text(v('מודפס במ"פ'), leftBoxRight - 1, 22, { align: 'right' });
  doc.text(v('תאריך'), leftBoxRight - 1, 30, { align: 'right' });

  doc.setFontSize(12);
  doc.setFont(PDF_FONT_FAMILY, 'bold');
  doc.text(v('טופס הוצאה/החזרה'), 105, 22, { align: 'center' });
  doc.text('Form 1008', 105, 30, { align: 'center' });

  const rightBoxRight = 194;
  doc.setFontSize(10);
  doc.setFont(PDF_FONT_FAMILY, 'normal');
  doc.text(v('מס טופס'), rightBoxRight - 1, 22, { align: 'right' });
  doc.text(formIdLine, rightBoxRight - 1, 30, { align: 'right' });
}

/**
 * סוג הטופס row: title on the right; options read RTL — primary option rightmost with its checkbox
 * immediately to the left of its label (label flush right for each group).
 */
function drawFormTypeRow(
  doc: jsPDF,
  mode: 'checkout' | 'checkin'
): void {
  doc.setFont(PDF_FONT_FAMILY, 'bold');
  doc.setFontSize(10);
  const title = v('סוג הטופס:');
  const titleW = doc.getTextWidth(title);
  doc.text(title, FORM_INNER_RIGHT, 50, { align: 'right' });

  doc.setFont(PDF_FONT_FAMILY, 'normal');
  const gapAfterTitle = 8;
  let anchor = FORM_INNER_RIGHT - titleW - gapAfterTitle;

  const placeOption = (
    labelLogical: string,
    checked: boolean
  ): void => {
    doc.text(v(labelLogical), anchor, 50, { align: 'right' });
    const lw = doc.getTextWidth(v(labelLogical));
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

/** Personal-details four fields mirrored for RTL (שם / יחידה on the right column). */
function drawPersonalDetailsBlock(
  doc: jsPDF,
  userData: User,
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
    'מס אישי:',
    userData.id || '',
    leftBlock.left,
    leftBlock.right,
    row1Y,
    { valueVisual: false }
  );

  drawLabeledFieldRtl(
    doc,
    'יחידה:',
    userData.email || '',
    rightBlock.left,
    rightBlock.right,
    row2Y,
    { valueVisual: false }
  );
  drawLabeledFieldRtl(
    doc,
    'טלפון:',
    userData.phone || '',
    leftBlock.left,
    leftBlock.right,
    row2Y,
    { valueVisual: false }
  );
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
    productNamesById: Readonly<Record<string, string>> = {}
  ): Buffer {
    const doc = new jsPDF();
    registerHebrewPdfFont(doc);

    // Top border
    doc.rect(10, 10, 190, 277);

    drawForm1008Header(doc, form.formID.toString());

    // Form Type Section
    doc.rect(15, 40, 180, 15);
    drawFormTypeRow(doc, 'checkout');

    // Personal Details Section
    doc.rect(15, 60, 180, 40);
    drawPersonalDetailsBlock(doc, userData, 70, 80, 90);

    // Equipment Table Section
    doc.setFont(PDF_FONT_FAMILY, 'bold');
    doc.setFontSize(10);
    textSectionTitleRtl(doc, 'רשימת ציוד:', 115);

    // Table headers — columns RTL (מס on the right); cell text right-aligned
    const tableStartY = 120;
    const rowHeight = 8;
    const colBounds = getFormTableRtlColumnBounds();
    const tableHeaders = [
      'מס',
      'קוד פריט',
      'תיאור',
      'כמות',
      'מס סידורי',
    ];

    // Draw table borders and headers
    doc.rect(FORM_TABLE_LEFT, tableStartY, 180, rowHeight); // Header row

    for (const lineX of getFormTableInnerVerticalLineXs()) {
      doc.line(lineX, tableStartY, lineX, tableStartY + rowHeight * 6);
    }

    doc.setFontSize(8);
    tableHeaders.forEach((h, i) => {
      textInFormTableCell(doc, formTableCellAt(colBounds, i), tableStartY + 5, h);
    });

    // Table rows for items
    form.items.forEach((item, index) => {
      const rowY = tableStartY + rowHeight * (index + 1);

      // Draw row border
      doc.rect(FORM_TABLE_LEFT, rowY, 180, rowHeight);

      // Fill row data (column index matches tableHeaders)
      doc.setFont(PDF_FONT_FAMILY, 'normal');
      textInFormTableCell(
        doc,
        formTableCellAt(colBounds, 0),
        rowY + 5,
        (index + 1).toString(),
        {
          visual: false,
        }
      );
      textInFormTableCell(
        doc,
        formTableCellAt(colBounds, 1),
        rowY + 5,
        item.productId.substring(0, 20)
      );
      textInFormTableCell(
        doc,
        formTableCellAt(colBounds, 2),
        rowY + 5,
        productNameForPdf(item.productId, productNamesById)
      );
      textInFormTableCell(
        doc,
        formTableCellAt(colBounds, 3),
        rowY + 5,
        item.quantity.toString(),
        {
          visual: false,
        }
      );
      textInFormTableCell(
        doc,
        formTableCellAt(colBounds, 4),
        rowY + 5,
        serialColumnForPdf(item),
        { visual: false }
      );
    });

    // Fill remaining empty rows (up to 5 total)
    const maxRows = 5;
    for (let i = form.items.length; i < maxRows; i++) {
      const rowY = tableStartY + rowHeight * (i + 1);
      doc.rect(FORM_TABLE_LEFT, rowY, 180, rowHeight);
    }

    // Approval Section
    const approvalY = tableStartY + rowHeight * (maxRows + 2);
    doc.rect(15, approvalY, 180, 40);

    doc.setFont(PDF_FONT_FAMILY, 'bold');
    doc.setFontSize(10);
    textSectionTitleRtl(doc, 'אישורים:', approvalY + 10);

    doc.setFont(PDF_FONT_FAMILY, 'normal');
    doc.setFontSize(9);

    // Status information
    if (form.approvedAtTimestamp && form.approvedByUserId) {
      doc.text(
        v(`מאושר על ידי: ${form.approvedByUserId}`),
        FORM_INNER_RIGHT,
        approvalY + 20,
        { align: 'right' }
      );
      textHebrewLabelThenLtrFromRight(
        doc,
        'תאריך אישור: ',
        new Date(form.approvedAtTimestamp).toLocaleDateString('he-IL'),
        FORM_INNER_RIGHT,
        approvalY + 30
      );
    } else if (form.rejectionReason) {
      doc.text(v('סטטוס: נדחה'), FORM_INNER_RIGHT, approvalY + 20, {
        align: 'right',
      });
      doc.text(
        v(`סיבה: ${form.rejectionReason}`),
        FORM_INNER_RIGHT,
        approvalY + 30,
        { align: 'right' }
      );
    } else {
      doc.text(v('סטטוס: ממתין לאישור'), FORM_INNER_RIGHT, approvalY + 20, {
        align: 'right',
      });
    }

    // Signatures: recipient (מקבל) on the right, commander (מפקד) on the left — RTL inside each box
    const sigY = approvalY + 50;
    const leftBoxInnerRight = 98;
    const rightBoxInnerRight = FORM_INNER_RIGHT;
    doc.rect(15, sigY, 85, 30);
    doc.rect(110, sigY, 85, 30);

    doc.setFont(PDF_FONT_FAMILY, 'bold');
    doc.text(v('חתימת מקבל:'), rightBoxInnerRight, sigY + 10, { align: 'right' });
    doc.text(v('חתימת מפקד:'), leftBoxInnerRight, sigY + 10, { align: 'right' });

    doc.setFont(PDF_FONT_FAMILY, 'normal');

    const currentDate = new Date().toLocaleDateString('he-IL');
    textHebrewLabelThenLtrFromRight(
      doc,
      'תאריך: ',
      currentDate,
      rightBoxInnerRight,
      sigY + 25
    );
    textHebrewLabelThenLtrFromRight(doc, 'תאריך: ', '', leftBoxInnerRight, sigY + 25);

    // Add signature if provided

    try {
      // Parse the data URL to extract format and base64 data
      const dataUrlMatch = signature.match(
        /^data:image\/([a-zA-Z]*);base64,(.*)$/
      );

      if (!dataUrlMatch) {
        console.warn(
          'Invalid signature format - expected data:image/[format];base64,[data]'
        );
      } else {
        const [, imageFormat, base64Data] = dataUrlMatch;

        // Validate supported formats
        const supportedFormats = ['png', 'jpeg', 'jpg', 'gif', 'webp'];
        const format = imageFormat.toLowerCase();

        if (!supportedFormats.includes(format)) {
          console.warn(
            `Unsupported image format: ${imageFormat}. Supported formats: ${supportedFormats.join(
              ', '
            )}`
          );
        } else {
          // Convert format for jsPDF (it expects 'JPEG' not 'JPG')
          const pdfFormat = format === 'jpg' ? 'JPEG' : format.toUpperCase();

          doc.addImage(base64Data, pdfFormat, 125, sigY + 12, 30, 10);

          console.log(`Successfully added ${imageFormat} signature to PDF`);
        }
      }
    } catch (error) {
      console.warn('Failed to add signature to PDF:', error);
      // Optionally, you could add a text placeholder instead
      // doc.setFontSize(8);
      // doc.text('[Signature could not be rendered]', 45, sigY + 17);
    }

    // Footer: page left, form id center, generated-at right (no overlap)
    doc.setFontSize(7);
    doc.setFont(PDF_FONT_FAMILY, 'normal');
    doc.text(v('עמוד 1 מתוך 1'), FORM_INNER_LEFT, 280, { align: 'left' });
    doc.text(v(`מס טופס: ${form.formID}`), 105, 280, { align: 'center' });
    textHebrewLabelThenLtrFromRight(
      doc,
      'נוצר בתאריך: ',
      new Date().toLocaleString('he-IL'),
      FORM_INNER_RIGHT,
      280
    );

    // Return PDF as buffer
    return Buffer.from(doc.output('arraybuffer'));
  }

  /**
   * Generates a check-in event PDF (return / החזרה).
   * Matches the same 1008-style Hebrew form with "החזרה" checked and a reference to the source check-out form.
   */
  static generateCheckInEventPdf(
    form: InventoryForm,
    event: CheckInEvent,
    userData: User,
    signature: string,
    productNamesById: Readonly<Record<string, string>> = {}
  ): Buffer {
    const doc = new jsPDF();
    registerHebrewPdfFont(doc);

    // Top border
    doc.rect(10, 10, 190, 277);

    drawForm1008Header(doc, event.checkInEventId.substring(0, 15));

    // Form type — mark החזרה (return)
    doc.rect(15, 40, 180, 15);
    drawFormTypeRow(doc, 'checkin');

    // Source form reference
    doc.rect(15, 58, 180, 10);
    doc.setFontSize(9);
    doc.setFont(PDF_FONT_FAMILY, 'normal');
    doc.text(v(`מס טופס מקור: ${form.formID}`), FORM_INNER_RIGHT, 65, {
      align: 'right',
    });

    // Personal Details
    doc.rect(15, 72, 180, 40);
    drawPersonalDetailsBlock(doc, userData, 82, 92, 102);

    // Equipment table (same RTL columns as checkout PDF)
    doc.setFont(PDF_FONT_FAMILY, 'bold');
    doc.setFontSize(10);
    textSectionTitleRtl(doc, 'רשימת ציוד המוחזר:', 128);

    const tableStartY = 133;
    const rowHeight = 8;
    const colBounds = getFormTableRtlColumnBounds();
    const tableHeaders = [
      'מס',
      'קוד פריט',
      'תיאור',
      'כמות',
      'מס סידורי',
    ];

    doc.rect(FORM_TABLE_LEFT, tableStartY, 180, rowHeight);
    for (const lineX of getFormTableInnerVerticalLineXs()) {
      doc.line(lineX, tableStartY, lineX, tableStartY + rowHeight * 6);
    }

    doc.setFontSize(8);
    tableHeaders.forEach((h, i) => {
      textInFormTableCell(doc, formTableCellAt(colBounds, i), tableStartY + 5, h);
    });

    event.items.forEach((item, index) => {
      const rowY = tableStartY + rowHeight * (index + 1);
      doc.rect(FORM_TABLE_LEFT, rowY, 180, rowHeight);
      doc.setFont(PDF_FONT_FAMILY, 'normal');
      textInFormTableCell(
        doc,
        formTableCellAt(colBounds, 0),
        rowY + 5,
        (index + 1).toString(),
        {
          visual: false,
        }
      );
      textInFormTableCell(
        doc,
        formTableCellAt(colBounds, 1),
        rowY + 5,
        item.productId.substring(0, 20)
      );
      textInFormTableCell(
        doc,
        formTableCellAt(colBounds, 2),
        rowY + 5,
        productNameForPdf(item.productId, productNamesById)
      );
      textInFormTableCell(
        doc,
        formTableCellAt(colBounds, 3),
        rowY + 5,
        item.quantity.toString(),
        {
          visual: false,
        }
      );
      textInFormTableCell(
        doc,
        formTableCellAt(colBounds, 4),
        rowY + 5,
        serialColumnForPdf(item),
        { visual: false }
      );
    });

    const maxRows = 5;
    for (let i = event.items.length; i < maxRows; i++) {
      const rowY = tableStartY + rowHeight * (i + 1);
      doc.rect(FORM_TABLE_LEFT, rowY, 180, rowHeight);
    }

    // Approval section
    const approvalY = tableStartY + rowHeight * (maxRows + 2);
    doc.rect(15, approvalY, 180, 30);
    doc.setFont(PDF_FONT_FAMILY, 'bold');
    doc.setFontSize(10);
    textSectionTitleRtl(doc, 'אישורים:', approvalY + 10);
    doc.setFont(PDF_FONT_FAMILY, 'normal');
    doc.setFontSize(9);
    doc.text(
      v(`מאושר על ידי: ${event.createdByUserId}`),
      FORM_INNER_RIGHT,
      approvalY + 20,
      { align: 'right' }
    );
    textHebrewLabelThenLtrFromRight(
      doc,
      'תאריך: ',
      new Date(event.createdAtTimestamp).toLocaleDateString('he-IL'),
      FORM_INNER_RIGHT,
      approvalY + 28
    );

    // Signature — מחזיר (right), מחסנאי (left)
    const sigY = approvalY + 40;
    const leftBoxInnerRight = 98;
    const rightBoxInnerRight = FORM_INNER_RIGHT;
    doc.rect(15, sigY, 85, 30);
    doc.rect(110, sigY, 85, 30);
    doc.setFont(PDF_FONT_FAMILY, 'bold');
    doc.text(v('חתימת מחזיר:'), rightBoxInnerRight, sigY + 10, { align: 'right' });
    doc.text(v('חתימת מחסנאי:'), leftBoxInnerRight, sigY + 10, { align: 'right' });
    doc.setFont(PDF_FONT_FAMILY, 'normal');
    const nowDate = new Date().toLocaleDateString('he-IL');
    textHebrewLabelThenLtrFromRight(
      doc,
      'תאריך: ',
      nowDate,
      rightBoxInnerRight,
      sigY + 25
    );
    textHebrewLabelThenLtrFromRight(doc, 'תאריך: ', '', leftBoxInnerRight, sigY + 25);

    try {
      const dataUrlMatch = signature.match(/^data:image\/([a-zA-Z]*);base64,(.*)$/);
      if (dataUrlMatch) {
        const [, imageFormat, base64Data] = dataUrlMatch;
        const supportedFormats = ['png', 'jpeg', 'jpg', 'gif', 'webp'];
        const format = imageFormat.toLowerCase();
        if (supportedFormats.includes(format)) {
          const pdfFormat = format === 'jpg' ? 'JPEG' : format.toUpperCase();
          doc.addImage(base64Data, pdfFormat, 125, sigY + 12, 30, 10);
        }
      }
    } catch (error) {
      console.warn('Failed to add signature to check-in PDF:', error);
    }

    // Footer
    doc.setFontSize(7);
    doc.setFont(PDF_FONT_FAMILY, 'normal');
    doc.text(v('עמוד 1 מתוך 1'), FORM_INNER_LEFT, 280, { align: 'left' });
    doc.text(v(`מס אירוע: ${event.checkInEventId}`), 105, 280, { align: 'center' });
    textHebrewLabelThenLtrFromRight(
      doc,
      'נוצר בתאריך: ',
      new Date().toLocaleString('he-IL'),
      FORM_INNER_RIGHT,
      280
    );

    return Buffer.from(doc.output('arraybuffer'));
  }
}

