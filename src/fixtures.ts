// Synthetic but structurally realistic engineering design review; no customer data.
export const diagrams = [
  {
    id: "architecture",
    title: "匯入服務架構",
    kind: "Flowchart · LR",
    source: `flowchart LR
 subgraph Client[Browser]
  U[Upload dialog] --> V[File validation]
  V --> P[Document preview]
  P --> E[Lexical editor]
 end
 subgraph API[Import API]
  G[API gateway] --> A[Auth and quota]
  A --> Q[Job queue]
  Q --> W[Import worker]
  W --> N[Normalize nodes]
 end
 subgraph Storage[Persistence]
  O[(Object store)]
  D[(Document DB)]
  C[(Cache)]
 end
 V --> G
 G --> O
 W --> O
 N --> D
 N --> C
 D --> E
 W --> T[Telemetry]
 A --> T`,
  },
  {
    id: "sequence",
    title: "非同步匯入與重試",
    kind: "Sequence",
    source: `sequenceDiagram
 autonumber
 actor User
 participant UI as Browser
 participant API as Import API
 participant Queue
 participant Worker
 participant DB as Document DB
 User->>UI: Choose document
 UI->>API: POST /imports + idempotency key
 API->>DB: Reserve import record
 API->>Queue: Enqueue job
 API-->>UI: 202 Accepted + job id
 loop Poll until terminal state
  UI->>API: GET /imports/:id
  API-->>UI: Current progress
 end
 Queue->>Worker: Deliver job
 Worker->>DB: Read document version
 alt Version matches
  Worker->>DB: Commit normalized nodes
  DB-->>Worker: New revision
  Worker-->>Queue: Acknowledge
 else Optimistic lock conflict
  Worker->>Queue: Retry with backoff
 end
 UI->>API: Fetch completed document
 API-->>UI: Editor state
 UI-->>User: Editable document`,
  },
  {
    id: "state",
    title: "工作狀態與失敗復原",
    kind: "State machine",
    source: `stateDiagram-v2
 [*] --> Pending
 Pending --> Validating: accepted
 Validating --> Rejected: invalid schema
 Validating --> Processing: valid
 state Processing {
  [*] --> Parsing
  Parsing --> Normalizing
  Normalizing --> Persisting
  Persisting --> [*]
 }
 Processing --> Retrying: transient failure
 Retrying --> Processing: budget remains
 Retrying --> Failed: exhausted
 Processing --> Completed: commit acknowledged
 Pending --> Cancelled: user request
 Completed --> [*]
 Rejected --> [*]
 Failed --> [*]
 Cancelled --> [*]`,
  },
  {
    id: "schema",
    title: "版本與工作資料模型",
    kind: "ER diagram",
    source: `erDiagram
 WORKSPACE ||--o{ DOCUMENT : owns
 DOCUMENT ||--|{ REVISION : contains
 DOCUMENT ||--o{ IMPORT_JOB : receives
 IMPORT_JOB ||--o{ JOB_EVENT : emits
 REVISION ||--o{ BLOCK : includes
 BLOCK ||--o| DIAGRAM : decorates
 WORKSPACE { string id PK string name int quota }
 DOCUMENT { string id PK string workspace_id FK string title }
 REVISION { string id PK string document_id FK int number }
 IMPORT_JOB { string id PK string status int attempts }
 JOB_EVENT { string id PK string job_id FK string message }
 BLOCK { string id PK string revision_id FK string type }
 DIAGRAM { string block_id FK string source string layout }`,
  },
  {
    id: "classes",
    title: "渲染介面與責任分配",
    kind: "Class diagram",
    source: `classDiagram
 class ImportController {
  +submit(file) Job
  +cancel(jobId) void
 }
 class DocumentRepository {
  +load(id) Revision
  +commit(revision) void
 }
 class Block {
  +String id
  +serialize() JSON
 }
 class DiagramBlock {
  +String source
  +String diagramType
 }
 class DiagramRenderer {
  <<interface>>
  +render(source) Promise
 }
 class MermaidRenderer {
  +initialize() void
  +render(source) Promise
 }
 class RenderQueue {
  +enqueue(request) Promise
  +cancel(requestId) void
 }
 ImportController --> DocumentRepository
 DocumentRepository o-- Block
 Block <|-- DiagramBlock
 DiagramBlock --> DiagramRenderer
 DiagramRenderer <|.. MermaidRenderer
 MermaidRenderer --> RenderQueue`,
  },
  {
    id: "schedule",
    title: "分階段上線計畫",
    kind: "Gantt",
    source: `gantt
 title Import rollout milestones
 dateFormat YYYY-MM-DD
 axisFormat %m/%d
 section Discovery
 Fixture inventory :done, a1, 2026-11-02, 3d
 Baseline profiling :done, a2, after a1, 3d
 section Implementation
 Editor integration :active, b1, 2026-11-09, 5d
 Diagram rendering :b2, after b1, 4d
 Failure recovery :b3, after b1, 3d
 section Validation
 Browser matrix :c1, after b2, 3d
 Canary rollout :c2, after c1, 2d
 General availability :milestone, after c2, 0d`,
  },
  {
    id: "journey",
    title: "使用者匯入旅程",
    kind: "User journey",
    source: `journey
 title Import and review a design document
 section Prepare
  Choose workspace: 5: Author
  Select document: 5: Author
  Review warnings: 3: Author
 section Import
  Wait for upload: 3: Author
  Inspect preview: 4: Author, Reviewer
  Resolve conflicts: 2: Author, Reviewer
 section Collaborate
  Edit diagram source: 4: Author
  Comment on decision: 5: Reviewer
  Publish revision: 5: Author, Reviewer`,
  },
  {
    id: "mindmap",
    title: "效能調查範圍",
    kind: "Mind map",
    source: `mindmap
 root((Editor performance))
  Document
   Node count
   Nested lists
   Tables
   Inline formatting
  Diagrams
   Layout engine
   Text measurement
   SVG complexity
   Queue time
  Browser
   Style recalculation
   Layout
   Paint
   Input latency
  Integration
   React commits
   Editor updates
   Observer callbacks
   Cache invalidation`,
  },
  {
    id: "recovery",
    title: "錯誤分流與降級",
    kind: "Flowchart · TD / subgraphs",
    source: `flowchart TD
 Start[Receive failure] --> Classify{Failure class}
 Classify -->|Network| Retry[Exponential backoff]
 Classify -->|Syntax| Source[Show source and error]
 Classify -->|Permission| Access[Request workspace access]
 Classify -->|Runtime| Circuit{Circuit open?}
 Retry --> Budget{Retry budget remaining?}
 Budget -->|Yes| Submit[Resubmit job]
 Budget -->|No| Manual[Manual recovery]
 subgraph Fallback[Rendering fallback]
  Circuit -->|Yes| Placeholder[Keep editable placeholder]
  Circuit -->|No| Once[Retry once]
  Once --> Result{Render succeeded?}
  Result -->|Yes| SVG[Commit SVG]
  Result -->|No| Placeholder
 end
 Source --> Edit[Edit source]
 Edit --> Submit
 Access --> Submit
 Manual --> Audit[Record audit event]
 Placeholder --> Audit
 SVG --> Done[Continue editing]`,
  },
  {
    id: "release",
    title: "發佈與 hotfix 分支",
    kind: "Git graph",
    source: `gitGraph
 commit id: "baseline"
 branch develop
 checkout develop
 commit id: "rich nodes"
 branch feature
 checkout feature
 commit id: "diagram queue"
 commit id: "input probe"
 checkout develop
 merge feature
 commit id: "integration tests"
 checkout main
 merge develop tag: "v1.1"
 branch hotfix
 checkout hotfix
 commit id: "table selection fix"
 checkout main
 merge hotfix tag: "v1.1.1"
 checkout develop
 merge main`,
  },
] as const;

type N = {
  type: string;
  version: number;
  children?: N[];
  text?: string;
  source?: string;
  [key: string]: unknown;
};
const t = (text: string, format = 0): N => ({
  type: "text",
  version: 1,
  text,
  format,
  detail: 0,
  mode: "normal",
  style: "",
});
const el = (
  type: string,
  children: N[],
  extra: Record<string, unknown> = {},
): N => ({
  type,
  version: 1,
  children,
  format: "",
  indent: 0,
  direction: null,
  ...extra,
});
const p = (...children: (string | N)[]) =>
  el(
    "paragraph",
    children.map((x) => (typeof x === "string" ? t(x) : x)),
  );
const h = (title: string, tag = "h2") => el("heading", [t(title)], { tag });
const link = (text: string, url: string) =>
  el("link", [t(text)], {
    url,
    rel: "noreferrer",
    target: "_blank",
    title: null,
  });
function list(items: string[], ordered = false) {
  return el(
    "list",
    items.map((x, i) => el("listitem", [t(x)], { value: i + 1 })),
    {
      listType: ordered ? "number" : "bullet",
      start: 1,
      tag: ordered ? "ol" : "ul",
    },
  );
}
function table(rows: string[][]) {
  return el(
    "table",
    rows.map((row, i) =>
      el(
        "tablerow",
        row.map((cell) =>
          el("tablecell", [p(cell)], {
            headerState: i === 0 ? 1 : 0,
            colSpan: 1,
            rowSpan: 1,
            backgroundColor: null,
          }),
        ),
      ),
    ),
  );
}
export function stats(node: N): {
  chars: number;
  nodes: number;
  tables: number;
  diagrams: number;
  types: Record<string, number>;
} {
  const result = {
    chars: (node.text?.length || 0) + (node.source?.length || 0),
    nodes: 1,
    tables: node.type === "table" ? 1 : 0,
    diagrams: node.type === "mermaid" ? 1 : 0,
    types: { [node.type]: 1 } as Record<string, number>,
  };
  for (const child of node.children || []) {
    const s = stats(child);
    result.chars += s.chars;
    result.nodes += s.nodes;
    result.tables += s.tables;
    result.diagrams += s.diagrams;
    for (const [key, value] of Object.entries(s.types))
      result.types[key] = (result.types[key] || 0) + value;
  }
  return result;
}
const concerns = [
  [
    "檔案接收與權限邊界",
    "先確認 workspace 權限、檔案大小與重複請求，再建立工作紀錄。使用者切換頁面後仍可查詢工作狀態；取消操作不應刪除先前已成功儲存的版本。",
  ],
  [
    "訊息交付與冪等性",
    "佇列採至少一次交付，worker 必須以工作識別碼與文件版本處理重複訊息。資料庫提交成功但 acknowledgment 遺失時，重新執行應讀取既有結果，避免新增重複段落。",
  ],
  [
    "狀態轉移與錯誤回復",
    "暫時性錯誤允許有限次重試，語法錯誤則保留原始內容供使用者修正。所有 terminal state 都需要留下原因與最後更新時間，避免前端持續輪詢已經失敗的工作。",
  ],
  [
    "文件版本與 schema 演進",
    "文件以 revision 保存結構化內容；段落、表格與圖表共用穩定識別碼。schema migration 必須兼容既有匯出格式，並在交易失敗時保持原文件可讀。",
  ],
  [
    "渲染責任與更新範圍",
    "圖表原始碼保存在 editor state，SVG 屬於可重新生成的呈現資料。一般文字編輯不應再次執行整份圖表生成；非同步結果必須核對請求版本才能插入目前節點。",
  ],
  [
    "分階段驗證與 rollout",
    "先在固定資料集建立基準，再逐步加入真實文件結構與瀏覽器矩陣。canary 階段同時觀察輸入延遲、失敗率及記憶體；不能只因總耗時下降就忽略互動期間的阻塞。",
  ],
  [
    "協作流程與審閱體驗",
    "作者需要在匯入後立刻修正標題與段落，審閱者則會跨章節跳轉查看表格及圖表。載入中的圖表必須保留可理解的狀態，不應讓選取範圍或捲動位置無預期地跳動。",
  ],
  [
    "效能歸因與量測定義",
    "圖表生成的牆鐘時間包含排程等待及文字量測，不能當成連續 CPU 使用時間。應將 editor commit、圖表完成與輸入回應分別記錄，並保留 trace 以確認排版工作範圍。",
  ],
  [
    "降級策略與可恢復性",
    "當圖表生成失敗，文件其餘內容仍需可編輯。錯誤訊息應指出可修正的來源，重試操作只針對該張圖表；批次匯入不能因一個非關鍵圖表而清空已載入內容。",
  ],
  [
    "版本發布與回歸控制",
    "版本更新必須鎖定套件與 layout 設定，保留原始 fixture、瀏覽器版本和量測條件。hotfix 合併後重新執行內容完整性檢查，確保改善效能時沒有漏掉表格或語意格式。",
  ],
];
export function fixture(target: number, count: number) {
  if (![20000, 50000, 80000].includes(target) || ![5, 10].includes(count))
    throw new Error("Invalid realistic fixture");
  const selected = diagrams.slice(0, count);
  const nodes: N[] = [
    h("跨工作區文件匯入：架構、資料模型與營運手冊", "h1"),
    p("文件狀態：", t("技術審查中", 1), " · Revision 12 · 2026-11-09"),
    p(
      "這是一份合成工程文件，用來模擬混合格式與多張圖表的 editor 注入負載。案例數字為測試設定，不代表產品實測。",
    ),
    el("quote", [
      p("決策原則：保留內容完整性，同時確保圖表生成期間的文字編輯能正常回應。"),
    ]),
  ];
  selected.forEach((d, i) => {
    const [title, body] = concerns[i];
    const section: N[] = [
      h(`${i + 1}. ${title}`),
      p(body),
      p(
        t("設計約束：", 1),
        "資料提交與畫面呈現需分開觀察；",
        t("避免以 API return 推論 paint 完成", 2),
        "。詳細 API 參考 ",
        link("Lexical 文件", "https://lexical.dev/docs/concepts/editor-state"),
        "。",
      ),
      h("行為與驗收條件", "h3"),
      list(
        [
          "接收來源內容並檢查當前文件版本。",
          "保存完整結構，保持連結、清單與表格欄位。",
          "記錄成功與失敗路徑，確認使用者可以繼續編輯。",
        ],
        true,
      ),
    ];
    const nested = list([
      "正常路徑：核對 revision 與預期輸出。",
      "錯誤路徑：驗證可重試與不可重試原因。",
    ]);
    nested.children!.push(
      el(
        "listitem",
        [
          list([
            "網路中斷後重新送出同一工作。",
            "文件切換後丟棄過期圖表結果。",
          ]),
        ],
        { value: 3 },
      ),
    );
    section.push(nested);
    section.push(
      h("介面與情境矩陣", "h3"),
      table([
        ["情境", "輸入／條件", "預期結果", "觀測位置"],
        [
          "正常匯入",
          `section-${i + 1} / revision 12`,
          "建立新版本，內容完整",
          "editor commit",
        ],
        ["重複提交", "相同 idempotency key", "回傳原工作結果", "API + DB"],
        [
          "表格含長字串",
          "8 欄 × 多行內容",
          "可捲動且不丟失儲存格",
          "DOM / layout",
        ],
        ["圖表語法有效", d.kind, "每張僅生成一次", "render request"],
        [
          "切換文件",
          "舊請求仍在執行",
          "舊 SVG 不覆蓋新內容",
          "request identity",
        ],
        [
          "瀏覽器忙碌",
          "生成期間按鍵輸入",
          "追蹤排隊與下一幀延遲",
          "input probe",
        ],
        ["失敗復原", "可重試錯誤", "保留已完成內容", "error boundary"],
      ]),
    );
    section.push(h(d.title, "h3"), {
      type: "mermaid",
      version: 1,
      source: d.source,
      diagramId: d.id,
      title: d.title,
      kind: d.kind,
    });
    section.push(
      p(
        "此圖採用 ",
        t(d.kind, 16),
        " 描述本章關係；周圍文字與表格均為真正的 Lexical nodes。",
      ),
      el("quote", [
        p(
          t("審閱註記：", 1),
          "請同時檢查內容正確性與操作回應，不能用延後顯示掩蓋持續阻塞。",
        ),
      ]),
      h("實作片段與觀測資料", "h3"),
      el(
        "code",
        [
          t(
            `async function applySection${i + 1}(job, editor) {\n  const state = await repository.load(job.documentId);\n  if (state.revision !== job.expectedRevision) {\n    throw new RevisionConflict(job.id);\n  }\n  editor.setEditorState(state.prepared);\n  metrics.record("section-${i + 1}", job.id);\n}`,
          ),
        ],
        { language: "javascript" },
      ),
      p(
        "歷史方案：",
        t("每次文字更新都重建全部圖表", 4),
        "。目前要求：",
        t("只在圖表來源或相關設定變更時重新生成", 1),
        "。",
      ),
    );
    let length = section.reduce((sum, n) => sum + stats(n).chars, 0);
    let index = 0;
    while (length < target / count) {
      const suffix = [
        "驗證文件切換與 selection 保留。",
        "比對重試前後的版本與節點數量。",
        "檢查段落及表格是否觸發額外 layout。",
        "測試慢速裝置上連續輸入的排隊時間。",
      ][index % 4];
      const block = p(
        t(`觀測案例 ${i + 1}.${++index}：`, 1),
        body,
        ` 測試資料採用 ${10 + index * 7} 個事件與 ${2 + (index % 4)} 次重試上限。`,
        suffix,
        " 日誌應包含 job id、revision、phase 與 duration，避免在高頻更新路徑序列化整份文件。",
      );
      section.push(block);
      length += stats(block).chars;
    }
    nodes.push(...section);
  });
  const root = el("root", nodes);
  return { state: { root }, stats: stats(root), diagrams: selected, target };
}
