// Genera el PDF 16:9, los PNG de cada diapositiva y el material para trasladar el informe a Figma.
// Uso:  node tools/build-informe.mjs
//       PITCHLAB_PUBLISHED_URL=https://… PITCHLAB_QR_SVG=informe/figma/assets/qr.svg node tools/build-informe.mjs
//
// Requiere el servidor local (node tools/serve.mjs) y Microsoft Edge/Chrome.
// El enlace y el QR se muestran SOLO si se pasan las variables (es decir, cuando la publicación fue verificada).

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './browser.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const lab = path.resolve(here, '..');
const out = path.join(lab, 'informe');
const slidesDir = path.join(out, 'slides');
const figmaDir = path.join(out, 'figma');
await fs.mkdir(slidesDir, { recursive: true });
await fs.mkdir(path.join(figmaDir, 'assets'), { recursive: true });

const base = process.env.PITCHLAB_URL || 'http://localhost:8080/pitch-lab/';
const url = new URL('informe/informe-pitch-lab.html', base).href;
const publishedUrl = process.env.PITCHLAB_PUBLISHED_URL || '';
const qrPath = process.env.PITCHLAB_QR_SVG ? path.resolve(process.env.PITCHLAB_QR_SVG) : '';
const qrSvg = qrPath ? await fs.readFile(qrPath, 'utf8') : '';

const browser = await launch({ fakeMic: false });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const page = await context.newPage();
await page.goto(url, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);

if (publishedUrl) {
  await page.evaluate(({ publishedUrl, qrSvg }) => {
    const html = document.getElementById('enlace').innerHTML;
    const start = html.indexOf('<!--PUBLICACION-->');
    const end = html.indexOf('<!--/PUBLICACION-->');
    const block = `<!--PUBLICACION-->
      <p class="ok-tag">Publicado y verificado</p>
      <p class="url">${publishedUrl}</p>
      ${qrSvg ? `<div class="qr">${qrSvg}</div>` : ''}
      <p class="small" style="margin-top:12px">Verificado con una consulta HTTP y una carga en navegador el día de la publicación.</p>
      `;
    document.getElementById('enlace').innerHTML = html.slice(0, start) + block + html.slice(end);
  }, { publishedUrl, qrSvg });
}
await page.waitForTimeout(500);

// Control de desbordes: ningún contenido debe salirse de su tarjeta ni invadir el pie de la diapositiva
const overflow = await page.evaluate(() => {
  const problems = [];
  document.querySelectorAll('section.slide:not(.cover)').forEach((slide) => {
    const i = [...document.querySelectorAll('section.slide')].indexOf(slide);
    const sb = slide.getBoundingClientRect();
    slide.querySelectorAll('.card, .pending, .box, .step, figure.shot').forEach((el) => {
      if (el.scrollHeight > el.clientHeight + 2) problems.push(`diapositiva ${i + 1}: contenido recortado en .${el.className.split(' ')[0]}`);
    });
    slide.querySelectorAll('p, li, h2, h3, table, figure').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom > sb.bottom - 66 || r.right > sb.right - 60) problems.push(`diapositiva ${i + 1}: «${el.textContent.trim().slice(0, 40)}» invade el borde o el pie`);
    });
  });
  return problems;
});
if (overflow.length) console.warn(`DESBORDES:\n${overflow.join('\n')}`);

// PDF horizontal 16:9
const pdfPath = path.join(out, 'informe-pitch-lab.pdf');
await page.pdf({ path: pdfPath, width: '1920px', height: '1080px', printBackground: true, preferCSSPageSize: true });
const pdf = await fs.readFile(pdfPath, 'latin1');
const pages = (pdf.match(/\/Type\s*\/Page[^s]/g) || []).length;

// PNG por diapositiva + textos para Figma
const slides = await page.$$('section.slide');
const contenido = [];
for (let i = 0; i < slides.length; i++) {
  const n = String(i + 1).padStart(2, '0');
  await slides[i].screenshot({ path: path.join(slidesDir, `slide-${n}.png`) });
  const text = await slides[i].evaluate((el) => el.innerText.trim());
  contenido.push(`## Diapositiva ${i + 1}\n\nArchivo de referencia: \`slides/slide-${n}.png\`\n\n\`\`\`text\n${text}\n\`\`\`\n`);
}
await fs.writeFile(path.join(figmaDir, 'contenido-diapositivas.md'), `# Texto de cada diapositiva (para copiar a Figma)\n\nGenerado automáticamente desde \`informe-pitch-lab.html\`. Cada marco de Figma mide **1920 × 1080 px**.\n\n${contenido.join('\n')}`);

console.log(`diapositivas: ${slides.length} · páginas del PDF: ${pages} · ${pdfPath}`);
await browser.close();
if (pages !== slides.length) { console.error('ATENCIÓN: la cantidad de páginas del PDF no coincide con la de diapositivas'); process.exit(1); }
