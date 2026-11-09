# 2026-11-10 Windows 本機驗證摘要

Observed：Windows x64、Node24.22.2、Chrome156.0.8078.81、Lexical0.18.0、React18.3.1、Mermaid12.3.0。基底commit為 `f3145dfc9892a3ed74dbc431f390df865bfd5a04`，含交付patch的未提交修改。

公開原型：6組headless fixture、10種Mermaid syntax、27項規則測試、原15筆browser流程與新增20筆配對流程通過。涵蓋證據點選、匯入/匯出、條件漂移阻擋、ID衝突保留原證據、停止、390px版面。背景失效路徑另以注入中的visibility事件模擬測試；不是所有OS背景行為認證。

隨repo提供的 [Windows實驗證據包](evidence/windows-experiment.json) 可用工作台「載入記錄」開啟。這是**先前此台電腦的合成樣本**，不是新使用者電腦的結果。相同bundle內才可彙總；不能和新build自動比較改善。

該組正常/重複各10筆，完成代理值中位數260.95/522.35ms；配對差值中位數257.0ms，每組多5次請求。時間含自然波動與觀測成本；不是paint/TTI、統計顯著、端到端改善或公司根因。

OpenCode2.2.5官方Windows executable完成來源與SHA256核對。SDK3項通過；實際server的editor-evidence為active；兩個Web session共5次工具查詢與CLI逐項一致，report ID沒有混淆。另一次全新session使用新版交接，讀本機recording，4次editor-evidence查詢亦與CLI一致。原始日誌/對話保留原執行機results，未宣稱這些日誌隨clone傳遞。

**品質限制：**agent初稿仍有無根據泛化、把時間分布重疊混成請求數反證等問題。工具接通不等於自動根因診斷可靠；[第一次判讀](FIRST-DIAGNOSIS.md)列出具體反例。

待新環境驗證：安裝/網路、Chrome與OpenCode真正版本、實際Web工具呼叫、模型政策、公司程式/版本/資料安全與接入。未碰公司repo，也未證明內網完整離線運作。
