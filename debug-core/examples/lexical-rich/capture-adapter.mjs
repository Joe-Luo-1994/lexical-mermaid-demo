// Project-specific trusted adapter. Runner scopes files, not arbitrary code execution.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const project = process.cwd();
const runtime = JSON.parse(await readFile(join(project, 'runtime.json'), 'utf8'));
const {build, preview} = await import(pathToFileURL(join(runtime.toolRoot, 'node_modules/vite/dist/node/index.js')).href);
const {chromium} = await import(pathToFileURL(join(runtime.toolRoot, 'node_modules/playwright/index.mjs')).href);
const baseline = process.argv.includes('--baseline');
const runDir = process.env.DEBUG_RUN_DIR;
if (!runDir || !process.env.DEBUG_RUN_ID) throw new Error('Use core run, optionally with --baseline');
await mkdir(runDir, {recursive:true});
const startedAt = Date.now();
let browser, server;
const errors = [], externalRequests = [];
try {
  await build({root: project, configFile: join(project,'runtime-vite.config.mjs'), logLevel:'error'});
  server = await preview({root:project, configFile:join(project,'runtime-vite.config.mjs'), logLevel:'error', preview:{host:'127.0.0.1',port:0,strictPort:true}});
  const address = server.httpServer.address();
  const url = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({executablePath:process.env.BROWSER_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const page = await browser.newPage({viewport:{width:1280,height:900}});
  page.on('pageerror', e=>errors.push(String(e)));
  page.on('console', m=>{if(m.type()==='error')errors.push({text:m.text(),location:m.location()});});
  page.on('request', r=>{if(!r.url().startsWith(url)&&!r.url().startsWith('data:'))externalRequests.push(r.url());});
  await page.goto(url);
  await page.locator('[data-open-document]').waitFor();
  await page.locator('[contenteditable=true]').waitFor();
  // Already-running website and unseen document. Setup/bundle loading precede the operation.
  const precondition = await page.locator('[contenteditable=true]').innerText();
  if (precondition.includes('Section 1.')) throw new Error('Document unexpectedly displayed before opening');
  const cdp = await page.context().newCDPSession(page);
  let traceDone;
  if (!baseline) {
    await page.evaluate(()=>window.__exampleObservation.start());
    traceDone = new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));
    await cdp.send('Tracing.start',{categories:'devtools.timeline,blink.user_timing,v8.execute,disabled-by-default-v8.cpu_profiler',transferMode:'ReturnAsStream'});
  }
  const operationSentAt = Date.now();
  await page.locator('[data-open-document]').click();
  await page.waitForFunction(()=>document.querySelector('[contenteditable=true]')?.querySelectorAll('p').length===40);
  // A settling step to let ordinary update listeners run; explicitly not a paint/TTI metric.
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const observation = baseline ? null : await page.evaluate(()=>window.__exampleObservation.stop());
  if (!baseline) {
    await cdp.send('Tracing.end');
    const {stream} = await traceDone;
    let trace = '', eof = false;
    try {
      while(!eof) {
        const part = await cdp.send('IO.read',{handle:stream,size:65536});
        trace += part.base64Encoded ? Buffer.from(part.data,'base64').toString('utf8') : part.data;
        if(Buffer.byteLength(trace)>16*1024*1024) throw new Error('Chrome trace exceeded predeclared 16 MiB limit');
        eof = part.eof;
      }
    } finally { await cdp.send('IO.close',{handle:stream}); }
    await writeFile(join(runDir,'chrome-trace.json'),trace);
  }
  const beforeTyping = await page.locator('[contenteditable=true]').innerText();
  const paragraphs = await page.locator('[contenteditable=true] p').count();
  const bold = await page.locator('[contenteditable=true] strong, [contenteditable=true] b').count();
  await page.locator('[contenteditable=true]').click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(' runtime-check');
  const afterTyping = await page.locator('[contenteditable=true]').innerText();
  if(!afterTyping.includes('runtime-check')) throw new Error('Editor typing functional check failed');
  if(errors.length||externalRequests.length) throw new Error(JSON.stringify({errors,externalRequests}));
  const behavior = {paragraphs,bold,textSha256:createHash('sha256').update(beforeTyping).digest('hex'),typing:true,operationSentAt,setupAndBuildMs:operationSentAt-startedAt,browser:browser.version(),versions:runtime.versions,errors,externalRequests};
  await writeFile(join(runDir,'behavior.json'),JSON.stringify(behavior,null,2));
  await page.screenshot({path:join(runDir,'document.png'),fullPage:false});
  if(baseline) {
    const timeOrigin = await page.evaluate(()=>performance.timeOrigin);
    const capture = {kind:'agent-debug-capture',version:1,runId:process.env.DEBUG_RUN_ID,clock:{unit:'ms',origin:'performance.timeOrigin',timeOrigin},events:[],relations:[],coverage:{installed:[],dropped:0,limitations:['Baseline contains functional artifacts only, no plugin timing probes','DOM completeness and typing checks do not establish visible-response latency']},artifacts:['behavior.json','document.png'],findings:[{id:'baseline-limit',status:'unknown',text:'Uninstrumented document content and typing were checked; execution path and visible-response latency are not established.',eventIds:[],limitations:['Behavior artifacts support only the tested content/typing conditions','No plugin observation installed']}],nextExperiment:{question:'Can source-targeted observation recover a truthful call path without changing these functional checks?',intervention:'Install the generated observation patch and rerun the same operation',controls:['Document text hash','Paragraph and bold count','Typing behavior','Same viewport and plugin set'],outcomes:['Matching behavior plus referenced raw calls supports this integration path','Changed behavior or missing source/raw references invalidates the observation']},capabilities:{visibleResponse:'unverified',externalViewer:'unverified'},costs:{tokens:null,fee:null}};
    await writeFile(join(runDir,'capture.json'),JSON.stringify(capture,null,2));
    console.log(JSON.stringify({kind:'lexical-runtime-baseline',...behavior}));
  }
  else {
    const raw = observation.records;
    if(!raw.length) throw new Error('No observed events; do not invent a path');
    const events = raw.map((record,index)=>({id:record.id,name:record.name,startMs:record.startMs,durationMs:record.durationMs,source:record.source,rawRef:{artifact:'raw.json',index}}));
    const relations = raw.filter(r=>r.parentId).map(r=>({from:r.parentId,to:r.id,type:'captured-call',reason:'Both wrappers were active on the synchronous JavaScript call stack; raw child parentId and parentType record this relationship'}));
    const toolbar = events.filter(e=>e.name==='Toolbar update listener');
    const invocation = events.filter(e=>e.name==='editor.update invocation');
    if(toolbar[0]&&invocation[0]) relations.push({from:invocation[0].id,to:toolbar[0].id,type:'temporal-association',reason:'The editor later notified the listener; these probes do not capture the asynchronous scheduling edge'});
    const capture = {kind:'agent-debug-capture',version:1,runId:process.env.DEBUG_RUN_ID,clock:{unit:'ms',origin:'performance.timeOrigin',timeOrigin:observation.timeOrigin},events,relations,coverage:{installed:['Document open handler','editor.update invocation','upstream Toolbar update listener','upstream Toolbar editorState.read'],dropped:observation.dropped,limitations:['Only these four source sites are observed','Synchronous wall time includes called work; overlapping spans cannot be added as CPU','Probe and Chrome tracing overhead uncalibrated; this run is diagnostic, not a benchmark','Chrome trace clock is not mapped to the probe clock; no external viewer navigation claim']},artifacts:['raw.json','behavior.json','chrome-trace.json','document.png'],findings:[{id:'source-path',status:'observed',text:`Recorded ${events.length} runtime spans and ${relations.filter(r=>r.type==='captured-call').length} synchronous call edges while opening an unseen document in the upstream Lexical example.`,eventIds:events.map(e=>e.id),limitations:['A captured path is not a bottleneck diagnosis','Public controlled operation is not the company case']},{id:'toolbar-followup',status:'hypothesis',text:'The original toolbar may contribute work after document insertion; no redundant work or dominant cost has been established.',eventIds:toolbar.map(e=>e.id),limitations:['No causal scheduling edge captured from update invocation to later listener','No candidate repair or controlled performance comparison executed']}],nextExperiment:{question:'Does the toolbar listener contribute material document-open cost while retaining required formatting behavior?',intervention:'Measure the listener and layout separately first; only then propose a semantically equivalent change at the observed source site',controls:['Same document content and viewport','Same original plugin set and font/cache conditions','Required formatting and typing behavior','Separate diagnostic tracing from performance acceptance'],outcomes:['Substantial repeated listener work supports a targeted equivalent-work experiment','Small listener cost or dominant layout refutes prioritizing this listener','Any formatting/content regression invalidates a proposed improvement']},capabilities:{visibleResponse:'unverified',externalViewer:'unverified'},costs:{tokens:null,fee:null}};
    await writeFile(join(runDir,'raw.json'),JSON.stringify(raw,null,2));
    await writeFile(join(runDir,'capture.json'),JSON.stringify(capture,null,2));
    console.log(JSON.stringify({capturedEvents:events.length,relations:relations.length,source:runtime.upstream.commit,behavior}));
  }
} finally {
  await browser?.close();
  if(server) await new Promise(resolve=>server.httpServer.close(resolve));
}
