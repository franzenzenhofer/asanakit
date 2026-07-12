import type { PaperSpec } from './paper.js';

const escapeHtml = (value: string): string =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

/**
 * Wrap sheet-page SVGs in a minimal print carrier. All layout lives in the
 * paper-sized SVGs; the HTML only sets the page size and breaks between pages,
 * so the browser's print dialog produces a vector PDF that matches the preview.
 */
export const buildPrintableHtml = (pages: readonly string[], paper: PaperSpec, title: string): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
@page { size: ${paper.widthMm}mm ${paper.heightMm}mm; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
.page { width: ${paper.widthMm}mm; height: ${paper.heightMm}mm; break-after: page; overflow: hidden; }
.page:last-child { break-after: auto; }
.page svg { display: block; width: 100%; height: 100%; }
</style>
</head>
<body>
${pages.map((svg) => `<div class="page">${svg}</div>`).join('\n')}
</body>
</html>
`;
