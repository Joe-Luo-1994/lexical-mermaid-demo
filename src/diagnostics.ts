/** Evidence rules, deliberately independent of fixture/scenario labels and UI. */
export type EvidenceEvent = {
  id: string;
  kind: string;
  start: number;
  duration?: number;
  owner?: string;
  label: string;
  diagramId?: string;
  parentId?: string;
  data?: Record<string, unknown>;
};

export type Finding = {
  id: string;
  title: string;
  confidence: "observed" | "hypothesis";
  summary: string;
  evidenceIds: string[];
  nextExperiment: string;
};

export type EvidenceReport = {
  schemaVersion: 1;
  id: string;
  environment: {
    lexical: string;
    react: string;
    mermaid: string;
    browser: string;
    build: string;
    /** CSS viewport width × height plus devicePixelRatio, captured before the operation. */
    viewport?: string;
  };
  configuration: {
    mode: string;
    scenario: string;
    size: number;
    count: number;
    sizing: string;
    warmup: string;
    recording: string;
    fixtureHash: string;
  };
  metrics: {
    completionProxyMs: number;
    commitMs: number | null;
    renderCalls: number;
    diagramCount: number;
    maxLongTaskMs: number;
    longTaskSupported: boolean;
  };
  diagrams: unknown[];
  events: EvidenceEvent[];
  limitations: string[];
  findings: Finding[];
};

export type Comparison = {
  comparable: boolean;
  reasons: string[];
  interventions: {
    field: "mode" | "scenario";
    before: string;
    after: string;
  }[];
  deltas: null | {
    completionProxyMs: number;
    commitMs: number | null;
    renderCalls: number;
    maxLongTaskMs: number;
  };
  note: string;
};

const isDuration = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
const refs = (events: EvidenceEvent[]) => events.map((event) => event.id);

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const boundedString = (value: unknown, max = 2000): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;
const finiteCount = (value: unknown): value is number =>
  isDuration(value) && Number.isSafeInteger(value);
const MAX_EVENTS = 2000;
const TIMING_TOLERANCE_MS = 1;

/** Checks untrusted imports before any UI/rule can dereference their contents. */
export function evidenceProblems(input: unknown): string[] {
  if (!record(input)) return ["記錄必須是 JSON object"];
  const problems: string[] = [];
  if (input.schemaVersion !== 1) problems.push("不支援的 evidence schema");
  if (!boundedString(input.id, 256)) problems.push("recording ID 缺少或過長");
  const environment = record(input.environment) ? input.environment : {};
  for (const key of ["lexical", "react", "mermaid", "browser", "build"]) {
    if (!boundedString(environment[key])) problems.push(`環境欄位無效：${key}`);
  }
  if (
    environment.viewport !== undefined &&
    !boundedString(environment.viewport, 256)
  )
    problems.push("環境欄位無效：viewport");
  const configuration = record(input.configuration) ? input.configuration : {};
  for (const key of [
    "mode",
    "scenario",
    "sizing",
    "warmup",
    "recording",
    "fixtureHash",
  ]) {
    if (!boundedString(configuration[key]))
      problems.push(`設定欄位無效：${key}`);
  }
  for (const key of ["size", "count"]) {
    if (!finiteCount(configuration[key]))
      problems.push(`設定 ${key} 必須為非負安全整數`);
  }
  const metrics = record(input.metrics) ? input.metrics : {};
  for (const key of ["completionProxyMs", "maxLongTaskMs"]) {
    if (!isDuration(metrics[key]))
      problems.push(`量測 ${key} 必須為有限、非負數`);
  }
  for (const key of ["renderCalls", "diagramCount"]) {
    if (!finiteCount(metrics[key]))
      problems.push(`量測 ${key} 必須為非負安全整數`);
  }
  if (metrics.commitMs !== null && !isDuration(metrics.commitMs))
    problems.push("commit 時間無效");
  if (typeof metrics.longTaskSupported !== "boolean")
    problems.push("缺少 long task 支援狀態");
  const completion = isDuration(metrics.completionProxyMs)
    ? metrics.completionProxyMs
    : null;
  if (completion !== null) {
    if (
      isDuration(metrics.commitMs) &&
      metrics.commitMs > completion + TIMING_TOLERANCE_MS
    )
      problems.push("commit 晚於操作完成時間");
    if (
      isDuration(metrics.maxLongTaskMs) &&
      metrics.maxLongTaskMs > completion + TIMING_TOLERANCE_MS
    )
      problems.push("long task 重疊時間超出操作區間");
  }
  if (
    finiteCount(configuration.count) &&
    finiteCount(metrics.diagramCount) &&
    configuration.count !== metrics.diagramCount
  ) {
    problems.push("設定圖表數與量測圖表數不同");
  }
  if (!Array.isArray(input.diagrams) || input.diagrams.length > MAX_EVENTS)
    problems.push("圖表資料必須是有界陣列");
  else if (
    input.diagrams.length > 0 &&
    finiteCount(metrics.diagramCount) &&
    input.diagrams.length !== metrics.diagramCount
  ) {
    problems.push("圖表資料數量與量測圖表數不同");
  }
  if (
    !Array.isArray(input.limitations) ||
    input.limitations.length > 100 ||
    !input.limitations.every((item) => boundedString(item, 4000))
  ) {
    problems.push("limitations 必須為最多 100 個、各 4000 字元內的字串");
  }
  if (!Array.isArray(input.events) || input.events.length > MAX_EVENTS)
    return [...problems, `事件必須為最多 ${MAX_EVENTS} 筆的陣列`];
  const ids = new Set<string>();
  const parents = new Map<string, string>();
  for (const event of input.events) {
    if (!record(event) || !boundedString(event.id, 256) || ids.has(event.id)) {
      problems.push("事件 ID 缺少、過長或重複");
      continue;
    }
    ids.add(event.id);
    if (!boundedString(event.kind, 256) || !boundedString(event.label))
      problems.push(`事件 ${event.id} 缺少類型或標籤`);
    for (const key of ["owner", "diagramId", "parentId"]) {
      if (event[key] !== undefined && !boundedString(event[key], 512))
        problems.push(`事件 ${event.id} 的 ${key} 無效`);
    }
    if (event.data !== undefined && !record(event.data))
      problems.push(`事件 ${event.id} 的 data 必須為 object`);
    if (
      !isDuration(event.start) ||
      (event.duration !== undefined && !isDuration(event.duration))
    ) {
      problems.push(`事件 ${event.id} 的時間無效`);
    } else if (
      completion !== null &&
      event.start + (event.duration ?? 0) > completion + TIMING_TOLERANCE_MS
    ) {
      problems.push(`事件 ${event.id} 超出操作區間`);
    }
    if (event.kind === "longtask" && event.duration === undefined)
      problems.push(`事件 ${event.id} 缺少 long task 持續時間`);
    if (typeof event.parentId === "string")
      parents.set(event.id, event.parentId);
  }
  // Missing and cyclic parent relations cannot be trusted as a causal graph.
  for (const [id, parent] of parents) {
    if (!ids.has(parent)) problems.push(`事件 ${id} 的 parent 引用無效`);
    const seen = new Set([id]);
    let cursor: string | undefined = parent;
    while (cursor !== undefined) {
      if (seen.has(cursor)) {
        problems.push(`事件 ${id} 的 parent 引用形成循環`);
        break;
      }
      seen.add(cursor);
      cursor = parents.get(cursor);
    }
  }
  return [...new Set(problems)];
}

/** Imported findings are assertions, not evidence. Always derive them afresh. */
export function parseReport(input: unknown): EvidenceReport {
  const problems = evidenceProblems(input);
  if (problems.length)
    throw new Error(
      `無法匯入記錄：${problems.slice(0, 8).join("；")}${problems.length > 8 ? "…" : ""}`,
    );
  const raw = input as EvidenceReport;
  const report: EvidenceReport = {
    schemaVersion: 1,
    id: raw.id,
    environment: { ...raw.environment },
    configuration: { ...raw.configuration },
    metrics: { ...raw.metrics },
    events: raw.events.map((event) => ({ ...event })),
    diagrams: [...raw.diagrams],
    limitations: [...raw.limitations],
    findings: [],
  };
  report.findings = analyze(report);
  return report;
}

export function analyze(report: EvidenceReport): Finding[] {
  const problems = evidenceProblems(report);
  if (problems.length)
    return [
      {
        id: "invalid-evidence",
        title: "這份記錄無法可靠分析",
        confidence: "observed",
        summary: problems.join("；"),
        evidenceIds: [],
        nextExperiment:
          "修正記錄格式並重新錄製。無效時間或重複 ID 不應被當成效能證據。",
      },
    ];

  const findings: Finding[] = [];
  const requests = report.events.filter(
    (event) => event.kind === "mermaid-request",
  );
  const byDiagram = new Map<string, EvidenceEvent[]>();
  for (const event of requests) {
    if (event.diagramId) {
      const group = byDiagram.get(event.diagramId) ?? [];
      group.push(event);
      byDiagram.set(event.diagramId, group);
    }
  }
  const repeated = [...byDiagram].filter(([, events]) => events.length > 1);
  if (repeated.length) {
    const repeatedEvents = repeated.flatMap(([, events]) => events);
    findings.push({
      id: "repeated-mermaid-requests",
      title: "同一張圖有多次生成請求",
      confidence: "observed",
      summary: `${repeated.length} 張圖出現重複請求：${repeated.map(([id, events]) => `${id} × ${events.length}`).join("、")}。這證明請求重複，尚不能證明多餘，也不能直接歸因於 React re-render。`,
      evidenceIds: refs(repeatedEvents),
      nextExperiment:
        "固定圖表 source、設定與尺寸，只改變疑似重複請求的觸發行為；比較請求次數、完成代理值及輸出內容。",
    });
  } else if (requests.length) {
    findings.push({
      id: "mermaid-requests",
      title: "已記錄圖表生成請求",
      confidence: "observed",
      summary: `${requests.length} 次請求，${byDiagram.size} 個可識別圖表 ID；已記錄事件中沒有同一 ID 的重複請求。請求到回傳的區間可能包含排隊，不等同於 CPU 執行時間。`,
      evidenceIds: refs(requests),
      nextExperiment:
        "保持圖表內容與版本相同，只變更周圍文件規模；搭配 browser trace 區分繪圖計算、排隊與 layout 成本。",
    });
  }

  const updates = report.events.filter(
    (event) => event.kind === "lexical-update",
  );
  if (updates.length > 1)
    findings.push({
      id: "multiple-editor-updates",
      title: "操作期間有多次 editor 更新",
      confidence: "observed",
      summary: `記錄到 ${updates.length} 次更新。更新次數本身不代表多餘；只有明確的呼叫或排程證據才能把它們連成觸發鏈。`,
      evidenceIds: refs(updates),
      nextExperiment:
        "查看各次更新的 tags 與來源。若懷疑 listener 排入下一次 update，只關閉該行為並重跑相同操作，確認更新數與成本是否一起下降。",
    });

  const longTasks = report.events.filter(
    (event) => event.kind === "longtask" && event.duration !== undefined,
  );
  if (longTasks.length) {
    const longest = [...longTasks].sort((a, b) => b.duration! - a.duration!)[0];
    findings.push({
      id: "main-thread-blocking",
      title: "記錄到主執行緒 long task",
      confidence: "observed",
      summary: `${longTasks.length} 個 long task；與操作區間重疊的最長事件為 ${longest.duration!.toFixed(1)} ms。時間重疊不能證明由同時出現的 plugin 或圖表造成。`,
      evidenceIds: refs(longTasks),
      nextExperiment:
        "在 Chrome performance trace 查看這段時間的 call stack 與 layout；定位實際工作後，再只改變該工作並比較。",
    });
  } else if (!report.metrics.longTaskSupported)
    findings.push({
      id: "longtask-unavailable",
      title:
        report.configuration.recording === "off"
          ? "本次關閉 long task 記錄"
          : "本次未提供 long task 資料",
      confidence: "observed",
      summary:
        "缺少這類資料，無法據此判定是否發生主執行緒阻塞。關閉記錄也不代表瀏覽器不支援此 API。",
      evidenceIds: [],
      nextExperiment:
        report.configuration.recording === "off"
          ? "另做一次開啟事件記錄的診斷；量測開銷則使用明確的 on/off 配對實驗，不當成產品改善。"
          : "使用支援 Long Tasks API 的瀏覽器，或錄製 Chrome performance trace；保留相同文件與操作。",
    });

  if (!requests.length && !updates.length && !longTasks.length)
    findings.push({
      id: "limited-evidence",
      title: "目前只有摘要，缺少可定位的事件",
      confidence: "observed",
      summary:
        "完成時間無法單獨解釋根因。佔位、預生成或關閉記錄時，也可能合理地沒有 Mermaid 請求事件。",
      evidenceIds: [],
      nextExperiment:
        "在相同條件開啟事件記錄重跑一次；先確認能取得請求或更新事件，再推論相關程式。",
    });
  return findings;
}

const fixedConfig = [
  "fixtureHash",
  "size",
  "count",
  "sizing",
  "warmup",
  "recording",
] as const;
const fixedEnvironment = [
  "lexical",
  "react",
  "mermaid",
  "browser",
  "build",
] as const;

export function compareReports(
  a: EvidenceReport,
  b: EvidenceReport,
): Comparison {
  const reasons = [
    ...evidenceProblems(a).map((reason) => `A：${reason}`),
    ...evidenceProblems(b).map((reason) => `B：${reason}`),
  ];
  for (const [name, report] of [
    ["A", a],
    ["B", b],
  ] as const) {
    if (
      Array.isArray(report?.limitations) &&
      report.limitations.some(
        (value) => typeof value === "string" && /^ERROR:/i.test(value.trim()),
      )
    ) {
      reasons.push(`${name}：操作失敗或未完成，不能比較改善幅度`);
    }
    if (
      Array.isArray(report?.limitations) &&
      report.limitations.some(
        (value) => typeof value === "string" && /^TRACE:/i.test(value.trim()),
      )
    ) {
      reasons.push(
        `${name}：啟用了額外 trace 錄製，僅供診斷，不能當成效能驗收樣本`,
      );
    }
  }
  for (const key of fixedConfig) {
    const before = a?.configuration?.[key],
      after = b?.configuration?.[key];
    if (
      before === undefined ||
      before === "" ||
      after === undefined ||
      after === ""
    )
      reasons.push(`缺少固定條件：${key}`);
    else if (before !== after)
      reasons.push(`固定條件不同：${key} (${before} → ${after})`);
  }
  for (const key of fixedEnvironment) {
    const before = a?.environment?.[key],
      after = b?.environment?.[key];
    if (!before || !after) reasons.push(`缺少環境條件：${key}`);
    else if (before !== after)
      reasons.push(`環境不同：${key} (${before} → ${after})`);
  }
  if (
    a?.environment?.viewport !== undefined ||
    b?.environment?.viewport !== undefined
  ) {
    if (!a?.environment?.viewport || !b?.environment?.viewport)
      reasons.push("缺少環境條件：viewport");
    else if (a.environment.viewport !== b.environment.viewport)
      reasons.push(
        `環境不同：viewport (${a.environment.viewport} → ${b.environment.viewport})`,
      );
  }
  if (a?.metrics?.longTaskSupported !== b?.metrics?.longTaskSupported)
    reasons.push("Long Tasks API 支援狀態不同");
  const interventions: Comparison["interventions"] = [];
  for (const field of ["mode", "scenario"] as const) {
    const before = a?.configuration?.[field],
      after = b?.configuration?.[field];
    if (
      typeof before !== "string" ||
      !before ||
      typeof after !== "string" ||
      !after
    )
      reasons.push(`缺少實驗條件：${field}`);
    else if (before !== after) interventions.push({ field, before, after });
  }
  const comparable = reasons.length === 0;
  return {
    comparable,
    reasons,
    interventions,
    deltas: comparable
      ? {
          completionProxyMs:
            b.metrics.completionProxyMs - a.metrics.completionProxyMs,
          commitMs:
            a.metrics.commitMs === null || b.metrics.commitMs === null
              ? null
              : b.metrics.commitMs - a.metrics.commitMs,
          renderCalls: b.metrics.renderCalls - a.metrics.renderCalls,
          maxLongTaskMs: b.metrics.maxLongTaskMs - a.metrics.maxLongTaskMs,
        }
      : null,
    note: comparable
      ? `差值為 B − A；這是兩次單樣本的描述性比較，不能證明因果或統計顯著。${interventions.length > 1 ? "同時變更多個實驗條件，無法分離各項效果。" : ""}${a?.environment?.viewport === undefined && b?.environment?.viewport === undefined ? "這兩份舊記錄未記錄 viewport／DPR，需人工確認相同。" : ""}完成時間是兩次 rAF 的代理值，並非實際 paint 或可互動時間。`
      : "條件或證據無效，停止產生改善幅度；請先對齊上述條件再比較。",
  };
}
