# 第一版證據規則

適用 schema：`1`。事件時間為操作起點後的毫秒；long task 與操作區間重疊時，記錄層先裁切到區間內。

這些規則是可檢查的觀測摘要與下一個實驗建議。它們沒有使用 `configuration.scenario` 當答案，也沒有把事件的時間相鄰當作因果關係。

| 規則 | 所需證據 | 可以說什麼 | 尚不能說什麼 |
| --- | --- | --- | --- |
| 重複圖表請求 | 同一 `diagramId` 的多個 `mermaid-request` | 這張圖有多次請求 | 哪個 component 造成、每次是否必要 |
| 多次 editor 更新 | 多個 `lexical-update` | 操作期間有多次更新 | 更新必然多餘、必然形成 waterfall |
| 主執行緒阻塞 | 有 duration 的 `longtask` | 操作區間重疊的阻塞事件 | 同時出現的 plugin 就是根因 |
| 資料不足 | 缺少請求、更新與 long task 事件 | 需要補哪類觀測 | 沒有事件就代表沒有問題 |
| 無效記錄 | 非有限時間、負數時間、重複 ID 或失效 parent 引用 | 記錄不可信，應重錄 | 效能改善幅度 |

每個 finding 包含：ID、標題、`observed`／`hypothesis`、摘要、可查回的事件 ID 與下一個可區分解釋的實驗。第一版自動規則僅產生觀測；未自動生成無執行證據的呼叫鏈。

JSON 匯入使用 `parseReport(unknown)`。它檢查必要的環境／設定欄位、最多 2,000 筆事件、圖表數量、事件 ID 與 parent 引用，並要求事件及 commit 落在完成代理值區間內（允許 1 ms 計時誤差）。匯入檔中的 findings 一律忽略，改用本機規則由事件重新產生，避免任意文字被顯示成已驗證診斷。

## 比較條件

固定文件 hash、內容大小、圖表數、尺寸模式、暖機、記錄模式、Lexical／React／Mermaid／browser／build。不同時拒絕產生改善幅度。`mode` 與 `scenario` 可以是刻意介入，必須明列；同時改變多項時提醒無法分離效果。

第一版比較限定同一 build 的設定介入。修改程式後產生的新 build 不會自動和舊 build 比較；這需要後續明確的跨版本實驗設計，不能隱藏版本差異。可選 `environment.viewport` 使用 `1280x900@1` 格式表示 CSS viewport 與 DPR。任一記錄提供時，兩邊必須都有且相同；舊記錄兩邊都缺少時，顯示人工確認提醒。

差值為 B − A。這是單次樣本的描述性比較，不能當作統計顯著或因果證明。完成代理值是插入後兩次 requestAnimationFrame，並不代表實際 paint 完成或可互動時間。

`limitations` 含 `ERROR:` 前綴時，代表操作未完成或失敗。部分證據仍可匯入與檢視，但禁止產生改善幅度。

`limitations` 含 `TRACE:` 前綴時，代表另有 CDP 等詳細 tracing instrumentation。這類資料可用來診斷，第一版禁止拿來做效能驗收比較，以免把 profiler 開銷當成產品差異。

## 驗證

`node --test scripts/diagnostics.test.mjs`（Node 24 的 TypeScript type stripping，無須額外下載）驗證反例：不同圖表不算重複、scenario 名稱不能洩漏答案、相鄰 plugin 不能被歸因、無效時間不能產生改善、版本／暖機不一致不能比較。

這些是規則測試；它們沒有驗證公司專案根因、OpenCode runtime 或瀏覽器記錄開銷。瀏覽器案例與真實專案的驗證由整合流程另外執行。
