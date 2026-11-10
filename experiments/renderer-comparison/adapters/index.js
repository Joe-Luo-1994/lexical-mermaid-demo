import mermaid from 'mermaid';
import { render } from 'pele';

mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default',
  fontFamily: 'Arial, sans-serif', themeVariables: { fontSize: '16px' } });
let sequence = 0;
export const adapters = {
  mermaid: async (source) => (await mermaid.render(`mermaid-comparison-${++sequence}`, source)).svg,
  pele: (source) => render(source, { idPrefix: `pele-comparison-${++sequence}`,
    fontFamily: 'Arial, sans-serif', fontSize: 16, autoDirection: false }).svg,
};
