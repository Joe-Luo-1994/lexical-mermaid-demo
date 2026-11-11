// Generated observation primitive for this example, not a universal Lexical patch.
const records = [];
const stack = [];
let active = false;
let dropped = 0;
let counter = 0;
export function traceSync(name, source, fn) {
  if (!active) return fn();
  if (records.length >= 2000) { dropped++; return fn(); }
  const record = {id: `e${++counter}`, name, source, startMs: performance.now(), durationMs: 0};
  if (stack.length) { record.parentId = stack.at(-1); record.parentType = 'sync-call'; }
  records.push(record);
  stack.push(record.id);
  try { return fn(); }
  finally { record.durationMs = performance.now() - record.startMs; stack.pop(); }
}
window.__exampleObservation = {
  start() { records.length = 0; stack.length = 0; dropped = 0; counter = 0; active = true; },
  stop() { active = false; return {timeOrigin: performance.timeOrigin, records: structuredClone(records), dropped}; },
};
