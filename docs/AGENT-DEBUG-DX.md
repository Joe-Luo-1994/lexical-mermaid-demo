# Agent Debug DX：第一版設計與迭代

日期：2026-11-11。狀態：**設計原型，不是可接入公司 editor 的診斷工具。**

依據：[契約](AGENT-DEBUG-CONTRACT.md)、[驗收](AGENT-DEBUG-ACCEPTANCE.md)、[runtime spike](AGENT-DEBUG-SPIKE.md)。可點擊原型位於 [design/agent-debug](../design/agent-debug/README.md)，使用明確標記的合成案例；不安裝 collector、不執行候選修復、不偽造 Chrome/Perfetto 整合。

## 1. 要交付的價值

開發者不必先理解觀測系統，就能回答：目前知道什麼、憑什麼相信、還缺什麼、下一步如何區分解釋。換人或換 agent 可以延續進度。框架依專案生成必要觀測；本原型只驗證如何呈現與交接其產物。

第一版以一份持續更新的 case 為入口：OpenCode 2.2.5 Web 接受任務；本機案例摘要承接閱讀與查證；現成 viewer 顯示詳細 trace。是否能內嵌或雙向同步須另測，不能假設 OpenCode 的 UI extension API。單向「摘要 → 正確證據位置」先做通；自製全套時間軸/replay 不列為必要範圍。

## 2. 五個時刻與可見行為

| 時刻 | 使用者看見 | Agent / 系統責任 |
|---|---|---|
| 開始 | 操作、範圍、版本、可用能力；只顯示真正缺少的資訊 | 自行發現設定；缺 source map 只阻擋來源歸因，不掩蓋其他可做工作 |
| 調查 | 正在區分的解釋、已排除方向、剩餘預算 | 每輪觀測有決策用途；成本未知明列，不能以忙碌動畫取代進度 |
| 判讀 | 判斷、支持證據、未知、下一實驗 | 結論狀態與 run 執行狀態分開；找不到根因也交付缺口 |
| 查證 | 目前選取事件、時間與來源版本；返回後保留焦點 | 同一 case/run/event/source 身分貫穿查詢與畫面；失效映射禁止靜默替代 |
| 續接 | 已做/未做、失敗嘗試、有效證據、恢復入口 | 使用可重建產物而非整段聊天；來源變更重新判定受影響證據 |

## 3. 第一屏與深入路徑

第一屏依序：案例名稱與合成/真實標記 → 調查/結論狀態 → 目前判斷 → 支持/未知 → 下一步。左側提供流程導航，右側為證據 inspector。主要動作為「查看支持證據」；接著才是「查看下一實驗」「交接摘要」。

證據列表顯示可讀名稱並保留 ID。只顯示當前問題相關事件，明示隱藏數、可恢復全部事件。相鄰但無因果事件必須能展開，不能以降噪刪掉反例。關係採文字類型；時間鄰近無因果箭頭。原型使用簡單時間條定位，不冒稱 flame chart 或 CPU profile。

Inspector 固定顯示 run/event、時間範圍、觀測來源、程式快照及關係類型。UI 的 source excerpt 只表示當時快照；不能用舊錄製替新 revision 歸因。正式版需 pin viewer 版本與 mapping，證據導航自動核對正確目標，不能靠人手動搜尋。

狀態不可塞成一顆成功燈：

- 執行：completed / blocked / budget-exhausted / invalid-capture 等。
- 判斷：insufficient-evidence / supported-path / hypothesis-refuted / improvement-validated。
- 來源適用性：匹配目前版本 / 歷史證據，對目前版本不適用 / unresolved。
- 導航能力：已驗證 / 受阻 / 尚未驗證。原型永遠沒有真實 viewer 已驗證狀態。

所有時間與來源指紋在原型中都是教學用合成值。不能顯示為 100 ms 驗收結果。

## 4. Agent 面：少量明確任務，不鏡射每個 UI 按鈕

以下是邏輯介面設計，**不是已存在的 OpenCode tool 名稱或 CLI**：

| 意圖 | 最小輸入 | 有界回傳 |
|---|---|---|
| 讀案例狀態 | case、revision | 已知/未知、目前問題、證據 refs、下一步、成本缺值 |
| 查證一項判斷 | finding ref、必要時間/來源範圍 | 證據及 typed relations、原始 artifact ref、缺口、可取得的下一頁 |
| 規劃單一介入 | hypothesis ref | 介入/控制、功能約束、可能結果與決策、所需能力 |
| 恢復調查 | checkpoint、當前來源 fingerprint | 可重用/失效項目、原因、最小恢復步驟、剩餘 deadline |

摘要截斷明列 omitted/truncated 與取得其餘內容的方法；不得遺漏會推翻摘要的重要反例。每次回傳保留 schema/version、case/run identity 與合成/真實標記。原始 trace 留在檔案，依問題索引，不能直接送整份到模型。格式通過不代表結論真實。

恢復同一調查不重設 30 分鐘。另開調查須建立新 case attempt 並揭露累積成本，不可把超時工作藏成續接。未驗證的觀測保留作草稿，不升級為證據。

## 5. 兩輪迭代與獨立 review

這是產品設計成本，與每個公司案例的 30 分鐘分開記錄。下列是本次工作分工，不擴張為多 agent 同時操作受測頁面。

1. **第一輪：建立具體設計。** 主 agent 負責契約、單一合成案例、可點擊摘要/事件/實驗/交接。只測「看懂、查證、續接」，不增加通用 collector。
2. **獨立 review。** 一位 reviewer 不修改產物，只找證據誤導、失效狀態、操作摩擦及不可驗收之處；要求重現條件與修正建議。主 agent 決定並記錄接受/拒絕原因。共享規格 review 不是盲測，不計入診斷正確率。
3. **第二輪：修正並走查。** 修正 blockers、用真實 Chromium 驗證導航/鍵盤/窄畫面/匯出，保留結果。沒有新的失敗或重要未知，不為了迭代數繼續重做。

停止條件：三條原型任務可走通、已知誤導被修正、實作缺口明列。這只允許交付設計原型；人類可用性、真實來源/trace 接合、公司診斷效果仍待驗收。

下一個實作切片：在 runtime spike 的獨立專案中，只將一筆真實 finding 與其證據接入同樣的摘要結構，實測「摘要 → trace 事件/區間 → 正確來源」。若無法建立可信 mapping，先修這個邊界，不擴充視覺功能。

## 6. 三項 DX 任務與對照

| 任務 | 給使用者的指令 | 觀察 | 失敗條件 |
|---|---|---|---|
| 看懂 | 說明目前判斷、支持證據與尚未確認的部分 | 完成時間、理解錯誤、求助 | 把觀測到的呼叫解讀為主要卡頓根因 |
| 查證 | 找出一條支持證據，並檢查旁邊另一事件是否有因果 | 正確 run/事件/來源、手動拼接次數 | 相鄰事件被歸因，或導航到錯誤版本 |
| 續接 | 交給 fresh agent，指出可重用資訊與下一實驗 | 重複工作、失效證據使用、token、人工介入 | 重新掃全部、重設 deadline，或信任已失效映射 |

對照為「聊天摘要 + 手動使用既有工具」，材料/資訊量、問題難度、環境及資源相同。人類測試用等價案例交錯順序，避免同一案例練習造成優勢；agent 用 fresh session。先固定 rubric 與記錄規則再執行。原型的鍵盤與畫面測試不能代替人類任務，3 項走通也不證明統計上的效率收益。

原型階段沒有額外虛構秒數 KPI；先蒐集基線再設定最小有用改善。100 ms 僅屬 editor 可見回應驗收，不是這個工具的 UX 指標。

## 7. 外觀與可及性

沿用 [DESIGN.md](../DESIGN.md)：暖中性色底、深綠動作、白色閱讀區、系統字體、不載入外部字體或 CDN。狀態有文字標籤；時間條不只靠顏色；重要資訊不只存在 hover。鍵盤可到所有控制、焦點可見、返回還原來源控制；窄螢幕單欄，ID 可換行。選取與狀態改變有 live announcement；reduced-motion 下不播放裝飾動畫。原型不自動保存資料，不把複製當作送出訊息。

## 8. 參考與採用邊界

查閱日期 2026-11-11；上游 URL 可變，接合時需 pin 實際版本。

- [Playwright Trace Viewer](https://playwright.dev/docs/trace-viewer)：採用操作/區間帶動相關資訊的設計；其 source 指向測試動作，不能當應用瓶頸定位。
- [Replay time travel tools](https://docs.replay.io/reference/replay-devtools/time-travel-tools)：採用 focus window、執行時刻書籤與交接；不承諾事後查任意變數或確定性 replay。
- [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md)：採用摘要後按 insight 深入，原始 trace 另存；不將一般 insight 當 Lexical plugin 因果分析。
- [Perfetto deep linking](https://perfetto.dev/docs/visualization/deep-linking-to-perfetto-ui)：可用時間區間/事件定位作基礎，但 slice ID 跨版本不穩定；同 ts/dur 可有多個事件，需驗證目標而非僅比時間。
- [Writing tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents)：採用有界、任務導向輸出與 agent eval；不以 token 下降取代正確性。

## 9. 驗證紀錄

| 層次 | 本輪結果 | 證據與限制 |
|---|---|---|
| design-review | 已完成，3 項 finding 已修正並獨立複核 | 表格結構、中性更新措辭、合成來源新舊版本與受影響 refs；非盲測 |
| browser-check | 19 項通過 | Chromium 156.0.8078.79；[結果與來源 SHA-256](../design/agent-debug/review/browser-check.json)；無 browser error / 外部 request |
| human-task | not-run | 尚未請未參與設計者完成三項任務，不能聲稱省時或較容易理解 |
| runtime-integration | not-run | 真實 trace/source、OpenCode 2.2.5、100 ms、公司案例都未驗證 |

Review 分工：主 agent 整合設計與實作，一位獨立 subagent 做靜態反例 review；沒有平行瀏覽器量測。三項 finding 均接受；reviewer 在修正後確認結案。沒有使用 reviewer 自評來代替使用者測試。模型 token/費用未取得可核對 usage，記 unknown；這是產品建置，不是公司案例 30 分鐘的調查成果。

Browser check 使用既有 Python Playwright 與系統 Chromium，沒有安裝或改動 repo runtime 依賴。第一次一般 sandbox 無法開 loopback socket；在核准的執行環境重跑成功。獨立 review 修正後再次執行 19 項檢查。測試 script 位於 [verify.py](../design/agent-debug/verify.py)；只適用設計原型，不代替既有 app CI 或整體契約驗收。

[桌面摘要](../design/agent-debug/review/overview.png) · [證據 inspector](../design/agent-debug/review/evidence.png) · [窄畫面](../design/agent-debug/review/mobile.png)。已人工檢視截圖的閱讀層次與窄畫面換行；這不等於完整 accessibility audit。
