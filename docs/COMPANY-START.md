# 到公司後，從這裡接續

目標：用最少接入工作，把「含 Mermaid 的內容注入很慢」轉成一個能區分原因的實驗。先重現、再量測；公開結果不能證明公司根因。

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
請以這份 repo 的 main 作為唯一遠端來源，讀 AGENTS.md、README.md 與 docs/COMPANY-START.md。
核心目標是讓我知道如何利用既有資訊，加速定位公司 Lexical editor 注入後的效能問題。
先不要安裝全部工具或掃描公司專案：
1. 記錄 checkout SHA、dirty 狀態，閱讀 docs/RENDERER-VALIDATION.md 與其連結的 summary/experiment。
2. 用簡短的 Observed/Inferred/Unknown 說明公開結果能支持什麼、還不能支持什麼，引用證據路徑。
3. 依我已說明的目的選路徑：理解診斷流程走 START-HERE；比較 renderer 走本文件入口 A；
   調查公司瓶頸走入口 B。若目的仍不明，先展示已有證據與下一個可區分原因的實驗。
4. 使用已授權的公司專案範圍、資料政策與既有工具；只詢問真正缺少的資訊。
5. 執行所選路徑必要的準備與驗證，保留原始證據，最後交付一個能支持或推翻假設的下一步。
沿用本機 OpenCode 2.2.5，不升級來繞過問題；不把公開 renderer 跑分當成公司 editor 改善。
不要額外拉其他遠端分支，不自動上傳或 push 公司資料。不同證據格式依各自 README 處理。
```

首次交接應說清楚三件事：**已經知道什麼、這次要消除哪個未知、用哪份證據驗證。** 若已有公司重現與足夠證據，可以直接走入口 B，不必先重跑所有公開 benchmark。

## 已知背景

- 公司 Lexical 為 **0.18.0**；React、Mermaid 實際版本要查公司 lockfile 與 runtime。
- 約 20k 字元的 Markdown 轉換已驗證很快；關注 **editor update／注入開始後** 的工作。
- 使用者觀察：無 Mermaid 約 300–400 ms，換入圖表後約 2–3 秒，且文件越大越明顯。這是問題描述，尚非此 repo 留存的公司測量證據。
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
請讀 docs/COMPANY-CASE.md 和 docs/EDITOR-INTEGRATION.md，沿用本 session 已授權的公司專案範圍與資料政策。
公司專案：[填實際路徑；若前文已有就沿用]
重現操作與案例：[填操作與本機檔案，或沿用已給資訊]
讀/改範圍及允許的模型資料：[填缺少的資訊；不覆蓋既有授權]
目標是 editor 注入後的成本，先確認 Lexical/React/Mermaid 實際版本與呼叫位置。
先利用既有 trace/標記；必要時依 EDITOR-INTEGRATION 做最小、可移除的觀測。
只在允許修改時實作，保持 company fixtures 與 trace 在公司核准的本機工作區。
先交付實際流程與一個對照：同一張圖，周圍文件 20k/50k/80k。
若要換 Pele，另開 worktree，固定 component 生命週期與量測終點；不同時加入 lazy load/worker/cache。
每輪保留失敗與慢樣本，檢查輸入、undo、儲存與圖表語意。不要從公開 benchmark 推論公司根因。
```

## 公司前的準備

取得最新 `main` 並記錄 commit；不需要拉取實驗分支。根目錄與 renderer 實驗有不同 lockfile：只做 renderer 篩選時不需安裝根目錄依賴或 OpenCode plugin。

在公司允許的連線環境預備實驗目錄的 `npm ci` 依賴及 Playwright Chromium；也可指定已安裝 Chrome/Edge 的 `BROWSER_PATH`。跨 OS 不直接複製 node_modules；依目標 OS/架構準備 cache 或使用核准 registry。`npm ci --offline` 只有 cache 完整時才會成功。

執行頁面使用本機 bundle 與系統字型，無 CDN；這不表示套件安裝或模型推論可以離線。Pele 固定版本及所有 transitive dependencies 以實驗 lockfile 為準。

## 完成與停止條件

另一個新 session 只靠 repo，能跑公開對照、追到樣本並指出公司接入缺哪段證據，即是這輪交付。Pele 不需要勝出。關鍵語法不合適、生成成本不足以解釋問題，或現有 Mermaid 已足夠好時，保存結論後停止套件探索。
