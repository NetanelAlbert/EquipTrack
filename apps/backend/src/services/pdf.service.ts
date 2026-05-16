import * as fs from 'fs';
import * as path from 'path';
import { jsPDF } from 'jspdf';
import { CheckInEvent, InventoryForm, User, toVisualOrder } from '@equip-track/shared';

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

/**
 * Renders a Hebrew label (with {@link v}) then LTR content (locale dates, ISO
 * timestamps) without merging into {@link v}, which would scramble digit order.
 */
function textHebrewLabelThenLtr(
  doc: jsPDF,
  hebrewLabelLogical: string,
  ltrRest: string,
  x: number,
  y: number,
  gapPt = 2
): void {
  const prefix = v(hebrewLabelLogical);
  doc.text(prefix, x, y);
  if (!ltrRest) {
    return;
  }
  const w = doc.getTextWidth(prefix);
  doc.text(ltrRest, x + w + gapPt, y);
}

export class PdfService {
  /**
   * Generates a PDF for the 1008 form based on the provided form data and user information
   * Matches the Hebrew form structure from the original document
   */
  static generateFormPDF(
    form: InventoryForm,
    userData: User,
    signature: string
  ): Buffer {
    const doc = new jsPDF();
    registerHebrewPdfFont(doc);

    // Header Section
    doc.setFontSize(14);
    doc.setFont(PDF_FONT_FAMILY, 'bold');

    // Top border
    doc.rect(10, 10, 190, 277);

    // Header boxes
    doc.rect(15, 15, 50, 20); // Left header box
    doc.rect(75, 15, 60, 20); // Center header box
    doc.rect(145, 15, 50, 20); // Right header box

    // Header text
    doc.setFontSize(10);
    doc.setFont(PDF_FONT_FAMILY, 'normal');
    doc.text(v('מודפס במ"פ'), 17, 22);
    doc.text(v('תאריך'), 17, 30);

    doc.setFontSize(12);
    doc.setFont(PDF_FONT_FAMILY, 'bold');
    doc.text(v('טופס הוצאה/החזרה'), 85, 22);
    doc.text('Form 1008', 85, 30);

    doc.setFontSize(10);
    doc.text(v('מס טופס'), 147, 22);
    doc.text(form.formID.toString(), 147, 30);

    // Form Type Section
    doc.rect(15, 40, 180, 15);
    doc.setFontSize(10);
    doc.setFont(PDF_FONT_FAMILY, 'bold');
    doc.text(v('סוג הטופס:'), 20, 50);

    // Checkboxes for form type — always check-out (הוצאה)
    doc.rect(45, 46, 4, 4);
    doc.rect(85, 46, 4, 4);
    doc.text('X', 46.5, 49.5);

    doc.setFont(PDF_FONT_FAMILY, 'normal');
    doc.text(v('הוצאה'), 52, 50);
    doc.text(v('החזרה'), 92, 50);

    // Personal Details Section
    doc.rect(15, 60, 180, 40);
    doc.setFont(PDF_FONT_FAMILY, 'bold');
    doc.text(v('פרטים אישיים:'), 20, 70);

    doc.setFont(PDF_FONT_FAMILY, 'normal');
    doc.setFontSize(9);

    // Name field
    doc.text(v('שם:'), 20, 80);
    doc.line(35, 80, 95, 80);
    doc.text(v(userData.name || ''), 37, 79);

    // ID field
    doc.text(v('מס אישי:'), 100, 80);
    doc.line(120, 80, 180, 80);
    doc.text(v(userData.id || ''), 122, 79);

    // Unit field
    doc.text(v('יחידה:'), 20, 90);
    doc.line(35, 90, 95, 90);
    doc.text(v(userData.email || ''), 37, 89);

    // Phone field
    doc.text(v('טלפון:'), 100, 90);
    doc.line(120, 90, 180, 90);
    doc.text(v(userData.phone || ''), 122, 89);

    // Equipment Table Section
    doc.setFont(PDF_FONT_FAMILY, 'bold');
    doc.setFontSize(10);
    doc.text(v('רשימת ציוד:'), 20, 115);

    // Table headers
    const tableStartY = 120;
    const rowHeight = 8;
    const colStarts = [15, 30, 70, 95, 130, 155, 190];

    // Draw table borders and headers
    doc.rect(15, tableStartY, 180, rowHeight); // Header row

    // Vertical lines for columns
    for (let i = 0; i < colStarts.length; i++) {
      doc.line(
        colStarts[i],
        tableStartY,
        colStarts[i],
        tableStartY + rowHeight * 6
      );
    }

    // Header text
    doc.setFontSize(8);
    doc.text(v('מס'), 17, tableStartY + 5);
    doc.text(v('קוד פריט'), 32, tableStartY + 5);
    doc.text(v('תיאור'), 72, tableStartY + 5);
    doc.text(v('כמות'), 97, tableStartY + 5);
    doc.text(v('מס סידורי'), 132, tableStartY + 5);
    doc.text(v('מצב'), 157, tableStartY + 5);
    doc.text(v('הערות'), 192, tableStartY + 5);

    // Table rows for items
    form.items.forEach((item, index) => {
      const rowY = tableStartY + rowHeight * (index + 1);

      // Draw row border
      doc.rect(15, rowY, 180, rowHeight);

      // Fill row data
      doc.setFont(PDF_FONT_FAMILY, 'normal');
      doc.text((index + 1).toString(), 17, rowY + 5);
      doc.text(v(item.productId.substring(0, 15)), 32, rowY + 5);
      doc.text('', 72, rowY + 5); // Description - empty for now
      doc.text(item.quantity.toString(), 97, rowY + 5);
      doc.text(
        v(item.upis ? item.upis.join(',').substring(0, 10) : ''),
        132,
        rowY + 5
      );
      doc.text('', 157, rowY + 5); // Condition - empty
      doc.text('', 192, rowY + 5); // Remarks - empty
    });

    // Fill remaining empty rows (up to 5 total)
    const maxRows = 5;
    for (let i = form.items.length; i < maxRows; i++) {
      const rowY = tableStartY + rowHeight * (i + 1);
      doc.rect(15, rowY, 180, rowHeight);
    }

    // Approval Section
    const approvalY = tableStartY + rowHeight * (maxRows + 2);
    doc.rect(15, approvalY, 180, 40);

    doc.setFont(PDF_FONT_FAMILY, 'bold');
    doc.setFontSize(10);
    doc.text(v('אישורים:'), 20, approvalY + 10);

    doc.setFont(PDF_FONT_FAMILY, 'normal');
    doc.setFontSize(9);

    // Status information
    if (form.approvedAtTimestamp && form.approvedByUserId) {
      doc.text(
        v(`מאושר על ידי: ${form.approvedByUserId}`),
        20,
        approvalY + 20
      );
      textHebrewLabelThenLtr(
        doc,
        'תאריך אישור: ',
        new Date(form.approvedAtTimestamp).toLocaleDateString('he-IL'),
        20,
        approvalY + 30
      );
    } else if (form.rejectionReason) {
      doc.text(v('סטטוס: נדחה'), 20, approvalY + 20);
      doc.text(v(`סיבה: ${form.rejectionReason}`), 20, approvalY + 30);
    } else {
      doc.text(v('סטטוס: ממתין לאישור'), 20, approvalY + 20);
    }

    // Signatures Section
    const sigY = approvalY + 50;
    doc.rect(15, sigY, 85, 30); // Employee signature box
    doc.rect(110, sigY, 85, 30); // Supervisor signature box

    doc.setFont(PDF_FONT_FAMILY, 'bold');
    doc.text(v('חתימת מקבל:'), 20, sigY + 10);
    doc.text(v('חתימת מפקד:'), 115, sigY + 10);

    doc.setFont(PDF_FONT_FAMILY, 'normal');
    doc.text(v('תאריך:'), 20, sigY + 25);
    doc.text(v('תאריך:'), 115, sigY + 25);

    // Add current date (locale string is LTR digits; avoid v() so digit order stays correct)
    const currentDate = new Date().toLocaleDateString('he-IL');
    doc.text(currentDate, 35, sigY + 25);

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

          // Add the image using the parsed data
          doc.addImage(base64Data, pdfFormat, 45, sigY + 12, 30, 10);

          console.log(`Successfully added ${imageFormat} signature to PDF`);
        }
      }
    } catch (error) {
      console.warn('Failed to add signature to PDF:', error);
      // Optionally, you could add a text placeholder instead
      // doc.setFontSize(8);
      // doc.text('[Signature could not be rendered]', 45, sigY + 17);
    }

    // Footer
    doc.setFontSize(7);
    doc.setFont(PDF_FONT_FAMILY, 'normal');
    textHebrewLabelThenLtr(
      doc,
      'נוצר בתאריך: ',
      new Date().toLocaleString('he-IL'),
      20,
      280
    );
    doc.text(v(`מס טופס: ${form.formID}`), 105, 280, { align: 'center' });
    doc.text(v('עמוד 1 מתוך 1'), 170, 280);

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
    signature: string
  ): Buffer {
    const doc = new jsPDF();
    registerHebrewPdfFont(doc);

    // Top border
    doc.rect(10, 10, 190, 277);

    // Header boxes
    doc.rect(15, 15, 50, 20);
    doc.rect(75, 15, 60, 20);
    doc.rect(145, 15, 50, 20);

    doc.setFontSize(10);
    doc.setFont(PDF_FONT_FAMILY, 'normal');
    doc.text(v('מודפס במ"פ'), 17, 22);
    doc.text(v('תאריך'), 17, 30);

    doc.setFontSize(12);
    doc.setFont(PDF_FONT_FAMILY, 'bold');
    doc.text(v('טופס הוצאה/החזרה'), 85, 22);
    doc.text('Form 1008', 85, 30);

    doc.setFontSize(10);
    doc.setFont(PDF_FONT_FAMILY, 'normal');
    doc.text(v('מס טופס'), 147, 22);
    doc.text(event.checkInEventId.substring(0, 15), 147, 30);

    // Form type — mark החזרה (return)
    doc.rect(15, 40, 180, 15);
    doc.setFontSize(10);
    doc.setFont(PDF_FONT_FAMILY, 'bold');
    doc.text(v('סוג הטופס:'), 20, 50);

    doc.rect(45, 46, 4, 4); // הוצאה checkbox
    doc.rect(85, 46, 4, 4); // החזרה checkbox
    doc.text('X', 86.5, 49.5); // mark החזרה
    doc.setFont(PDF_FONT_FAMILY, 'normal');
    doc.text(v('הוצאה'), 52, 50);
    doc.text(v('החזרה'), 92, 50);

    // Source form reference
    doc.rect(15, 58, 180, 10);
    doc.setFontSize(9);
    doc.text(v(`מס טופס מקור: ${form.formID}`), 17, 65);

    // Personal Details
    doc.rect(15, 72, 180, 40);
    doc.setFont(PDF_FONT_FAMILY, 'bold');
    doc.setFontSize(10);
    doc.text(v('פרטים אישיים:'), 20, 82);

    doc.setFont(PDF_FONT_FAMILY, 'normal');
    doc.setFontSize(9);
    doc.text(v('שם:'), 20, 92);
    doc.line(35, 92, 95, 92);
    doc.text(v(userData.name || ''), 37, 91);

    doc.text(v('מס אישי:'), 100, 92);
    doc.line(120, 92, 180, 92);
    doc.text(v(userData.id || ''), 122, 91);

    doc.text(v('יחידה:'), 20, 102);
    doc.line(35, 102, 95, 102);
    doc.text(v(userData.email || ''), 37, 101);

    doc.text(v('טלפון:'), 100, 102);
    doc.line(120, 102, 180, 102);
    doc.text(v(userData.phone || ''), 122, 101);

    // Equipment table
    doc.setFont(PDF_FONT_FAMILY, 'bold');
    doc.setFontSize(10);
    doc.text(v('רשימת ציוד המוחזר:'), 20, 128);

    const tableStartY = 133;
    const rowHeight = 8;
    const colStarts = [15, 30, 70, 95, 130, 155, 190];

    doc.rect(15, tableStartY, 180, rowHeight);
    for (let i = 0; i < colStarts.length; i++) {
      doc.line(colStarts[i], tableStartY, colStarts[i], tableStartY + rowHeight * 6);
    }

    doc.setFontSize(8);
    doc.text(v('מס'), 17, tableStartY + 5);
    doc.text(v('קוד פריט'), 32, tableStartY + 5);
    doc.text(v('תיאור'), 72, tableStartY + 5);
    doc.text(v('כמות'), 97, tableStartY + 5);
    doc.text(v('מס סידורי'), 132, tableStartY + 5);
    doc.text(v('מצב'), 157, tableStartY + 5);
    doc.text(v('הערות'), 192, tableStartY + 5);

    event.items.forEach((item, index) => {
      const rowY = tableStartY + rowHeight * (index + 1);
      doc.rect(15, rowY, 180, rowHeight);
      doc.setFont(PDF_FONT_FAMILY, 'normal');
      doc.text((index + 1).toString(), 17, rowY + 5);
      doc.text(v(item.productId.substring(0, 15)), 32, rowY + 5);
      doc.text('', 72, rowY + 5);
      doc.text(item.quantity.toString(), 97, rowY + 5);
      doc.text(
        v(item.upis ? item.upis.join(',').substring(0, 10) : ''),
        132,
        rowY + 5
      );
      doc.text('', 157, rowY + 5);
      doc.text('', 192, rowY + 5);
    });

    const maxRows = 5;
    for (let i = event.items.length; i < maxRows; i++) {
      const rowY = tableStartY + rowHeight * (i + 1);
      doc.rect(15, rowY, 180, rowHeight);
    }

    // Approval section
    const approvalY = tableStartY + rowHeight * (maxRows + 2);
    doc.rect(15, approvalY, 180, 30);
    doc.setFont(PDF_FONT_FAMILY, 'bold');
    doc.setFontSize(10);
    doc.text(v('אישורים:'), 20, approvalY + 10);
    doc.setFont(PDF_FONT_FAMILY, 'normal');
    doc.setFontSize(9);
    doc.text(
      v(`מאושר על ידי: ${event.createdByUserId}`),
      20,
      approvalY + 20
    );
    textHebrewLabelThenLtr(
      doc,
      'תאריך: ',
      new Date(event.createdAtTimestamp).toLocaleDateString('he-IL'),
      100,
      approvalY + 20
    );

    // Signature
    const sigY = approvalY + 40;
    doc.rect(15, sigY, 85, 30);
    doc.rect(110, sigY, 85, 30);
    doc.setFont(PDF_FONT_FAMILY, 'bold');
    doc.text(v('חתימת מחזיר:'), 20, sigY + 10);
    doc.text(v('חתימת מחסנאי:'), 115, sigY + 10);
    doc.setFont(PDF_FONT_FAMILY, 'normal');
    doc.text(v('תאריך:'), 20, sigY + 25);
    doc.text(v('תאריך:'), 115, sigY + 25);
    doc.text(new Date().toLocaleDateString('he-IL'), 35, sigY + 25);

    try {
      const dataUrlMatch = signature.match(/^data:image\/([a-zA-Z]*);base64,(.*)$/);
      if (dataUrlMatch) {
        const [, imageFormat, base64Data] = dataUrlMatch;
        const supportedFormats = ['png', 'jpeg', 'jpg', 'gif', 'webp'];
        const format = imageFormat.toLowerCase();
        if (supportedFormats.includes(format)) {
          const pdfFormat = format === 'jpg' ? 'JPEG' : format.toUpperCase();
          doc.addImage(base64Data, pdfFormat, 45, sigY + 12, 30, 10);
        }
      }
    } catch (error) {
      console.warn('Failed to add signature to check-in PDF:', error);
    }

    // Footer
    doc.setFontSize(7);
    doc.setFont(PDF_FONT_FAMILY, 'normal');
    textHebrewLabelThenLtr(
      doc,
      'נוצר בתאריך: ',
      new Date().toLocaleString('he-IL'),
      20,
      280
    );
    doc.text(v(`מס אירוע: ${event.checkInEventId}`), 105, 280, { align: 'center' });
    doc.text(v('עמוד 1 מתוך 1'), 170, 280);

    return Buffer.from(doc.output('arraybuffer'));
  }
}
