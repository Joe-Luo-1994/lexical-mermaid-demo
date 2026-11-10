# OpenCode 2.2.5 本機交接

2026-11-10 更新：已在一台 Windows 本機完成 SDK、server active、兩個 Web session 的真實工具呼叫與 ID/CLI 對照；詳見 [本機驗證摘要](WINDOWS-VALIDATION.md)。這不代表新機自動通過或 agent 判讀可靠；下列最初 SDK 紀錄保留為歷史。首次使用可直接從 [agent onboarding](AGENT-START.md) 開始。

**最短可用路徑：** `node scripts/report-query.mjs <recording.json>`。CLI 無第三方依賴；OpenCode 可以透過既有終端工具執行，不必先安裝 plugin。

**Mermaid／Pele 獨立實驗：**依 [公司入口](COMPANY-START.md) 及 [renderer README](../experiments/renderer-comparison/README.md) 執行。其 summary/experiment/samples 是另一種格式，使用 OpenCode 既有讀檔工具；不要交給 `editor-evidence`，不需修改 plugin 設定。

工作台按「錄製這次操作」會完成準備、暖機與注入。完成後按 **JSON** 下載；「複製給 OpenCode」只複製交接文字，不會傳送 JSON 或訊息。重新整理前請先匯出。工作台的「語意 trace」不是此工具接受的 recording，也不是 CPU profile。

本分支固定 Lexical **0.18.0**、React **18.3.1**、Mermaid **12.3.0**。公司專案的 React／Mermaid 版本仍需另行確認。

## 重要的版本發現

核對 **v2.2.5 原始碼與實際 npm 套件**後發現，該 tag 的部分 web 文件仍描述舊 API。`@opencode-ai/plugin` 的 `tool()` 範例不能用來證明 2.2.5 相容性；該套件沒有 2.2.5 發行版。已移除原先的 `.opencode/tools/editor-evidence.ts`，避免使用者複製後自動載入不相容程式。

實際 2.2.5 API 是：

- 套件 **`@opencode/plugin@2.2.5`**，使用 `Plugin.define`、`ctx.tool.transform` 與 schema。
- 設定欄位 **`plugins`**；明確設定的本機 plugin 必須指向**目錄**，不是 `.ts` 檔案。
- MCP 設定位置是 **`mcp.servers.<name>`**，使用 **`disabled`**。
- 工具執行所在位置由 `ctx.location.directory` 取得，不能照抄舊版 `context.worktree`。

本 repository 提供 opt-in plugin package：`docs/integrations/`。它不在自動發現的 plugin 目錄中，clone／開啟此 repository 不會自動啟用它。

## 已驗證與待驗證

已在 Node 24.22.1 實際安裝 `@opencode/plugin@2.2.5` 與 `effect@4.0.6`，完成：

- 實際 `Host.resolve` 能從 package 目錄找到 server entry。
- 實際 `Config.Info` schema 接受此處的 `plugins` 與 `mcp.servers` 結構。
- 使用真實 SDK 的 `Plugin.define`，在模擬 registration host 中註冊並執行工具；schema decode、摘要／事件查詢、錯誤、路徑界線、symlink 與 cleanup 通過。
- TypeScript strict check 對實際 SDK declarations 通過。

當時尚未驗證 server／Web／兩個 session；後續 Windows 驗證見上方更新。公司環境與公司 editor 仍未知。SDK 測試不等於完整 runtime 驗證。歷史實測紀錄見 [VALIDATION.md](VALIDATION.md)。

## CLI 與 agent 交接

從工作台匯出單次 recording，放進專案目錄，例如 `recordings/my-run.json`。

```sh
node scripts/report-query.mjs recordings/my-run.json
node scripts/report-query.mjs recordings/my-run.json --limit 3
node scripts/report-query.mjs recordings/my-run.json --event <摘要中的事件ID>
node --test scripts/report-query.test.mjs
```

回應是最多 16,000 字元的 JSON；超出時明確標示 truncation。輸入上限 32 MiB。CLI 驗證結構與 evidence ID 引用，但不重新計算 findings；`findingsProvenance` 會提醒這些是保存的陳述，仍需查回事件驗證。

在 OpenCode 對話中可使用：

```text
請以 node scripts/report-query.mjs recordings/my-run.json --limit 5 讀摘要。
先區分觀測、推論與未知，引用 report ID 和 event IDs。
按需查最多三個關鍵事件，提出一個能區分候選原因的實驗。
不要完整貼出 trace，也不要把時間相鄰當作因果。
```

## 選用：啟用實際 V2 plugin

保留 repository 內的相對位置，因 plugin 共用 `scripts/report-query.mjs`。在允許套件存取的環境準備以下獨立 lockfile 的依賴；內網環境使用已備妥的套件來源：

```sh
npm ci --prefix docs/integrations --ignore-scripts
npm test --prefix docs/integrations
```

將以下片段合併到**repository 根目錄**的 `opencode.json`／`opencode.jsonc`，保留其他設定：

```json
{
  "plugins": ["./docs/integrations"]
}
```

`docs/integrations/package.json` 透過 `exports` 宣告入口。先確認 OpenCode runtime 為 **2.2.5**，再啟用設定並檢查 `editor-evidence` 工具可用；這個最後步驟需在本機完成。

工具參數為 `file`、選填的 `eventId`、選填的 `limit`（1–20，預設 5）。路徑以 active OpenCode location 為基準，只接受該目錄內的檔案，並拒絕指向外部的 symlink。工具不執行 shell、不上傳資料、不傳送訊息。

範例提問：`使用 editor-evidence，file 為 recordings/my-run.json，limit 為 5。先列觀測，再提出一個可否證實驗。` 未啟用 plugin 時沿用上面的 CLI 即可。

`.opencode/skills/editor-diagnosis/SKILL.md` 保存短診斷流程；可先直接閱讀使用，不依賴尚未驗證的 skill 自動載入。

## 選用：Chrome DevTools MCP

以下是符合已核對 V2 schema 的**模板**。請替換成已在內網準備、選定版本的 Node 與 MCP executable；我們沒有在這輪測試 Chrome MCP runtime，因此未填入「已測試」版本。

```json
{
  "mcp": {
    "servers": {
      "chrome-devtools": {
        "type": "local",
        "command": [
          "/ABSOLUTE/PATH/TO/node",
          "/ABSOLUTE/PATH/TO/chrome-devtools-mcp/build/src/index.js",
          "--no-usage-statistics",
          "--no-performance-crux"
        ],
        "environment": {
          "CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS": "1"
        },
        "disabled": true
      }
    }
  }
}
```

確認所選 MCP 版本的 executable、flags、Chrome 連線方式後才啟用。現有 MCP 可錄製 performance trace，但本工具沒有自動將 Chrome trace 轉成本專案 recording。跨資料來源的時鐘與操作身分仍需實測對齊。

## 本機 runtime 完成條件

- CLI 與 plugin 查詢同一份 JSON，結果一致。
- 兩個 Web session 指定不同檔案時，各自回傳正確 report ID。
- 無效路徑、schema 與 event ID 有可採取行動的錯誤。
- 斷網後仍能讀取 recording；這不代表模型 provider 可以離線運作。
- 記錄 OpenCode、Node、Chrome、MCP 版本與測試日期。完成後才把 Web runtime 標為已驗證。

## 原始碼依據

- [V2 Promise Plugin API](https://github.com/anomalyco/opencode/blob/v2.2.5/packages/plugin/src/README.md)
- [v2.2.5 plugin package](https://github.com/anomalyco/opencode/blob/v2.2.5/packages/plugin/package.json)
- [Plugin directory resolution](https://github.com/anomalyco/opencode/blob/v2.2.5/packages/core/src/config/plugin/source.ts)
- [Plugin entrypoint discovery](https://github.com/anomalyco/opencode/blob/v2.2.5/packages/plugin/src/host.ts)
- [V2 MCP config](https://github.com/anomalyco/opencode/blob/v2.2.5/packages/schema/src/config/mcp.ts)
- [V2 MCP server fields](https://github.com/anomalyco/opencode/blob/v2.2.5/packages/schema/src/mcp.ts)
- [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp)
