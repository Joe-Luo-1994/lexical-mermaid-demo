import { adapters } from './adapters/index.js';
import { fixtures } from './fixtures.js';
import plan from './experiment.json';
import { summarize, reportHTML } from './results.js';

const $ = id => document.getElementById(id);
const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
const settle = async () => { await frame(); await frame(); };
const sha = async text => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
const environment = () => ({ viewport:`${innerWidth}x${innerHeight}@${devicePixelRatio}`, hostWidth:$('host').clientWidth,
  browser:navigator.userAgent, language:navigator.language, platform:navigator.platform });
let busy=false, stopped=false, state=null;
const provenance = await (await fetch('/provenance.json')).json();
$('versions').textContent = `Mermaid ${provenance.versions.mermaid} · Pele ${provenance.versions.pele} · build ${provenance.buildHash.slice(0,12)}`;

async function generate(engine, diagram) {
  const svg = await adapters[engine](diagram.source);
  if (typeof svg !== 'string' || !svg.includes('<svg')) throw new Error(`${engine}: no SVG for ${diagram.id}`);
  return svg;
}

async function sample(engine, selected, pair, manifest) {
  const id=`${manifest.id}:p${pair+1}:${engine}`;
  const invalid=[];
  const invalidate=reason=>{ if(!invalid.includes(reason)) invalid.push(reason); };
  const visibility=()=>{ if(document.hidden) invalidate('頁面切到背景'); };
  const resized=()=>invalidate('視窗尺寸改變');
  document.addEventListener('visibilitychange',visibility);
  window.addEventListener('resize',resized);
  const result={id, experimentId:manifest.id, pair, engine, invalid, diagrams:[], generateMs:0, insertMs:0, settledMs:0};
  let start;
  try {
    if(document.hidden) throw new Error('頁面不在前景');
    if(JSON.stringify(environment())!==JSON.stringify(manifest.environment)) throw new Error('環境或繪圖區寬度改變');
    $('host').replaceChildren();
    for(const d of selected) await generate(engine,d);
    await document.fonts.ready;
    await settle();
    start=performance.now();
    for(const d of selected) {
      const t=performance.now(), svg=await generate(engine,d), generated=performance.now();
      const node=document.createElement('div'); node.className='diagram'; node.dataset.diagramId=d.id;
      $('host').append(node);
      const insertStart=performance.now(); node.innerHTML=svg; const inserted=performance.now();
      const item={id:d.id, ok:Boolean(node.querySelector('svg')), generateMs:generated-t, insertMs:inserted-insertStart,
        svgChars:svg.length, svgElements:node.querySelectorAll('svg *').length};
      result.diagrams.push(item); result.generateMs+=item.generateMs; result.insertMs+=item.insertMs;
    }
    await settle();
    result.settledMs=performance.now()-start;
    if(JSON.stringify(environment())!==JSON.stringify(manifest.environment)) invalidate('環境或繪圖區寬度改變');
  } catch(error) {
    result.error=String(error); if(start!==undefined) result.settledMs=performance.now()-start;
  } finally {
    document.removeEventListener('visibilitychange',visibility); window.removeEventListener('resize',resized);
  }
  return result;
}

async function visualComparison(selected) {
  const gallery=[];
  for(const d of selected) {
    const row={...d};
    for(const engine of ['mermaid','pele']) {
      try {
        const svg=await generate(engine,d);
        // Mermaid HTML labels can contain <br> valid in innerHTML but not XML images.
        // Serialize the same parsed SVG DOM for previews only, outside the timed run.
        const document=new DOMParser().parseFromString(svg,'text/html');
        const previewSvg=new XMLSerializer().serializeToString(document.querySelector('svg'));
        row[engine]={svg,previewSvg};
      }
      catch(error) { row[engine]={error:String(error)}; }
    }
    gallery.push(row);
  }
  return gallery;
}

function showGallery(gallery) {
  $('gallery').replaceChildren();
  for(const row of gallery) {
    const section=document.createElement('section'); section.className='fixture';
    const title=document.createElement('h3'); title.textContent=`${row.title} · ${row.kind}`; section.append(title);
    const pair=document.createElement('div'); pair.className='pair'; section.append(pair);
    for(const engine of ['mermaid','pele']) {
      const article=document.createElement('article'); article.className='diagram-card';
      const h=document.createElement('h3'); h.textContent=engine; article.append(h);
      if(row[engine].error) { const p=document.createElement('p'); p.textContent=row[engine].error; article.append(p); }
      else {
        const img=document.createElement('img'); img.alt=`${row.title} · ${engine}`;
        img.src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(row[engine].previewSvg)}`;
        const link=document.createElement('a'); link.href=img.src; link.download=`${row.id}-${engine}.svg`;
        link.textContent='下載 SVG 檢查細節'; article.append(img,link);
      }
      pair.append(article);
    }
    const details=document.createElement('details'), label=document.createElement('summary'), pre=document.createElement('pre');
    label.textContent='查看原始語法'; pre.textContent=row.source; details.append(label,pre); section.append(details);
    $('gallery').append(section);
  }
  $('visual').hidden=false;
}

function showResult() {
  const {summary}=state;
  $('result').hidden=false; $('summary').textContent=JSON.stringify(summary,null,2); $('stats').replaceChildren();
  const names={generateMs:'生成請求合計',insertMs:'SVG 寫入合計',settledMs:'完成代理值'};
  if(summary.timing) for(const [key,value] of Object.entries(summary.timing)) {
    const card=document.createElement('div'); card.className='stat';
    const title=document.createElement('span'); title.textContent=names[key];
    const delta=document.createElement('strong'); delta.textContent=`${value.peleMinusMermaid.median.toFixed(1)} ms`;
    const caption=document.createElement('span'); caption.textContent=`Pele − Mermaid 配對差值中位數；${value.peleLower}/${value.peleMinusMermaid.n} 組 Pele 較低`;
    const values=document.createElement('span'); values.textContent=`中位數 A ${value.mermaid.median.toFixed(1)} / B ${value.pele.median.toFixed(1)} ms`;
    card.append(title,delta,caption,values); $('stats').append(card);
  }
  $('interpretation').textContent=summary.timing ? '量測完成；呈現品質仍待人工確認。差值不代表統計顯著，也不證明公司 editor 已改善。' : `未產生效能彙總：${summary.reasons.join('；')}。全部樣本仍可下載。`;
}

async function run({count=plan.defaults.count,pairs=plan.defaults.pairs}={}) {
  if(busy) throw new Error('An experiment is already running');
  if(!plan.allowedCounts.includes(count)||!Number.isInteger(pairs)||pairs<1||pairs>10) throw new Error('Invalid count/pairs');
  busy=true; stopped=false; state=null;
  $('run').disabled=true; $('stop').disabled=false; $('count').disabled=true; $('pairs').disabled=true;
  $('count').value=String(count);
  if(![...$('pairs').options].some(o=>o.value===String(pairs))) $('pairs').add(new Option(`${pairs} 輪 · 自訂`,String(pairs)));
  $('pairs').value=String(pairs);
  $('result').hidden=true; $('visual').hidden=true; $('gallery').replaceChildren();
  $('measurement').open=true;
  const selected=fixtures.slice(0,count);
  try {
    await document.fonts.ready; await settle();
    const manifest={...plan, kind:'renderer-comparison-experiment', id:`renderer-${crypto.randomUUID()}`,
      createdAt:new Date().toISOString(), pairs, count, fixtureIds:selected.map(d=>d.id),
      corpusSha256:await sha(JSON.stringify(selected)), provenance, environment:environment()};
    const samples=[]; state={manifest,samples,gallery:[]};
    outer: for(let pair=0; pair<pairs; pair++) {
      for(const engine of pair%2?['pele','mermaid']:['mermaid','pele']) {
        if(stopped) break outer;
        $('status').textContent=`第 ${pair+1}/${pairs} 組 · ${engine} · ${count} 張圖（含量測前暖機）`;
        const result=await sample(engine,selected,pair,manifest); samples.push(result);
        if(result.error||result.invalid.length) break outer;
      }
    }
    state.summary=summarize(manifest,samples);
    $('measurement').open=false;
    showResult();
    $('status').textContent='正在準備外觀對照（不計入量測）…';
    state.gallery=await visualComparison(selected); showGallery(state.gallery);
    $('status').textContent=`已保留 ${samples.length} 筆樣本 · ${state.summary.status==='inconclusive'?'證據不足，請檢查原因':'等待你檢查圖表呈現'}`;
    return state;
  } finally {
    busy=false; $('run').disabled=false; $('stop').disabled=true; $('count').disabled=false; $('pairs').disabled=false;
  }
}

function artifact(file) {
  if(!state?.summary) throw new Error('Run an experiment first');
  if(file==='report') return reportHTML(state.summary,state.manifest,state.gallery);
  return JSON.stringify(file==='experiment'?state.manifest:state[file],null,2);
}
$('run').addEventListener('click',()=>run({count:Number($('count').value),pairs:Number($('pairs').value)}).then(()=>$('result-title').focus()).catch(error=>{$('status').textContent=String(error);}));
$('stop').addEventListener('click',()=>{stopped=true; $('stop').disabled=true;});
for(const button of document.querySelectorAll('[data-file]')) button.addEventListener('click',()=>{
  const file=button.dataset.file, html=file==='report', blob=new Blob([artifact(file)],{type:html?'text/html':'application/json'});
  const url=URL.createObjectURL(blob), a=document.createElement('a'); a.href=url; a.download=`${file}.${html?'html':'json'}`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
});
window.rendererExperiment={run,artifact,getState:()=>state,isBusy:()=>busy,stop:()=>{stopped=true;}};
$('run').disabled=false; $('status').textContent='準備完成。選擇案例後，開始一輪比較。';
