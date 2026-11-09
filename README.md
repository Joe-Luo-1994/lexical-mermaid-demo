# Lexical × Mermaid injection lab · v2

直接注入預先建立的 Lexical EditorState。排除 Markdown parser 與反序列化時間，測量混合格式文件、多張 Mermaid、表格與編輯器的整合成本。

## 使用

需要 Node.js 24 與 npm。

```sh
npm ci
npm run validate
npm run build
npm run preview
```

網頁依序選擇實驗組、約 20k／50k／80k 字元、5／10 張圖，以及自然／固定高度。按「準備資料」後按「注入 content」。準備階段會先暖機每種圖表類型，可能需等待數秒；它不列入注入計時。

## 接近工程文件的合成資料

內容是一份文件匯入架構與營運手冊，包含多層標題、粗體、斜體、刪除線、inline code、連結、引用、巢狀清單、JavaScript 程式碼及情境矩陣。使用真正的 Lexical rich text、list、link、code、table nodes，並載入 ListPlugin、TablePlugin 與 LinkPlugin。

每章有一張 4 欄 × 8 列的表格及一張圖。圖表分散於不同章節，不集中在首屏：

1. 左至右的服務架構 flowchart，含 subgraph。
2. 多參與者 sequence diagram，含 loop 與 alt。
3. 含巢狀狀態的 state diagram。
4. 七個實體的 ER diagram。
5. 介面、繼承與依賴的 class diagram。
6. 分階段上線 Gantt。
7. 多角色 user journey。
8. 多層 mind map。
9. 上至下、含分流與 subgraph 的 recovery flowchart。
10. 含 merge／hotfix 的 git graph。

5 張方案使用前五章；10 張使用全部。每章有其對應的敘述、驗收條件、表格、程式碼與觀測案例。大文件透過增加具有情境的觀測段落擴充，仍屬合成資料，並非使用者產品實際文件。

字元數是文字與 Mermaid source 的 JavaScript string length，不是 bytes，也不是 Markdown source length。保持章節完整，因此略高於目標值。準備後與結果表都顯示實際字元、nodes、tables 數量。

## 實驗組

| 組別 | 實作 |
|---|---|
| A | 相同 MermaidNode，保留空白佔位，不生成圖表 |
| B | 準備階段生成所有 SVG，注入後插入 |
| C | 掛載後在各節點內呼叫 Mermaid render |
| D | 在 editor 外離屏容器生成，再插入對應節點 |

四組使用同一份文件。B 把生成移到計時範圍外，僅用於歸因，不代表端到端加速。C/D 沒有應用層 SVG 快取；Mermaid 的公開 render API 可能在內部排隊，並不代表十張圖平行計算。

預設自然高度，使各種圖表高度變動反映到長文件排版；A 的佔位高度不等於成圖高度，因此不能把 A/B 差距全歸因於 SVG DOM 複雜度。切換固定 260 px 可限制尺寸變動這個變因。桌面容器寬 760 px；外部生成仍在同一 document，沒有 iframe 或 CSS containment。手機較窄時內外寬度可能不同，不適合直接歸因於容器位置。

## 量測

起點是 `editor.setEditorState()` 前。逐張記錄 decorator commit、生成請求、回傳與插入；**等全部圖表成功或失敗後**，才記錄完成代理值。

- Commit：帶 benchmark tag 的 Lexical update listener。
- 生成區間：第一張生成請求到最後一張回傳，包含排隊與等待。
- 各圖表耗時：該圖請求到回傳，包含 Mermaid 內部佇列，不是獨立 CPU 時間。不能將所有圖的等待耗時相加當總時間。
- 完成代理值：所有圖插入後兩次 rAF，不是 paint 完成保證。
- Long task：注入區間內與 >50 ms task 重疊的片段；0 不代表無短暫阻塞。自訂 blockingOver50Ms 不是 Lighthouse TBT。
- 完成之後再保留 180 ms 收集 observer／輸入；這段等待不計入完成時間。

結果可匯出 JSON，包含每張圖的類型、原始碼長度、耗時、錯誤與插入時間。生成結果只更新對應 DOM，不回寫 editor state。

## 驗證與重跑

`npm run validate` 已通過六組 fixture 的 Lexical 反序列化／序列化與結構檢查，以及十張圖的 Mermaid 語法解析。語法檢查在 Node + jsdom 執行；它不是瀏覽器渲染或效能測試。

Production build 已通過。本快照尚未執行 rich-fixture 瀏覽器測試或效能矩陣；測試腳本已提供，請在自己的環境執行。不得將較簡單 fixture 的歷史結果套用到本版本。

在具有瀏覽器執行能力的本機可執行：

```sh
npx playwright install chromium
npm test
npm run bench
node scripts/trace.mjs inline 80000 10
node scripts/trace.mjs external 80000 10
```

`npm test` 定義 24 組案例（四模式 × 三規模 × 兩圖表數，預設自然高度），檢查所有 SVG／表格、實際鍵盤輸入、無關編輯不重畫、外部容器清理。這些是待執行的新版測試，不是已通過的結果。

`npm run bench` 每組五次、固定 seed 打散，輸出原始 JSON、CSV 與中位數。另做獨立輸入探測。測試過程關閉結果表格更新，以免額外 DOM 影響比較。`BROWSER_PATH` 指定 Chromium；`PORT` 更換本機 preview port；`BENCH_URL` 使用既有伺服器；`REPETITIONS` 控制次數。

## 主要檔案

- `src/fixtures.ts`：合成文件、十張 Mermaid、字元與 node 統計。
- `src/nodes.ts`：rich text / table / list / code 節點註冊。
- `src/lab.ts`：準備、注入、每圖計時與全部完成條件。
- `src/MermaidNode.tsx`：獨立圖表呈現、過期結果檢查與錯誤顯示。
- `scripts/validate-fixtures.mjs`：已執行的資料與語法檢查。

[Mermaid render API](https://mermaid.js.org/config/usage.html#api-usage) · [Lexical nodes](https://lexical.dev/docs/concepts/nodes) · [Chrome Performance](https://developer.chrome.com/docs/devtools/performance/reference)

## 暖機與 Agent 交接

本版本是 **warm-render benchmark**，不是首次生成測試。請先閱讀 [WARMUP.md](WARMUP.md) 與 [AGENT_HANDOFF.md](AGENT_HANDOFF.md)。所有依賴版本固定於 package.json / package-lock.json；不同 Lexical 版本的 schema 與 API 可能需要適配。
