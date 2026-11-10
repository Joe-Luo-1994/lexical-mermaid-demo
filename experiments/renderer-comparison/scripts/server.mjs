import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export async function serve(port = 0) {
  const base = fileURLToPath(new URL('../dist/', import.meta.url));
  const files = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'],
    '/style.css': ['style.css', 'text/css'], '/provenance.json': ['provenance.json', 'application/json'] };
  const server = createServer(async (req, res) => {
    const file = files[new URL(req.url, 'http://localhost').pathname];
    if (!file) { res.writeHead(404).end(); return; }
    try {
      res.writeHead(200, { 'Content-Type': `${file[1]}; charset=utf-8`, 'Cache-Control': 'no-store' });
      res.end(await readFile(resolve(base, file[0])));
    } catch { res.writeHead(500).end('Build first: npm run build'); }
  });
  await new Promise((ok, fail) => { server.once('error', fail); server.listen(port, '127.0.0.1', ok); });
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(r => server.close(r)) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const server = await serve(Number(process.env.PORT || 0));
  console.log(`Renderer Comparison: ${server.url}\nKeep this terminal open; Ctrl+C stops the server.`);
}
