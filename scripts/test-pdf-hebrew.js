#!/usr/bin/env node
/**
 * Manual test for Hebrew PDF export.
 *
 * Exercises the same code-path as ReportsHistoryComponent.exportPdf()
 * using the production font file, toVisualOrder(), and jspdf-autotable-rtl.
 *
 * Usage:
 *   node scripts/test-pdf-hebrew.js            # generates report-he.pdf + report-en.pdf
 *   node scripts/test-pdf-hebrew.js --open     # same, then opens in default viewer
 */

const fs = require('fs');
const path = require('path');
const { jsPDF } = require('jspdf');
const autoTable = (require('jspdf-autotable-rtl').default || require('jspdf-autotable-rtl'));

// ── production helpers (imported at runtime so we test the real code) ───────

const FONT_PATH = path.resolve(
  __dirname,
  '../apps/frontend/src/assets/fonts/NotoSansHebrew-Regular.ttf'
);
const FONT_FILE = 'NotoSansHebrew-Regular.ttf';
const FONT_FAMILY = 'NotoSansHebrew';

function registerFont(doc) {
  const fontData = fs.readFileSync(FONT_PATH);
  const bytes = new Uint8Array(fontData);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  doc.addFileToVFS(FONT_FILE, binary);
  doc.addFont(FONT_FILE, FONT_FAMILY, 'normal', 'Identity-H');
  doc.setFont(FONT_FAMILY, 'normal');
}

// ── toVisualOrder — copied at build-time is impractical, so we inline the
//    same logic.  The unit-test in reports-history.utils.spec already covers
//    the production TS version; here we just need the runtime equivalent.
// ────────────────────────────────────────────────────────────────────────────

const isRtlChar = (c) =>
  (c >= 0x0590 && c <= 0x05ff) || (c >= 0xfb1d && c <= 0xfb4f);
const isLtrChar = (c) =>
  (c >= 0x41 && c <= 0x5a) ||
  (c >= 0x61 && c <= 0x7a) ||
  (c >= 0x30 && c <= 0x39);

function toVisualOrder(text) {
  if (!text) return text;
  const chars = Array.from(text);
  let hasRtl = false;
  for (const ch of chars) {
    if (isRtlChar(ch.codePointAt(0))) { hasRtl = true; break; }
  }
  if (!hasRtl) return text;

  const types = chars.map((ch) => {
    const c = ch.codePointAt(0);
    if (isRtlChar(c)) return 'R';
    if (isLtrChar(c)) return 'L';
    return 'N';
  });
  for (let i = 0; i < types.length; i++) {
    if (types[i] !== 'N') continue;
    let prev = 'R';
    for (let j = i - 1; j >= 0; j--) { if (types[j] !== 'N') { prev = types[j]; break; } }
    let next = 'R';
    for (let j = i + 1; j < types.length; j++) { if (types[j] !== 'N') { next = types[j]; break; } }
    types[i] = prev === 'L' && next === 'L' ? 'L' : 'R';
  }

  const runs = [];
  let runStart = 0;
  for (let i = 1; i <= types.length; i++) {
    if (i === types.length || types[i] !== types[runStart]) {
      runs.push({ text: chars.slice(runStart, i).join(''), type: types[runStart] });
      runStart = i;
    }
  }
  return runs
    .reverse()
    .map((r) => (r.type === 'R' ? r.text.split('').reverse().join('') : r.text))
    .join('');
}

// ── i18n labels ─────────────────────────────────────────────────────────────

const labels = {
  he: {
    historyTitle: 'היסטוריית דוחות',
    columnProduct: 'מוצר',
    upiLabel: "צ'",
    columnStatus: 'סטטוס',
    enterLocation: 'הזן מיקום',
    columnHolder: 'מחזיק',
    columnDepartment: 'מחלקה',
    columnReporter: 'דווח על ידי',
    notReportedStatus: 'לא דווח',
    reported: 'דווח',
    warehouseItems: 'פריטי מחסן',
  },
  en: {
    historyTitle: 'Reports History',
    columnProduct: 'Product',
    upiLabel: 'UPI',
    columnStatus: 'Status',
    enterLocation: 'Enter Location',
    columnHolder: 'Holder',
    columnDepartment: 'Department',
    columnReporter: 'Reported by',
    notReportedStatus: 'Not reported',
    reported: 'Reported',
    warehouseItems: 'Warehouse Items',
  },
};

// ── mock data (representative of real report rows) ──────────────────────────

function mockRows(t) {
  return [
    { product: 'fdhfnj',       upi: '11',     reported: true,  location: 'asdas',    holder: t.warehouseItems, department: '',       reporter: 'נתנאל אלברט' },
    { product: 'fdhfnj',       upi: '22',     reported: true,  location: 'xvxvz',    holder: t.warehouseItems, department: '',       reporter: 'נתנאל אלברט' },
    { product: 'fdhfnj',       upi: '33',     reported: true,  location: 'dsfg',      holder: '',               department: '',       reporter: 'נתנאל אלברט' },
    { product: 'fdhfnj',       upi: '76528',  reported: false, location: '',          holder: t.warehouseItems, department: '',       reporter: '' },
    { product: 'Magic Wand',   upi: '101010', reported: true,  location: 'dsa',       holder: t.warehouseItems, department: '',       reporter: 'נתנאל אלברט' },
    { product: 'Magic Wand',   upi: '111',    reported: true,  location: 'asfdsfsd',  holder: t.warehouseItems, department: '',       reporter: 'נתנאל אלברט' },
    { product: 'Magic Wand',   upi: '222',    reported: false, location: '',          holder: t.warehouseItems, department: '',       reporter: '' },
    { product: 'Magic Wand',   upi: '333',    reported: true,  location: 'asd',       holder: t.warehouseItems, department: '',       reporter: 'נתנאל אלברט' },
    { product: 'Magic Wand',   upi: '444',    reported: false, location: '',          holder: t.warehouseItems, department: '',       reporter: '' },
    { product: 'Magic Wand',   upi: '555',    reported: false, location: '',          holder: t.warehouseItems, department: '',       reporter: '' },
    { product: 'Magic Wand',   upi: '666',    reported: false, location: '',          holder: t.warehouseItems, department: '',       reporter: '' },
    { product: 'Magic Wand',   upi: '777',    reported: true,  location: 'safasaaa',  holder: t.warehouseItems, department: '',       reporter: 'נתנאל אלברט' },
    { product: 'Magic Wand',   upi: '888',    reported: false, location: '',          holder: t.warehouseItems, department: '',       reporter: '' },
    { product: 'Magic Wand',   upi: '999',    reported: false, location: '',          holder: t.warehouseItems, department: '',       reporter: '' },
    { product: 'שרביט קסם',    upi: '1',      reported: false, location: '',          holder: '',               department: 'נתנאל אלברט', reporter: '' },
    { product: 'שרביט קסם',    upi: '2',      reported: true,  location: 'asfas',     holder: '',               department: '',       reporter: 'נתנאל אלברט' },
    { product: 'שרביט קסם',    upi: '3',      reported: false, location: '',          holder: 'dfgf',           department: 'הנדסה',  reporter: '' },
    { product: 'שרביט קסם',    upi: '4',      reported: false, location: '',          holder: 'dfgf',           department: 'הנדסה',  reporter: '' },
    { product: 'שרביט קסם',    upi: '5',      reported: false, location: '',          holder: t.warehouseItems, department: '',       reporter: '' },
  ];
}

// ── PDF generation — mirrors exportPdf() in reports-history.component.ts ────

function generateReport(lang) {
  const t = labels[lang];
  const isRtl = lang === 'he';
  const dateStr = new Date().toISOString().slice(0, 10);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  registerFont(doc);

  // ── title (R2L on → jsPDF bidi engine handles mixed content) ──
  if (isRtl) doc.setR2L(true);
  const title = `${t.historyTitle} — ${dateStr}`;
  doc.setFont(FONT_FAMILY, 'normal');
  doc.setFontSize(12);
  const pageW = doc.internal.pageSize.getWidth();
  doc.text(title, isRtl ? pageW - 40 : 40, 36, {
    align: isRtl ? 'right' : 'left',
  });
  if (isRtl) doc.setR2L(false);

  // ── table (R2L off → toVisualOrder handles Hebrew cell text) ──
  const fix = isRtl ? toVisualOrder : (s) => s;

  const head = [[
    t.columnProduct,
    t.upiLabel,
    t.columnStatus,
    t.enterLocation,
    t.columnHolder,
    t.columnDepartment,
    t.columnReporter,
  ].map(fix)];

  const rows = mockRows(t);
  const body = rows.map((r) =>
    [
      r.product,
      r.upi,
      r.reported ? t.reported : t.notReportedStatus,
      r.location,
      r.holder,
      r.department,
      r.reported ? r.reporter : '',
    ].map(fix)
  );

  autoTable(doc, {
    head,
    body,
    startY: 48,
    styles: {
      font: FONT_FAMILY,
      fontStyle: 'normal',
      halign: isRtl ? 'right' : 'left',
    },
    headStyles: {
      fillColor: [80, 80, 100],
      font: FONT_FAMILY,
      fontStyle: 'normal',
    },
  });

  return { doc, dateStr };
}

// ── main ────────────────────────────────────────────────────────────────────

const outDir = path.resolve(__dirname, '..');
const files = [];

for (const lang of ['he', 'en']) {
  const { doc, dateStr } = generateReport(lang);
  const filename = `report-${lang}.pdf`;
  const outPath = path.join(outDir, filename);
  fs.writeFileSync(outPath, Buffer.from(doc.output('arraybuffer')));
  files.push(outPath);
  console.log(`✅  ${filename}  (${lang === 'he' ? 'Hebrew / RTL' : 'English / LTR'})`);
}

// optional: open in default viewer
if (process.argv.includes('--open')) {
  const { execSync } = require('child_process');
  for (const f of files) {
    try {
      const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
      execSync(`${cmd} "${f}"`);
    } catch { /* viewer not available */ }
  }
}

console.log(`\nFiles written to ${outDir}/`);
