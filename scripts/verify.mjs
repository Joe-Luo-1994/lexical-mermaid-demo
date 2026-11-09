import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { openLab, runCase } from "./browser.mjs";
const lab = await openLab();
try {
  for (const count of [5, 10])
    for (const size of [20000, 50000, 80000])
      for (const mode of ["placeholder", "svg", "inline", "external"]) {
        const result = await runCase(lab, mode, size, { input: true, count });
        assert.equal(result.completed, count);
        assert.equal(await lab.page.locator(".editor table").count(), count);
        assert.equal(
          result.calls,
          ["inline", "external"].includes(mode) ? count : 0,
        );
        assert.equal(
          await lab.page.locator("[data-testid=diagram]").count(),
          count,
        );
        assert.equal(
          await lab.page.locator("[data-testid=diagram] svg").count(),
          mode === "placeholder" ? 0 : count,
        );
        assert.ok(result.spans["lexical-commit"] >= 0);
        assert.ok(result.completionProxyMs >= result.spans["all-svg-inserted"]);
        assert.ok(
          result.inputs.length === 1 && result.inputs[0].trusted,
          "Trusted keyboard event is required",
        );
        assert.ok(result.textInserted, "Input must change editor content");
        await lab.page.keyboard.type("ordinary text");
        await lab.page.evaluate(
          () =>
            new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
        );
        assert.equal(
          await lab.page.evaluate(() => window.bench.calls()),
          result.calls,
          "Unrelated typing must not regenerate diagram",
        );
        assert.equal(
          await lab.page.locator(".staging").count(),
          0,
          "Staging host must be removed",
        );
        console.log(
          `PASS ${mode} ${size}/${count} diagrams: ${result.completionProxyMs.toFixed(1)} ms, input delay ${result.inputs[0].handlerDelayMs.toFixed(1)} ms`,
        );
      }
  assert.deepEqual(lab.errors, []);
  await mkdir("results", { recursive: true });
  await lab.page.screenshot({ path: "results/screenshot.png" });
  console.log(
    "24 cases passed: real SVG, input, no regeneration, and staging cleanup.",
  );
} finally {
  await lab.close();
}
