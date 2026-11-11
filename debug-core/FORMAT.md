# Agent Debug core v0.1 產物與接合格式

Executable format for `debug-core/` v0.1. Stable core uses Node 24 built-ins; optional browser adapter uses existing pinned Playwright. No company data in repo. Root contract remains the requirements baseline; this document describes the implemented subset.

## Commands

`node debug-core/cli.mjs init --case DIR --project ROOT --operation TEXT [--budget 1800]`

Starts the case clock immediately (environment/login must already be ready). No source scanning before starting. DIR must not exist. Project root must exist. Writes case.json with kind `agent-debug-case`, version 1, id UUID, root realpath, startedAt/deadlineAt ISO strings, budgetSeconds (1..1800), limits {maxEvents:2000,maxCaptureBytes:2097152,maxArtifactBytes:33554432}, attempts []. Immutable started/deadline identity hash and core source SHA-256; accidental mutation detected, not tamper-proof against arbitrary shell. A different core fingerprint is rejected: retain the pinned tool checkout for historical cases; changing tool version does not authorize resetting investigation budgets.

`node debug-core/cli.mjs run --case DIR --plan FILE -- COMMAND ARGS...`

Plan JSON: {question, outcomes:[string,string], sources:[relative project file paths], limitations:[string]}. Bounded strings and sources; validate paths including realpath, no symlink escape. Snapshot source text and hashes BEFORE spawning command; append attempt BEFORE spawn. Child cwd project root, env DEBUG_RUN_DIR/DEBUG_RUN_ID/DEBUG_DEADLINE. All new case operations subject to original deadline, no reset on query. Child owned process group stops on deadline; Windows limitations documented. Concurrent run lock. Adapter is trusted authorized code, NOT a sandbox. Captures bounded stdout/stderr, retains failure. Child writes `capture.json` in run dir and optional raw artifacts. Core snapshots plan/command/tool version. After completion validate capture references and seal artifact digests; source drift during run invalidates capture. Do not delete failed runs. A pending attempt after crash is reported interrupted, never silently retried. POSIX cancellation cleanup bounded.

Capture v1 (adapter output):
```
{kind:'agent-debug-capture',version:1,runId:process.env.DEBUG_RUN_ID,
 clock:{unit:'ms',origin:'performance.timeOrigin',timeOrigin:NUMBER},
 events:[{id:'e1',name:'handler',startMs:0,durationMs:10,source:{path:'src/app.ts',line:10},rawRef:{artifact:'raw.json',index:0}}],
 relations:[{from:'e1',to:'e2',type:'temporal-association',reason:'adjacent only'}],
 coverage:{installed:['probe name'],dropped:0,limitations:['probe overhead uncalibrated']},
 artifacts:['raw.json'],
 findings:[{id:'f1',status:'observed'|'hypothesis'|'unknown',text:'...',eventIds:['e1'],limitations:['...']}],
 nextExperiment:{question:'...',intervention:'...',controls:['...'],outcomes:['supports...','refutes...']},
 capabilities:{visibleResponse:'unverified',externalViewer:'unverified'},
 costs:{tokens:null,fee:null}
}
```
raw.json must be an array of raw probe event records. Each record for an event includes at least {id,name,startMs,durationMs,source}; core validates rawRef points to same event fields. Captured-call relation additionally requires raw target.parentId===from AND target.parentType==='sync-call'. Captured-schedule requires explicit raw scheduling record; v0.1 reject captured-schedule rather than invent support. static-call/hypothesis/temporal-association never promoted. Core cannot prove adapter honesty: show capture provenance and checks separately. No improvement-validated verdict or 100ms pass in v0.1. Unverified custom capabilities cannot grant success.

`node debug-core/cli.mjs query --case DIR [--run ID] [--event ID] [--limit 10] [--offset 0]`

Returns bounded JSON to stdout. Summary includes identity/deadline/remainingSeconds, all attempts' status (newest-first pagination using offset/limit/nextOffset), validity/freshness, findings with original statuses, limitations/unknown costs and nextExperiment. Detail retains raw refs and source snapshot, optional current fingerprint. Do not dump whole raw data in default query. Every run command stdout ends in JSON summary. Nonzero exit on invalid/failed capture. Query remains usable after expiry and source changes; no history rewrite.

`node debug-core/cli.mjs serve --case DIR [--port 0]`

Loopback read-only server: GET /api/case gives projection; GET /api/run?id=... full validated run projection; GET /api/event?run=...&id=... detail; GET /api/source?run=...&path=... gets pinned source text and hash/current freshness. GET /api/artifact?run=...&path=... gives sealed raw artifact (download only or JSON). Never arbitrary file serving or URL from artifact. No external requests. Inspector must directly select correct event/source line; chronological neighbors not inferred parents. Browser viewer internal evidence/source navigation only, external Perfetto not validated. Viewer shows explicit unknown/unsupported; no synthetic fixtures auto-filled.

Core API exports from core.mjs (async): initCase({caseDir,projectRoot,operation,budgetSeconds=1800}), runCase({caseDir,planPath,command}), queryCase(caseDir,{runId,eventId,limit=10}={}), getRun(caseDir,runId), getSource(caseDir,runId,path), getArtifact(caseDir,runId,path). getRun returns {attempt,capture,sources:[{path,sha256,text,freshness}],validity:{valid,issues:[]},freshness,limitations:[]}; capture may be null on failure. queryCase must be JSON serializable. serve.mjs exports serveCase(caseDir,{port=0}={}) returning http server. CLI root integrates commands.

## Enforced bounds and provenance

Plan and argv each have an 8 KiB encoded bound. Sources: up to 32 files, 256 KiB each, 4 MiB aggregate. Capture: 2 MiB, up to 2,000 events and 4,000 relations. Artifacts: up to 24 files and 32 MiB aggregate. Logs: 256 KiB combined, then stop the owned child. Up to 100 attempts per case. These are accepted-artifact/runner bounds, not a disk quota or arbitrary-code sandbox.

The top-level Node/Python script must be in plan.sources so its bytes are pinned. Inline commands are retained in the bounded argv. This does not discover all imported dependencies or shell indirections. Agents include probe/build/lock provenance explicitly. Git HEAD/status/diff hashes are recorded where available; an enclosing repository is labelled as such and is not claimed as the target's origin.

Query JSON has a 24 KB byte bound. Findings/events/attempts expose omissions and pagination; list text may have items/omitted/truncated projections. Event relation pagination uses offset/nextOffset. Core API accepts limit 1..50; CLI uses 1..20. Offsets are 0..10000. Full sealed data remains available to local viewer/file inspection. Oversized metadata produces an explicit error, never a fabricated empty case.

## Trust and compatibility

A matching rawRef, source snapshot and sync parent validates consistency of adapter-supplied records, not an independently proven causal root. The probe is project-specific generated code and must be checked for semantics and overhead. Captured-call edges additionally reject self edges, cycles and out-of-parent intervals. Async captured-schedule is intentionally rejected in v0.1.

Failed attempts keep status/logs; invalid evidence cannot be navigated as trusted capture. Deadline is enforced for runner-owned work, not all agent thinking or external shell. Query/serve remain read-only after expiry but require the original pinned core implementation. Clock changes and Windows process-tree enforcement are limitations. The current version offers no automatic compatibility migration or new-budget-on-resume.

See [README](README.md), [agent workflow](AGENT-PLAYBOOK.md), and [verification record](VALIDATION.md).
