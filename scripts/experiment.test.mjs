import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseExperiment,experimentBundle,summarizeExperiment,mergeRecordings} from '../src/experiment.ts';
const normal=JSON.parse(await readFile(new URL('../docs/evidence/normal-recording.json',import.meta.url),'utf8'));
const duplicate=JSON.parse(await readFile(new URL('../docs/evidence/duplicate-recording.json',import.meta.url),'utf8'));
function pairs(){return Array.from({length:3},(_,i)=>({normal:{...structuredClone(normal),id:'normal-'+i},duplicate:{...structuredClone(duplicate),id:'duplicate-'+i}}));}
test('uses paired differences, not difference of medians, and preserves variation',()=>{
 const p=pairs();
 [2000,10000,3000].forEach((v,i)=>p[i].normal.metrics.completionProxyMs=v);
 [6000,11000,2000].forEach((v,i)=>p[i].duplicate.metrics.completionProxyMs=v);
 const result=summarizeExperiment(p);
 assert.ok(result.comparable);assert.equal(result.stats.delta.median,1000);
 assert.notEqual(result.stats.delta.median,result.stats.duplicate.median-result.stats.normal.median);
 assert.equal(result.stats.delta.min,-1000);assert.equal(result.stats.positivePairs,2);
});
test('one invalid or drifted sample blocks the whole summary instead of cherry-picking',()=>{
 for(const alter of [r=>r.configuration.warmup='cold',r=>r.configuration.mode='external',r=>r.environment.build='production:other',r=>delete r.environment.viewport,r=>r.limitations.push('TRACE: profiler'),r=>r.limitations.push('ERROR: failed')]) {
  const p=pairs();alter(p[1].duplicate);const result=summarizeExperiment(p);assert.equal(result.comparable,false);assert.equal(result.stats,null);
 }
});
test('bundle recomputes findings, rejects duplicate IDs and wrong schema; never trusts saved summary',()=>{
 const raw=experimentBundle(pairs());raw.summary={claim:'improved 100%'};
 raw.pairs[0].normal.findings=[{title:'FAKE CLAIM'}];
 const parsed=parseExperiment(raw);assert.equal(parsed.summary,undefined);assert.ok(!JSON.stringify(parsed).includes('FAKE CLAIM'));
 raw.pairs[1].normal.id=raw.pairs[0].normal.id;assert.throws(()=>parseExperiment(raw),/重複/);
 assert.throws(()=>parseExperiment({kind:'editor-evidence-experiment',schemaVersion:2,pairs:[]}));
});
test('wrong arm and reused measurements cannot count as repeated evidence; partial sets remain explicit',()=>{
 const p=pairs();p[1].duplicate.configuration.scenario='normal';assert.equal(summarizeExperiment(p).comparable,false);
 const one=[pairs()[0]];assert.equal(summarizeExperiment(one).stats.pairs,1);
 assert.equal(summarizeExperiment([]).comparable,false);
 assert.equal(summarizeExperiment([one[0],one[0]]).comparable,false);
});
test('conflicting imported ID never overwrites or partially merges existing evidence',()=>{
 const original=structuredClone(normal), changed=structuredClone(normal);changed.metrics.completionProxyMs+=1;
 const existing=[original];assert.throws(()=>mergeRecordings(existing,[duplicate,changed]),/ID 衝突/);
 assert.deepEqual(existing,[normal]);
 const reordered=Object.fromEntries(Object.entries(normal).reverse());assert.equal(mergeRecordings(existing,[reordered]).length,1);
});
test('large finite imported times do not overflow the median into Infinity',()=>{
 const p=pairs().slice(0,2);for(const pair of p){pair.normal.metrics.completionProxyMs=1e308;pair.duplicate.metrics.completionProxyMs=1.1e308;}
 const result=summarizeExperiment(p);assert.ok(result.comparable);
 assert.ok(Number.isFinite(result.stats.normal.median));assert.ok(Number.isFinite(result.stats.duplicate.median));
});
