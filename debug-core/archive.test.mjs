import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {queryCase,getRun,getSource} from './core.mjs';

test('shipped public case remains readable without rebuilding the editor or assuming its original project exists',async()=>{
  const dir=fileURLToPath(new URL('./evidence/public-case/',import.meta.url));
  const summary=await queryCase(dir,{limit:2});
  assert.equal(summary.attemptsTotal,2);
  assert.equal(summary.id,'28745842-ba71-4ae8-ad76-467611720d7c');
  const run=await getRun(dir,summary.latest.runId);
  assert.equal(run.validity.valid,true,JSON.stringify(run.validity));
  const event=await queryCase(dir,{runId:summary.latest.runId,eventId:'e3'});
  assert.equal(event.source.path,'src/plugins/ToolbarPlugin.tsx');
  const source=await getSource(dir,summary.latest.runId,event.source.path);
  assert.equal(source.sha256,event.source.sha256);
  assert.ok(source.text.split('\n')[event.source.line-1].includes('Toolbar update listener'));
  assert.ok(run.capture.relations.some(r=>r.from==='e2'&&r.to==='e3'&&r.type==='temporal-association'));
  assert.equal(run.capture.capabilities.visibleResponse,'unverified');
});
