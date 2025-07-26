import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { InventoryForm, User, FormType } from '@equip-track/shared';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
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

    // Set font for Hebrew support (using helvetica as fallback)
    doc.setFont('helvetica');

    // Header Section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');

    // Top border
    doc.rect(10, 10, 190, 277);

    // Header boxes
    doc.rect(15, 15, 50, 20); // Left header box
    doc.rect(75, 15, 60, 20); // Center header box
    doc.rect(145, 15, 50, 20); // Right header box

    // Header text
    doc.setFontSize(10);
    doc.text('מודפס במ"פ', 17, 22);
    doc.text('תאריך', 17, 30);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('טופס הוצאה/החזרה', 85, 22);
    doc.text('Form 1008', 85, 30);

    doc.setFontSize(10);
    doc.text('מס טופס', 147, 22);
    doc.text(form.formID.toString(), 147, 30);

    // Form Type Section
    doc.rect(15, 40, 180, 15);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('סוג הטופס:', 20, 50);

    const isCheckout = form.type === FormType.CheckOut;
    const isCheckin = form.type === FormType.CheckIn;

    // Checkboxes for form type
    doc.rect(45, 46, 4, 4);
    doc.rect(85, 46, 4, 4);

    if (isCheckout) {
      doc.text('X', 46.5, 49.5);
    }
    if (isCheckin) {
      doc.text('X', 86.5, 49.5);
    }

    doc.setFont('helvetica', 'normal');
    doc.text('הוצאה', 52, 50);
    doc.text('החזרה', 92, 50);

    // Personal Details Section
    doc.rect(15, 60, 180, 40);
    doc.setFont('helvetica', 'bold');
    doc.text('פרטים אישיים:', 20, 70);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    // Name field
    doc.text('שם:', 20, 80);
    doc.line(35, 80, 95, 80);
    doc.text(userData.name || '', 37, 79);

    // ID field
    doc.text('מס אישי:', 100, 80);
    doc.line(120, 80, 180, 80);
    doc.text(userData.id || '', 122, 79);

    // Unit field
    doc.text('יחידה:', 20, 90);
    doc.line(35, 90, 95, 90);
    doc.text(userData.email || '', 37, 89);

    // Phone field
    doc.text('טלפון:', 100, 90);
    doc.line(120, 90, 180, 90);
    doc.text(userData.phone || '', 122, 89);

    // Equipment Table Section
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('רשימת ציוד:', 20, 115);

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
    doc.text('מס', 17, tableStartY + 5);
    doc.text('קוד פריט', 32, tableStartY + 5);
    doc.text('תיאור', 72, tableStartY + 5);
    doc.text('כמות', 97, tableStartY + 5);
    doc.text('מס סידורי', 132, tableStartY + 5);
    doc.text('מצב', 157, tableStartY + 5);
    doc.text('הערות', 192, tableStartY + 5);

    // Table rows for items
    form.items.forEach((item, index) => {
      const rowY = tableStartY + rowHeight * (index + 1);

      // Draw row border
      doc.rect(15, rowY, 180, rowHeight);

      // Fill row data
      doc.setFont('helvetica', 'normal');
      doc.text((index + 1).toString(), 17, rowY + 5);
      doc.text(item.productId.substring(0, 15), 32, rowY + 5);
      doc.text('', 72, rowY + 5); // Description - empty for now
      doc.text(item.quantity.toString(), 97, rowY + 5);
      doc.text(
        item.upis ? item.upis.join(',').substring(0, 10) : '',
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

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('אישורים:', 20, approvalY + 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    // Status information
    if (form.approvedAtTimestamp && form.approvedByUserId) {
      doc.text(`מאושר על ידי: ${form.approvedByUserId}`, 20, approvalY + 20);
      doc.text(
        `תאריך אישור: ${new Date(form.approvedAtTimestamp).toLocaleDateString(
          'he-IL'
        )}`,
        20,
        approvalY + 30
      );
    } else if (form.rejectionReason) {
      doc.text('סטטוס: נדחה', 20, approvalY + 20);
      doc.text(`סיבה: ${form.rejectionReason}`, 20, approvalY + 30);
    } else {
      doc.text('סטטוס: ממתין לאישור', 20, approvalY + 20);
    }

    // Signatures Section
    const sigY = approvalY + 50;
    doc.rect(15, sigY, 85, 30); // Employee signature box
    doc.rect(110, sigY, 85, 30); // Supervisor signature box

    doc.setFont('helvetica', 'bold');
    doc.text('חתימת מקבל:', 20, sigY + 10);
    doc.text('חתימת מפקד:', 115, sigY + 10);

    doc.setFont('helvetica', 'normal');
    doc.text('תאריך:', 20, sigY + 25);
    doc.text('תאריך:', 115, sigY + 25);

    // Add current date
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
    doc.setFont('helvetica', 'italic');
    doc.text(`נוצר בתאריך: ${new Date().toLocaleString('he-IL')}`, 20, 280);
    doc.text(`מס טופס: ${form.formID}`, 105, 280, { align: 'center' });
    doc.text('עמוד 1 מתוך 1', 170, 280);

    // Return PDF as buffer
    return Buffer.from(doc.output('arraybuffer'));
  }
}
