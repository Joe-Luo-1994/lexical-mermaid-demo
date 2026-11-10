# 公司 editor 的最小觀測契約

這是接入指引，**不是已實作的通用 collector SDK**。原型 `src/lab.ts` 仍是公開 demo 專用，勿直接貼進公司並宣稱完整可用。公司調查範圍沿用 [COMPANY-CASE.md](COMPANY-CASE.md) 與當前 session 授權。

## 先定位實際程式路徑

在授權專案內用 `rg` 分批搜尋並沿引用追查，記錄檔案與行號：

```sh
rg -n 'mermaid|DecoratorNode|decorate\(' src
rg -n 'setEditorState|parseEditorState|editor\.update|registerUpdateListener' src
rg -n 'ResizeObserver|MutationObserver|getBBox|getBoundingClientRect' src
```

`src` 改為實際已授權的來源目錄，不擴大到整台電腦。搜尋結果是候選位置，不能單憑 `useEffect`、`flushSync`、observer 或 listener 的存在判定根因。先列出「注入入口 → editor 操作 → component 生成請求 → SVG 寫入」的實際關係；非同步關係無證據就標未知。

## 接入四個邊界

| 邊界 | 最小欄位 | 實際放置位置 |
|---|---|---|
| operation-start | operationId、單調時鐘起點、字元/節點/圖表數、版本 | 已準備好的 editor state 開始注入前；Markdown 轉換另外記，不混入 |
| renderer-request / result / error | operationId、diagramId、requestId、renderer+版本、開始/結束、設定識別 | 真正呼叫 renderer 的包裝處，而非 React render 函式入口 |
| svg-inserted | operationId、diagramId、requestId、時間、輸出元素數（選用） | DOM 已寫入 SVG 後；回傳 SVG 字串尚不算插入 |
| operation-terminal | operationId、成功/失敗/取消、未完成 request IDs、終點定義 | 所有屬於該操作的圖表已插入或明確失敗；不能只等 editor.update callback 返回 |

建議用 `performance.now()`，以同一 `operation-start` 為相對起點。每個請求都有 ID；錯誤也要結束請求。不同文件切換需新的 operation ID，舊請求完成不得算進新操作。只記少量數字與 ID，不在每次 update 序列化整篇文件。

source 是否相同需在準備階段計算摘要並記錄相關設定，不可用字元數代替。摘要也應留在核准的本機範圍。React render、effect 執行、renderer 請求、Lexical commit 是不同事件，分別計數；重複不自動代表多餘。

`parentId` 僅用實際傳遞的關係；不要用時間相鄰畫出因果。多個請求 span 重疊時不可相加為 CPU 成本。先記 wrapper 的等待時間，再用獨立 Chrome Performance recording 分辨 JavaScript、style、layout、paint。

## 操作完成與可互動是兩個終點

「最後插入後兩次 rAF」可沿用作代理值，但必須明列名稱。真正要量輸入阻塞時，從瀏覽器外的 Playwright/CDP 程序排程一個固定時間的輸入，記錄送出、handler 收到與可見結果；不要只在被阻塞的頁面 setTimeout 再宣稱準時送出。不同時鐘需校準。操作完成後才輸入只能證明功能可用。

詳細 tracing 另錄診斷樣本，非 tracing 配對才拿來比較一般耗時。Performance API 少量 mark 本身不因主執行緒阻塞而失去計時意義；observer callback 可能延後送達，需看 entry 時戳，並用關閉/輕量記錄對照估算觀測成本。

## 第一個有區辨力的實驗

1. 固定圖表 source、圖數、字型與 component 生命週期，只增加周圍文件 20k/50k/80k。字元數外也記錄節點、表格與 DOM 數量。
2. 觀察 renderer 呼叫耗時及完成代理值各自如何變化；只憑總耗時無法歸因。
3. 若生成階段值得追查，在獨立 worktree 加入 Pele `render()`，使用同一個插入流程。初輪不加自適應 `mount()`、worker、lazy loading 或快取。
4. 再加入兩套 renderer 各自的預生成 SVG 對照。預生成時間排除時，只能解釋插入/後續成本，不能宣稱完整流程加速。

固定同一部機器、production build 模式、viewport、背景狀態、字型就緒、暖機規則與量測終點。交替 A/B 順序，保留全部原始配對。跨 build 比較需記錄來源 SHA/dirty/差異，宣告 renderer 為介入，其他條件仍需比對。現有主工作台比較器會拒絕不同 build；**不要關閉此保護或偽造相同版本**，先保留為獨立實驗。

## 接入的功能驗收

- diagrams 與表格未遺失；中文字型、換行、箭頭、連線與相關功能人工確認。
- 輸入、selection、undo/redo、儲存/重開仍正確；操作結束後無持續反覆生成。
- error/cancel/unmount 可結束操作；過期 Promise 不覆蓋新文件。
- collector 關閉後保留正常行為；清理 listener/observer，檢查觀測開銷。

公司原始事件先保留獨立格式。只有真正符合 `src/diagnostics.ts` 契約的 recording 才交給既有 `editor-evidence`；Chrome trace、新 renderer summary 和任意 log 都不屬於該格式。
