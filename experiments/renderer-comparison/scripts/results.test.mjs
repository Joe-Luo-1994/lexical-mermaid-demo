import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize, reportHTML } from '../results.js';
const manifest={id:'test',pairs:2,fixtureIds:['a']};
const samples=[['mermaid',0,10],['pele',0,4],['pele',1,12],['mermaid',1,10]].map(([engine,pair,time],i)=>({
  id:`s${i}`,experimentId:'test',engine,pair,generateMs:time,insertMs:1,settledMs:time+30,
  invalid:[],diagrams:[{id:'a',ok:true}],
}));
test('AB/BA uses paired B minus A and keeps slower Pele sample',()=>{
  const r=summarize(manifest,samples);
  assert.equal(r.timing.generateMs.peleMinusMermaid.median,-2);
  assert.equal(r.timing.generateMs.peleLower,1);
  assert.equal(r.pairedDifferences[1].delta.generateMs,2);
  assert.match(r.visualReview,/pending/);
});
test('partial pairs, failure, visibility, malformed values and missing diagrams block aggregate without dropping samples',()=>{
  const cases=[samples.slice(0,3),samples.map(s=>({...s,invalid:['hidden']})),samples.map(s=>({...s,diagrams:[]})),
    samples.map(s=>({...s,generateMs:NaN})),samples.map(s=>({...s,experimentId:'other'})),
    samples.map(s=>({...s,error:'failed'})),[samples[1],samples[0],...samples.slice(2)],
    samples.map(s=>({...s,id:'duplicate'}))];
  for(const input of cases) {
    const r=summarize(manifest,input); assert.equal(r.timing,null); assert.ok(r.reasons.length);
    assert.equal(r.samples.length,input.length); assert.deepEqual(r.pairedDifferences,[]);
  }
});
test('HTML report escapes metadata and source and embeds SVG as a non-executable image',()=>{
  const html=reportHTML({...summarize(manifest,samples),visualReview:'<script>alert(1)</script>'},manifest,
    [{title:'<img src=x onerror=alert(1)>',source:'</pre><script>bad()</script>',mermaid:{svg:'<svg><script>bad()</script></svg>'},pele:{error:'<script>bad()</script>'}}]);
  assert.ok(!html.includes('<script>')); assert.match(html,/data:image\/svg\+xml;charset=utf-8,/); assert.ok(!html.includes('<iframe')); assert.match(html,/Content-Security-Policy/);
});
