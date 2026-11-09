import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

export async function openLab() {
  const port = process.env.PORT || "4173";
  const url = process.env.BENCH_URL || `http://127.0.0.1:${port}`;
  let server;
  if (!process.env.BENCH_URL) {
    server = spawn(
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        "preview",
        "--host",
        "127.0.0.1",
        "--port",
        port,
        "--strictPort",
      ],
      { stdio: "pipe" },
    );
    let failure = "";
    server.stderr.on("data", (b) => (failure += b));
    server.stdout.on("data", (b) => (failure += b));
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null)
        throw new Error(`Preview failed: ${failure}`);
      try {
        if ((await fetch(url)).ok) break;
      } catch {}
      if (i === 99) {
        server.kill();
        throw new Error("Preview startup timeout");
      }
      await delay(100);
    }
  }
  try {
    const executablePath =
      process.env.BROWSER_PATH ||
      (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
    const browser = await chromium.launch({
      executablePath,
      headless: true,
      args: ["--no-sandbox"],
    });
    const page = await browser.newPage({
      viewport: { width: 1280, height: 1100 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(url);
    await page.waitForFunction(() => window.bench?.isReady());
    await page.evaluate(() => window.bench.setReporting(false));
    const cdp = await page.context().newCDPSession(page);
    return {
      browser,
      page,
      cdp,
      errors,
      close: async () => {
        await browser.close();
        server?.kill();
      },
    };
  } catch (error) {
    server?.kill();
    throw error;
  }
}

export async function runCase(
  lab,
  mode,
  size,
  { input = false, count = 5, sizing = "natural" } = {},
) {
  const { page, cdp } = lab;
  let sentEpochMs;
  await page.evaluate(
    async ({ mode, size, count, sizing }) =>
      window.bench.prepare(mode, size, count, sizing),
    { mode, size, count, sizing },
  );
  if (input) {
    // Place a real DOM caret before injection, without a measured editor update.
    await page.locator("[contenteditable=true]").focus();
    await page.evaluate(() => {
      setTimeout(() => window.bench.run(), 100);
    });
    // Node's timer is independent of the blocked renderer main thread.
    await delay(125);
    sentEpochMs = Date.now();
    await cdp.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "z",
      code: "KeyZ",
      text: "z",
      unmodifiedText: "z",
      windowsVirtualKeyCode: 90,
      timestamp: sentEpochMs / 1000,
    });
    await cdp.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "z",
      code: "KeyZ",
      windowsVirtualKeyCode: 90,
    });
  } else await page.evaluate(() => window.bench.run());
  await page.waitForFunction(
    () => window.bench.getResult() !== null,
    {},
    { timeout: 120000 },
  );
  const result = await page.evaluate(() => window.bench.getResult());
  if (sentEpochMs !== undefined)
    result.probeSentAfterStartMs =
      sentEpochMs -
      (await page.evaluate(() => performance.timeOrigin)) -
      result.start;
  if (result.error) throw new Error(result.error);
  return result;
}
