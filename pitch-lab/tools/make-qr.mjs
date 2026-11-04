// Genera el QR del enlace publicado (SVG y PNG) y COMPRUEBA que se decodifica al mismo enlace.
// Uso: node tools/make-qr.mjs https://cundix.github.io/sitioPubliton/pitch-lab/ informe/figma/assets
import fs from 'node:fs/promises';
import path from 'node:path';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';

const [url, outDir = 'informe/figma/assets'] = process.argv.slice(2);
if (!url) { console.error('Falta el enlace'); process.exit(1); }
await fs.mkdir(outDir, { recursive: true });
const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#181D16', light: '#FFFFFF' } });
await fs.writeFile(path.join(outDir, 'qr-experiencia.svg'), svg);
const pngPath = path.join(outDir, 'qr-experiencia.png');
await QRCode.toFile(pngPath, url, { margin: 2, width: 640, errorCorrectionLevel: 'M' });

// Verificación: decodificar el PNG generado
const png = PNG.sync.read(await fs.readFile(pngPath));
const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
if (!decoded || decoded.data !== url) {
  console.error('El QR NO se decodifica al enlace esperado:', decoded?.data);
  process.exit(1);
}
console.log('QR generado y verificado (decodifica a):', decoded.data);
