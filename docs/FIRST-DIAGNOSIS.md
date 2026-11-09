# 第一個有證據的判斷

問題：這份公開案例是否記錄到同一張圖被請求兩次？這跟「公司React render多餘」是不同問題。

照START-HERE的三條CLI指令讀 `duplicate-recording.json`。核對：

- Report：`run-bdcada32-e342-42ad-8ab5-c15452320751-2`
- `bdcada32-e342-42ad-8ab5-c15452320751:2:e11`：`mermaid-request`、`classes`、attempt1、sourceChars699。
- `bdcada32-e342-42ad-8ab5-c15452320751:2:e17`：同diagramId、attempt2、sourceChars699。

**Observed：**同一diagramId出現兩個請求，attempt由1到2。這兩個event可在工作台載入相同JSON後查到。

**Inferred：**第二次請求可能增加工作量；還需對照，不能從span長度拆成CPU時間。

**Unknown：**兩次source全文是否相同、是否必要、誰觸發、公司是否同樣重現。這個fixture刻意製造重複，不能當公司bug證明。

**下一個實驗：**在工作台按一鍵對照，固定同build、版本、20k、5圖、暖機、viewport與light記錄，只切normal/duplicate，交錯重複。先查請求數是否穩定5/10、圖表/表格/文字是否完整，再描述完成代理值分布。

請求數符合預測，支持情境控制確實改變請求數；不符合則調查記錄或fixture。時間差落在波動內，只表示未觀察到穩定時間效果，**不能推翻已被事件證明的請求數差異**。兩個問題分開判讀。

## 不合格的答案

- 「多呼叫一次，所以修React effect就會快一倍」：沒有呼叫來源與修正實驗。
- 「同699字元，證明source完全相同」：長度不是內容。
- 「一筆attempt2約250ms，所以所有第二次請求都在等250ms」：以單例推全體。
- 「分布重疊，所以duplicate不能控制請求數」：把時間結果混成請求數機制。
- 「固定fixtureHash，將20k改80k」：完整文件hash會改；目前比較器會拒絕直接改善比較。
- 「先開coalescing旗標」：目前沒有這個控制。提議新功能時應標為需開發。

Agent能指出上述界線，才算交付一個可繼續的調查。結論仍需要你或工程師審查。
