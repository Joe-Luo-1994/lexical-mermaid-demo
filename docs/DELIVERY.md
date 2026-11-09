# 確認你拿到的是可交接版本

只clone遠端，拿不到原作者尚未push的修改。開始前執行 `git branch --show-current`、`git rev-parse HEAD`、`git status --short`，並確認存在：

- `START-HERE.md`、root `AGENTS.md`
- `scripts/doctor.mjs` 與 `npm run doctor`
- `src/ExperimentPanel.tsx`（一鍵配對）
- `docs/AGENT-START.md`、`docs/COMPANY-CASE.md`

缺少這些檔案，代表你拿到舊版；不要把本機展示當成遠端已有功能。

## 交付來源與發布狀態

2026-11-10 的本機驗證以 `feat/editor-diagnostics` 的 `f3145dfc9892a3ed74dbc431f390df865bfd5a04` 加上產品與onboarding修改為基底。最初離線交付時尚未發布；後續已獲擁有者授權提交、push與合併。最新發布結果請核對 [PR #1](https://github.com/Joe-Luo-1994/lexical-mermaid-demo/pull/1) 的 merged 狀態及你clone的commit，不將授權或舊ZIP manifest當作已合併證據。不要將results、recordings、.tools、本機opencode設定或公司內容一起提交。

原始離線交付另提供以下兩種本機交付物（不隨repo下載，見交付時提供的絕對路徑）：

1. **source.zip**：原始碼、lockfiles、合成範例與guide。解壓到獨立目錄後，從START-HERE開始。不含.git、node_modules、Node/Chrome/OpenCode執行檔、憑證、使用者資料；**不是完整離線安裝包**。
2. **changes.patch**：在上述基底commit的乾淨獨立checkout，先 `git apply --check <patch路徑>`，成功才 `git apply <patch路徑>`。若有修改/基底不同，另建checkout，不reset/clean或覆蓋工作。patch包含本輪及先前尚未提交的產品改進。

兩者與SHA256 manifest一起交付。內網不能下載npm套件時，需由公司核准渠道準備lockfile對應cache、Node24和browser；不要帶入本機模型cookie或密碼。

## 發布前的具體檢查

- 檢查完整diff與新增檔案，確認只有產品/測試/docs與公開合成證據。
- 在新解壓的source目錄檢查doctor、零依賴範例、npm ci、validate、rules、build；瀏覽器測試有實際執行才記錄通過。
- 記錄commit/patch SHA、OS/Node/browser與實際exit code。既有示例值不是新機量測。
- 得到明確發布授權後才commit/push；本文件本身不授權發布。
