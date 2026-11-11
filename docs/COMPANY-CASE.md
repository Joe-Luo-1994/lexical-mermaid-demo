# 從公開案例到公司問題

新版正式需求見 [Agent Debug v0.1](AGENT-DEBUG-CONTRACT.md)。本文件保留初次只讀盤點範本；若使用者已授權隔離 worktree 內的觀測/修復/測試，沿用既有授權，不因下方範本再次要求批准。新調查由 [公司共用入口](COMPANY-START.md) 開始，不預設 renderer 是根因。

這個repo不能直接接管公司editor，也不能把任意Chrome trace變成recording。先判斷缺的是哪一段證據，再決定最小接入。

## 可貼給公司環境 agent 的起始指令

將方括號填好；未填時agent只能整理缺口，不自行搜尋磁碟。

```text
請先讀 Editor Evidence 的 docs/COMPANY-CASE.md，再開始只讀調查。
授權的公司專案根目錄：[絕對路徑]
重現操作：[例如：從匯入對話選某文件，按確認後卡住]
期待與實際行為：[文字可輸入/圖表完整/等待多久；未知就寫未知]
可使用的本機案例或trace：[確切路徑；沒有就寫尚無]
公司允許的模型/資料政策：[允許的模型介面及可傳資料；未知則先不讀公司內容進模型]
本階段只盤點與提出一個最小蒐證計畫，不修改程式、不上傳、不push、不動既有server。
請以Observed/Inferred/Unknown引用精確檔案或runtime證據；不要把公開demo結果當公司根因。
```

## 證據閘門

| 閘門 | 需要確認 | 通過後才做 |
|---|---|---|
| 範圍與資料使用 | 實際路徑、讀/改權限、公司允許的模型與資料流向 | 讀授權程式/trace；localhost OpenCode不代表模型推論離線 |
| 實際版本 | lockfile與runtime的Lexical/React/Mermaid、browser、build；不要猜 | 比對原型適用範圍；不自動升級 |
| 真實流程 | 匯入入口、Markdown解析、editor state commit、圖表請求/插入、undo/persistence、可重現操作 | 畫最小實際流程並引用source，不編造呼叫鏈 |
| 可用證據 | 既有性能標記、Chrome trace、匿名合成重現、來源/事件ID是否可對齊 | 選最小新增觀測；沒有必要就不裝新工具 |
| 最小介入 | 固定條件、唯一變因、支持/推翻條件、功能正確性與回復方式 | 在明確修改授權後才實作；保留原始樣本 |

把盤點與問題寫在公司核准的本機工作區，**不要放進public repo待提交檔案**。此repo的recordings/results雖gitignore，仍可能被agent/provider讀取；gitignore不是資料保護或上傳授權。

## 首次調查應交付什麼

最多三項Observed、兩個候選解釋及其缺證、一個可否證的下一實驗。若尚未知道版本/操作/資料政策，就列具體缺口及取得方式。不要宣稱問題解決。

若需接入collector，先核對 `src/lab.ts` 的prototype量測契約與 `src/diagnostics.ts` 的schema；它不是可直接掛上任意editor的成熟SDK。相同事件ID應能跨UI與agent查回，完整source不能從sourceChars推得。

驗收分開看：資料/表格/圖表完整、輸入與undo/persistence正確、操作回應、完成代理值、實際browser工作。預生成SVG模式只是把工作移出注入區間，不能當端到端改善。詳細trace與非tracing量測分開。
