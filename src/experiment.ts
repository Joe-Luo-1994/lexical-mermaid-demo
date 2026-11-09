import { compareReports, parseReport, type EvidenceReport } from './diagnostics.ts';

export type ExperimentPair = { normal: EvidenceReport; duplicate: EvidenceReport };
export type ExperimentBundle = {
  kind: 'editor-evidence-experiment'; schemaVersion: 1;
  pairs: ExperimentPair[];
};
export function experimentBundle(pairs: ExperimentPair[]): ExperimentBundle {
  return { kind: 'editor-evidence-experiment', schemaVersion: 1, pairs };
}
export function parseExperiment(input: unknown): ExperimentBundle {
  const value = input as Partial<ExperimentBundle> | null;
  if (!value || value.kind !== 'editor-evidence-experiment' || value.schemaVersion !== 1 ||
      !Array.isArray(value.pairs) || value.pairs.length < 1 || value.pairs.length > 10)
    throw new Error('不是支援的實驗證據包（需包含 1–10 組配對記錄）。');
  const pairs = value.pairs.map(p => ({ normal: parseReport(p?.normal), duplicate: parseReport(p?.duplicate) }));
  const ids = pairs.flatMap(p => [p.normal.id, p.duplicate.id]);
  if (new Set(ids).size !== ids.length) throw new Error('證據包含重複 recording ID，不能當作獨立樣本。');
  return experimentBundle(pairs);
}
const median = (values: number[]) => {
  const sorted = [...values].sort((a,b) => a-b), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : sorted[middle-1] / 2 + sorted[middle] / 2;
};
const spread = (values: number[]) => ({ median: median(values), min: Math.min(...values), max: Math.max(...values) });
/** An imported ID never silently replaces an existing piece of evidence. */
export function mergeRecordings(existing: EvidenceReport[], incoming: EvidenceReport[]) {
  const canonical=(value:unknown)=>JSON.stringify(value,(_key,v)=>v && typeof v==='object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map(key=>[key,v[key]])) : v);
  const byId=new Map(existing.map(r=>[r.id,r]));
  for(const report of incoming) {
    const prior=byId.get(report.id);
    if(prior && canonical(prior)!==canonical(report)) throw new Error(`記錄 ID 衝突：${report.id}。內容不同，已保留舊證據；請先確認檔案來源。`);
    if(!prior) byId.set(report.id,report);
  }
  return [...byId.values()];
}
export function summarizeExperiment(pairs: ExperimentPair[]) {
  const reasons = new Set<string>();
  const first = pairs[0]?.normal;
  if (!first) return { comparable: false as const, reasons: ['尚無完整配對。'], stats: null };
  const ids = new Set<string>();
  for (const pair of pairs) for (const [arm, report] of Object.entries(pair)) {
    if (ids.has(report.id)) reasons.add('重複 recording ID，不是獨立樣本');
    ids.add(report.id);
    if (report.configuration.scenario !== arm) reasons.add('樣本的情境與組別不符');
    if (report.configuration.mode !== first.configuration.mode) reasons.add('同時變更繪圖方式，無法隔離情境差異');
    if (!report.environment.viewport) reasons.add('缺少 viewport／DPR，不能自動彙總');
    if (!report.environment.build.startsWith('production:')) reasons.add('需要 production build 樣本');
    for (const reason of compareReports(first, report).reasons) reasons.add(reason);
  }
  if (reasons.size) return { comparable: false as const, reasons: [...reasons], stats: null };
  const deltas = pairs.map(p => p.duplicate.metrics.completionProxyMs - p.normal.metrics.completionProxyMs);
  return { comparable: true as const, reasons: [], stats: {
    pairs: pairs.length,
    normal: spread(pairs.map(p => p.normal.metrics.completionProxyMs)),
    duplicate: spread(pairs.map(p => p.duplicate.metrics.completionProxyMs)),
    delta: spread(deltas), positivePairs: deltas.filter(x => x > 0).length,
    requests: spread(pairs.map(p => p.duplicate.metrics.renderCalls - p.normal.metrics.renderCalls)),
  }};
}
