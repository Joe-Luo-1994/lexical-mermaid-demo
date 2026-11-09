import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  queryReport,
  queryFile,
  serializeResult,
  validateReport,
} from "./report-query.mjs";

const fixture = () => ({
  schemaVersion: 1,
  id: "run-test",
  environment: { lexical: "0.18.0" },
  configuration: { mode: "inline" },
  metrics: { completionProxyMs: 91 },
  diagrams: [],
  findings: [{ title: "Observed duration", evidenceIds: ["event-b"] }],
  limitations: ["No causal claim"],
  events: [
    { id: "event-a", kind: "update", start: 0, duration: 4, label: "Update" },
    { id: "event-b", kind: "render", start: 2, duration: 80, label: "Render" },
  ],
});

test("summary cites evidence, sorts spans, preserves overlap caution and reports omissions", () => {
  const result = queryReport(fixture(), { limit: 1 });
  assert.equal(result.events[0].id, "event-b");
  assert.equal(result.omitted.events, 1);
  assert.equal(result.findings[0].evidenceIds[0], "event-b");
  assert.match(result.next, /overlapping/);
});
test("exact event lookup is unambiguous and does not infer parentage", () => {
  assert.equal(
    queryReport(fixture(), { eventId: "event-a" }).event.parentId,
    undefined,
  );
  assert.throws(
    () => queryReport(fixture(), { eventId: "absent" }),
    /not found/,
  );
});
test("rejects incompatible schema and duplicate or invalid event identities", () => {
  assert.throws(
    () => validateReport({ ...fixture(), schemaVersion: 2 }),
    /schemaVersion/,
  );
  const r = fixture();
  r.events[1].id = "event-a";
  assert.throws(() => validateReport(r), /unique/);
  const n = fixture();
  n.events[0].duration = -1;
  assert.throws(() => validateReport(n), /duration/);
  const missing = fixture();
  missing.findings[0].evidenceIds = ["unknown"];
  assert.throws(() => validateReport(missing), /evidenceIds/);
  const parent = fixture();
  parent.events[0].parentId = "unknown";
  assert.throws(() => validateReport(parent), /parentId/);
  assert.throws(() => queryReport(fixture(), { limit: 0 }), /limit/);
});
test("large nested data returns valid JSON with bounded output", () => {
  const r = fixture();
  r.events[0].data = {
    message: "X".repeat(30000),
    nested: Array(500).fill({ text: "Z".repeat(4000) }),
  };
  const result = serializeResult(queryReport(r, { eventId: "event-a" }));
  assert.doesNotThrow(() => JSON.parse(result));
  assert.ok(result.length <= 16000);
  const escaped = serializeResult({
    reportId: "id",
    view: "event",
    large: '"\\\n'.repeat(50000),
  });
  assert.ok(escaped.length <= 16000);
  assert.equal(JSON.parse(escaped).truncated, true);
});
test("CLI reads literal paths, rejects wrong file types, and keeps errors structured", async () => {
  const directory = await mkdtemp(join(tmpdir(), "editor-evidence-"));
  try {
    const file = join(directory, "literal $(not-a-command) report.json");
    await writeFile(file, JSON.stringify(fixture()));
    assert.equal(JSON.parse(await queryFile(file)).reportId, "run-test");
    const proc = spawnSync(
      process.execPath,
      ["scripts/report-query.mjs", file, "--event", "event-b"],
      { encoding: "utf8" },
    );
    assert.ifError(proc.error);
    assert.equal(proc.status, 0);
    assert.equal(JSON.parse(proc.stdout).event.id, "event-b");
    await writeFile(file, "not JSON");
    const bad = spawnSync(
      process.execPath,
      ["scripts/report-query.mjs", file],
      { encoding: "utf8" },
    );
    assert.ifError(bad.error);
    assert.equal(bad.status, 1);
    assert.match(JSON.parse(bad.stderr).error, /Invalid JSON/);
    await assert.rejects(queryFile(directory), /regular JSON file/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
