import { diagrams } from '../../src/fixtures.ts';
export const fixtures = [...diagrams, {
  id: 'cjk-labels', title: '中文、換行與特殊字元', kind: 'Flowchart · CJK',
  source: 'flowchart LR\n A["知識庫匯入<br/>文件與表格"] --> B{"版本一致？"}\n B -->|是| C["儲存 & 同步"]\n B -->|否| D["重新讀取：α／β 🚀"]',
}];
