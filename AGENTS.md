# Editor Evidence: start here

This repository is a public, synthetic Lexical diagnostic workbench, not the company editor. Do not use another lab's Markdown-import adoption contract as this product's API.

The new product direction is an agent-driven investigation framework that generates project-specific observations. For framework work, read `docs/AGENT-DEBUG-CONTRACT.md`, `docs/AGENT-DEBUG-ACCEPTANCE.md`, and `docs/AGENT-DEBUG-SPIKE.md` first. The confirmed scope is opening an unseen document in an already-running app, 30 minutes after environment/login readiness, and a 100 ms input/scroll visible-response gate. These are requirements, not implemented enforcement. Do not default framework requests to the Mermaid demo or claim the existing collector is portable. For DX work also read `docs/AGENT-DEBUG-DX.md`; `design/agent-debug` is synthetic interaction design, not runtime evidence. Existing tools remain reference/evaluation assets. Follow current session authorization; merge of a company repair remains a human decision.

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

For renderer experiments, read `docs/COMPANY-START.md` and `experiments/renderer-comparison/README.md`. Install the experiment's independent lockfile only. Its summary/samples are not workbench recordings and must not be passed to `editor-evidence`. Reuse existing authorization; do not ask again for paths/actions already in scope. Company integration guidance is `docs/EDITOR-INTEGRATION.md`.

For UI work, read `DESIGN.md` and preserve the result → event → handoff path. Run the focused UX browser check after building; do not treat design-resource recommendations as verified usability gains.
