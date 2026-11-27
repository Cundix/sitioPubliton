// Servidor estático mínimo, sin dependencias, para probar el sitio completo en local.
// Sirve la RAÍZ del repositorio (un nivel arriba de pitch-lab/) para que las rutas
// sean las mismas que en GitHub Pages: http://localhost:8080/pitch-lab/
//
// Uso:  node tools/serve.mjs [puerto]

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const port = Number(process.argv[2] || process.env.PORT || 8080);
// Prefijo opcional para simular la ruta de GitHub Pages: node tools/serve.mjs 8081 /sitioPubliton
const prefix = (process.argv[3] || process.env.PREFIX || '').replace(/\/$/, '');

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.wasm': 'application/wasm',
  '.task': 'application/octet-stream',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

// Modo IA con clave en el servidor (PITCHLAB_PROXY=1 o `npm run start:ia`): la clave sale de `.env` (GEMINI_API_KEY), que NO se sube a git,
// y este servidor se la agrega a los pedidos a Gemini. El navegador nunca la ve. Solo para correr el sitio en tu máquina: GitHub Pages no tiene servidor.
async function loadEnvKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  const txt = await fs.readFile(path.join(here, '..', '.env'), 'utf8').catch(() => '');
  return (txt.match(/^\s*GEMINI_API_KEY\s*=\s*(\S+)/m)?.[1] || '').replace(/^["']|["']$/g, '');
}
const proxyKey = process.env.PITCHLAB_PROXY === '1' ? await loadEnvKey() : '';
if (process.env.PITCHLAB_PROXY === '1' && !proxyKey) console.warn('PITCHLAB_PROXY=1 pero no hay GEMINI_API_KEY en pitch-lab/.env: la IA seguirá pidiendo clave.');

async function proxyGemini(req, res, rest, search) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  const headers = { 'x-goog-api-key': proxyKey };
  if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];
  const upstream = await fetch(`https://generativelanguage.googleapis.com/${rest}${search}`, {
    method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
  });
  const out = Buffer.from(await upstream.arrayBuffer());
  res.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') || 'application/json', 'Cache-Control': 'no-store' });
  res.end(out);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);
    const proxyAt = `${prefix}/pitch-lab/ia-proxy/`;
    if (pathname.startsWith(proxyAt)) {
      const rest = pathname.slice(proxyAt.length);
      if (rest === 'estado') { res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: !!proxyKey })); return; }
      if (!proxyKey) { res.writeHead(404).end('Sin proxy'); return; }
      await proxyGemini(req, res, rest, url.search);
      return;
    }
    if (prefix) {
      if (!pathname.startsWith(`${prefix}/`) && pathname !== prefix) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('No encontrado (fuera del prefijo)'); return; }
      pathname = pathname.slice(prefix.length) || '/';
    }
    let file = path.join(root, pathname);
    if (!file.startsWith(root)) { res.writeHead(403).end('Prohibido'); return; }
    let stat = await fs.stat(file).catch(() => null);
    if (stat?.isDirectory()) {
      if (!url.pathname.endsWith('/')) { res.writeHead(301, { Location: url.pathname + '/' }).end(); return; }
      file = path.join(file, 'index.html');
      stat = await fs.stat(file).catch(() => null);
    }
    if (!stat) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('No encontrado'); return; }
    const body = await fs.readFile(file);
    res.writeHead(200, {
      'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch (error) {
    res.writeHead(500).end(String(error));
  }
});

server.listen(port, () => {
  console.log(`Sitio en http://localhost:${port}${prefix}/  ·  Pitch Lab en http://localhost:${port}${prefix}/pitch-lab/`);
});
