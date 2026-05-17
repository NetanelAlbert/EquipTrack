import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync, execSync } from 'child_process';
import {
  CheckInEvent,
  FormStatus,
  FormType,
  InventoryForm,
  User,
  UserState,
} from '@equip-track/shared';
import type { PdfUserContext } from './pdf-user-context';
import { PdfService } from './pdf.service';

function pdftotextAvailable(): boolean {
  try {
    execSync('pdftotext -v', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const pdfTextExtractAvailable = pdftotextAvailable();
const itPdftotext = pdfTextExtractAvailable ? it : it.skip;

function pdftotextUtf8(buf: Buffer): string {
  const tmp = path.join(
    os.tmpdir(),
    `equiptrack-pdf-${process.pid}-${Date.now()}.pdf`
  );
  fs.writeFileSync(tmp, new Uint8Array(buf));
  try {
    return execFileSync('pdftotext', ['-layout', tmp, '-'], {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
  } finally {
    fs.unlinkSync(tmp);
  }
}

describe('PdfService', () => {
  const minimalUser: User = {
    id: 'user-1',
    name: 'ישראל ישראלי',
    email: 'user@example.com',
    phone: '050-0000000',
    state: UserState.Active,
  };

  const minimalCtx: PdfUserContext = {
    userNamesById: {},
    holderUnitName: undefined,
  };

  const productNames = {
    'prod-bulk-helmet': 'קסדת בטיחות',
    'prod-upi-laptop': 'מחשב נייד',
    'prod-mixed': 'Helmet קסדה M-15',
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
      productNames,
      minimalCtx
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
      productNames,
      minimalCtx
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
      checkInEventId: 'cie-test-event-full-id-xyz',
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
      productNames,
      minimalCtx
    );
    expect(buf.toString('latin1')).toContain('NotoSansHebrew');
  });

  it('does not interpolate dynamic segments inside visual-order helpers', () => {
    const src = fs.readFileSync(
      path.join(__dirname, 'pdf.service.ts'),
      'utf8'
    );
    expect(src).not.toMatch(/\bv\s*\(\s*`[^`]*\$\{/);
    expect(src).not.toContain('toVisualOrder');
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
      productNames,
      minimalCtx
    );
    fs.writeFileSync(out, new Uint8Array(buf));
  });

  describe('pdftotext Hebrew regressions (#195)', () => {
    const phrasesCheckout = [
      'מאושר על ידי',
      'מס טופס',
      'פרטים אישיים',
      'אישורים',
      'יחידה',
      'חתימת מקבל',
    ];

    const phrasesCheckinExtra = ['מס טופס מקור', 'מס אירוע', 'חתימת מחזיר'];

    itPdftotext('checkout PDF exposes canonical Hebrew fragments (logical order)', () => {
      const approvedForm: InventoryForm = {
        ...baseForm,
        status: FormStatus.Approved,
        approvedAtTimestamp: Date.now(),
        approvedByUserId: 'approver-1',
      };
      const ctx: PdfUserContext = {
        holderUnitName: 'מחלקת תפעול',
        userNamesById: { 'approver-1': 'שרה כהן' },
      };
      const buf = PdfService.generateFormPDF(
        approvedForm,
        minimalUser,
        '',
        productNames,
        ctx
      );
      const txt = pdftotextUtf8(buf);
      for (const phrase of phrasesCheckout) {
        expect(txt).toContain(phrase);
      }
      expect(txt).not.toContain('רוקמ ספוט סמ');
      expect(txt).toContain('שרה כהן');
      expect(txt).toContain('טופס הוצאה');
      expect(txt).not.toContain('טופס החזרה');
    });

    itPdftotext('check-in PDF exposes canonical Hebrew fragments (logical order)', () => {
      const eventId = 'cie-mp9ywzwv-4b8s6a1d';
      const event: CheckInEvent = {
        checkInEventId: eventId,
        items: [{ productId: 'prod-bulk-helmet', quantity: 1 }],
        createdAtTimestamp: Date.now(),
        createdByUserId: 'wm-77',
      };
      const ctx: PdfUserContext = {
        holderUnitName: 'יחידה א',
        userNamesById: { 'wm-77': 'מנהל מחסן' },
      };
      const buf = PdfService.generateCheckInEventPdf(
        baseForm,
        event,
        minimalUser,
        '',
        productNames,
        ctx
      );
      const txt = pdftotextUtf8(buf);
      for (const phrase of [...phrasesCheckout, ...phrasesCheckinExtra]) {
        if (phrase === 'חתימת מקבל') {
          continue;
        }
        expect(txt).toContain(phrase);
      }
      expect(txt).toContain('חתימת מחזיר');
      expect(txt).toContain('מאושר על ידי');
      expect(txt).toContain('מס טופס מקור');
      expect(txt).not.toContain('רוקמ ספוט סמ');
      expect(txt).not.toContain('ידי לע רשואמ');
      expect(txt).toContain(eventId);
      expect(txt.match(new RegExp(eventId, 'g'))?.length ?? 0).toBeGreaterThanOrEqual(
        2
      );
      expect(txt).toContain('טופס החזרה');
    });

    itPdftotext('mixed Hebrew–Latin product descriptions extract logically', () => {
      const formMixed: InventoryForm = {
        ...baseForm,
        items: [{ productId: 'prod-mixed', quantity: 1 }],
      };
      const buf = PdfService.generateFormPDF(
        formMixed,
        minimalUser,
        '',
        productNames,
        minimalCtx
      );
      const txt = pdftotextUtf8(buf);
      expect(txt).toContain('Helmet');
      expect(txt).toContain('קסדה');
      expect(txt).toContain('M-15');
    });

    itPdftotext('omits טלפון label when phone is unset', () => {
      const userNoPhone: User = {
        ...minimalUser,
        phone: undefined,
      };
      const buf = PdfService.generateFormPDF(
        baseForm,
        userNoPhone,
        '',
        productNames,
        minimalCtx
      );
      const txt = pdftotextUtf8(buf);
      expect(txt).not.toContain('טלפון');
    });

    itPdftotext('falls back to raw user id when approver name is unknown', () => {
      const approvedForm: InventoryForm = {
        ...baseForm,
        status: FormStatus.Approved,
        approvedAtTimestamp: Date.now(),
        approvedByUserId: 'unknown-id-zzz',
      };
      const buf = PdfService.generateFormPDF(
        approvedForm,
        minimalUser,
        '',
        productNames,
        { userNamesById: {}, holderUnitName: undefined }
      );
      const txt = pdftotextUtf8(buf);
      expect(txt).toContain('unknown-id-zzz');
    });
  });
});
