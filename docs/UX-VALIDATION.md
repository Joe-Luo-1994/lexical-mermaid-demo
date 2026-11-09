# UX 工作台驗證 · 2026-11-10

## 本輪交付

- 首次使用雙入口：公開對照與匯入 recording。自訂設定按需展開；開始錄製或成功匯入後收起導覽，可重新開啟。
- 請求差異優先、直接開啟第一組證據、配對 A/B 上下文與返回摘要。
- 事件檢視的焦點與返回位置；分頁方向鍵及 Home/End；跳到工作區、較大的文字／操作目標與 reduced-motion。
- 交接指南區分單筆 JSON、實驗證據包及 agent 所需的 report/event ID。
- DESIGN.md 保存採用的設計規則，無新增 runtime 依賴、遠端字型或 CDN。

## Observed：本機實測

Windows x64、Node 24.22.2、Chrome 156.0.8078.81、production build。Lexical 0.18.0、React 18.3.1、Mermaid 12.3.0 未變。

- `npm run validate`：6 組 fixture 與 10 個 Mermaid 語法檢查通過。
- `npm run test:rules`：27 tests 通過（由首次 `npm test` 執行）。
- TypeScript 與 Vite production build 通過；既有大型 chunk 警告仍存在。
- `npm run test:browser`：原 evidence 流程、20 筆配對實驗、匯出／匯入、條件漂移阻擋、停止與背景失效處理，以及新增 UX 檢查通過。
- 最後鍵盤焦點調整後再執行 build 與 `npm run test:ux`：6 組檢查通過；核對 report/event ID、返回焦點、方向鍵焦點保留、匯出 ID、390/640/1280 CSS px 無整頁溢出、減少動態效果；page/console errors 為 0。

原始本機日誌與截圖：`results/ux/`；原驗收：`results/validation.json`、`results/value/experiment-validation.json`。results 不提交公開 repo；首頁截圖僅含公開空白工作台。

## 保留的失敗與修正

1. 沙箱 loopback preview 啟動逾時；相同測試在一般本機執行環境成功。
2. 首次完整測試在停止後找不到收合區內的錄製按鈕；測試增加實際展開自訂設定的操作，原 `isEnabled` 斷言保留。原日誌為 `results/ux/initial-test-failure.log`。
3. 審查發現鍵盤分頁可能因殘留選取事件而失去焦點；改為只有點擊證據才移動焦點，新增等待後的焦點斷言。

## Unknown：仍未建立的結論

沒有宣稱完整 WCAG 合規、200% 真實瀏覽器縮放已驗證、人類操作時間縮短、公司根因已解決。640 CSS px 檢查是窄 viewport reflow，不冒稱瀏覽器縮放測試。本輪未重新登入或操作 OpenCode Web；既有接合紀錄見 WINDOWS-VALIDATION.md，工具協定與交接文字生成未修改。

下一個產品驗證：由第一次使用的人，在無口頭提示下完成「公開對照 → 找到額外請求事件 → 交接單筆 JSON」。記錄停頓、誤點與是否引用正確 ID，據此判斷導覽是否真的降低理解成本。
