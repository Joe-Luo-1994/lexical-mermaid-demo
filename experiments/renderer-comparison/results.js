export const metrics = ['generateMs', 'insertMs', 'settledMs'];
export function distribution(values) {
  const xs = [...values].sort((a,b) => a-b), n = xs.length;
  return n ? { n, median: n % 2 ? xs[n>>1] : (xs[n/2-1]+xs[n/2])/2, min: xs[0], max: xs[n-1] } : null;
}
export function summarize(manifest, samples) {
  const reasons = [];
  if (samples.length !== manifest.pairs * 2) reasons.push('未完成全部配對；未剔除不完整或失敗樣本');
  const seen = new Set();
  for (const s of samples) {
    if (seen.has(s.id)) reasons.push(`重複 sample ID：${s.id}`);
    seen.add(s.id);
    if (s.invalid?.length || s.error) reasons.push(`${s.id}: ${[...(s.invalid || []), s.error].filter(Boolean).join('; ')}`);
    if (!metrics.every(k => Number.isFinite(s[k]) && s[k] >= 0)) reasons.push(`${s.id}: 無效計時`);
    if (s.diagrams?.length !== manifest.fixtureIds.length || s.diagrams.some((d,i) => d.id !== manifest.fixtureIds[i] || !d.ok)) reasons.push(`${s.id}: 圖表不完整`);
    if (s.experimentId !== manifest.id) reasons.push(`${s.id}: experiment ID 不符`);
  }
  const pairs = [];
  for (let i=0; i<manifest.pairs; i++) {
    const items = samples.filter(s=>s.pair===i);
    const order = i%2 ? ['pele','mermaid'] : ['mermaid','pele'];
    if (items.length !== 2 || items.some((s,j)=>s.engine!==order[j])) { reasons.push(`配對 ${i+1} 不完整或順序不符`); continue; }
    const a=items.find(s=>s.engine==='mermaid'), b=items.find(s=>s.engine==='pele');
    pairs.push({ pair:i, a:a.id, b:b.id, delta:Object.fromEntries(metrics.map(k=>[k,b[k]-a[k]])) });
  }
  const valid = reasons.length===0;
  return { kind:'renderer-comparison-summary', schemaVersion:1, experimentId:manifest.id,
    status:valid?'measured-visual-review-required':'inconclusive', reasons,
    samples: samples.map(s=>s.id), pairedDifferences:valid?pairs:[],
    timing: valid ? Object.fromEntries(metrics.map(k=>[k, {
      mermaid:distribution(samples.filter(s=>s.engine==='mermaid').map(s=>s[k])),
      pele:distribution(samples.filter(s=>s.engine==='pele').map(s=>s[k])),
      peleMinusMermaid:distribution(pairs.map(p=>p.delta[k])),
      peleLower:pairs.filter(p=>p.delta[k]<0).length,
    }])) : null,
    visualReview:'pending: 需人工確認語意、中文、換行、連線、互動需求；產生 SVG 不等於正確',
    nextExperiment:'呈現可接受且生成差異值得追查時，在 Lexical 0.18.0 中固定同一圖，增加周圍文件 20k/50k/80k；只換 renderer。',
    evidence:{ manifest:'experiment.json', samples:'samples.json', visual:'report.html' },
    limitations:['公開合成 renderer 篩選；未執行 Lexical、Markdown 轉換或公司 editor',
      'generateMs 為呼叫至回傳，包含 renderer 內部工作/等待；非 CPU 專屬時間',
      'insertMs 只量 innerHTML；後續 layout/paint 可能延後發生',
      'settledMs 從開始生成到最後插入後兩次 rAF；非 paint 完成或 TTI',
      '每筆先暖機；首次載入/首次生成另行實驗，這裡未量測',
      '不同 layout/輸出 DOM 是 renderer 介入的一部分，需檢查功能等價',
      '外觀預覽於量測後生成；SVG 經 HTML DOM 解析與 XML 序列化，讓 HTML label 換行可用於圖片',
      '中位數/範圍為描述性數據，不是統計顯著或公司根因；無 profiler tracing'],
  };
}

export function escapeHTML(s) { return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
export function reportHTML(summary, manifest, gallery) {
  const e=escapeHTML;
  return `<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:;">
<title>Renderer comparison · ${e(manifest.id)}</title><style>body{font:16px/1.65 system-ui;background:#f5f4ee;color:#203b32;max-width:1200px;margin:32px auto;padding:0 20px}h1{font-size:32px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:white;padding:20px;border-radius:12px}section{margin:28px 0}article{background:white;border:1px solid #ddd;border-radius:12px;padding:16px;min-width:0}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}img{width:100%;height:420px;object-fit:contain}p{overflow-wrap:anywhere}@media(max-width:700px){.pair{grid-template-columns:1fr}}</style>
<h1>相同語法，兩種繪圖結果</h1><p>${e(manifest.id)} · ${e(summary.status)}</p><p>先檢查語意與可讀性，再判斷時間差異。此檔離線可開啟；圖片為量測後另外產生，非 CPU trace。</p>
<h2>摘要與證據</h2><pre>${e(JSON.stringify(summary,null,2))}</pre>
${gallery.map(g=>`<section><h2>${e(g.title)}</h2><div class="pair">${['mermaid','pele'].map(engine=>`<article><h3>${e(engine)}</h3>${g[engine]?.error?`<p>${e(g[engine].error)}</p>`:`<img alt="${e(g.title)} ${engine}" src="data:image/svg+xml;charset=utf-8,${e(encodeURIComponent(g[engine]?.previewSvg||g[engine]?.svg||''))}">`}</article>`).join('')}</div><details><summary>原始語法</summary><pre>${e(g.source)}</pre></details></section>`).join('')}
<h2>實驗條件</h2><pre>${e(JSON.stringify(manifest,null,2))}</pre></html>`;
}
