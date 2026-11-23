import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const root = new URL('./', import.meta.url);
const routes = new Map([
  ['index.html', 'text/html; charset=utf-8'],
  ['style.css', 'text/css; charset=utf-8'],
  ...['main', 'view', 'landscape', 'architecture', 'structures', 'spatial', 'world'].map(name => [name + '.mjs', 'text/javascript; charset=utf-8']),
]);
const vendorPath = '/g1-m2/r2-vertical-v03-visual/vendor/three.module.min.js';
const port = Number(process.argv[2] ?? 8080);
const host = process.argv[3] ?? '127.0.0.1';

const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://127.0.0.1').pathname;
  if (path === '/' || path === '/play/01') {
    response.writeHead(302, { location: '/play/01/' }).end();
    return;
  }
  const file = path === '/play/01/' ? 'index.html' : path.slice('/play/01/'.length);
  const type = path === vendorPath ? 'text/javascript; charset=utf-8' : path.startsWith('/play/01/') && routes.get(file);
  if (!type || !['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(404).end('Not found');
    return;
  }
  try {
    const contents = await readFile(path === vendorPath ? new URL('../..' + vendorPath, root) : new URL(file, root));
    response.writeHead(200, { 'content-type': type, 'cache-control': 'no-cache' });
    response.end(request.method === 'HEAD' ? undefined : contents);
  } catch {
    response.writeHead(404).end('Not found');
  }
});
server.listen(port, host, () => {
  const { address, family, port } = server.address();
  console.log(`http://${family === 'IPv6' ? `[${address}]` : address}:${port}/play/01/`);
});
