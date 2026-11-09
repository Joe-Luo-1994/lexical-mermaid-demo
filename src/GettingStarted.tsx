export function GettingStarted({busy,onImport,onDemo,onConfigure}: {
  busy:boolean; onImport:()=>void; onDemo:()=>void; onConfigure:()=>void;
}) {
  return <section className="start-guide" aria-label="開始診斷">
    <div className="start-heading"><span className="eyebrow">從這裡開始</span><h2>先看懂一份證據，再追查你的問題。</h2></div>
    <div className="start-options">
      <article><span className="route-number">01 / 第一次使用</span><h3>體驗公開案例</h3>
        <p>在這台電腦錄製正常與重複繪圖流程。從差異找到事件，最後帶走可交接的證據。</p>
        <button className="dark-button" disabled={busy} onClick={onDemo}>前往公開對照實驗 →</button>
        <small>20k 字元 · 5 張圖 · 20 筆量測 · 可停止</small>
      </article>
      <article><span className="route-number">02 / 已有證據</span><h3>載入我的 recording</h3>
        <p>開啟本工具匯出的單筆 JSON 或實驗證據包，重新計算觀測與比較條件。</p>
        <button disabled={busy} onClick={onImport}>選擇證據檔案</button>
        <small>只在本頁解析；不接受任意公司文件或 Chrome trace。</small>
      </article>
    </div>
    <div className="start-foot"><span>公開實驗 → 可查證的交接 → 公司案例另行蒐證</span><button disabled={busy} onClick={onConfigure}>我要自訂一次重現</button></div>
  </section>;
}
