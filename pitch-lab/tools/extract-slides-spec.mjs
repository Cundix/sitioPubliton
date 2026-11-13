// Convierte las diapositivas HTML del informe en una especificación de capas (JSON) para recrearlas en Figma
// con elementos EDITABLES (rectángulos, textos con tipografía real, imágenes), no como una imagen plana.
// Uso: node tools/extract-slides-spec.mjs   (requiere el servidor local en el puerto 8080)

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './browser.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const lab = path.resolve(here, '..');
const base = process.env.PITCHLAB_URL || 'http://localhost:8080/pitch-lab/';
const url = new URL('informe/informe-pitch-lab.html', base).href;

const browser = await launch({ fakeMic: false });
const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })).newPage();
await page.goto(url, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);

const spec = await page.evaluate(() => {
  const r2 = (n) => Math.round(n * 100) / 100;
  const rgba = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(',').map((x) => parseFloat(x));
    return { r: r2(r / 255), g: r2(g / 255), b: r2(b / 255), a: r2(a) };
  };
  const slides = [];
  document.querySelectorAll('section.slide').forEach((slide, index) => {
    const sr = slide.getBoundingClientRect();
    const rel = (r) => ({ x: r2(r.left - sr.left), y: r2(r.top - sr.top), w: r2(r.width), h: r2(r.height) });
    const nodes = [];
    const scs = getComputedStyle(slide);

    const isInline = (el) => getComputedStyle(el).display === 'inline';
    const collectRuns = (el, runs) => {
      for (const n of el.childNodes) {
        if (n.nodeType === 3) {
          const text = n.textContent.replace(/\s+/g, ' ');
          if (!text.trim() && !text.includes(' ')) continue;
          const cs = getComputedStyle(n.parentElement);
          runs.push({ t: cs.textTransform === 'uppercase' ? text.toUpperCase() : text, f: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(), w: parseInt(cs.fontWeight, 10), s: parseFloat(cs.fontSize), c: rgba(cs.color), ls: cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing) });
        } else if (n.nodeType === 1) {
          if (n.tagName === 'BR') runs.push({ t: '\n' });
          else if (isInline(n) && n.tagName !== 'IMG') collectRuns(n, runs);
        }
      }
    };
    const hasOwnText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());

    const visit = (el, parentIsText) => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      const r = el.getBoundingClientRect();
      if (el !== slide && r.width > 0 && r.height > 0) {
        const bg = rgba(cs.backgroundColor);
        const bw = parseFloat(cs.borderTopWidth) || 0;
        if ((bg && bg.a > 0) || bw > 0) {
          nodes.push({
            k: 'rect', ...rel(r), fill: bg && bg.a > 0 ? bg : null,
            stroke: bw > 0 ? rgba(cs.borderTopColor) : null, sw: bw, dash: cs.borderTopStyle === 'dashed',
            rad: parseFloat(cs.borderTopLeftRadius) || 0,
          });
        }
        if (el.tagName === 'IMG') {
          nodes.push({ k: 'img', ...rel(r), src: el.getAttribute('src'), fit: cs.objectFit });
          return;
        }
        if (el.tagName === 'svg' || el.closest('svg')) {
          nodes.push({ k: 'svgbox', ...rel(r) });
          return;
        }
      }
      const textBlock = hasOwnText(el) || (isInline(el) && !parentIsText && el.textContent.trim());
      if (textBlock && el !== slide) {
        const runs = [];
        collectRuns(el, runs);
        if (runs.some((x) => x.t && x.t.trim())) {
          const range = document.createRange();
          range.selectNodeContents(el);
          const tr = range.getBoundingClientRect();
          const pad = (p) => parseFloat(cs[p]) || 0;
          const contentLeft = r.left + pad('paddingLeft') + (parseFloat(cs.borderLeftWidth) || 0);
          const contentW = r.width - pad('paddingLeft') - pad('paddingRight') - (parseFloat(cs.borderLeftWidth) || 0) - (parseFloat(cs.borderRightWidth) || 0);
          const lh = cs.lineHeight === 'normal' ? parseFloat(cs.fontSize) * 1.2 : parseFloat(cs.lineHeight);
          const box = cs.display === 'inline' || cs.display === 'inline-block' || cs.display === 'inline-flex'
            ? { x: tr.left - sr.left, y: tr.top - sr.top, w: tr.width }
            : { x: contentLeft - sr.left, y: tr.top - sr.top, w: contentW };
          nodes.push({ k: 'text', x: r2(box.x), y: r2(box.y), w: r2(box.w), h: r2(tr.height), lh: r2(lh), align: cs.textAlign === 'start' ? 'left' : cs.textAlign, runs });
          if (el.tagName === 'LI') {
            const fs = parseFloat(cs.fontSize);
            nodes.push({ k: 'diamond', cx: r2(r.left - sr.left + 10.5), cy: r2(r.top - sr.top + fs * 0.55 + 6.5), size: 18, fill: rgba('rgb(255, 201, 74)') });
          }
        }
        // Los hijos que no son en línea (bloques dentro de un bloque con texto) se visitan por separado
        for (const child of el.children) if (!isInline(child)) visit(child, false);
        return;
      }
      for (const child of el.children) visit(child, parentIsText || textBlock);
    };
    visit(slide, false);

    const cover = slide.classList.contains('cover');
    slides.push({
      n: index + 1,
      id: slide.id,
      bg: rgba(scs.backgroundColor),
      cover,
      nodes,
      pageNumber: index + 1,
    });
  });
  return slides;
});

await browser.close();

const out = path.join(lab, 'informe', 'figma', 'slides-spec.json');
await fs.writeFile(out, JSON.stringify({ frame: { w: 1920, h: 1080 }, slides: spec }));
const sizes = spec.map((s) => `${s.n}:${s.nodes.length}`).join(' ');
console.log(`diapositivas: ${spec.length} · capas por diapositiva → ${sizes}`);
console.log(`archivo: ${out} (${Math.round((await fs.stat(out)).size / 1024)} KB)`);
