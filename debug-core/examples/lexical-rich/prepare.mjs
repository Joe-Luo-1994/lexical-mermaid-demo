import {cp, mkdir, readFile, writeFile, symlink, access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname, resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const toolRoot = resolve(here, '../../..');
export const sha256 = content => createHash('sha256').update(content).digest('hex');

export async function prepareProject(target) {
  target = resolve(target);
  try { await access(target); throw new Error(`Target must not exist: ${target}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const upstream = JSON.parse(await readFile(join(here, 'upstream.json'), 'utf8'));
  for (const [path, expected] of Object.entries(upstream.sha256)) {
    if (sha256(await readFile(join(here, 'upstream', path))) !== expected) throw new Error(`Upstream fixture changed: ${path}`);
  }
  await mkdir(dirname(target), {recursive: true});
  await cp(join(here, 'upstream'), target, {recursive: true});
  // Build adaptation uses this tool's exact locked dependencies, never upgrades the upstream lock.
  await symlink(join(toolRoot, 'node_modules'), join(target, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  await cp(join(here, 'capture-adapter.mjs'), join(target, 'capture-adapter.mjs'));
  const versions = {};
  for (const name of ['lexical', '@lexical/react', 'react', 'react-dom', 'vite', 'playwright']) versions[name] = JSON.parse(await readFile(join(toolRoot, 'node_modules', name, 'package.json'), 'utf8')).version;
  if (versions.lexical !== '0.18.0') throw new Error('This generated adapter supports the pinned Lexical 0.18.0 example only');
  const lock = await readFile(join(toolRoot, 'package-lock.json'));
  await writeFile(join(target, 'runtime.json'), JSON.stringify({toolRoot, versions, lockSha256: sha256(lock), upstream, fixture: 'controlled document-open operation; not company slowdown'}, null, 2));
  await writeFile(join(target, 'runtime-vite.config.mjs'), 'export default {build:{sourcemap:true}, server:{host:"127.0.0.1"}};\n');
  const indexPath = join(target, 'index.html');
  await writeFile(indexPath, (await readFile(indexPath, 'utf8')).replace('<title>', '<link rel="icon" href="data:," />\n    <title>'));
  const appPath = join(target, 'src/App.tsx');
  const originalApp = await readFile(appPath, 'utf8');
  const app = originalApp.replace("import ExampleTheme from './ExampleTheme';", "import ExampleTheme from './ExampleTheme';\nimport DocumentOperationPlugin from './plugins/DocumentOperationPlugin.jsx';").replace('<ToolbarPlugin />', '<DocumentOperationPlugin />\n        <ToolbarPlugin />');
  await writeFile(appPath, app);
  await cp(join(here, 'DocumentOperationPlugin.jsx'), join(target, 'src/plugins/DocumentOperationPlugin.jsx'));
  await writeFile(join(target, 'fixture-provenance.json'), JSON.stringify({upstreamCommit: upstream.commit, additions: ['src/plugins/DocumentOperationPlugin.jsx'], modifications: ['src/App.tsx', 'index.html (empty favicon to avoid incidental request)'], purpose: 'Add document-open behavior absent from the original example; no slowdown injected; no probes installed at setup', adaptation: 'Use tool locked dependency tree and Vite config; original upstream package/lock/config preserved'}, null, 2));
  return {target, versions, upstreamCommit: upstream.commit};
}

export async function instrumentProject(target) {
  target = resolve(target);
  const files = ['src/plugins/DocumentOperationPlugin.jsx', 'src/plugins/ToolbarPlugin.tsx'];
  const original = new Map(await Promise.all(files.map(async p => [p, await readFile(join(target, p), 'utf8')])));
  if ([...original.values()].some(s => s.includes('traceSync'))) throw new Error('Already instrumented; use a fresh prepared project');
  await mkdir(join(target, '.debug'), {recursive: true});
  await cp(join(here, 'probe.js'), join(target, '.debug/probe.js'));
  let document = original.get(files[0]);
  document = "import {traceSync} from '../../.debug/probe.js';\n" + document;
  document = document.replace('function openDocument() {\n    editor.update(() => {', 'function openDocument() {\n    return traceSync("Document open handler", {path:"src/plugins/DocumentOperationPlugin.jsx",line:__OPEN_LINE__}, () => {\n    return traceSync("editor.update invocation", {path:"src/plugins/DocumentOperationPlugin.jsx",line:__UPDATE_LINE__}, () => editor.update(() => {');
  document = document.replace('    });\n  }', '    }));\n    });\n  }');
  document = document.replace('__OPEN_LINE__', String(document.split('\n').findIndex(l => l.includes('Document open handler')) + 1));
  document = document.replace('__UPDATE_LINE__', String(document.split('\n').findIndex(l => l.includes('editor.update invocation')) + 1));
  let toolbar = "import {traceSync} from '../../.debug/probe.js';\n" + original.get(files[1]);
  const from = `editor.registerUpdateListener(({editorState}) => {\n        editorState.read(() => {\n          $updateToolbar();\n        });\n      })`;
  const to = `editor.registerUpdateListener(({editorState}) => traceSync("Toolbar update listener", {path:"src/plugins/ToolbarPlugin.tsx",line:__LISTENER_LINE__}, () => {\n        return traceSync("Toolbar editorState.read", {path:"src/plugins/ToolbarPlugin.tsx",line:__READ_LINE__}, () => editorState.read(() => {\n          $updateToolbar();\n        }));\n      }))`;
  if (!toolbar.includes(from)) throw new Error('Pinned upstream listener shape changed; do not guess another location');
  toolbar = toolbar.replace(from, to);
  toolbar = toolbar.replace('__LISTENER_LINE__', String(toolbar.split('\n').findIndex(l => l.includes('Toolbar update listener')) + 1));
  toolbar = toolbar.replace('__READ_LINE__', String(toolbar.split('\n').findIndex(l => l.includes('Toolbar editorState.read')) + 1));
  await writeFile(join(target, files[0]), document);
  await writeFile(join(target, files[1]), toolbar);
  // Preserve before and after snapshots so a reviewer can inspect the precise generated patch.
  for (const [path, content] of original) {
    const dest = join(target, '.debug/before', path);
    await mkdir(dirname(dest), {recursive: true}); await writeFile(dest, content);
  }
  const patches = [];
  for (const path of files) {
    try { execFileSync('git', ['diff', '--no-index', '--', join(target, '.debug/before', path), join(target, path)], {encoding:'utf8'}); }
    catch (error) { if (error.status !== 1) throw error; patches.push(error.stdout); }
  }
  await writeFile(join(target, 'observation.patch'), patches.join('\n'));
  const plan = {question: 'Which source-located synchronous calls occur when opening the reference document, and does the original toolbar react to the update?', outcomes: ['A matching parent record and child record support a synchronous call path', 'Missing parent/source or dropped events leave that path unverified; do not infer it from neighboring times'], sources: ['src/App.tsx', ...files, '.debug/probe.js', 'capture-adapter.mjs', 'runtime.json', 'runtime-vite.config.mjs', 'fixture-provenance.json', 'observation.patch'], limitations: ['Public upstream example with controlled document-open fixture, not a blind test or company case', 'The generated probes measure synchronous wall duration; observer overhead is not calibrated', 'No source-map inference: explicit generated source locations are snapshotted and validated', 'No arbitrary async parent propagation or full editor coverage']};
  await writeFile(join(target, 'probe-plan.json'), JSON.stringify(plan, null, 2));
  return plan;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, target] = process.argv.slice(2);
  if (!target || !['prepare','instrument'].includes(mode)) throw new Error('Usage: node prepare.mjs prepare|instrument TARGET');
  console.log(JSON.stringify(await (mode === 'prepare' ? prepareProject(target) : instrumentProject(target)), null, 2));
}
