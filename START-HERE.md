# 明天第一次打開，就從這裡開始

**Editor Evidence 幫你把「匯入好像變慢」變成一個有證據、能驗證的下一步。**

第一個可交付成果不是漂亮的效能數字，而是：你能指出多出的工作，點回原始事件，交給 agent 查同一份資料，再決定下一個實驗。這是公開合成原型，還不是任意公司 editor 的自動錄製器。

## 有 agent：貼這一句，先讓它把環境跑起來

```text
請讀取這個 repo 的 AGENTS.md、START-HERE.md 與 docs/AGENT-START.md，執行「A：公開案例首次體驗」。
請直接完成可逆的本機準備、production preview 與實測，保留既有修改與服務。
只使用公開合成資料；不要搜尋公司專案，不讀憑證、不改全域設定、不上傳、不 push。
若環境受阻，先完成 CLI 範例診斷，留下具體錯誤、最短恢復方式與未驗證項目。
最後帶我完成一個從差異點回事件的例子，不要只列測試通過。
```

不依賴特定 agent 品牌。OpenCode plugin 是選用，CLI 就能開始。

## 沒有 agent：最短啟動

先確認 `node --version` 為 24.x；版本不符時用既有版本管理器或使用者層級隔離 Node，別改其他專案。

```sh
npm run doctor
npm ci
npm run doctor
npm run start
```

第一次 doctor 報「尚未安裝依賴」是待完成事項。`start` 建立 production build 並啟動 loopback preview；開啟終端顯示的實際網址，預設 `http://127.0.0.1:4173`，占用時 Vite 會選下一個 port。終端保持運作，停止按 Ctrl+C。

## 五步看到價值

1. 按 **一鍵驗證差異**。頁面保持前景，正常與刻意重複流程各跑10次；你可中途停止。
2. 看請求數差值、配對時間差與範圍。正常預期5次、重複預期10次；這是受控案例，**不要求某台電腦一定快多少**。
3. 展開 **追到每一筆證據**，點一筆重複流程，再點證據ID。確認同一 diagramId 的兩筆請求；相同字元數不證明 source 全文相同。
4. 下載 **實驗證據包**，重新整理後用 **載入記錄** 還原。選定一筆後按 **JSON**，另匯出供 agent 讀取的單筆 recording。
5. 把單筆JSON放進此專案 `recordings/`，按 **複製給 OpenCode**，貼給 agent；它必須引用同一 report/event ID，列未知，再提出一個可否證實驗。

**你可以判定它是否值得留下：**不用重講背景，另一個人或 agent 能從同一份證據指出「看到了什麼、哪個解釋還沒證實、接著只改什麼」。如果只是重述數字或猜 React 根因，這次交付就不合格。

## 安裝受阻，也能先看一個完整例子

有 Node 就能執行以下零第三方依賴 CLI，不需 npm ci、瀏覽器、OpenCode 或模型登入：

```sh
node scripts/report-query.mjs docs/evidence/duplicate-recording.json --limit 2
node scripts/report-query.mjs docs/evidence/duplicate-recording.json --event bdcada32-e342-42ad-8ab5-c15452320751:2:e11
node scripts/report-query.mjs docs/evidence/duplicate-recording.json --event bdcada32-e342-42ad-8ab5-c15452320751:2:e17
```

你會讀到 report `run-bdcada32-e342-42ad-8ab5-c15452320751-2`、同為 `classes` 的 attempt 1/2。這些是隨repo附帶的既有合成證據，**不是你公司電腦剛量測的結果**。完整範例與不合格答案見 [第一次判讀](docs/FIRST-DIAGNOSIS.md)。

## 依你的情況繼續

- [Agent完整任務與受阻恢復](docs/AGENT-START.md)
- [開始處理公司案例](docs/COMPANY-CASE.md)：先授權範圍、確認版本與資料可否進模型，再蒐證。
- [OpenCode選用plugin](docs/OPENCODE.md)：先確認2.2.5，不替換既有版本；模型登入只在本機介面完成。
- [實驗與判讀契約](docs/EXPERIMENT_CONTRACT.md)／[規則](docs/DIAGNOSTIC_RULES.md)
- [交付版本檢查](docs/DELIVERY.md)：明天clone拿到的版本，不一定包含今天未發布的本機改進。

不要把冷啟動、Markdown解析、paint/TTI或公司根因算在此原型已證明的範圍。資料目前保留在頁面記憶體，重新整理前請匯出。
