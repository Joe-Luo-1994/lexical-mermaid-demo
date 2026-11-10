# Mermaid / Pele：獨立套件篩選

回答「Pele 是否值得接進 editor」，不把套件跑分當成公司改善。此目錄獨立安裝，主工作台、OpenCode plugin 與 root lockfile 無需改動。

[首輪實測與完整公開證據](../../docs/RENDERER-VALIDATION.md) 已隨 repo 保存；歷史樣本不代表公司電腦上的結果。

## 啟動與自動比較

Node **24.x**，從本目錄執行：

```sh
npm run doctor
npm ci
npm run doctor
npm test
npm run bench
npm run start
```

第一次 doctor 缺依賴會回傳 exit 1，屬待處理事項。`start` 使用 production bundle，綁定 `127.0.0.1`，預設選空閒 port 並印出實際網址。保留終端，Ctrl+C 停止。若需固定 port 可設定 `PORT`；占用時回報錯誤，不停止其他服務。

`npm test` 執行三個證據規則測試及 Chromium 的 11 張圖、配對、下載、手機 reflow、停止/尺寸變動、離線報告檢查，不要求某 renderer 一定比較快。`npm run bench` 預設 10 張／5 組配對；設定 `COUNT=1|5|10|11`、`PAIRS=1..10` 可調整（依 shell 語法設定環境變數）。1 組僅適合 smoke check。

瀏覽器可設定 **BROWSER_PATH** 為 Chrome/Edge/Chromium 絕對路徑。否則 Linux 先找 `/usr/bin/chromium`，再用 Playwright 安裝的 Chromium。在核准網路環境可執行 `npx --no-install playwright install chromium`；CI Linux 若缺系統依賴使用 `--with-deps chromium`。不要以 `npx latest` 升級測試版本。

## 你會拿到什麼

自動化產物在 `results/<UTC時間>/`，每次建立新目錄；UI 提供四個下載按鈕：

| 檔案 | 讀者與用途 |
|---|---|
| summary.json | Agent 先讀：配對差值、原始 sample IDs、限制、下一實驗 |
| experiment.json | 固定版本、來源 commit/dirty、build/lock/corpus SHA256、viewport、暖機與變因 |
| samples.json | 每一筆含圖表生成/插入時間、SVG 大小與元素數；保留失敗/慢樣本 |
| report.html | 離線雙欄圖表、來源語法、摘要及實驗設定；SVG 以不執行腳本的 image 顯示 |
| runtime.json | 自動化才有：Chrome/Node/OS、headless、browser checks、錯誤與外連 |

格式為 `renderer-comparison-*`，**不能載入主工作台、report-query.mjs 或 editor-evidence**。OpenCode 2.2.5 可直接用既有本機讀檔工具讀 summary，按 sample ID 查 samples。未新增 plugin API 或自動上傳。

給 agent 的交接文字：

```text
請只讀本次 results/<時間>/summary.json 與 experiment.json；核對 experimentId。
列 Observed/Inferred/Unknown。必要時按 summary 中的 sample ID 查 samples.json，最多先查三筆。
區分生成、插入、完成代理值；保留 slower samples，不將 range/median 稱統計顯著。
人工外觀檢查還沒完成就保持 pending，不因 SVG 存在宣稱相容。
提出一個公司 editor 中可區分原因的實驗，依 docs/EDITOR-INTEGRATION.md。
不要使用 editor-evidence 解析本格式，也不要完整貼 SVG 或 trace 給模型。
```

## 比較契約

- A=Mermaid **12.3.0**，B=Pele **1.13.0**；固定 lockfile。
- 現有 `src/fixtures.ts` 的 10 張圖直接由 build 引用；第 11 張在此目錄補中文/換行/符號。manifest 記錄來源與 corpus hash。無公司案例。
- 每筆前，各自用選定圖表暖機一次，排除於量測之外。保留 renderer 原生快取，不快取 SVG 結果。首次載入／首次生成**未量測**；要驗證需另開全新 browser context，另列結果，不混入暖樣本。
- 同一可見 host 輪流繪圖；沒有 offscreen/iframe 隔離。Pele `render()` 使用固定 font，關閉自動方向變化，未用 `mount()`；Mermaid strict security，不掛互動 callbacks。互動功能不在本輪驗證內。
- `generateMs` 是每次呼叫至回傳合計，包含 renderer 內部等待，非純 CPU。`insertMs` 是 `innerHTML` 寫入合計；不含 host 建立及後續 layout/paint。
- `settledMs` 是第一個生成開始到最後 SVG 寫入後兩次 rAF，包含計數等輕量觀測；不是 paint/TTI。沒有 Lexical 或 Markdown 轉換。
- AB/BA 交替；差值為同組 **Pele − Mermaid**，再取配對差中位數。所有失敗、未完成、背景/尺寸變動樣本保留，阻止整輪彙總，不自動移除較慢值。
- 圖表 layout 與 SVG 結構不同是介入的一部分，需要人工確認語意。共用相同 CSS 字型名稱不保證跨機器實際字型相同；保留 OS/browser，跨機器不直接比較。
- 測量後才生成左右預覽，預覽不計入時間。報告保留 SVG，不是 CPU trace 或 editor replay。
- 預覽與單張 SVG 下載會將產出的 SVG 依 HTML DOM 解析，再 XML 序列化；Mermaid 的 HTML label 可能包含非 XML 的 `<br>`。此步驟只供圖片/離線報告使用，量測區仍直接插入 renderer 原始回傳；不改語法或計時。

## 先判斷品質，再進下一階段

人工檢查原文節點、連線/方向、中文/換行、大小與可讀性；需要的 HTML label、callback、theme、數學/圖示功能需另測。`supports()` 只檢查類型，不代表完整語法相容。

若呈現可接受且差異值得追查，依 [公司接入契約](../../docs/EDITOR-INTEGRATION.md) 在獨立 worktree 中替換 renderer，驗證固定圖表隨文件大小增加的成本。若無法解釋問題或品質不適合，記錄停止原因。第一版不自動新增 worker、lazy load 或第三套 renderer。

## 內網準備與限制

頁面無 CDN、外部字型或 telemetry；安裝依賴需核准 registry/cache。`npm ci --offline` 只在目標 OS/架構的 cache 完整時可行。`results/` 已忽略；不要把公司原文加入本公開 fixture。OpenCode 的模型網路另依公司規範，localhost 不代表推論離線。

[公司起始 prompt](../../docs/COMPANY-START.md) · [上游 Pele API](https://pele.run/api) · [上游相容性](https://pele.run/compatibility) · [上游比較方法](https://github.com/obsidianmd/pele/blob/3a2f075ee0c3d914f0fad3545fc0f193693975ac/scripts/bench-mermaid.mjs)
