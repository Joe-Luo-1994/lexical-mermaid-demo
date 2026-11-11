# 第一版實驗契約

本文件適用既有合成工作台。新版 agent 依專案生成觀測的產品需求，以 [Agent Debug v0.1](AGENT-DEBUG-CONTRACT.md) 為準；本文件的 demo 規則不代表新框架已有 enforcement。

## 使用者價值

當匯入包含圖表的文件變慢，工程師能保留現場、和 agent 查閱同一份證據，並更快選出有區辨力的下一個實驗。第一版終點是可查證的診斷與改善驗證；圖表、時間軸與自動摘要是完成這個任務的手段。

固定條件：Lexical 0.18.0、OpenCode 2.2.5 Web、本機 server、內網可執行。本分支 lockfile 的實驗版本為 React 18.3.1、Mermaid 12.3.0；Chrome 與 MCP 的實際測試版本需寫入驗證紀錄。公司專案的 React／Mermaid 版本仍需另行確認。參考實驗不代表公司專案根因。

## 記錄與證據

```text
schemaVersion: 1
id: recording identifier
environment: runtime versions and browser/build information
configuration: document, scenario, mode and recording conditions
metrics: named measurements with explicit meaning
events: [{id, kind, start, duration?, owner?, label, diagramId?, parentId?, data?}]
diagrams: per-diagram evidence
findings: observations and hypotheses with evidence references
limitations: known gaps and measurement caveats
```

事件時間為相對於本次 recording 起點的毫秒。`parentId` 只在實際捕獲的呼叫或排程關係成立時填寫；時間鄰近不足以填寫。不同來源的時鐘必須明確對齊。schemaVersion 改動需一併更新 exporter、query、UI 與測試。

## 每輪實驗卡

| 欄位 | 要回答的問題 |
|---|---|
| 問題 | 這輪要消除哪個影響決策的未知？ |
| 假設 | 什麼機制可能造成觀察到的行為？ |
| 對照 | 固定哪些條件，只改哪個變因？ |
| 可否證結果 | 哪種結果會讓我們放棄假設？ |
| 證據 | recording／trace／source 的位置與 IDs |
| 結果 | 已知、未知、誤差與適用範圍 |
| 決策 | 繼續、修正、採用較簡單方案或停止 |

## 可持續驗收

1. **證據可信**：結論可查回 recording 與事件；缺少資料時指出缺口，不猜出因果。
2. **診斷有用**：在保留案例上提出可區分原因的實驗。正常且昂貴的工作與無因果的相鄰事件都必須納入反例。
3. **量測可比**：版本、內容、圖表、操作、暖機、viewport、CPU 與量測終點一致。完成後兩次 rAF 是代理值，不等於真實 paint 或 TTI。
4. **觀測成本**：交錯比較關閉、輕量、詳細記錄；先測自然波動，再訂預算。以短 recording 為預設，避免每次更新序列化整篇文件。
5. **操作體驗**：使用者能找到主要成本、查看依據、交給 agent、回到同一份證據，再完成比較。另檢查資訊層級、密度、長名稱、載入、空白與失敗狀態。

不在尚未量測前宣稱 token 節省比例或效能改善百分比。記錄可取得的 token、tool calls、到第一個有效實驗的時間，以及需要人類補資料的次數。模型不同時不直接比較工具效益。

## 環境與成果邊界

| 環境 | 可證明的事情 |
|---|---|
| 公開實驗環境 | 案例正確性、記錄與診斷邏輯、介面及瀏覽器測試 |
| 本機 OpenCode 2.2.5 | tool 載入、Web 交接、內網依賴與 session 選擇 |
| 公司專案 | 真實瓶頸、接入維護成本、改善效果 |

各環境分別驗證。任何一層通過都不自動代表其他層通過。保留原始資料和失敗案例；調整成功標準時記錄原因，避免追著實作結果改驗收。

## 第一版停止條件

若現有工具加上薄型接合已能可靠完成主要任務，就先打磨它。完整 browser replay、全局 plugin graph、worker renderer 與自製大型時間軸，需要新的實際摩擦與證據才能擴張。
