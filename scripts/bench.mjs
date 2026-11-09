import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import { openLab, runCase } from "./browser.mjs";
const lab = await openLab();
try {
  const repetitions = Number(process.env.REPETITIONS || 5);
  if (!Number.isInteger(repetitions) || repetitions < 1)
    throw new Error("Invalid repetitions");
  const cases = [];
  for (let repeat = 0; repeat < repetitions; repeat++)
    for (const count of [5, 10])
      for (const size of [20000, 50000, 80000])
        for (const mode of ["placeholder", "svg", "inline", "external"])
          cases.push({ mode, size, count, repeat });
  let seed = 7919;
  for (let i = cases.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [cases[i], cases[j]] = [cases[j], cases[i]];
  }
  const rows = [];
  for (const { mode, size, count, repeat } of cases) {
    const row = await runCase(lab, mode, size, { count });
    rows.push({ ...row, repeat, probe: "none" });
    console.log(
      `${mode} ${size}/${count}: ${row.completionProxyMs.toFixed(1)} ms`,
    );
  }
  // Separate interaction runs so typing does not contaminate main timing comparisons.
  for (const count of [5, 10])
    for (const size of [20000, 80000])
      for (const mode of ["placeholder", "svg", "inline", "external"]) {
        const row = await runCase(lab, mode, size, { input: true, count });
        rows.push({ ...row, probe: "keyboard" });
      }
  await mkdir("results", { recursive: true });
  const pkg = JSON.parse(await readFile("package.json", "utf8"));
  const metadata = {
    at: new Date().toISOString(),
    browser: await lab.browser.version(),
    node: process.version,
    cpu: os.cpus()[0]?.model,
    logicalCpus: os.cpus().length,
    platform: os.platform(),
    dependencies: pkg.dependencies,
    repetitions,
    viewport: { width: 1280, height: 1100 },
    warmLibrary: true,
    svgCache: false,
    tracing: false,
    errors: lab.errors,
  };
  await writeFile(
    "results/benchmark.json",
    JSON.stringify({ metadata, rows }, null, 2),
  );
  const keys = [
    "mode",
    "targetChars",
    "chars",
    "diagramCount",
    "sizing",
    "probe",
    "repeat",
    "completionProxyMs",
    "generateMs",
    "maxOverlappingLongTaskMs",
    "blockingOver50Ms",
    "calls",
    "lexicalNodes",
    "domElements",
  ];
  await writeFile(
    "results/benchmark.csv",
    keys.join(",") +
      "\n" +
      rows.map((row) => keys.map((k) => row[k] ?? "").join(",")).join("\n") +
      "\n",
  );
  const median = (values) => {
    const a = values.sort((a, b) => a - b);
    return a.length % 2
      ? a[(a.length - 1) / 2]
      : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
  };
  const summary = [];
  for (const count of [5, 10])
    for (const size of [20000, 50000, 80000])
      for (const mode of ["placeholder", "svg", "inline", "external"]) {
        const group = rows.filter(
          (r) =>
            r.targetChars === size &&
            r.diagramCount === count &&
            r.mode === mode &&
            r.probe === "none",
        );
        summary.push({
          size,
          count,
          mode,
          completionMedianMs: median(group.map((r) => r.completionProxyMs)),
          generationMedianMs: median(group.map((r) => r.generateMs)),
          maxTaskMedianMs: median(group.map((r) => r.maxOverlappingLongTaskMs)),
          n: group.length,
        });
      }
  await writeFile("results/summary.json", JSON.stringify(summary, null, 2));
  console.table(summary);
  if (lab.errors.length) throw new Error(lab.errors.join("\n"));
} finally {
  await lab.close();
}
