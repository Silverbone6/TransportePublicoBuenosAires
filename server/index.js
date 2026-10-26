import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectApi } from './project-api.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };
const api = projectApi(process.env.TRAMA_DATA_DIR || path.join(root, 'data'));
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 8080);

async function staticFile(req, res) {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(dist, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!file.startsWith(`${dist}${path.sep}`)) { res.writeHead(403); res.end(); return; }
    const info = await stat(file);
    if (!info.isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Content-Length': info.size, 'X-Content-Type-Options': 'nosniff' });
    if (req.method === 'HEAD') res.end();
    else createReadStream(file).on('error', () => res.destroy()).pipe(res);
  } catch { res.writeHead(404); res.end('Archivo no encontrado. Ejecutá npm run build antes de iniciar el servidor.'); }
}
const server = createServer((req, res) => api(req, res, () => { void staticFile(req, res); }));
server.requestTimeout = 0;
server.listen(port, host, () => console.log(`Trama local: http://${host}:${port}\nGuardado automático: ${process.env.TRAMA_DATA_DIR || path.join(root, 'data')}/proyecto.json`));
