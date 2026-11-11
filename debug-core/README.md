# Agent Debug core：小核心，專案觀測由 agent 生成

這是第一個可執行切片：**開始案例 → 執行授權 adapter → 保存/查詢證據 → 定位事件與來源 → 帶著原期限續接**。使用 Node 24 built-ins，核心不需要 npm install。瀏覽器 adapter 與選用 OpenCode plugin 各需其相依工具。

不是自動根因分析器；不宣稱 100 ms 可見回應驗收、修復成立、Perfetto 接合、公司案例定位或框架效率優勢。舊 `design/agent-debug` 仍是合成設計；本目錄 reader 只讀實際 case artifacts，不補合成資料。

## 先體驗，不用安裝 editor 依賴

Repo 隨附本輪公開 Lexical 範例的封存錄製。只需 Node 24：

```sh
node debug-core/cli.mjs query --case debug-core/evidence/public-case --limit 2
node debug-core/cli.mjs serve --case debug-core/evidence/public-case
```

打開印出的 URL → 選 `e3` → 看來源與 `e4` 關係 → 下載交接摘要。這是歷史公開案例，原 root 不存在或期限已過不代表資料損毀，詳見 [證據說明](evidence/README.md)。

## 在既有專案開始

先由人完成必要登入與一次性初始化。Agent 沿用已授權的範圍，準備隔離 worktree；公司修復合併仍由人決定。工具 repo 與受測專案可以是不同目錄。

以下 `<...>` 是需替換的實際路徑。先建立 case 的父目錄，case 本身不可已存在。啟動案例後掃描、生成、build、重現與分析都算入原本的 30 分鐘。

```sh
node <tool-repo>/debug-core/cli.mjs init --case <case-dir> --project <project-worktree> --operation "開啟指定尚未顯示的文件"
node <tool-repo>/debug-core/cli.mjs run --case <case-dir> --plan <plan.json> -- node <project-worktree>/debug/adapter.mjs
node <tool-repo>/debug-core/cli.mjs query --case <case-dir> --limit 5
node <tool-repo>/debug-core/cli.mjs serve --case <case-dir>
```

`serve` 顯示實際 loopback URL，Ctrl+C 關閉。它沒有錄製/修改/執行命令的 HTTP API。網站只讀本案保存的來源快照與 artifacts；不要把服務綁到公司網段或 public host。原始 trace、來源快照可能含公司資料，留在核准位置；gitignore 不代表有權送給模型。

## Agent 需要生成什麼

先讀 [操作規約](AGENT-PLAYBOOK.md)。根據問題使用 rg、Code Graph 或現有 profiler 縮小範圍，不要求完整索引，不必為了展示功能增加探針。

1. `plan.json`：具體未知、不同結果如何改變下一步、來源範圍與限制。
2. adapter：操作既有 app、安裝/移除必要探針、保留 raw 記錄、寫出 capture。它是核准的程式碼，runner 不提供其檔案或網路沙箱。
3. 下一實驗：介入、控制、功能要求、支持/削弱/無法區分的結果。

Plan 最小形狀：

```json
{
  "question": "這次文件切換中，listener 是否再次發起 update？",
  "outcomes": ["有明確呼叫：檢查必要性並設計介入", "未捕捉到：檢查覆蓋或其他昂貴工作，不推論沒有發生"],
  "sources": ["src/DocumentPlugin.tsx", "debug/adapter.mjs"],
  "limitations": ["詳細觀測開銷未校準；此輪不能作改善驗收"]
}
```

程式來源、probe/adapter、相關 build 設定都應納入來源清單與 provenance。不能只寫入口檔案，就宣稱已知全部依賴。實際格式與上限見 [FORMAT](FORMAT.md)。

Adapter 的工作目錄是 project root，從環境讀 `DEBUG_RUN_DIR`、`DEBUG_RUN_ID`、`DEBUG_DEADLINE`；產物寫入 run dir，最後產生 `capture.json`。不得寫入核心 `.core/`、改 case ledger 或驗收規則。每次 run 有新 ID，失敗也保留，不用同一檔案覆蓋慢樣本。

## 人與 agent 查同一份證據

```sh
node <tool-repo>/debug-core/cli.mjs query --case <case-dir> --run <run-id> --limit 5 --offset 0
node <tool-repo>/debug-core/cli.mjs query --case <case-dir> --run <run-id> --event <event-id>
```

預設摘要有界；用回傳的分頁資訊繼續，或以 run/event ID 查證。不要把完整 raw trace 貼進 context。查詢過期案例不重設 deadline。沒有足夠 usage 資料時 token/費用為 unknown，不是免費。

Viewer 可從事件定位 rawRef 與保存的 source line，並顯示當前檔案是否改變。這是本機證據 inspector，**不是 Chrome CPU profiler 或確定性 replay**。語意 span 可含等待；重疊 span 不能相加當 CPU。歷史快照有效不代表它仍能歸因目前程式。

選用 OpenCode **2.2.5** 接合新增唯讀 `editor-debug-case` tool，與舊 `editor-evidence` recording tool 分開。沿用 [plugin 設定](../docs/OPENCODE.md)，不要覆寫既有設定。Case 與其 project root 必須在 active OpenCode location 之內；工具不啟動命令、不上傳。SDK 測試不等於 Web 端實際載入通過。

## 邊界與恢復

| 狀況 | 行為／恢復 |
|---|---|
| deadline 已到 | 拒絕新 run；保留 query/serve 作交接，不偷偷開新 30 分鐘 |
| 控制程序中斷 | 保留 running attempt，後續查詢揭露 interrupted；先確認原程序已停止再處理 lock，不自動刪鎖 |
| adapter/build 失敗 | 保存 exit、有限 stdout/stderr 與 attempt；修正後在同一案例原 deadline 內另開 run |
| source 改變 | 原始快照保留，current applicability 為 stale；需要重新觀測受影響範圍 |
| 證據/引用不一致 | invalid capture；不顯示為可信執行路徑 |
| 缺 source 或覆蓋 | 明列 unresolved/limitations；不猜 component 名稱或宣稱沒執行 |
| artifact 過大 | 拒絕採納；這是接受上限，不是對任意 adapter 的硬碟配額 |

Runner 的 deadline 限制它啟動的工作，不控制任意 agent shell 或思考。系統時鐘變更、宿主權限及 Windows 子程序樹清理需額外宿主能力；不宣稱整案全程沙箱。來源/證據雜湊能偵測不一致，不能防止具有寫入權限的 agent 重寫整份證據與雜湊。

## 驗證與下一步

核心反例：`node --test debug-core/core.test.mjs debug-core/cli.test.mjs`。瀏覽器／獨立 Lexical 接合依其驗證腳本與 [交付紀錄](VALIDATION.md) 執行；需 repo 鎖定的 Playwright 等相依套件。

交付只聲稱實際有證據的層次。下一個公司案例要驗證：agent 能否依內部結構生成合適觀測，30 分鐘內交付有證據的路徑及下一實驗；受控接合不能代替公司結果或公平對照。
