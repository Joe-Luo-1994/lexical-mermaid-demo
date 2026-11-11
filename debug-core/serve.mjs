import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {queryCase, getRun, getSource, getArtifact} from './core.mjs';

const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/viewer.js', ['viewer.js', 'text/javascript; charset=utf-8']],
  ['/viewer.css', ['viewer.css', 'text/css; charset=utf-8']],
]);
const assetRoot = new URL('./viewer/', import.meta.url);
const csp = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";
const MAX_URL = 4096;

function send(res, status, data, type = 'application/json; charset=utf-8', extra = {}) {
  res.writeHead(status, {'Content-Type':type, 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'Content-Security-Policy':csp, 'Referrer-Policy':'no-referrer', ...extra});
  res.end(type.startsWith('application/json') ? JSON.stringify(data) : data);
}
function param(url, name) {
  const values = url.searchParams.getAll(name);
  if(values.length !== 1 || !values[0] || values[0].length > 1024) throw new Error(`One nonempty ${name} parameter is required`);
  return values[0];
}

/** Read-only, loopback-only viewer. Adapter execution is deliberately absent. */
export async function serveCase(caseDir, {port = 0} = {}) {
  if(!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port');
  await queryCase(caseDir);
  const server = http.createServer(async (req, res) => {
    try {
      const authority = `127.0.0.1:${server.address().port}`;
      const allowedHosts = [authority, `localhost:${server.address().port}`];
      if(!allowedHosts.includes(req.headers.host)) return send(res, 403, {error:'Loopback Host required'});
      if(req.method !== 'GET') return send(res, 405, {error:'Read-only viewer: GET only'}, undefined, {Allow:'GET'});
      if(req.headers['sec-fetch-site'] === 'cross-site' || (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`)) return send(res, 403, {error:'Same-origin requests only'});
      if(!req.url || req.url.length > MAX_URL) return send(res, 414, {error:'Request URL too long'});
      const url = new URL(req.url, `http://${authority}`);
      if(assets.has(url.pathname)) {
        const [name, type] = assets.get(url.pathname);
        return send(res, 200, await readFile(new URL(name, assetRoot)), type);
      }
      if(url.pathname === '/favicon.ico') return send(res, 204, '', 'image/x-icon');
      if(url.pathname === '/api/case') {
        const offset = Number(url.searchParams.get('offset') || 0);
        if(!Number.isInteger(offset) || offset < 0) throw new Error('Invalid offset');
        return send(res, 200, await queryCase(caseDir, {limit:20, offset}));
      }
      if(url.pathname === '/api/run') return send(res, 200, await getRun(caseDir, param(url, 'id')));
      if(url.pathname === '/api/event') {
        const runId = param(url, 'run'), eventId = param(url, 'id');
        const run = await getRun(caseDir, runId);
        if(!run.validity?.valid) return send(res, 409, {error:'Capture invalid; see run issues before using evidence', issues:run.validity?.issues});
        const event = run.capture?.events.find(e => e.id === eventId);
        if(!event) return send(res, 404, {error:'Event not found in this run'});
        return send(res, 200, {runId, event, relations:run.capture.relations.filter(r => r.from === eventId || r.to === eventId), freshness:run.freshness, limitations:run.limitations});
      }
      if(url.pathname === '/api/source') return send(res, 200, await getSource(caseDir, param(url, 'run'), param(url, 'path')));
      if(url.pathname === '/api/artifact') {
        const artifact = await getArtifact(caseDir, param(url, 'run'), param(url, 'path'));
        return send(res, 200, artifact.data, 'application/octet-stream', {'Content-Disposition':'attachment; filename="evidence-artifact.bin"'});
      }
      return send(res, 404, {error:'Unknown resource'});
    } catch(error) {
      return send(res, 400, {error:error instanceof Error ? error.message : 'Request failed'});
    }
  });
  await new Promise((resolve, reject) => {server.once('error', reject); server.listen(port, '127.0.0.1', resolve);});
  return server;
}

// Optional direct launch; the main CLI delegates to the same function.
if(process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const caseDir = process.argv[2];
  if(!caseDir) {console.error('Usage: node debug-core/serve.mjs CASE_DIR [PORT]'); process.exitCode = 1;}
  else {
    try {const server = await serveCase(caseDir, {port:Number(process.argv[3] || 0)}); console.log(JSON.stringify({url:`http://127.0.0.1:${server.address().port}`, readOnly:true}));}
    catch(error) {console.error(error.message); process.exitCode = 1;}
  }
}
