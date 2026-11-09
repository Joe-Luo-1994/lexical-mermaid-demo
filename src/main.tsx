import {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {LexicalComposer} from '@lexical/react/LexicalComposer';
import {RichTextPlugin} from '@lexical/react/LexicalRichTextPlugin';
import {ContentEditable} from '@lexical/react/LexicalContentEditable';
import {LexicalErrorBoundary} from '@lexical/react/LexicalErrorBoundary';
import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {ListPlugin} from '@lexical/react/LexicalListPlugin';
import {TablePlugin} from '@lexical/react/LexicalTablePlugin';
import {LinkPlugin} from '@lexical/react/LexicalLinkPlugin';
import {richNodes} from './nodes';
import {MermaidNode} from './MermaidNode';
import {connect, labels, modes, type Mode, type Sizing} from './lab';
import './style.css';

function Lab() {
  const [editor] = useLexicalComposerContext();
  const [mode,setMode] = useState<Mode>('inline');
  const [size,setSize] = useState(20000);
  const [count,setCount] = useState(5);
  const [sizing,setSizing] = useState<Sizing>('natural');
  const [status,setStatus] = useState('先準備資料，再注入 editor。');
  const [ready,setReady] = useState(false);
  const [busy,setBusy] = useState(false);
  const [rows,setRows] = useState<ReturnType<Window['bench']['results']>>([]);
  useEffect(()=>connect(editor,()=>{setRows(window.bench.results());setBusy(false);setStatus('量測完成。可匯出結果，或準備下一組。');}),[editor]);
  async function prepare() {
    setBusy(true);setReady(false);
    try {setStatus('正在準備混合格式文件並暖機各圖表類型…');const info=await window.bench.prepare(mode,size,count,sizing);setReady(true);setStatus(`已準備 ${info.chars.toLocaleString()} 字元、${info.nodes} nodes、${info.tables} 張表格、${count} 張圖；準備耗時不列入注入計時。`);}
    catch(error){setStatus(String(error));} finally {setBusy(false);}
  }
  function inject() {setReady(false);setBusy(true);setStatus('注入中…'); requestAnimationFrame(()=>window.bench.run());}
  function download() {
    const url=URL.createObjectURL(new Blob([JSON.stringify(window.bench.results(),null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='injection-results.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <>
    <header><div className="eyebrow">PERFORMANCE LAB / 02 · RICH DOCUMENT</div><h1>Lexical × Mermaid</h1><p>工程文件情境：多種格式、表格、程式碼與 5–10 張不同布局的圖表。直接注入 Lexical state。</p></header>
    <section className="controls">
      <label>實驗組<select value={mode} disabled={busy} onChange={e=>{setMode(e.target.value as Mode);setReady(false);}}>{modes.map(m=><option value={m} key={m}>{labels[m]}</option>)}</select></label>
      <label>內容規模（約）<select value={size} disabled={busy} onChange={e=>{setSize(+e.target.value);setReady(false);}}>{[20000,50000,80000].map(s=><option key={s}>{s}</option>)}</select></label>
      <label>Mermaid 張數<select value={count} disabled={busy} onChange={e=>{setCount(+e.target.value);setReady(false);}}><option value={5}>5 張 · 架構與資料模型</option><option value={10}>10 張 · 完整設計文件</option></select></label>
      <label>圖表高度<select value={sizing} disabled={busy} onChange={e=>{setSizing(e.target.value as Sizing);setReady(false);}}><option value="natural">自然高度</option><option value="fixed">固定 260 px</option></select></label>
      <button onClick={prepare} disabled={busy}>1. 準備資料</button><button className="primary" onClick={inject} disabled={!ready||busy}>2. 注入 content</button><button onClick={download} disabled={!rows.length}>匯出 JSON</button>
    </section>
    <p className="status" role="status">{status}</p>
    <section className="results"><table><thead><tr><th>模式 / 字元</th><th>Commit</th><th>生成區間</th><th>完成代理值¹</th><th>最長阻塞 task²</th><th>生成次數</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{labels[r.mode]} / {r.chars.toLocaleString()} / {r.diagramCount} 圖 / {r.sizing}</td><td>{r.spans['lexical-commit']?.toFixed(1)} ms</td><td>{r.generateMs.toFixed(1)} ms</td><td>{r.completionProxyMs.toFixed(1)} ms</td><td>{r.maxOverlappingLongTaskMs.toFixed(1)} ms</td><td>{r.calls}{r.error?' · ERROR':''}</td></tr>)}</tbody></table>{!rows.length&&<p className="empty">尚無結果 · 使用 production build 進行比較</p>}</section>
    <p className="note">¹ SVG 插入後兩次 rAF，並非實際 paint 完成時間。 ² 只計入注入區間重疊的 long task；0 不代表沒有短暫阻塞。自然高度會反映圖表尺寸變動；固定高度可用於排除這個變因。生成區間從第一張請求到最後一張回傳，包含排隊。</p>
    {rows.length>0&&<details className="diagram-details"><summary>最近一次 · 各圖表請求耗時（含 Mermaid 排隊）</summary><table><thead><tr><th>圖表</th><th>類型</th><th>請求 → 回傳</th><th>插入時間</th><th>狀態</th></tr></thead><tbody>{rows.at(-1)!.diagrams.map(d=><tr key={d.id}><td>{d.title}</td><td>{d.kind}</td><td>{d.resolved!==undefined&&d.requested!==undefined?`${(d.resolved-d.requested).toFixed(1)} ms`:'—'}</td><td>{d.inserted?.toFixed(1)} ms</td><td>{d.error??'完成'}</td></tr>)}</tbody></table></details>}
    <ListPlugin/><TablePlugin/><LinkPlugin/>
    <div className="editor-heading">LIVE EDITOR <span>可直接輸入；自動化會在注入期間送出按鍵。</span></div>
    <RichTextPlugin contentEditable={<ContentEditable className="editor" aria-label="Benchmark editor"/>} placeholder={null} ErrorBoundary={LexicalErrorBoundary}/>
  </>;
}

createRoot(document.getElementById('root')!).render(<LexicalComposer initialConfig={{namespace:'injection-lab',nodes:[MermaidNode,...richNodes],onError:error=>{throw error;},theme:{paragraph:'paragraph',code:'code-block',text:{bold:'text-bold',italic:'text-italic',strikethrough:'text-strike',code:'text-code'}}}}><Lab/></LexicalComposer>);
