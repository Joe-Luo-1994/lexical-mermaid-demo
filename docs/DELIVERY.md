# 確認你拿到的是可交接版本

公司統一從 `main` 取得，不需要逐一拉取功能分支、套用舊 patch 或尋找原作者的 ZIP。開始前執行 `git branch --show-current`、`git rev-parse HEAD`、`git status --short`，並確認存在：

- `START-HERE.md`、root `AGENTS.md`
- `scripts/doctor.mjs` 與 `npm run doctor`
- `src/ExperimentPanel.tsx`（一鍵配對）
- `docs/AGENT-START.md`、`docs/COMPANY-CASE.md`
- `docs/COMPANY-START.md`、`docs/EDITOR-INTEGRATION.md`
- `experiments/renderer-comparison/package-lock.json` 與 `docs/RENDERER-VALIDATION.md`

缺少這些檔案，代表你拿到舊版；不要把本機展示當成遠端已有功能。

## 交付來源與發布狀態

主線整合來源：[PR #1](https://github.com/Joe-Luo-1994/lexical-mermaid-demo/pull/1)（診斷工具與 onboarding）、[PR #2](https://github.com/Joe-Luo-1994/lexical-mermaid-demo/pull/2)（介面與交接）、[PR #3](https://github.com/Joe-Luo-1994/lexical-mermaid-demo/pull/3)（renderer 實驗與公司入口）。可核對 merged 狀態、main commit 與 GitHub Actions；一般使用者只需從 [公司入口](COMPANY-START.md) 開始，不需要理解 PR 歷史。不要將 results、recordings、.tools、本機 opencode 設定或公司內容一起提交。

## 歷史離線交付（現行 main 使用者可跳過）

2026-11-10 最初離線交付以 `feat/editor-diagnostics` 的 `f3145dfc9892a3ed74dbc431f390df865bfd5a04` 加上當時尚未發布的修改為基底。以下保留為歷史記錄，不是目前使用 main 的安裝步驟。

原始離線交付另提供以下兩種本機交付物（不隨repo下載，見交付時提供的絕對路徑）：

1. **source.zip**：原始碼、lockfiles、合成範例與guide。解壓到獨立目錄後，從START-HERE開始。不含.git、node_modules、Node/Chrome/OpenCode執行檔、憑證、使用者資料；**不是完整離線安裝包**。
2. **changes.patch**：在上述基底commit的乾淨獨立checkout，先 `git apply --check <patch路徑>`，成功才 `git apply <patch路徑>`。若有修改/基底不同，另建checkout，不reset/clean或覆蓋工作。patch包含本輪及先前尚未提交的產品改進。

兩者與SHA256 manifest一起交付。內網不能下載npm套件時，需由公司核准渠道準備lockfile對應cache、Node24和browser；不要帶入本機模型cookie或密碼。

## 發布前的具體檢查

- 檢查完整diff與新增檔案，確認只有產品/測試/docs與公開合成證據。
- 在新解壓的source目錄檢查doctor、零依賴範例、npm ci、validate、rules、build；瀏覽器測試有實際執行才記錄通過。
- 記錄commit/patch SHA、OS/Node/browser與實際exit code。既有示例值不是新機量測。
- 得到明確發布授權後才commit/push；本文件本身不授權發布。
