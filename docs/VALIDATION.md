# v0.2 驗證紀錄

後續 2026-11-10 Windows 本機、配對實驗與 OpenCode Web 接合狀態見 [WINDOWS-VALIDATION.md](WINDOWS-VALIDATION.md)。以下是原 Linux 驗證的歷史快照，不代表新機已驗證。

## 已實測

2026-11-09，Linux cloud executor、Node 24.22.1、Chromium 156.0.8078.79、production build。Lexical 0.18.0、React 18.3.1、Mermaid 12.3.0。測試來源為公開合成文件。

- 18 項規則／匯入反例／CLI 查詢測試通過。
- 6 組 headless fixture 驗證與 10 種 Mermaid 語法驗證通過。
- Chromium 15 筆非 CDP-tracing 操作完成：正常、刻意重複繪圖、獨立 callback 對照、畫面外容器、預生成 SVG、佔位、80k／10 圖，以及 4 組交錯記錄開關對照。
- 真實按鈕操作、證據選取、比較、JSON 匯出／匯入、偽造 findings 重新計算、無效 JSON 顯示錯誤、完成後輸入不重新繪圖、390px 手機版面通過。
- 另一次操作取得真正 Chrome CDP trace，包含 User Timing 與 Layout 事件。此筆只供診斷，不列入一般效能樣本。
- 桌面／手機截圖已檢視。這是視覺與操作檢查，不是使用者研究或完整無障礙稽核。
- OpenCode **實際 npm SDK** `@opencode/plugin@2.2.5`、Effect 4.0.6：3 項 opt-in plugin 測試通過，涵蓋實際 Host.resolve／Config.Info、模擬 registration host 下的執行與 cleanup、路徑／symlink 界線；strict SDK 型別檢查通過。完整 server／Web runtime 仍未測試。

可檢查 [機器可讀驗證紀錄](evidence/validation.json)、[正常記錄](evidence/normal-recording.json)、[重複繪圖記錄](evidence/duplicate-recording.json)。下載 JSON 後可用工作台「載入記錄」或 `node scripts/report-query.mjs <檔案>` 查詢。同一份證據具有相同 event IDs。

## 這輪學到了什麼

重複案例在同一張圖的相同 source 上刻意再呼叫一次 Mermaid；5 張圖產生 10 次請求。診斷能由事件識別此差異，切回正常流程則為 5 次。診斷沒有使用 scenario 名稱判斷，沒有把獨立 callback 的時間鄰近轉成因果邊。

這只能驗證記錄／診斷管線與受控介入。不能證明公司 Mermaid 卡頓的根因，也不能證明任意重複請求都多餘。

四組 recording off/light 的完成代理值差異方向不一致，存在暖機後仍有的執行波動。樣本不足以設定穩定 overhead 預算。off 仍保留基本計時與計數；不是零 instrumentation。沒有宣稱 token 節省百分比。

OpenCode v2.2.5 的部分 web 文件仍使用舊 `@opencode-ai/plugin` API。實際套件為 `@opencode/plugin`，設定為 `plugins` 目錄與 `mcp.servers`。已移除不相容 autoload tool，改成 CLI 基本流程與通過 SDK 測試的 opt-in plugin。這證明版本標籤上的文件也必須與來源／執行結果交叉驗證。

## 尚未成立的結論

- 公司專案的根因、改善方案及可匯入的文件上限。
- OpenCode 2.2.5 Web 中端到端 agent 診斷、兩個 session 的交接。
- 真實使用者是否更快找到有效實驗；尚未完成 LLM 盲測與使用者試用。
- Perfetto 內嵌與雙向 selection；目前只輸出可載入 viewer 的語意 trace。
- 冷啟動、真實 paint 完成時間，以及注入期間的輸入回應。本輪 UI 測試驗證的是完成後輸入；完成代理值不能冒稱 TTI。
- 跨 source build 的改善比較。第一版 guard 只允許相同 build、版本、fixture、viewport 等條件下的設定介入。

## 持續驗證

`npm test` 執行規則測試、production build 與瀏覽器流程。`.github/workflows/evidence-checks.yml` 提供相同檢查與結果 artifact；本文件不宣稱 GitHub Actions 已執行成功。

每次改變 collector／規則，至少保留正常、重複與非因果對照。改變比較條件時同步更改契約與反例。相同資料增加新的 UI 不應改變事件 ID 或原始內容。

原始 trace 與全部 screenshot 留在本地 `results/`，可由測試重新產生；只將合成且經挑選的證據放在 public repo。公司錄製請放 `recordings/`，該目錄已加入 gitignore。
