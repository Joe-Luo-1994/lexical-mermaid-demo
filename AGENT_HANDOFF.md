> 歷史文件：描述 v0.1 benchmark。v0.2 使用 Lexical 0.18.0，請以 [README](README.md) 與 [實驗契約](docs/EXPERIMENT_CONTRACT.md) 為準。

# Agent investigation guide

Use this public repository as a controlled reference for slow post-injection rendering in a target project. It contains synthetic fixtures only. Keep target-specific source, documents, traces and findings in the destination authorized by the project owner.

## Inputs to obtain

- Branch/commit, startup commands and exact reproduction steps.
- package.json, lockfile and installed dependency tree: lexical, all @lexical/* packages, mermaid, wrappers, react/react-dom. Check actual resolved and duplicate versions.
- Serialized content immediately before injection plus diagram source. If only Markdown exists, prepare it before starting the measured injection.
- Paths for content injection, diagram node/component, Mermaid initialization, editor plugins, update listeners, ResizeObserver and whole-document serialization.
- Browser/OS/hardware, production vs development build, StrictMode, throttling, and first vs repeated import.
- Reference JSON export on the same machine, if available. No access to a private hosted site is required to run this repo.

## Evidence boundaries

This reference pins Lexical 0.53.0, Mermaid 12.3.0 and React 19.3.1. Older targets such as Lexical 0.18.0 may require different APIs or serialized schemas. Preserve target versions initially; do not infer a regression from unmatched workloads or blindly paste newer components.

Read WARMUP.md. Every selected diagram is generated before injection timing. Downloaded library does not necessarily mean diagram modules, layout code and fonts are warm. C/D generate again; B reuses prepared output. The two-rAF completion proxy is not proven paint completion or time-to-interactive. Per-diagram request times include queueing.

The rich fixtures pass data/syntax/build checks. The browser suite and performance matrix are provided for execution, not presented as already passed. Establish your own matched baseline.

## Investigation sequence

1. Reproduce using existing target versions. Identify API/wrapper/configuration, htmlLabels, layout, fonts, warm/cold conditions and actual generation count.
2. In the SAME target page and fixture, compare placeholder, prebuilt SVG, minimal direct mermaid.render, and the existing component. Control settings and dimensions.
3. Record node key + source hash, actual render requests/completion, editor commits and significant listeners. React render count is not Mermaid generation count.
4. Capture a Chrome Performance trace. Distinguish diagram computation, other JS/listeners, Layout and Paint. Check completion→editor update and size-observer feedback loops.
5. If minimal integration is still slow, vary configuration, CSS, plugins or versions one at a time. Adapt serialized schemas explicitly when moving fixtures between versions.
6. Verify one evidence-backed change. Keep cold/warm comparisons separate. Do not change versions, caching and lazy rendering together.

## Deliverables

- Reproduction steps and exact version/configuration matrix.
- A switchable comparison preserving the original implementation.
- Raw measurements, generation counts, real input/content checks and representative traces.
- Supported/rejected hypotheses, remaining uncertainty, smallest fix and tradeoffs.

Do not claim a root cause or speedup without matched conditions. Moving work outside the measurement interval is not eliminating it.
