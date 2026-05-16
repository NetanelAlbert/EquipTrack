import * as fs from 'fs';
import {
  CheckInEvent,
  FormStatus,
  FormType,
  InventoryForm,
  User,
  UserState,
} from '@equip-track/shared';
import { PdfService } from './pdf.service';

describe('PdfService', () => {
  const minimalUser: User = {
    id: 'user-1',
    name: 'ישראל ישראלי',
    email: 'user@example.com',
    phone: '050-0000000',
    state: UserState.Active,
  };

  const productNames = {
    'prod-bulk-helmet': 'קסדת בטיחות',
    'prod-upi-laptop': 'מחשב נייד',
  };

  const laptopUpis = Array.from(
    { length: 10 },
    (_, i) => `LAP-WH-${String(i + 1).padStart(3, '0')}`
  );

  const baseForm: InventoryForm = {
    userID: 'user-1',
    formID: 'form-abc',
    organizationID: 'org-1',
    items: [
      { productId: 'prod-bulk-helmet', quantity: 2 },
      {
        productId: 'prod-upi-laptop',
        quantity: 10,
        upis: laptopUpis,
      },
    ],
    type: FormType.CheckOut,
    status: FormStatus.Pending,
    createdAtTimestamp: Date.now(),
    lastUpdated: Date.now(),
  };

  it('embeds NotoSansHebrew and produces a valid PDF buffer', () => {
    const buf = PdfService.generateFormPDF(
      baseForm,
      minimalUser,
      '',
      productNames
    );
    expect(buf.subarray(0, 4).toString('utf8')).toBe('%PDF');
    const latin1 = buf.toString('latin1');
    expect(latin1).toContain('NotoSansHebrew');
    expect(latin1).toMatch(/Type0|CIDFontType2/);
  });

  it('embeds Unicode Hebrew glyph data in the PDF (not empty Helvetica labels)', () => {
    const buf = PdfService.generateFormPDF(
      baseForm,
      minimalUser,
      '',
      productNames
    );
    const hasHebrewUtf16Be = buf.some(
      (b, i) =>
        b === 0x05 &&
        i + 1 < buf.length &&
        buf[i + 1] >= 0x90 &&
        buf[i + 1] <= 0xff
    );
    expect(hasHebrewUtf16Be).toBe(true);
  });

  it('generateCheckInEventPdf also registers the Hebrew font', () => {
    const event: CheckInEvent = {
      checkInEventId: 'cie-1',
      items: [
        { productId: 'prod-bulk-helmet', quantity: 1 },
        {
          productId: 'prod-upi-laptop',
          quantity: 10,
          upis: laptopUpis,
        },
      ],
      createdAtTimestamp: Date.now(),
      createdByUserId: 'wm-1',
    };
    const buf = PdfService.generateCheckInEventPdf(
      baseForm,
      event,
      minimalUser,
      '',
      productNames
    );
    expect(buf.toString('latin1')).toContain('NotoSansHebrew');
  });

  it('writes a sample PDF when PDF_VERIFY_OUT is set (for pdftotext manual check)', () => {
    const out = process.env['PDF_VERIFY_OUT'];
    if (!out) {
      return;
    }
    const buf = PdfService.generateFormPDF(
      {
        ...baseForm,
        status: FormStatus.Rejected,
        rejectionReason: 'דוגמה לסיבת דחייה',
      },
      { ...minimalUser, name: 'בדיקת עברית למסמך' },
      '',
      productNames
    );
    fs.writeFileSync(out, new Uint8Array(buf));
  });
});
