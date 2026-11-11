# 到公司後，從這裡接續

目標：讓 agent 依既有專案與具體問題生成適量觀測，在 30 分鐘調查內交付有證據的執行路徑與有判別力的下一實驗。新版 [契約](AGENT-DEBUG-CONTRACT.md)、[驗收矩陣](AGENT-DEBUG-ACCEPTANCE.md) 與 [可行性實驗](AGENT-DEBUG-SPIKE.md) 是需求來源；enforcement 尚待實作。舊 renderer 實驗仍可作參考，不預設每次都要重跑。

## 公司只需一個分支

所有入口、工具、實驗與公開證據都由 **`main`** 交付，不需要另拉 PR branch。首次取得可用：

```sh
git clone --branch main --single-branch https://github.com/Joe-Luo-1994/lexical-mermaid-demo.git
cd lexical-mermaid-demo
git rev-parse HEAD
```

已有 checkout 時，先確認未提交修改再更新 `main`，不要用 reset/clean 覆蓋本機工作。記錄取得的 commit，方便同事對齊證據與程式版本。不同目錄的獨立依賴不代表需要不同分支；只安裝本次要使用的部分。

## 共用起始 prompt

不必看過原始聊天，將這段交給公司允許的 OpenCode 2.2.5／Codex：

```text
請以這份 repo 的 main 作為唯一遠端來源，讀 AGENTS.md 及 docs/AGENT-DEBUG-CONTRACT.md、
docs/AGENT-DEBUG-ACCEPTANCE.md、docs/AGENT-DEBUG-SPIKE.md。
目標是依專案當前狀態生成有效觀測；現有 demo/renderer 工具只是參考，不是產品目標。
1. 記錄 checkout/dirty 與能力清單，區分已實作、待實作、待實測；不得宣稱規格就是 enforcement。
2. 沿用本 session 已授權的公司路徑與資料流向，只詢問缺項。沒有路徑就先做公開可行性準備。
3. 本案是網站已開啟後點進尚未顯示文件的主執行緒阻塞。先重現、定位相關來源與缺證，
   再用現有工具及最小生成 patch 消除未知；不為了畫全圖或埋滿事件而工作。
4. 環境可啟動且人已完成登入後，調查最多 30 分鐘，包含掃描/索引/建置/子任務。
   目前若沒有可信 runner deadline，就明列為人工/宿主計時，不能聲稱已強制執行。
5. 已核准範圍可在隔離 worktree 自動觀測、修復、測試；合併由人決定。成本如實記錄。
6. 人可沿用 Chrome/Perfetto，但摘要要能定位同一事件/時間/來源。可見輸入/捲動回應門檻
   是 100 ms，不能拿 handler、DOM 或兩次 rAF 代替；延後內容另測捲入反應。
交付 Observed/Inferred/Unknown、原始證據與下一個有判別力的實驗；未達成要明列。
不自動上傳/push 公司資料、不升級 OpenCode 2.2.5 繞過問題，不把公開結果當公司根因。
```

首次交接應說清楚三件事：**已經知道什麼、這次要消除哪個未知、用哪份證據驗證。** 若已有公司重現與足夠證據，可以直接走入口 B，不必先重跑所有公開 benchmark。

## 已知背景

- 新版已確認：網站已開啟後，進入未顯示文件時約 3 秒無回應，使用者已排除網路傳輸。Pele 已試用且回報效能良好；剩餘調查不預設是 Mermaid/Pele 瓶頸。
- 公司 Lexical 為 **0.18.0**；React、Pele 及仍在使用的 renderer 實際版本要查公司 lockfile 與 runtime。
- 歷史 renderer 案例中，約 20k 字元的 Markdown 轉換已驗證很快；當時關注 **editor update／注入開始後** 的工作。
- 當時使用者觀察：無 Mermaid 約 300–400 ms，換入圖表後約 2–3 秒，且文件越大越明顯。這是歷史問題描述，不證明新版載入問題仍由同一原因造成，也不是此 repo 留存的公司測量證據。
- OpenCode **2.2.5 Web**、server 在自己的電腦；公司內網可存取 public repo。Desktop Codex 也可使用相同流程。
- 公開工具已提供合成案例、單筆 recording 查詢與配對實驗。新 renderer 實驗是獨立格式，不是任意公司 editor 的錄製器。

## 入口 A：先比較公開 Mermaid／Pele（不需要公司專案）

將下面整段交給本機 agent：

```text
請讀 AGENTS.md、docs/COMPANY-START.md、experiments/renderer-comparison/README.md。
執行公開 renderer 篩選，不搜尋公司檔案。保持既有修改、套件版本與服務。
1. 記錄本 repo SHA、dirty 狀態、Node/OS；從 root 執行 node scripts/doctor.mjs --renderer。
2. 在 experiments/renderer-comparison 中，依獨立 lockfile 安裝 npm ci。
   只能用公司允許的 registry/cache；缺件就留下錯誤與確切恢復步驟，不改全域設定。
3. 執行 npm test，確認實際 Chromium 的 SVG、匯出、失敗處理與響應式檢查。
4. 執行 npm run bench。讀本次輸出的 summary.json，按需查 samples.json 的 sample ID。
   不把 summary 當主工作台 recording，不呼叫 editor-evidence 解析它。
5. npm run start 留下實際 localhost URL，帶我看左右圖並人工核對中文/換行/連線。
最後交付 Observed/Inferred/Unknown、證據目錄、未驗證層級，以及一個可否證的下一實驗。
不要宣稱公司已加速、統計顯著或首次載入已驗證；不要自動 push、上傳或改公司 editor。
```

預期產物：`experiments/renderer-comparison/results/<時間>/` 內四份證據與 runtime 資訊；依賴或瀏覽器阻塞時，仍可讀實驗契約及 root 的 `npm run demo:cli`。

## 入口 B：公司 editor 接入

沿用 [COMPANY-CASE.md](COMPANY-CASE.md) 的範圍與資料使用約定。既有 session 已授權的路徑和操作不需要重複確認；缺的資訊才補充。使用者未指定公司路徑時，不自行掃描磁碟。

```text
請先讀 docs/AGENT-DEBUG-CONTRACT.md 與 docs/AGENT-DEBUG-SPIKE.md，沿用本 session 已授權的公司專案範圍與資料政策。
公司專案：[填實際路徑；若前文已有就沿用]
重現操作與案例：[填操作與本機檔案，或沿用已給資訊]
讀/改範圍及允許的模型資料：[填缺少的資訊；不覆蓋既有授權]
先確認實際版本、重現/快取/首屏條件與工具能力。從已準備環境開始計 30 分鐘，含索引與建置。
先利用既有 trace；必要時根據候選路徑生成最小、可移除的觀測，記錄結果如何改變下一步。
已核准範圍可在隔離 worktree 自動加觀測、候選修復並測試；合併由人決定。
公司資料保留在核准的本機工作區。不同事件/trace/recording 格式不互相冒充。
先交付有證據的路徑與可否證下一實驗；保留失敗、成本、覆蓋缺口與無法支持的判斷。
若延後畫面外內容，另驗證捲入不卡頓；首屏完整及輸入/捲動可見回應 100 ms 是不同條件。
不能把公開 demo CI 當作本調查框架通過，也不預設要更換 renderer。
```

## 公司前的準備

取得最新 `main` 並記錄 commit；不需要拉取實驗分支。根目錄與 renderer 實驗有不同 lockfile：只做 renderer 篩選時不需安裝根目錄依賴或 OpenCode plugin。

在公司允許的連線環境預備實驗目錄的 `npm ci` 依賴及 Playwright Chromium；也可指定已安裝 Chrome/Edge 的 `BROWSER_PATH`。跨 OS 不直接複製 node_modules；依目標 OS/架構準備 cache 或使用核准 registry。`npm ci --offline` 只有 cache 完整時才會成功。

執行頁面使用本機 bundle 與系統字型，無 CDN；這不表示套件安裝或模型推論可以離線。Pele 固定版本及所有 transitive dependencies 以實驗 lockfile 為準。

## 完成與停止條件

另一個新 session 只靠 repo，能跑公開對照、追到樣本並指出公司接入缺哪段證據，即是這輪交付。Pele 不需要勝出。關鍵語法不合適、生成成本不足以解釋問題，或現有 Mermaid 已足夠好時，保存結論後停止套件探索。
