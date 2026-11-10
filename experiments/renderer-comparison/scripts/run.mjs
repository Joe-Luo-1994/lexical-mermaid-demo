import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { serve } from './server.mjs';

process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const verify=process.argv.includes('--verify');
const pairs=verify?2:Number(process.env.PAIRS||5), count=verify?11:Number(process.env.COUNT||10);
assert.ok(Number.isInteger(pairs)&&pairs>=1&&pairs<=10,'PAIRS must be 1..10');
assert.ok([1,5,10,11].includes(count),'COUNT must be 1, 5, 10, or 11');
const server=await serve();
let browser;
const errors=[], requests=[];
const dir=resolve('results',`${new Date().toISOString().replace(/[:.]/g,'-')}${verify?'-verify':''}`);
await mkdir(dir,{recursive:true});
try {
  browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:1});
  page.setDefaultTimeout(30000);
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('request',r=>{if(!r.url().startsWith(server.url)&&!r.url().startsWith('data:')&&!r.url().startsWith('about:')) requests.push(r.url());});
  await page.goto(server.url);
  await page.waitForFunction(()=>Boolean(window.rendererExperiment));
  const state=await page.evaluate(opts=>window.rendererExperiment.run(opts),{pairs,count});
  console.log('Recorded paired samples; saving evidence.');
  // Preserve evidence even when an assertion fails below.
  for(const file of ['summary','experiment','samples','report']) {
    await writeFile(resolve(dir,`${file}.${file==='report'?'html':'json'}`),await page.evaluate(f=>window.rendererExperiment.artifact(f),file));
  }
  const runtime={browser:await browser.version(),node:process.version,platform:process.platform,architecture:process.arch,
    viewport:{width:1280,height:900},headless:true,errors,externalRequests:requests,automatedChecks:[]};
  await writeFile(resolve(dir,'runtime.json'),JSON.stringify(runtime,null,2));
  assert.equal(state.summary.status,'measured-visual-review-required',JSON.stringify(state.summary.reasons));
  assert.equal(state.samples.length,pairs*2);
  assert.ok(state.samples.every(s=>s.diagrams.length===count&&s.diagrams.every(d=>d.ok)));
  assert.equal(state.gallery.length,count);
  assert.ok(state.gallery.every(g=>g.mermaid.svg&&g.pele.svg));
  await page.waitForFunction(()=>[...document.querySelectorAll('#gallery img')].every(img=>img.complete && img.naturalWidth>0));
  assert.equal(await page.locator('#gallery img').count(),count*2);
  console.log('All preview images decoded successfully.');
  assert.equal(state.manifest.provenance.versions.pele,'1.13.0');
  runtime.automatedChecks.push('All selected fixtures produce SVG; paired samples and provenance retained');
  await page.locator('#result').scrollIntoViewIfNeeded();
  await page.screenshot({path:resolve(dir,'results-desktop.png')});
  await page.locator('#visual').evaluate(el=>el.scrollIntoView({block:'start'}));
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await page.screenshot({path:resolve(dir,'visual-desktop.png')});
  if(verify) {
    const button=page.getByRole('button',{name:'下載摘要 JSON'});
    // Settle scrolling before issuing a real pointer click.
    await button.scrollIntoViewIfNeeded();
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const download=page.waitForEvent('download'); await button.click();
    await (await download).saveAs(resolve(dir,'downloaded-summary.json'));
    assert.equal(JSON.parse(await readFile(resolve(dir,'downloaded-summary.json'),'utf8')).experimentId,state.manifest.id);
    for(const width of [390,640,1280]) {
      await page.setViewportSize({width,height:900});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Overflow at ${width}`);
    }
    await page.setViewportSize({width:390,height:844}); await page.locator('#result').scrollIntoViewIfNeeded();
    await page.screenshot({path:resolve(dir,'results-mobile.png')});
    runtime.automatedChecks.push('Download retains experiment ID; 390/640/1280 px reflow');
    console.log('Download and responsive checks passed.');
    // Stop during a live operation; incomplete evidence must remain inspectable without timing claims.
    const partial=await page.evaluate(async()=>{
      const watcher=new MutationObserver(()=>{
        if(document.getElementById('status').textContent.startsWith('第 ')) { watcher.disconnect(); window.rendererExperiment.stop(); }
      });
      watcher.observe(document.getElementById('status'),{childList:true});
      const task=window.rendererExperiment.run({count:1,pairs:3});
      return await task;
    });
    assert.equal(partial.summary.status,'inconclusive'); assert.equal(partial.summary.timing,null);
    assert.equal(partial.samples.length,1);
    console.log('Stop check passed.');
    await writeFile(resolve(dir,'stopped-summary.json'),JSON.stringify(partial.summary,null,2));
    // Invalidate during warmup without relying on the task's label or a forged metric.
    const changed=await page.evaluate(async()=>{
      const watcher=new MutationObserver(()=>{
        if(document.getElementById('status').textContent.startsWith('第 ')) { watcher.disconnect(); window.dispatchEvent(new Event('resize')); }
      });
      watcher.observe(document.getElementById('status'),{childList:true});
      const task=window.rendererExperiment.run({count:1,pairs:1});
      return await task;
    });
    assert.equal(changed.summary.status,'inconclusive');
    console.log('Resize invalidation check passed.');
    await writeFile(resolve(dir,'resized-summary.json'),JSON.stringify(changed.summary,null,2));
    runtime.automatedChecks.push('Stopped and resize-invalidated runs preserve evidence and block aggregate');
    // Load exact exported bytes without a server. Block HTTP; SVG images are embedded data URLs.
    const offlineContext=await browser.newContext({offline:true});
    const offline=await offlineContext.newPage(); const offlineRequests=[];
    await offline.route(/^https?:\/\//,route=>{offlineRequests.push(route.request().url());return route.abort();});
    await offline.setContent(await readFile(resolve(dir,'report.html'),'utf8'));
    console.log('Offline report HTML loaded.');
    assert.equal(await offline.locator('img').count(),count*2);
    await offline.waitForFunction(()=>[...document.images].every(img=>img.complete && img.naturalWidth>0));
    await offline.screenshot({path:resolve(dir,'offline-report.png')});
    assert.equal(offlineRequests.length,0);
    await offlineContext.close(); runtime.automatedChecks.push('Exact standalone report bytes render with browser offline; OS file association/file:// not tested');
  }
  assert.deepEqual(errors,[]); assert.deepEqual(requests,[]);
  runtime.automatedChecks.push('No page/console errors or external HTTP requests');
  await writeFile(resolve(dir,'runtime.json'),JSON.stringify(runtime,null,2));
  console.log(JSON.stringify({results:dir,status:state.summary.status,timing:state.summary.timing,checks:runtime.automatedChecks},null,2));
} finally { await browser?.close(); await server.close(); }
