# 可執行核心交付紀錄

日期：2026-11-11。這是第一個工程接合交付，**不是整體框架驗收完成**。

## 可以實際使用的部分

- Node 24 CLI：init / run / query / serve，不需核心 runtime 套件安裝。
- 有界案例與 attempt ledger、原 deadline、程序取消、失敗保存、來源/adapter/git provenance、core implementation fingerprint。
- 真實 raw event 與來源快照的引用檢查、同步關係一致性與完整性檢查；過期/缺失/無效分開呈現。
- 本機唯讀 inspector：從 finding 到同一 run/event/rawRef/source line；有界摘要、分頁、交接與未知狀態。
- OpenCode 2.2.5 選用唯讀 `editor-debug-case` tool，與舊 recording tool 共存。

## 已執行的驗證

| 層次 | 結果 | 證據與意義 |
|---|---|---|
| 核心反例 | 25 項通過 | scope/symlink、錯誤引用、parent/cycle、來源變更、artifact/ledger 竄改、期限/並行鎖、資料上限、核心指紋、虛構 100 ms/成本等；只涵蓋這些測試情境 |
| 封存首次體驗 | 1 項通過 | 核對隨附 case 的完整性、來源與非因果邊；不依賴原專案存在 |
| CLI／OpenCode 讀取邊界 | 2 項通過 | 輸入不歧義、case/project root 不越過 active location |
| 生成 probe | 3 項通過 | this/return/throw、同步 parent 邊界、buffer/drop/inactive；不是完整語意等價證明 |
| OpenCode 2.2.5 SDK | 4 項通過 | 真實 SDK registration/schema/execute；新工具 server/Web 實際載入未驗證 |
| Viewer | 24 項通過 | [紀錄](evidence/viewer-check.json)：錯誤、來源、raw、keyboard、窄畫面、分頁、無來源 announcement、可展開限制；無 browser errors/外部請求 |
| 公開 Lexical runtime | 通過有限接合 | [完整紀錄](examples/lexical-rich/verification.json)：baseline 與 instrumented 兩次 runner attempt，4 spans、2 sync edges、1 temporal association；40 段落、14 粗體、文字 hash 與 typing 一致 |
| 真實案例產物導航 | 10 項通過 | [紀錄](evidence/navigation-check.json)：實際公開錄製的事件/保存來源/行號/hash/deep link/handoff；不是外部 Perfetto 導航 |
| Fresh-agent 續接 | 一次 smoke check 通過 | [紀錄](evidence/handoff-check.json)：無前文 agent 用摘要與 3 次事件查詢，辨識 e3→e4 與 e2→e3 的不同證據強度；不是盲測效率對照 |
| 既有 app | build、資料語法、rules 與 6 項 UX 通過 | root app 未改；一般 sandbox 無法跑的 CLI 子程序測試在允許 subprocess 的環境重跑通過 |

[交付來源指紋](evidence/verification.json) 記錄被測程式。完整本機 log/raw 留在本輪 results；公開 runtime 的兩次封存 attempt 也隨 repo 提供，見 [evidence](evidence/README.md)。失敗/中途修正的開發歷史在 runtime verification 的 attemptHistoryNotes 記錄，不把修正前的問題藏成首次全綠。

固定上游為官方 Lexical v0.18.0 commit `3d08282ca3e5941a65c45fcf372b4d1fe4dc9d76`。原範例無文件導航，另外明示新增文件開啟操作，不注入 slowdown。這個 adapter 是預先撰寫的工程接合，不是 agent 在未知專案自主探索的 30 分鐘成績。兩次實測建置、瀏覽器重現都在同一 case deadline 內，重現不能藏成 setup。

## Review 與修正

分工為核心、viewer、公開接合，另有獨立 reviewer 與無前文 handoff agent。Review 不是盲測，測試數不代表定位準確率。已處理的主要問題：

1. 補 adapter/build 來源範圍、git enclosing-repository 標示，避免把工具 repo HEAD 當上游來源。
2. 同步 parent 增加 self/cycle/區間檢查；未捕捉 async schedule 保留 temporal。
3. 大型摘要保留 case/attempt/deadline，明示省略與分頁；viewer 不把 query 失敗渲染為空案例。
4. baseline 重現移入原期限，透過 runner 留存。
5. 核心 bytes pinning、metadata/source/log symlink 邊界；摘要與來源導航遇到失效狀態不默認成功。
6. 無來源時的 live announcement 改成 unresolved；完整限制可展開，必要缺口持續可見。

## 契約對應與未完成項目

| 契約區域 | 本次範圍 | 仍缺少 |
|---|---|---|
| AT-01/02/03/04 | 路徑、版本、raw refs、同步邊一致性反例 | 宿主沙箱、完整 dependency attestation、獨立因果證明 |
| AT-05/06/07/08 | 覆蓋/遺失欄位、plan 格式、probe 局部語意、資料上限 | plan 決策品質的自動判定、全部 plugin 等價與觀測開銷校準、任意 adapter 磁碟配額 |
| AT-09/10 | attempt 保留；公開 baseline 的有限功能對照 | 正式候選修復比較、採樣與改善判定、自動防挑樣本的完整實驗層 |
| AT-11/12 | runner-owned deadline、原期限續接、核心指紋 | 強制整個宿主 agent 的分析/shell 停止、不可竄改 oracle、Windows process-tree 實測 |
| AT-13/17/18 | 本機 inspector、共享引用、狀態、分頁、handoff | 外部 Chrome/Perfetto 精確接合、跨工具時鐘、更多真實專案與中斷恢復情境 |
| AT-14/15/16 | 拒絕宣稱未實作的 100 ms 通過；缺 usage/價格保留 unknown | 真實可見回應量測與誤差、provider usage/cost meter |

**未驗證：**公司案例、診斷正確率、受控盲測、自由 agent 公平對照、人類可用性收益、候選修復、100 ms、OpenCode 新工具 Web 實測。不能用本輪結果宣稱已全面解決 editor 效能。

## 下一個實驗與停止條件

在公司已核准 worktree 給一個可重現文件操作，依 [playbook](AGENT-PLAYBOOK.md) 由 agent 生成不同於本範例的 adapter。先驗證一條 runtime path 與來源，再提出能區分工作重複、單次昂貴工作、layout 的下一實驗。若資料不足或 30 分鐘用完，交付缺口與停止原因；不以公司問題尚未解出為理由無限擴大核心。

## 重跑

```sh
npm run test:debug
npm run test:debug:browser
npm --prefix docs/integrations test
```

`test:debug` 使用 Node built-ins，不需 browser dependencies；只有 `test:debug:browser` 需先有 root lockfile dependencies/Chromium。SDK command 需獨立 plugin lockfile dependencies。CI 已加入核心與公開 runtime/viewer/navigation 檢查；此文件記錄本機結果，不能預先宣稱遠端 CI 已通過。
