import { summarizeExperiment, type ExperimentPair } from './experiment';

export function ExperimentPanel({pairs,running,progress,note,busy,onStart,onStop,onExport,onInspect}: {
  pairs: ExperimentPair[]; running: boolean; progress: number; note: string; busy: boolean;
  onStart:()=>void; onStop:()=>void; onExport:()=>void; onInspect:(pair:ExperimentPair,arm:'normal'|'duplicate')=>void;
}) {
  const summary=summarizeExperiment(pairs), stats=summary.stats;
  const ms=(v:number)=>v.toFixed(1);
  return <section id="experiment-overview" tabIndex={-1} className="experiment-card" aria-label="受控對照實驗">
    <div className="experiment-intro">
      <div><div className="eyebrow">從「好像變慢」到可查證的差異</div>
        <h2>多畫一次，究竟多了多少工作？</h2>
        <p>{pairs.length ? `${pairs.length} 組配對；A 記錄為 ${pairs[0].normal.configuration.size.toLocaleString()} 字元目標、${pairs[0].normal.configuration.count} 張圖。條件一致才彙總，完整設定可查回單筆記錄。` : '同一份 20k 文件、5 張圖，正常與重複流程各跑 10 次。自動交錯順序，每次先暖機。'}</p>
      </div>
      <div className="experiment-actions">
        {running ? <button onClick={onStop}>完成這筆後停止</button> :
          <button className="dark-button" disabled={busy} onClick={onStart}>{pairs.length ? '再做 20k／5 圖對照' : '一鍵驗證差異'}</button>}
        {pairs.length>0 && <button disabled={busy} onClick={onExport}>下載實驗證據包</button>}
      </div>
    </div>
    {running && <div className="experiment-progress"><progress max={20} value={progress}/><span>{progress} / 20 筆 · 請讓本頁保持前景</span></div>}
    {note && <p className="experiment-note" role="status">{note}</p>}
    {pairs.length>0 && !summary.comparable && <div className="comparison-block"><b>保留證據，暫不彙總差異</b><ul>{summary.reasons.map(r=><li key={r}>{r}</li>)}</ul></div>}
    {stats && <>
      <div className="evidence-headline"><span>已觀測 · 請求差異</span><strong>每組多 {stats.requests.min===stats.requests.max ? stats.requests.min : `${stats.requests.min}–${stats.requests.max}`} 次繪圖請求</strong><p>先查回事件，再解釋時間差。這是刻意重複的公開案例，尚未定位公司專案的觸發來源。</p>
        <button disabled={busy} onClick={()=>onInspect(pairs[0],'duplicate')}>查看第一組重複流程的證據 →</button>
      </div>
      <div className="experiment-results">
        <div><span>正常流程 · 完成代理值中位數</span><strong>{ms(stats.normal.median)} <small>ms</small></strong><small>範圍 {ms(stats.normal.min)}–{ms(stats.normal.max)} ms</small></div>
        <div><span>重複流程 · 完成代理值中位數</span><strong>{ms(stats.duplicate.median)} <small>ms</small></strong><small>範圍 {ms(stats.duplicate.min)}–{ms(stats.duplicate.max)} ms</small></div>
        <div><span>配對差值中位數 · 重複 − 正常</span><strong>{stats.delta.median>0?'+':''}{ms(stats.delta.median)} <small>ms</small></strong><small>{stats.positivePairs} / {stats.pairs} 組重複流程較久</small></div>
      </div>
      <div className="experiment-verdict">
        <h3>已看到的差異</h3><p>{stats.pairs} 組完整對照，每組繪圖請求差值為 {stats.requests.min===stats.requests.max ? stats.requests.min : `${stats.requests.min}–${stats.requests.max}`} 次。時間差的範圍為 {ms(stats.delta.min)}–{ms(stats.delta.max)} ms；方向{stats.positivePairs===0||stats.positivePairs===stats.pairs?'在這組樣本一致':'並非每組一致'}。</p>
        <p><b>現在可以做的決定：</b>先點開下方一組，核對同一圖表的請求事件，再決定是否值得追查重複觸發來源。這個刻意介入只驗證診斷管線，不能證明公司的請求多餘。</p>
      </div>
      <details className="experiment-pairs"><summary>追到每一筆證據 · {stats.pairs} 組{stats.pairs<10?'（未滿 10 組）':''}</summary>
        <table><thead><tr><th>配對</th><th>正常 A</th><th>重複 B</th><th>B − A</th></tr></thead><tbody>{pairs.map((p,i)=><tr key={p.normal.id}><th>{i+1}</th>
          <td><button disabled={busy} onClick={()=>onInspect(p,'normal')}>{ms(p.normal.metrics.completionProxyMs)} ms ↗</button></td>
          <td><button disabled={busy} onClick={()=>onInspect(p,'duplicate')}>{ms(p.duplicate.metrics.completionProxyMs)} ms ↗</button></td>
          <td>{ms(p.duplicate.metrics.completionProxyMs-p.normal.metrics.completionProxyMs)} ms</td></tr>)}</tbody></table>
      </details>
    </>}
    <p className="experiment-caveat">公開合成案例 · 不含 Markdown 解析與暖機；完成值是插入後兩次 rAF，非 paint／TTI。中位數與範圍是描述性結果，不是統計顯著或穩定改善的證明。背景負載與記錄開銷仍存在。</p>
  </section>;
}
