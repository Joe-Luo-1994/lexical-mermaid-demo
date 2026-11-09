import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { richNodes } from "./nodes";
import { MermaidNode } from "./MermaidNode";
import {
  connect,
  current,
  event,
  handoff,
  labels,
  modes,
  scenarioLabels,
  traceExport,
  type Mode,
  type Scenario,
  type Sizing,
} from "./lab";
import {
  compareReports,
  parseReport,
  type EvidenceReport,
} from "./diagnostics";
import "./style.css";

function Icon({
  name,
}: {
  name: "play" | "download" | "arrow" | "check" | "layers" | "plus";
}) {
  const paths = {
    play: "m8 5 11 7-11 7Z",
    download: "M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4",
    arrow: "M5 12h14m-6-6 6 6-6 6",
    check: "m5 12 4 4 10-10",
    layers: "m3 7 9-4 9 4-9 4-9-4Zm0 5 9 4 9-4M3 17l9 4 9-4",
    plus: "M12 5v14M5 12h14",
  };
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
function download(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob(
      [typeof value === "string" ? value : JSON.stringify(value, null, 2)],
      { type: typeof value === "string" ? "text/plain" : "application/json" },
    ),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const ms = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : n.toFixed(1);
const short = (id: string) => id.split(":").at(-1) ?? id.slice(-8);
function Lab() {
  const [editor] = useLexicalComposerContext();
  const [mode, setMode] = useState<Mode>("inline"),
    [size, setSize] = useState(20000),
    [count, setCount] = useState(5),
    [scenario, setScenario] = useState<Scenario>("normal"),
    [sizing, setSizing] = useState<Sizing>("natural");
  const [recording, setRecording] = useState<"light" | "off">("light");
  const [status, setStatus] = useState(
    "準備好重現一次操作。每次錄製前會先暖機圖表。",
  );
  const [busy, setBusy] = useState(false),
    [reports, setReports] = useState<EvidenceReport[]>([]),
    [selected, setSelected] = useState(""),
    [baseline, setBaseline] = useState("");
  const [tab, setTab] = useState<"summary" | "events" | "compare">("summary"),
    [selectedEvent, setSelectedEvent] = useState(""),
    [filter, setFilter] = useState("");
  const file = useRef<HTMLInputElement>(null);
  useEffect(
    () =>
      connect(editor, () => {
        const next = window.bench.reports().at(-1)!;
        setReports((old) => [...old, next]);
        setSelected(next.id);
        setSelectedEvent("");
        setBaseline((old) => old || next.id);
        setBusy(false);
        setStatus(
          next.limitations.some((x) => x.startsWith("ERROR:"))
            ? "操作失敗，已保留部分證據。"
            : "記錄完成。先看觀測，再選擇下一個實驗。",
        );
      }),
    [editor],
  );
  useEffect(
    () =>
      editor.registerUpdateListener(({ tags }) => {
        const run = current;
        if (tags.has("benchmark-inject") && run?.scenario === "adjacent")
          queueMicrotask(() => {
            if (current === run && !run.done)
              event(
                run,
                "plugin-callback",
                "獨立 probe callback",
                "IndependentProbe",
                { data: { doesNotInvokeMermaid: true } },
              );
          });
      }),
    [editor],
  );
  const active = reports.find((r) => r.id === selected),
    base = reports.find((r) => r.id === baseline);
  const comparison =
    active && base && active.id !== base.id
      ? compareReports(base, active)
      : null;
  const events =
    active?.events.filter((e) =>
      `${e.owner} ${e.label} ${e.kind} ${e.diagramId ?? ""} ${e.id}`
        .toLowerCase()
        .includes(filter.toLowerCase()),
    ) ?? [];
  const detail = active?.events.find((e) => e.id === selectedEvent);
  async function record() {
    setBusy(true);
    setStatus("正在準備文件與暖機圖表…這段時間不列入注入量測。");
    try {
      await window.bench.prepare(
        mode,
        size,
        count,
        sizing,
        scenario,
        recording,
      );
      setStatus("正在記錄 editor 注入與圖表生成…");
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      window.bench.run();
    } catch (error) {
      setBusy(false);
      setStatus(`無法開始：${String(error)}`);
    }
  }
  async function importReport(f: File | undefined) {
    if (!f) return;
    try {
      if (f.size > 2_000_000)
        throw new Error("JSON 超過 2 MB，請改用原始 trace 工具查看。");
      const report = parseReport(JSON.parse(await f.text()));
      setReports((old) =>
        old.some((r) => r.id === report.id) ? old : [...old, report],
      );
      setSelected(report.id);
      setSelectedEvent("");
      setBaseline((old) => old || report.id);
      setStatus("已載入記錄，診斷已由原始事件重新計算。");
    } catch (error) {
      setStatus(`無法載入：${String(error)}`);
    } finally {
      if (file.current) file.current.value = "";
    }
  }
  async function copy() {
    if (!active) return;
    try {
      await navigator.clipboard.writeText(handoff(active));
      setStatus(
        "已複製摘要與證據 ID。請同時下載 JSON，放進 OpenCode worktree。",
      );
    } catch {
      download("opencode-handoff.txt", handoff(active));
      setStatus("瀏覽器無法存取剪貼簿，已下載交接文字。");
    }
  }
  function showEvidence(id: string) {
    setTab("events");
    setFilter("");
    setSelectedEvent(id);
  }
  const failed = active?.limitations.some((x) => x.startsWith("ERROR:"));
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#">
          <span className="brand-icon">
            <Icon name="layers" />
          </span>
          <span>
            Editor Evidence<small>LEXICAL PERFORMANCE LAB</small>
          </span>
        </a>
        <div className="workspace-label">
          <span className="online-dot" />
          本機實驗工作區<span className="version-pill">v0.2</span>
        </div>
        <div className="nav-label">
          INVESTIGATIONS{" "}
          <span>{reports.length.toString().padStart(2, "0")}</span>
        </div>
        <button
          className="new-investigation"
          disabled={busy}
          onClick={() => {
            setSelected("");
            setTab("summary");
            document
              .getElementById("record-config")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          <Icon name="plus" />
          新的實驗
        </button>
        <div className="run-list">
          {reports.length === 0 ? (
            <div className="sidebar-empty">
              每次重現，留下可查證的線索。
              <br />
              第一筆記錄會出現在這裡。
            </div>
          ) : (
            [...reports].reverse().map((r, i) => (
              <button
                key={r.id}
                disabled={busy}
                className={`run-item ${selected === r.id ? "active" : ""}`}
                onClick={() => {
                  setSelected(r.id);
                  setSelectedEvent("");
                }}
              >
                <span className="run-index">
                  {String(reports.length - i).padStart(2, "0")}
                </span>
                <span className="run-name">
                  {scenarioLabels[r.configuration.scenario as Scenario] ??
                    r.configuration.scenario}
                  <small>
                    {r.configuration.count} 圖 · {r.configuration.size / 1000}k
                    ·{" "}
                    {labels[r.configuration.mode as Mode] ??
                      r.configuration.mode}
                  </small>
                </span>
                <span className="run-time">
                  {Math.round(r.metrics.completionProxyMs)}
                  <small>ms</small>
                </span>
              </button>
            ))
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="nav-label">實驗邊界</div>
          <p>
            Lexical <b>0.18.0</b>
            <br />
            Mermaid <b>12.3.0</b>
            <br />
            OpenCode <b>2.2.5 · 待本機驗證</b>
          </p>
          <span className="local-note">
            資料留在本頁，匯出後可交接。
            <br />
            重新整理會清除本次記錄。
          </span>
        </div>
      </aside>
      <main>
        <div className="topbar">
          <span>
            工作區 <span className="slash">/</span> 匯入效能調查
          </span>
          <div>
            <span
              className={`build-badge ${import.meta.env.DEV ? "warning" : ""}`}
            >
              {import.meta.env.DEV
                ? "Development · 不作效能驗收"
                : "Production build"}
            </span>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => file.current?.click()}
            >
              <Icon name="download" />
              載入記錄
            </button>
            <input
              ref={file}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => void importReport(e.target.files?.[0])}
            />
          </div>
        </div>
        <div className="content">
          <header className="page-header">
            <div>
              <div className="eyebrow">
                FROM A SLOW MOMENT TO A CLEAR NEXT STEP
              </div>
              <h1>讓下一步，有證據。</h1>
              <p>重現匯入操作，找出值得追查的工作，再驗證你的改善。</p>
            </div>
            <div className="experiment-stamp">
              <span className="online-dot" />
              可重現實驗 <small>暖機後的內容注入</small>
            </div>
          </header>
          <section
            className="config-card"
            id="record-config"
            aria-label="實驗設定"
          >
            <div className="section-title">
              <span className="step">01</span>
              <h2>設定一次重現</h2>
              <span className="muted">
                合成工程文件 · 真實 Lexical nodes 與 SVG
              </span>
            </div>
            <div className="config-grid">
              <label>
                測試情境
                <select
                  aria-label="測試情境"
                  value={scenario}
                  disabled={busy}
                  onChange={(e) => setScenario(e.target.value as Scenario)}
                >
                  {Object.entries(scenarioLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                繪圖方式
                <select
                  aria-label="繪圖方式"
                  value={mode}
                  disabled={busy}
                  onChange={(e) => setMode(e.target.value as Mode)}
                >
                  {modes.map((m) => (
                    <option key={m} value={m}>
                      {labels[m]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                文件大小
                <select
                  aria-label="文件大小"
                  value={size}
                  disabled={busy}
                  onChange={(e) => setSize(+e.target.value)}
                >
                  {[20000, 50000, 80000].map((s) => (
                    <option key={s} value={s}>
                      約 {s / 1000}k 字元
                    </option>
                  ))}
                </select>
              </label>
              <label>
                圖表數
                <select
                  aria-label="圖表數"
                  value={count}
                  disabled={busy}
                  onChange={(e) => setCount(+e.target.value)}
                >
                  <option value={5}>5 張 · 不同布局</option>
                  <option value={10}>10 張 · 不同布局</option>
                </select>
              </label>
            </div>
            <div className="config-footer">
              <details>
                <summary>量測設定</summary>
                <div className="advanced">
                  <label>
                    圖表尺寸
                    <select
                      aria-label="圖表尺寸"
                      value={sizing}
                      disabled={busy}
                      onChange={(e) => setSizing(e.target.value as Sizing)}
                    >
                      <option value="natural">自然高度</option>
                      <option value="fixed">固定高度 260 px</option>
                    </select>
                  </label>
                  <label>
                    事件記錄
                    <select
                      aria-label="事件記錄"
                      value={recording}
                      disabled={busy}
                      onChange={(e) =>
                        setRecording(e.target.value as "light" | "off")
                      }
                    >
                      <option value="light">輕量事件記錄</option>
                      <option value="off">關閉事件 · 保留基本計時</option>
                    </select>
                  </label>
                  <p>
                    每次先生成所有圖表一次。此版本不量測冷啟動；畫面外繪圖仍在同一
                    document。
                  </p>
                </div>
              </details>
              <button
                className="primary"
                onClick={() => void record()}
                disabled={busy}
              >
                <Icon name="play" />
                {busy ? "記錄進行中…" : "錄製這次操作"}
              </button>
            </div>
          </section>
          <div className={`status ${busy ? "running" : ""}`} role="status">
            <span className={busy ? "spinner" : "status-dot"} />
            {status}
          </div>
          {!active ? (
            <section className="welcome">
              <div className="empty-orbit">
                <Icon name="layers" />
              </div>
              <div className="eyebrow">
                ONE RECORDING. A SHARED UNDERSTANDING.
              </div>
              <h2>先留下現場，再縮小問題。</h2>
              <p>
                從正常流程開始，接著切換重複繪圖案例。
                <br />
                比較同一份文件，觀察請求次數與完成時間如何改變。
              </p>
              <div className="welcome-steps">
                <span>
                  <b>1</b>重現操作
                </span>
                <Icon name="arrow" />
                <span>
                  <b>2</b>查看證據
                </span>
                <Icon name="arrow" />
                <span>
                  <b>3</b>驗證改變
                </span>
              </div>
              <small>診斷依據實際事件產生，不以案例名稱猜答案。</small>
            </section>
          ) : (
            <>
              <div className="record-title">
                <div>
                  <div className="eyebrow">
                    RECORDING / {reports.indexOf(active) + 1}
                  </div>
                  <h2>
                    {scenarioLabels[
                      active.configuration.scenario as Scenario
                    ] ?? active.configuration.scenario}
                    <span className={`tag ${failed ? "error-tag" : ""}`}>
                      {failed
                        ? "部分證據"
                        : active.configuration.recording === "off"
                          ? "基本計時"
                          : "已記錄"}
                    </span>
                  </h2>
                </div>
                <div className="actions">
                  <button onClick={() => download(`${active.id}.json`, active)}>
                    <Icon name="download" />
                    JSON
                  </button>
                  <button
                    onClick={() =>
                      download(`${active.id}.trace.json`, traceExport(active))
                    }
                  >
                    語意 trace
                  </button>
                  <button className="dark-button" onClick={() => void copy()}>
                    複製給 OpenCode <Icon name="arrow" />
                  </button>
                </div>
              </div>
              <div className="metrics">
                <div className="metric">
                  <span>完成代理值</span>
                  <strong>
                    {ms(active.metrics.completionProxyMs)}
                    <small>ms</small>
                  </strong>
                  <small>全部圖表插入後兩次 rAF</small>
                </div>
                <div className="metric">
                  <span>Lexical commit</span>
                  <strong>
                    {ms(active.metrics.commitMs)}
                    <small>ms</small>
                  </strong>
                  <small>從注入至 update listener</small>
                </div>
                <div className="metric">
                  <span>繪圖請求</span>
                  <strong>
                    {active.metrics.renderCalls}
                    <small>/ {active.metrics.diagramCount} 圖</small>
                  </strong>
                  <small>獨立請求，不代表 React render 數</small>
                </div>
                <div className="metric">
                  <span>最長重疊 long task</span>
                  <strong>
                    {active.metrics.longTaskSupported
                      ? ms(active.metrics.maxLongTaskMs)
                      : "—"}
                    <small>ms</small>
                  </strong>
                  <small>
                    {active.metrics.longTaskSupported
                      ? "需透過 browser trace 確認來源"
                      : "未收集 · 無法判斷阻塞"}
                  </small>
                </div>
              </div>
              <section className="investigation">
                <div className="tabbar" role="tablist" aria-label="記錄視圖">
                  {(
                    [
                      ["summary", "觀測與下一步"],
                      ["events", `事件證據 · ${active.events.length}`],
                      ["compare", "比較實驗"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      role="tab"
                      aria-selected={tab === key}
                      className={tab === key ? "selected" : ""}
                      onClick={() => setTab(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {tab === "summary" && (
                  <div className="findings">
                    {active.findings.length ? (
                      active.findings.map((f, i) => (
                        <article className="finding" key={f.id}>
                          <div className="finding-number">
                            {String(i + 1).padStart(2, "0")}
                          </div>
                          <div>
                            <div className="finding-header">
                              <h3>{f.title}</h3>
                              <span className="confidence">
                                {f.confidence === "observed"
                                  ? "已觀測"
                                  : "待驗證"}
                              </span>
                            </div>
                            <p>{f.summary}</p>
                            <div className="evidence-links">
                              {f.evidenceIds.slice(0, 4).map((id) => (
                                <button
                                  key={id}
                                  onClick={() => showEvidence(id)}
                                >
                                  {short(id)} ↗
                                </button>
                              ))}
                              {f.evidenceIds.length > 4 && (
                                <button onClick={() => setTab("events")}>
                                  另 {f.evidenceIds.length - 4} 筆
                                </button>
                              )}
                            </div>
                            <div className="next-step">
                              <span>下一個實驗</span>
                              <p>{f.nextExperiment}</p>
                            </div>
                          </div>
                        </article>
                      ))
                    ) : (
                      <p className="empty-inline">
                        目前沒有可定位的診斷。請查看原始事件或補錄 browser
                        trace。
                      </p>
                    )}
                  </div>
                )}
                {tab === "events" && (
                  <div className="events-view">
                    <div className="event-toolbar">
                      <label className="search">
                        搜尋事件
                        <input
                          value={filter}
                          onChange={(e) => setFilter(e.target.value)}
                          placeholder="Plugin、圖表 ID 或事件…"
                        />
                      </label>
                      <span>區間含等待，不能相加作為 CPU 成本。</span>
                    </div>
                    <div className="event-layout">
                      <div className="event-list">
                        {events.length ? (
                          events.map((e) => (
                            <button
                              key={e.id}
                              className={`event-row ${e.id === selectedEvent ? "selected" : ""}`}
                              onClick={() => setSelectedEvent(e.id)}
                            >
                              <span
                                className={`event-kind ${e.kind === "longtask" ? "amber" : ""}`}
                              />
                              <span className="event-name">
                                {e.owner}
                                <small>{e.diagramId ?? e.label}</small>
                              </span>
                              <span className="timeline-track">
                                <span
                                  style={{
                                    left: `${Math.min(99, (e.start / Math.max(1, active.metrics.completionProxyMs)) * 100)}%`,
                                    width: `${Math.max(0.6, ((e.duration ?? 0) / Math.max(1, active.metrics.completionProxyMs)) * 100)}%`,
                                  }}
                                />
                              </span>
                              <span className="event-duration">
                                {e.duration === undefined
                                  ? `${ms(e.start)} ms`
                                  : `${ms(e.duration)} ms`}
                                <small>{short(e.id)}</small>
                              </span>
                            </button>
                          ))
                        ) : (
                          <p className="empty-inline">沒有符合條件的事件。</p>
                        )}
                      </div>
                      <aside className="event-detail">
                        {detail ? (
                          <>
                            <span className="eyebrow">
                              EVIDENCE / {short(detail.id)}
                            </span>
                            <h3>{detail.label}</h3>
                            <dl>
                              <dt>Owner</dt>
                              <dd>{detail.owner}</dd>
                              <dt>開始</dt>
                              <dd>{ms(detail.start)} ms</dd>
                              <dt>區間</dt>
                              <dd>{ms(detail.duration)} ms</dd>
                              <dt>圖表</dt>
                              <dd>{detail.diagramId ?? "—"}</dd>
                            </dl>
                            <pre>{JSON.stringify(detail, null, 2)}</pre>
                            <p>
                              只有明確記錄的觸發關係才能連成因果；時間接近不等於互相觸發。
                            </p>
                          </>
                        ) : (
                          <>
                            <span className="eyebrow">EVIDENCE INSPECTOR</span>
                            <h3>選一筆事件，查看依據。</h3>
                            <p>
                              時間軸使用實際事件，不插補未觀測的 call stack。
                            </p>
                          </>
                        )}
                      </aside>
                    </div>
                  </div>
                )}
                {tab === "compare" && (
                  <div className="compare-view">
                    <label>
                      比較基準 A
                      <select
                        aria-label="比較基準 A"
                        value={baseline}
                        onChange={(e) => setBaseline(e.target.value)}
                      >
                        {reports.map((r, i) => (
                          <option value={r.id} key={r.id}>
                            #{i + 1} ·{" "}
                            {scenarioLabels[
                              r.configuration.scenario as Scenario
                            ] ?? r.configuration.scenario}{" "}
                            · {ms(r.metrics.completionProxyMs)} ms
                          </option>
                        ))}
                      </select>
                    </label>
                    <p>目前選取的記錄為 B。先檢查條件，再比較差異。</p>
                    {comparison ? (
                      <>
                        {comparison.comparable ? (
                          <>
                            <div className="comparison-pass">
                              <Icon name="check" />
                              固定條件一致，可以描述這兩筆差異。
                            </div>
                            <div className="comparison-numbers">
                              <div>
                                <span>完成代理值 B − A</span>
                                <strong>
                                  {comparison.deltas!.completionProxyMs > 0
                                    ? "+"
                                    : ""}
                                  {ms(comparison.deltas!.completionProxyMs)} ms
                                </strong>
                              </div>
                              <div>
                                <span>繪圖請求 B − A</span>
                                <strong>
                                  {comparison.deltas!.renderCalls > 0
                                    ? "+"
                                    : ""}
                                  {comparison.deltas!.renderCalls} 次
                                </strong>
                              </div>
                            </div>
                            <p>
                              變更項目：
                              {comparison.interventions
                                .map(
                                  (x) => `${x.field}: ${x.before} → ${x.after}`,
                                )
                                .join("；") || "無；這是同條件重複量測。"}
                            </p>
                          </>
                        ) : (
                          <div className="comparison-block">
                            <b>條件不同，暫不計算改善幅度。</b>
                            <ul>
                              {comparison.reasons.map((r) => (
                                <li key={r}>{r}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <p className="comparison-note">{comparison.note}</p>
                      </>
                    ) : (
                      <div className="empty-inline">
                        選擇另一筆記錄作為基準。建議先錄正常流程，再錄重複繪圖案例。
                      </div>
                    )}
                  </div>
                )}
              </section>
              <details className="limitations">
                <summary>如何解讀這份記錄 · 量測界線與環境</summary>
                <ul>
                  {active.limitations.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
                <pre>
                  {JSON.stringify(
                    {
                      environment: active.environment,
                      configuration: active.configuration,
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
            </>
          )}
          <section className="editor-panel">
            <div className="section-title">
              <span className="step">LIVE</span>
              <h2>實際編輯器</h2>
              <span className="muted">固定視窗 · 可捲動、選取與輸入</span>
            </div>
            <div className="editor-viewport">
              <RichTextPlugin
                contentEditable={
                  <ContentEditable
                    className="editor"
                    aria-label="Benchmark editor"
                  />
                }
                placeholder={
                  <div className="editor-placeholder">
                    開始一次錄製後，混合格式文件會注入這個編輯器。
                  </div>
                }
                ErrorBoundary={LexicalErrorBoundary}
              />
            </div>
          </section>
          <footer>
            <span>Editor Evidence / 實驗原型</span>
            <span>觀測 → 假設 → 實驗 → 驗證</span>
          </footer>
        </div>
      </main>
      <ListPlugin />
      <TablePlugin />
      <LinkPlugin />
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <LexicalComposer
    initialConfig={{
      namespace: "editor-evidence",
      nodes: [MermaidNode, ...richNodes],
      onError: (error) => {
        throw error;
      },
      theme: {
        paragraph: "paragraph",
        code: "code-block",
        text: {
          bold: "text-bold",
          italic: "text-italic",
          strikethrough: "text-strike",
          code: "text-code",
        },
      },
    }}
  >
    <Lab />
  </LexicalComposer>,
);
