import mermaid from "mermaid";
import type { EditorState, LexicalEditor } from "lexical";
import { fixture } from "./fixtures";
import {
  analyze,
  type EvidenceEvent,
  type EvidenceReport,
} from "./diagnostics";

export const modes = ["inline", "external", "svg", "placeholder"] as const;
export type Mode = (typeof modes)[number];
export type Sizing = "natural" | "fixed";
export type Scenario = "normal" | "duplicate" | "adjacent";
export const labels: Record<Mode, string> = {
  placeholder: "只顯示佔位",
  svg: "使用預生成 SVG",
  inline: "在節點內繪圖",
  external: "在畫面外繪圖",
};
export const scenarioLabels: Record<Scenario, string> = {
  normal: "正常流程",
  duplicate: "重複繪圖案例",
  adjacent: "獨立事件對照",
};
type Entry = { start: number; duration: number };
export type DiagramTiming = {
  id: string;
  title: string;
  kind: string;
  sourceChars: number;
  requested?: number;
  resolved?: number;
  inserted?: number;
  error?: string;
};
export type Run = {
  viewport: string;
  id: number;
  mode: Mode;
  sizing: Sizing;
  scenario: Scenario;
  recording: "light" | "off";
  fixtureHash: string;
  chars: number;
  targetChars: number;
  lexicalNodes: number;
  tables: number;
  nodeTypes: Record<string, number>;
  diagramCount: number;
  diagrams: DiagramTiming[];
  start: number;
  end?: number;
  calls: number;
  error?: string;
  spans: Record<string, number>;
  events: EvidenceEvent[];
  longTasks: Entry[];
  inputs: { trusted: boolean; handlerDelayMs: number; nextFrameMs?: number }[];
  domElements?: number;
  textInserted?: boolean;
  done: boolean;
  completed: number;
  report?: EvidenceReport;
};
let editor: LexicalEditor;
let prepared: EditorState | null = null;
let preparedFixture: ReturnType<typeof fixture>;
let preparedConfig = {
  mode: "inline" as Mode,
  sizing: "natural" as Sizing,
  scenario: "normal" as Scenario,
  recording: "light" as "light" | "off",
  fixtureHash: "",
};
let sequence = 0,
  runSequence = 0,
  pending = false,
  reporting = true;
let observer: PerformanceObserver | undefined;
let watchdog: ReturnType<typeof setTimeout> | undefined;
export let current: Run | undefined;
const session = crypto.randomUUID();
const svgs = new Map<string, string>();
const results: Run[] = [];
const reports: EvidenceReport[] = [];
let onResult = () => {};
mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
  theme: "default",
  fontFamily: "Arial",
  flowchart: { htmlLabels: false },
});
export function staging(sizing: Sizing = "natural") {
  const el = document.createElement("div");
  el.className = `diagram staging ${sizing}`;
  el.setAttribute("aria-hidden", "true");
  document.body.append(el);
  return el;
}
export async function generate(host: HTMLElement, text: string) {
  return (await mermaid.render(`graph-${++sequence}`, text, host)).svg;
}
export function event(
  value: Run,
  kind: string,
  label: string,
  owner: string,
  extra: Partial<EvidenceEvent> = {},
) {
  if (
    value.recording === "off" ||
    value.done ||
    value.events.length >= 2000 ||
    (value.end !== undefined && kind !== "longtask" && kind !== "completion")
  )
    return undefined;
  const item: EvidenceEvent = {
    id: `${session}:${value.id}:e${value.events.length + 1}`,
    kind,
    label,
    owner,
    start: performance.now() - value.start,
    ...extra,
  };
  value.events.push(item);
  return item;
}
export function mark(value: Run, name: string) {
  value.spans[name] = performance.now() - value.start;
  if (value.recording === "light") performance.mark(`run-${value.id}:${name}`);
}
export async function prepare(
  mode: Mode,
  size: number,
  count = 5,
  sizing: Sizing = "natural",
  scenario: Scenario = "normal",
  recording: "light" | "off" = "light",
) {
  if (pending || (current && !current.done))
    throw new Error("上一筆操作尚未完成。");
  if (
    !modes.includes(mode) ||
    !["natural", "fixed"].includes(sizing) ||
    !["normal", "duplicate", "adjacent"].includes(scenario) ||
    !["light", "off"].includes(recording)
  )
    throw new Error("Invalid configuration");
  pending = true;
  prepared = null;
  try {
    current = undefined;
    editor.setEditorState(
      editor.parseEditorState(
        JSON.stringify({
          root: {
            type: "root",
            version: 1,
            format: "",
            indent: 0,
            direction: null,
            children: [
              {
                type: "paragraph",
                version: 1,
                format: "",
                indent: 0,
                direction: null,
                children: [],
              },
            ],
          },
        }),
      ),
    );
    await new Promise<void>((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r())),
    );
    await document.fonts.ready;
    const begin = performance.now();
    preparedFixture = fixture(size, count);
    // Every recording warms every diagram once, including off and prebuilt controls.
    // This explicit policy compares warmed injection, not cold page startup.
    for (const diagram of preparedFixture.diagrams) {
      const host = staging(sizing);
      try {
        svgs.set(diagram.id, await generate(host, diagram.source));
      } finally {
        host.remove();
      }
    }
    const serialized = JSON.stringify(preparedFixture.state);
    const bytes = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(serialized),
    );
    const fixtureHash = Array.from(new Uint8Array(bytes), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    prepared = editor.parseEditorState(serialized);
    preparedConfig = { mode, sizing, scenario, recording, fixtureHash };
    return {
      mode,
      size,
      count,
      sizing,
      scenario,
      recording,
      preparationMs: performance.now() - begin,
      ...preparedFixture.stats,
    };
  } finally {
    pending = false;
  }
}
export function prebuiltSvg(id: string) {
  const svg = svgs.get(id);
  if (!svg) throw new Error(`Missing SVG ${id}`);
  return svg;
}
export function run() {
  if (!prepared || pending || (current && !current.done))
    throw new Error("請先準備新的資料。");
  const f = preparedFixture;
  const value: Run = {
    viewport: `${innerWidth}x${innerHeight}@${devicePixelRatio}`,
    id: ++runSequence,
    ...preparedConfig,
    chars: f.stats.chars,
    targetChars: f.target,
    lexicalNodes: f.stats.nodes,
    tables: f.stats.tables,
    nodeTypes: f.stats.types,
    diagramCount: f.diagrams.length,
    diagrams: f.diagrams.map((d) => ({
      id: d.id,
      title: d.title,
      kind: d.kind,
      sourceChars: d.source.length,
    })),
    start: performance.now(),
    calls: 0,
    spans: {},
    events: [],
    longTasks: [],
    inputs: [],
    done: false,
    completed: 0,
  };
  current = value;
  if (
    value.recording === "light" &&
    PerformanceObserver.supportedEntryTypes.includes("longtask")
  ) {
    observer = new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        value.longTasks.push({ start: e.startTime, duration: e.duration });
    });
    observer.observe({ type: "longtask", buffered: false });
  }
  mark(value, "inject-start");
  event(value, "operation", "注入已準備的 EditorState", "Import");
  watchdog = setTimeout(() => {
    if (current === value && !value.done) {
      value.error = "操作超過 60 秒；保留部分證據，不能視為完成。";
      finish(value);
    }
  }, 60000);
  const state = prepared;
  prepared = null;
  try {
    editor.setEditorState(state, { tag: "benchmark-inject" });
    mark(value, "api-return");
  } catch (error) {
    value.error = String(error);
    finish(value);
  }
  return value.id;
}
export function diagramTiming(value: Run, id: string) {
  const d = value.diagrams.find((d) => d.id === id);
  if (!d) throw new Error("Unknown diagram");
  return d;
}
function finish(value: Run) {
  if (value.done) return;
  clearTimeout(watchdog);
  value.end ??= performance.now();
  if (value.viewport !== `${innerWidth}x${innerHeight}@${devicePixelRatio}`)
    value.error = "錄製期間視窗或 DPR 改變，不能直接比較。";
  if (observer) {
    for (const e of observer.takeRecords())
      value.longTasks.push({ start: e.startTime, duration: e.duration });
    observer.disconnect();
    observer = undefined;
  }
  value.longTasks = value.longTasks.filter(
    (e) => e.start < value.end! && e.start + e.duration > value.start,
  );
  for (const task of value.longTasks)
    event(value, "longtask", "瀏覽器 Long Task", "Browser", {
      start: Math.max(0, task.start - value.start),
      duration: Math.max(
        0,
        Math.min(task.start + task.duration, value.end!) -
          Math.max(task.start, value.start),
      ),
    });
  value.domElements = editor.getRootElement()?.querySelectorAll("*").length;
  value.done = true;
  results.push(value);
  value.report = toReport(value);
  reports.push(value.report);
  for (const name of Object.keys(value.spans))
    performance.clearMarks(`run-${value.id}:${name}`);
  if (reporting) onResult();
}
export function complete(value: Run, id: string) {
  if (current !== value || value.done) return;
  const d = diagramTiming(value, id);
  if (d.inserted !== undefined) return;
  d.inserted = performance.now() - value.start;
  mark(value, `${id}:inserted`);
  event(value, "svg-insert", "圖表呈現插入", "MermaidView", { diagramId: id });
  value.completed++;
  if (value.completed !== value.diagramCount) return;
  mark(value, "all-svg-inserted");
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      if (current !== value || value.done) return;
      mark(value, "two-raf-after-insert");
      value.end = performance.now();
      event(value, "completion", "全部圖表插入後兩次 rAF", "Browser");
      setTimeout(() => finish(value), 180);
    }),
  );
}
export function summary(value: Run) {
  const durations = value.longTasks.map((e) =>
    Math.max(
      0,
      Math.min(e.start + e.duration, value.end!) -
        Math.max(e.start, value.start),
    ),
  );
  const generated = value.diagrams.filter(
    (d) => d.requested !== undefined && d.resolved !== undefined,
  );
  return {
    ...value,
    report: undefined,
    preparationExcluded: true,
    longTaskSupported:
      PerformanceObserver.supportedEntryTypes.includes("longtask"),
    generateMs: generated.length
      ? Math.max(...generated.map((d) => d.resolved!)) -
        Math.min(...generated.map((d) => d.requested!))
      : 0,
    completionProxyMs:
      value.spans["two-raf-after-insert"] ?? value.end! - value.start,
    maxOverlappingLongTaskMs: Math.max(0, ...durations),
    blockingOver50Ms: durations.reduce((a, d) => a + Math.max(0, d - 50), 0),
  };
}
function toReport(value: Run): EvidenceReport {
  const s = summary(value);
  const report: EvidenceReport = {
    schemaVersion: 1,
    id: `run-${session}-${value.id}`,
    environment: {
      lexical: "0.18.0",
      react: "18.3.1",
      mermaid: "12.3.0",
      browser: navigator.userAgent,
      viewport: value.viewport,
      build: `${import.meta.env.DEV ? "development" : "production"}:${__BUILD_ID__}`,
    },
    configuration: {
      mode: value.mode,
      scenario: value.scenario,
      size: value.targetChars,
      count: value.diagramCount,
      sizing: value.sizing,
      warmup: "all-diagrams-once-before-each-run",
      recording: value.recording,
      fixtureHash: value.fixtureHash,
    },
    metrics: {
      completionProxyMs: s.completionProxyMs,
      commitMs: value.spans["lexical-commit"] ?? null,
      renderCalls: value.calls,
      diagramCount: value.diagramCount,
      maxLongTaskMs: s.maxOverlappingLongTaskMs,
      longTaskSupported: s.longTaskSupported && value.recording === "light",
    },
    events: structuredClone(value.events).sort((a, b) => a.start - b.start),
    diagrams: structuredClone(value.diagrams),
    findings: [],
    limitations: [
      "公開合成案例；不能據此判定公司專案根因。",
      "每次先暖機所有圖表；不含 Markdown 解析、套件首次載入與暖機成本。",
      "完成代理值是全部圖表插入後兩次 rAF；不是實際 paint 或可互動時間。",
      "Mermaid 請求區間包含排隊與非同步等待；不能相加當成 CPU 成本。",
      "這是語意事件記錄；CPU、layout 歸因需搭配 Chrome performance trace。",
      `視窗 ${innerWidth}×${innerHeight}，DPR ${devicePixelRatio}；硬體負載與瀏覽器設定未完全控制，比較前需人工確認。`,
      ...(value.recording === "off"
        ? [
            "事件記錄關閉；仍保留最少量計時及繪圖次數，這不是完全零 instrumentation。",
          ]
        : []),
      ...(value.error ? [`ERROR: ${value.error}`] : []),
    ],
  };
  report.findings = analyze(report);
  return report;
}
export function traceExport(report: EvidenceReport) {
  const owners = [...new Set(report.events.map((e) => e.owner ?? "Other"))];
  return {
    displayTimeUnit: "ms",
    metadata: { kind: "semantic-events-not-cpu-profile", reportId: report.id },
    traceEvents: [
      ...owners.map((name, i) => ({
        name: "thread_name",
        ph: "M",
        pid: 1,
        tid: i + 1,
        args: { name },
      })),
      ...report.events.map((e) => ({
        name: e.label,
        cat: e.kind,
        ph: e.duration === undefined ? "i" : "X",
        s: e.duration === undefined ? "t" : undefined,
        pid: 1,
        tid: owners.indexOf(e.owner ?? "Other") + 1,
        ts: e.start * 1000,
        dur: e.duration === undefined ? undefined : e.duration * 1000,
        args: { eventId: e.id, diagramId: e.diagramId, ...e.data },
      })),
    ],
  };
}
export function handoff(report: EvidenceReport) {
  return [
    `請調查這次 Lexical 匯入操作。請先區分觀測與推論，再提出一個可否證的實驗。`,
    `Recording: ${report.id}`,
    `Lexical ${report.environment.lexical} · Mermaid ${report.environment.mermaid} · ${report.environment.build}`,
    `完成代理值 ${report.metrics.completionProxyMs.toFixed(1)} ms；繪圖 ${report.metrics.renderCalls} 次 / ${report.metrics.diagramCount} 圖。`,
    ...report.findings
      .slice(0, 3)
      .map(
        (f) =>
          `${f.confidence}: ${f.title}\n${f.summary}\n證據：${f.evidenceIds.slice(0, 4).join(", ")}\n下一步：${f.nextExperiment}`,
      ),
    `原始資料：請先下載 recording JSON，放進 OpenCode 專案。先執行 node scripts/report-query.mjs <JSON路徑> --limit 3；已啟用 V2 plugin 時也可用 editor-evidence 工具。這段文字不會自動傳送。`,
    `限制：${report.limitations.join(" ")}`,
  ].join("\n\n");
}
export function connect(instance: LexicalEditor, update: () => void) {
  editor = instance;
  onResult = update;
  const unregister = editor.registerUpdateListener(
    ({ tags, dirtyElements, dirtyLeaves }) => {
      if (current && !current.done) {
        event(current, "lexical-update", "Lexical commit", "Lexical", {
          data: {
            tags: [...tags],
            dirtyElements: dirtyElements.size,
            dirtyLeaves: dirtyLeaves.size,
          },
        });
        if (tags.has("benchmark-inject")) mark(current, "lexical-commit");
      }
    },
  );
  let priorZ = 0;
  const keydown = (e: KeyboardEvent) => {
    if (e.key !== "z" || !current) return;
    const value = current;
    priorZ = (editor.getRootElement()?.textContent?.match(/z/g) || []).length;
    const input = {
      trusted: e.isTrusted,
      handlerDelayMs: performance.now() - e.timeStamp,
      nextFrameMs: undefined as number | undefined,
    };
    value.inputs.push(input);
    requestAnimationFrame(() => {
      input.nextFrameMs = performance.now() - e.timeStamp;
    });
  };
  const input = (e: Event) => {
    if (current && (e as InputEvent).data === "z")
      current.textInserted =
        e.isTrusted &&
        (editor.getRootElement()?.textContent?.match(/z/g) || []).length >
          priorZ;
  };
  const root = editor.getRootElement();
  root?.addEventListener("keydown", keydown);
  root?.addEventListener("input", input);
  window.bench = {
    prepare,
    run,
    setReporting: (enabled: boolean) => {
      reporting = enabled;
    },
    getResult: () => (current?.done ? summary(current) : null),
    results: () => results.map(summary),
    reports: () => reports,
    isReady: () => true,
    editorText: () => editor.getRootElement()?.textContent ?? "",
    calls: () => current?.calls ?? 0,
  };
  return () => {
    unregister();
    root?.removeEventListener("keydown", keydown);
    root?.removeEventListener("input", input);
    clearTimeout(watchdog);
    observer?.disconnect();
  };
}
declare global {
  interface Window {
    bench: {
      prepare: typeof prepare;
      run: typeof run;
      setReporting: (enabled: boolean) => void;
      getResult: () => ReturnType<typeof summary> | null;
      results: () => ReturnType<typeof summary>[];
      reports: () => EvidenceReport[];
      isReady: () => boolean;
      editorText: () => string;
      calls: () => number;
    };
  }
}
