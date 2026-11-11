# Independent Lexical runtime integration fixture

This is the official `examples/react-rich` application from Lexical **v0.18.0**, vendored unchanged under `upstream/`, plus an explicit generated adaptation. The public repository now redirects `facebook/lexical` to `meta/lexical`. Origin commit: `3d08282ca3e5941a65c45fcf372b4d1fe4dc9d76`. Original MIT license and icon attribution are preserved; `upstream.json` pins every included file by SHA-256.

The original application has no document-navigation operation. `DocumentOperationPlugin.jsx` adds a controlled button which inserts 40 formatted paragraphs. It does not inject a slowdown or claim to reproduce the company issue. The original Composer, RichTextPlugin, History, toolbar and TreeView remain present. The old Mermaid workbench collector is never imported.

## What is generated for this project

- `prepare.mjs prepare TARGET`: copies the verified original source into a new target, adds the controlled document-open operation, and records build adaptation. It uses the tool repository's exact locked dependency tree via a local symlink/junction, not the older upstream development-tool lock. Original upstream package/config files remain preserved. `runtime.json` records actual versions, upstream hashes and the used lock hash.
- `prepare.mjs instrument TARGET`: adds source-specific synchronous wrappers to the operation and original toolbar listener; records the precise before snapshots and `observation.patch`, and writes a minimal `probe-plan.json`. Run this after the case clock starts. It rejects a changed upstream listener shape and double instrumentation rather than guessing.
- `capture-adapter.mjs`: rebuilds within the case budget, opens the app, then clicks the unseen document. Writes actual browser records, checked source references, a diagnostic Chrome trace, screenshot and limited behavior checks. The adapter is trusted project code, not sandboxed by the core runner.

The probe uses a bounded in-memory buffer. It records a synchronous parent only while that parent wrapper is active, preserves return/throw behavior, and does not await promises. Later notifications are only temporal associations. See `probe.test.mjs`. These tests and baseline comparisons are limited behavior evidence, not a proof of complete semantic equivalence.

## Reproduce

With the repository's locked dependencies installed, Node 24 and Chromium available:

```sh
node --test debug-core/examples/lexical-rich/probe.test.mjs
node debug-core/verify-runtime.mjs
```

Set `BROWSER_PATH` to an installed Chromium executable if it is not `/usr/bin/chromium`. The verifier creates a new target and case under ignored `results/debug-runtime/`. The case clock starts conservatively before the uninstrumented baseline is built or opened. Both baseline and observed attempts run through the core runner, so all builds, browser startup, reproduction, instrumentation and analysis count against the same 1,800-second deadline, with failures retained. Preparing the public fixture and resolving installed dependency versions is recorded as fixture setup, not a diagnosis or private project scan. The baseline browser/server are closed, and the instrumented app is rebuilt and reopened inside the budget; this is not reuse of the same live baseline browser. Each document-open operation begins only after its website is open, before the document is displayed. Setup and investigation time are recorded separately. Each run is retained; `latest.json` locates the last successful result, not a reusable source of company conclusions.

This is a scripted integration replay using a prewritten example-specific adapter. Its elapsed time does not demonstrate autonomous source discovery or an agent finishing a new investigation in 30 minutes. It verifies actual runtime capture and limited unchanged content/formatting/typing, not blind diagnostic accuracy, human usability, company performance, the 100 ms visible-response criterion or external Perfetto/Chrome navigation. The diagnostic trace has additional uncalibrated overhead and no established clock mapping to the probe events. Do not combine its measurements with a performance acceptance benchmark. An ordinary expensive original plugin is not thereby a bug.

To investigate a company project, the agent should generate its own narrowly scoped plan and adapter from the authorized source. Do not copy these plugin locations into an unrelated project.

## Recorded verification

[verification.json](verification.json) records the final limited integration result, source/adapter/core fingerprints, both attempt IDs, artifact hashes and scope limits. The raw case remains in ignored local results and can be recreated with the command above; the checked-in report alone is not a portable case bundle or proof of company behavior.
