import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source = (await readFile(new URL('./probe.js',import.meta.url),'utf8')).replace('export function traceSync','function traceSync');
function probe(){const context=vm.createContext({window:{},performance,structuredClone});vm.runInContext(source,context);return {trace:context.traceSync,control:context.window.__exampleObservation};}
const location={path:'example.js',line:1};
test('generated synchronous probe preserves return value, method receiver and thrown identity',()=>{
  const p=probe();p.control.start();const obj={value:7,method(){return this.value;}};
  assert.equal(p.trace('method',location,()=>obj.method()),7);
  const error=new Error('expected');assert.throws(()=>p.trace('failure',location,()=>{throw error;}),e=>e===error);
  p.trace('after failure',location,()=>42);
  const result=p.control.stop();assert.equal(result.records.length,3);assert.equal(result.records[2].parentId,undefined);
});
test('parent edge is only recorded while synchronous parent wrapper is active',async()=>{
  const p=probe();p.control.start();let resolve;
  const promise=new Promise(r=>resolve=r);
  const returned=p.trace('parent',location,()=>{p.trace('child',location,()=>1);return promise;});
  assert.equal(returned,promise);
  p.trace('later',location,()=>2);resolve();await returned;
  const {records}=p.control.stop();assert.equal(records[1].parentId,records[0].id);assert.equal(records[1].parentType,'sync-call');assert.equal(records[2].parentId,undefined);
});
test('event bound preserves operation and exposes dropped count; inactive probe records nothing',()=>{
  const p=probe();assert.equal(p.trace('inactive',location,()=>9),9);p.control.start();let calls=0;
  for(let i=0;i<2005;i++)p.trace('bounded',location,()=>++calls);
  const result=p.control.stop();assert.equal(calls,2005);assert.equal(result.records.length,2000);assert.equal(result.dropped,5);
  p.trace('stopped',location,()=>++calls);assert.equal(p.control.stop().records.length,2000);
});
