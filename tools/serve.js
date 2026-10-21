import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root = resolve(process.env.SERVE_ROOT || '.');
const prefix = process.env.BASE_PATH || '';
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.z3': 'application/octet-stream' };
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (prefix && !url.pathname.startsWith(`${prefix}/`)) throw new Error('Not found');
    const pathname = decodeURIComponent(url.pathname.slice(prefix.length));
    const path = resolve(root, `.${pathname === '/' ? '/exp.html' : pathname}`);
    if (!path.startsWith(root + sep) || !(await stat(path)).isFile()) throw new Error('Not found');
    response.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(await readFile(path));
  } catch {
    response.writeHead(404); response.end('Not found');
  }
});
server.listen(Number(process.env.PORT || 8000), '127.0.0.1', () => console.log(`Serving http://127.0.0.1:${server.address().port}${prefix}/exp.html`));
