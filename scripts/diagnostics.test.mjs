import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze, compareReports, parseReport } from "../src/diagnostics.ts";

function report(events = []) {
  return {
    schemaVersion: 1,
    id: "run-a",
    environment: {
      lexical: "0.18.0",
      react: "18.3.1",
      mermaid: "12.3.0",
      browser: "test-browser",
      build: "production",
    },
    configuration: {
      mode: "inline",
      scenario: "normal",
      size: 20000,
      count: 2,
      sizing: "natural",
      warmup: "warm",
      recording: "events",
      fixtureHash: "abc",
    },
    metrics: {
      completionProxyMs: 250,
      commitMs: 4,
      renderCalls: 2,
      diagramCount: 2,
      maxLongTaskMs: 0,
      longTaskSupported: true,
    },
    events,
    diagrams: [],
    limitations: [],
    findings: [],
  };
}
const request = (id, diagramId, start) => ({
  id,
  kind: "mermaid-request",
  label: "Generate",
  diagramId,
  start,
});

test("repeated identity yields evidence, distinct diagrams do not, labels never reveal the answer", () => {
  const a = report([
    request("e1", "diagram-a", 2),
    request("e2", "diagram-b", 3),
  ]);
  a.configuration.scenario = "duplicate-render";
  assert.ok(!analyze(a).some((x) => x.id === "repeated-mermaid-requests"));
  a.events.push(request("e3", "diagram-a", 30));
  a.configuration.scenario = "normal";
  const finding = analyze(a).find((x) => x.id === "repeated-mermaid-requests");
  assert.equal(finding.confidence, "observed");
  assert.deepEqual(finding.evidenceIds, ["e1", "e3"]);
  assert.match(finding.summary, /尚不能證明多餘/);
});

test("unrelated adjacent plugin activity never becomes a causal edge or attribution", () => {
  const a = report([
    {
      id: "p1",
      kind: "plugin",
      label: "Plugin A",
      owner: "A",
      start: 1,
      duration: 20,
    },
    {
      id: "p2",
      kind: "plugin",
      label: "Plugin B",
      owner: "B",
      start: 21,
      duration: 60,
    },
    { id: "l1", kind: "longtask", label: "Long task", start: 1, duration: 80 },
  ]);
  const result = analyze(a);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "main-thread-blocking");
  assert.deepEqual(result[0].evidenceIds, ["l1"]);
  assert.match(result[0].summary, /不能證明/);
});

test("invalid timings and ambiguous IDs fail closed instead of producing improvement claims", () => {
  for (const event of [
    request("bad", "a", -1),
    { ...request("bad", "a", 0), duration: NaN },
    { ...request("bad", "a", 0), duration: -4 },
    { ...request("bad", "a", 0), parentId: "missing" },
  ]) {
    const bad = report([event]);
    assert.equal(analyze(bad)[0].id, "invalid-evidence");
    assert.equal(compareReports(report(), bad).deltas, null);
  }
  const repeatedIds = report([
    request("same", "a", 1),
    request("same", "a", 2),
  ]);
  assert.equal(analyze(repeatedIds)[0].id, "invalid-evidence");
});

test("cold versus warm, different versions, different fixture, and observer mode block comparison", () => {
  for (const [section, key, value] of [
    ["configuration", "warmup", "cold"],
    ["environment", "lexical", "0.53.0"],
    ["configuration", "fixtureHash", "different"],
    ["configuration", "recording", "off"],
    ["environment", "browser", "another-browser"],
  ]) {
    const b = report();
    b[section][key] = value;
    const comparison = compareReports(report(), b);
    assert.equal(comparison.comparable, false);
    assert.equal(comparison.deltas, null);
    assert.ok(comparison.reasons.some((reason) => reason.includes(key)));
  }
});

test("interventions remain explicit and deltas are descriptive B minus A", () => {
  const b = report();
  b.configuration.mode = "external";
  b.configuration.scenario = "duplicate-render";
  b.metrics.completionProxyMs = 190;
  b.metrics.commitMs = null;
  const comparison = compareReports(report(), b);
  assert.equal(comparison.comparable, true);
  assert.deepEqual(
    comparison.interventions.map((x) => x.field),
    ["mode", "scenario"],
  );
  assert.equal(comparison.deltas.completionProxyMs, -60);
  assert.equal(comparison.deltas.commitMs, null);
  assert.match(comparison.note, /無法分離/);
  assert.match(comparison.note, /單樣本/);
});

test("missing observability is distinguished from a clean bill of health", () => {
  const a = report();
  a.metrics.longTaskSupported = false;
  assert.ok(analyze(a).some((x) => x.id === "longtask-unavailable"));
  assert.ok(analyze(a).some((x) => x.id === "limited-evidence"));
});

test("untrusted imports fail safely on missing configuration and invalid shapes", () => {
  for (const input of [
    null,
    [],
    {},
    { ...report(), configuration: undefined },
    { ...report(), environment: [] },
    { ...report(), limitations: ["ok", null] },
    { ...report(), diagrams: null },
  ]) {
    assert.throws(() => parseReport(input), /無法匯入/);
    assert.equal(analyze(input)[0].id, "invalid-evidence");
  }
  const tooMany = report(
    Array.from({ length: 2001 }, (_, i) => request(`e${i}`, "a", 0)),
  );
  assert.throws(() => parseReport(tooMany), /2000/);
});

test("imported fabricated findings are discarded and derived only from event evidence", () => {
  const input = report([request("e1", "a", 1), request("e2", "b", 2)]);
  input.findings = [
    {
      id: "fake",
      title: "Plugin X is the root cause",
      confidence: "observed",
      evidenceIds: ["e1"],
      summary: "fabricated",
      nextExperiment: "delete X",
    },
  ];
  const parsed = parseReport(input);
  assert.ok(parsed.findings.every((finding) => finding.id !== "fake"));
  assert.equal(parsed.findings[0].id, "mermaid-requests");
  assert.equal(input.findings[0].id, "fake");
});

test("events, commits and diagram counts must fit the recorded operation", () => {
  for (const invalid of [
    report([request("late", "a", 252)]),
    report([{ ...request("overlap", "a", 240), duration: 12 }]),
    { ...report(), metrics: { ...report().metrics, commitMs: 252 } },
    { ...report(), configuration: { ...report().configuration, count: 3 } },
    { ...report(), diagrams: [{ id: "only-one" }] },
  ])
    assert.throws(() => parseReport(invalid), /無法匯入/);
  assert.doesNotThrow(() =>
    parseReport(
      report([
        {
          id: "l1",
          kind: "longtask",
          label: "Clipped long task",
          start: 200,
          duration: 50,
        },
      ]),
    ),
  );
  assert.doesNotThrow(() =>
    parseReport(report([request("rounding", "a", 250.1)])),
  );
});

test("incomplete ERROR recordings remain inspectable but cannot become a performance improvement", () => {
  const input = report([request("e1", "a", 1)]);
  input.limitations.push("ERROR: timeout before all diagrams completed");
  const parsed = parseReport(input);
  assert.ok(parsed.findings.length > 0);
  const comparison = compareReports(report(), parsed);
  assert.equal(comparison.comparable, false);
  assert.equal(comparison.deltas, null);
  assert.ok(comparison.reasons.some((reason) => reason.includes("未完成")));
});

test("viewport/DPR, when captured, must match on both recordings", () => {
  const a = report();
  a.environment.viewport = "1280x900@1";
  const b = report();
  b.environment.viewport = "1280x900@2";
  assert.equal(compareReports(a, b).comparable, false);
  delete b.environment.viewport;
  assert.equal(compareReports(a, b).comparable, false);
  b.environment.viewport = a.environment.viewport;
  assert.equal(compareReports(a, b).comparable, true);
  delete a.environment.viewport;
  delete b.environment.viewport;
  assert.match(compareReports(a, b).note, /人工確認/);
  b.environment.viewport = {};
  assert.throws(() => parseReport(b), /viewport/);
});

test("disabled instrumentation does not claim the browser lacks the API", () => {
  const a = report();
  a.configuration.recording = "off";
  a.metrics.longTaskSupported = false;
  const finding = analyze(a).find(
    (finding) => finding.id === "longtask-unavailable",
  );
  assert.match(finding.title, /關閉/);
  assert.match(finding.nextExperiment, /開啟/);
});

test("CDP trace captures are inspectable but excluded from performance acceptance", () => {
  const a = report();
  a.limitations.push("TRACE: CDP tracing enabled; diagnostic capture only");
  const parsed = parseReport(a);
  assert.ok(parsed.findings.length);
  const comparison = compareReports(parsed, report());
  assert.equal(comparison.comparable, false);
  assert.equal(comparison.deltas, null);
  assert.ok(comparison.reasons.some((reason) => reason.includes("trace")));
});
