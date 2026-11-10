import { build } from 'esbuild';
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
process.chdir(root);
const hash = (s) => createHash('sha256').update(s).digest('hex');
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
for (const [name,expected] of Object.entries({...pkg.dependencies,...pkg.devDependencies})) {
  const installed=JSON.parse(await readFile(`node_modules/${name}/package.json`,'utf8')).version;
  if(installed!==expected) throw new Error(`${name}: installed ${installed}, expected ${expected}; run npm ci`);
}
const fixtureSource = await readFile('../../src/fixtures.ts');
let commit = 'unknown', dirty = true;
try {
  commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  dirty = Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim());
} catch { /* Source archives can be built without git. Hashes remain available. */ }
await mkdir('dist', { recursive: true });
const output = await build({ entryPoints: ['app.js'], bundle: true, format: 'esm',
  minify: true, sourcemap: false, target: 'chrome120', outfile: 'dist/app.js', metafile: true });
const inputHashes = {};
for (const path of Object.keys(output.metafile.inputs).sort()) {
  inputHashes[path] = hash(await readFile(resolve(path)));
}
for (const path of ['index.html','style.css','scripts/build.mjs']) inputHashes[path]=hash(await readFile(path));
const provenance = {
  commit, dirty, buildHash: hash(JSON.stringify(inputHashes)),
  fixtureSource: { path: 'src/fixtures.ts', sha256: hash(fixtureSource), commit },
  lockSha256: hash(await readFile('package-lock.json')),
  versions: pkg.dependencies, node: process.version,
};
await writeFile('dist/provenance.json', JSON.stringify(provenance, null, 2));
await cp('index.html', 'dist/index.html');
await cp('style.css', 'dist/style.css');
console.log(`Built renderer experiment · ${provenance.buildHash.slice(0,12)} · ${commit.slice(0,7)}${dirty ? ' (dirty)' : ''}`);
