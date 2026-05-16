#!/usr/bin/env bash
# Generates a sample Form 1008 PDF and prints extracted text via pdftotext
# (requires poppler-utils: pdftotext).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
OUT="${TMPDIR:-/tmp}/equiptrack-form-pdf-verify.pdf"
export PDF_VERIFY_OUT="$OUT"
npx nx run backend:test --skip-nx-cache --testFile=apps/backend/src/services/pdf.service.spec.ts >/dev/null
echo "=== Wrote $OUT ==="
pdftotext "$OUT" -
echo "=== pdftotext exit $? ==="
