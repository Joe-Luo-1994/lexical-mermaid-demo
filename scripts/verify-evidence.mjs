import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { openLab } from "./browser.mjs";
import { parseReport, compareReports } from "../src/diagnostics.ts";
const lab = await openLab();
const { page, cdp } = lab;
await mkdir("results", { recursive: true });
const checked = [];
async function run({
  scenario = "normal",
  mode = "inline",
  size = 20000,
  count = 5,
  recording = "light",
} = {}) {
  await page.evaluate(
    async (c) => {
      await window.bench.prepare(
        c.mode,
        c.size,
        c.count,
        "natural",
        c.scenario,
        c.recording,
      );
      window.bench.run();
    },
    { scenario, mode, size, count, recording },
  );
  await page.waitForFunction(() => window.bench.getResult() !== null, null, {
    timeout: 90000,
  });
  const r = await page.evaluate(() => window.bench.reports().at(-1));
  parseReport(r);
  assert.ok(!r.limitations.some((x) => x.startsWith("ERROR:")));
  assert.equal(await page.locator("[data-testid=diagram]").count(), count);
  assert.equal(
    await page.locator("[data-testid=diagram] svg").count(),
    mode === "placeholder" ? 0 : count,
  );
  assert.equal(await page.locator(".editor table").count(), count);
  assert.equal(await page.locator(".staging").count(), 0);
  checked.push(r);
  return r;
}
try {
  await page.evaluate(() => window.bench.setReporting(true));
  await page.screenshot({ path: "results/empty-desktop.png", fullPage: true });
  // Exercise real controls, not only the test API.
  await page.getByText("自訂實驗 · 情境、文件與量測設定", {exact:true}).click();
  await page.getByRole("button", { name: "錄製這次操作" }).click();
  await page.waitForFunction(() => window.bench.getResult() !== null, null, {
    timeout: 90000,
  });
  const normal = parseReport(
    await page.evaluate(() => window.bench.reports().at(-1)),
  );
  assert.equal(normal.metrics.renderCalls, 5);
  assert.ok(!normal.findings.some((f) => f.id === "repeated-mermaid-requests"));
  checked.push(normal);
  await page.getByLabel("測試情境", { exact: true }).selectOption("duplicate");
  await page.getByRole("button", { name: "錄製這次操作" }).click();
  await page.waitForFunction(() => window.bench.reports().length === 2, null, {
    timeout: 90000,
  });
  const duplicate = parseReport(
    await page.evaluate(() => window.bench.reports().at(-1)),
  );
  assert.equal(duplicate.metrics.renderCalls, 10);
  assert.ok(
    duplicate.findings.some((f) => f.id === "repeated-mermaid-requests"),
  );
  assert.ok(compareReports(normal, duplicate).comparable);
  checked.push(duplicate);
  assert.ok(
    await page
      .getByRole("heading", { name: "同一張圖有多次生成請求" })
      .isVisible(),
  );
  await page.screenshot({
    path: "results/findings-desktop.png",
    fullPage: true,
  });
  await page.locator(".evidence-links button").first().click();
  assert.ok(await page.locator(".event-detail pre").isVisible());
  await page.screenshot({ path: "results/events-desktop.png", fullPage: true });
  await page.getByRole("tab", { name: "比較實驗", exact: true }).click();
  assert.ok(await page.locator(".comparison-pass").isVisible());
  await page.screenshot({
    path: "results/compare-desktop.png",
    fullPage: true,
  });
  const adjacent = await run({ scenario: "adjacent" });
  assert.equal(adjacent.metrics.renderCalls, 5);
  assert.ok(adjacent.events.some((e) => e.owner === "IndependentProbe"));
  assert.ok(
    !adjacent.findings.some((f) => f.id === "repeated-mermaid-requests"),
  );
  assert.ok(
    adjacent.events.every((e) => !e.parentId),
    "No inferred edges",
  );
  for (const mode of ["external", "svg", "placeholder"]) {
    const r = await run({ mode });
    assert.equal(r.metrics.renderCalls, mode === "external" ? 5 : 0);
  }
  const large = await run({ size: 80000, count: 10 });
  assert.equal(large.metrics.renderCalls, 10);
  assert.ok(!compareReports(normal, large).comparable);
  // Actual editor input after completion must not regenerate diagrams.
  await page.locator(".editor").click({ position: { x: 60, y: 40 } });
  await page.keyboard.type(" evidence-input");
  assert.ok(
    (await page.locator(".editor").innerText()).includes("evidence-input"),
  );
  assert.equal(await page.evaluate(() => window.bench.calls()), 10);
  // Paired exploratory overhead runs; alternating order limits order confounding.
  const pairs = [];
  for (let i = 0; i < 4; i++) {
    const pair = {};
    for (const recording of i % 2 ? ["light", "off"] : ["off", "light"])
      pair[recording] = await run({ recording });
    assert.equal(pair.off.events.length, 0);
    assert.ok(pair.light.events.length > 0);
    assert.ok(!compareReports(pair.off, pair.light).comparable);
    pairs.push({
      off: pair.off.metrics.completionProxyMs,
      light: pair.light.metrics.completionProxyMs,
      delta:
        pair.light.metrics.completionProxyMs -
        pair.off.metrics.completionProxyMs,
    });
  }
  // Untrusted imported findings get recomputed. Incomparable records get no delta.
  const altered = structuredClone(normal);
  altered.id = "import-cold-counterexample";
  altered.configuration.warmup = "cold";
  altered.findings = [{ title: "FAKE CLAIM" }];
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "counterexample.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(altered)),
    });
  // File.text() and the React commit complete after setInputFiles returns.
  // Wait for this import's identity, not a status left by a previous operation.
  await page.waitForFunction(
    (id) => document.querySelector(".report-identity")?.textContent === id,
    altered.id,
  );
  await page.getByRole("tab", { name: "比較實驗", exact: true }).click();
  assert.ok(await page.locator(".comparison-block").isVisible());
  assert.equal(await page.getByText("FAKE CLAIM", { exact: true }).count(), 0);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  await (await downloadPromise).saveAs("results/exported-recording.json");
  const invalid = { schemaVersion: 1 };
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(invalid)),
    });
  await page.waitForFunction(() =>
    document.querySelector('[role="status"]')?.textContent?.includes("無法載入"),
  );
  assert.match(await page.getByRole("status").innerText(), /無法載入/);
  // Collect a real browser trace in a separate, explicitly instrumented run.
  const trace = [];
  cdp.on("Tracing.dataCollected", ({ value }) => trace.push(...value));
  await page.evaluate(() =>
    window.bench.prepare("inline", 20000, 5, "natural", "duplicate", "light"),
  );
  await cdp.send("Tracing.start", {
    categories:
      "devtools.timeline,blink.user_timing,v8.execute,disabled-by-default-devtools.timeline",
    transferMode: "ReportEvents",
  });
  await page.evaluate(() => window.bench.run());
  await page.waitForFunction(() => window.bench.getResult() !== null);
  const done = new Promise((resolve) =>
    cdp.once("Tracing.tracingComplete", resolve),
  );
  await cdp.send("Tracing.end");
  await done;
  assert.ok(trace.some((e) => e.name.endsWith?.(":inject-start")));
  assert.ok(trace.some((e) => e.name === "Layout"));
  await writeFile(
    "results/duplicate-browser.trace.json",
    JSON.stringify({ traceEvents: trace }),
  );
  const traced = await page.evaluate(() => window.bench.reports().at(-1));
  traced.limitations.push(
    "TRACE: 此筆同時開啟 CDP tracing；不可用來估計未錄 trace 的效能。",
  );
  await writeFile(
    "results/traced-recording.json",
    JSON.stringify(traced, null, 2),
  );
  await page.getByRole("tab", { name: "觀測與下一步", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
    "No page-wide mobile overflow",
  );
  await page.screenshot({
    path: "results/findings-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(lab.errors, []);
  await writeFile("results/recordings.json", JSON.stringify(checked, null, 2));
  const sorted = pairs.map((p) => p.delta).sort((a, b) => a - b);
  const validation = {
    checkedAt: new Date().toISOString(),
    browser: await lab.browser.version(),
    recordings: checked.length,
    checks: [
      "real UI normal and duplicate",
      "evidence selection",
      "guarded comparison",
      "adjacent noncausal control",
      "external / prebuilt / placeholder",
      "80k + 10 diagrams / tables",
      "trusted editor typing without regeneration",
      "export / import / invalid input",
      "mobile overflow",
      "separate Chrome trace",
    ],
    overhead: {
      pairs,
      medianDeltaMs: (sorted[1] + sorted[2]) / 2,
      interpretation:
        "4 exploratory paired runs on one machine; not a stable overhead budget or general performance claim",
    },
    errors: lab.errors,
  };
  await writeFile(
    "results/validation.json",
    JSON.stringify(validation, null, 2),
  );
  console.log(JSON.stringify(validation, null, 2));
} finally {
  await lab.close();
}
