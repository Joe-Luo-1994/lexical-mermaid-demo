# Editor Evidence: start here

This repository is a public, synthetic Lexical diagnostic workbench, not the company editor. Do not use another lab's Markdown-import adoption contract as this product's API.

Read `START-HERE.md`, then `docs/AGENT-START.md` for the requested track. Read `docs/EXPERIMENT_CONTRACT.md` and `docs/DIAGNOSTIC_RULES.md` before interpreting measurements. `docs/OPENCODE.md` describes the optional integration; CLI works without it.

- Default: public-demo track only. No company filesystem search or upload without explicit scope. Company data stays local; gitignore is not permission to send it to a model provider.
- Node 24; Lexical 0.18.0, React 18.3.1, Mermaid 12.3.0. Use lockfiles, preserve existing changes, never upgrade to make a test pass. Use `npm run doctor` before installation; it is read-only and needs no dependencies.
- Reversible setup within this checkout is authorized when the user asks to start. No global settings, existing server restarts, secrets, publishing or external messages without corresponding authorization.
- Read actual package scripts and run relevant tests. UI changes require browser verification, including page/console errors. Local success is not another machine's success.
- Mark claims Observed, Inferred, Unknown. Cite report/event IDs or exact source evidence. A passing test, API HTTP 200, active plugin, actual Web tool call, and sound agent diagnosis are separate outcomes.
- `recordings/` and `results/` are local artifacts. A single recording, an experiment bundle and a Chrome trace are different formats; do not rename one to impersonate another.
- No statistical significance claim from medians/ranges; request spans include queueing, completion proxy is two rAFs after insertion, not paint or TTI. Chrome tracing runs are separate diagnostic samples.
- Finish with local URL, <=5 trial steps, passed/blocked/unverified layers, evidence paths and one falsifiable next experiment. If blocked, complete independent work and leave exact recovery commands; do not claim success.

Company investigation starts with the evidence gates in `docs/COMPANY-CASE.md`, not automatic instrumentation or a root-cause guess.
