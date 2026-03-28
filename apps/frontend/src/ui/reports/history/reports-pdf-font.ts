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
