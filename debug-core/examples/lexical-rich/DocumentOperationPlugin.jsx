// Controlled document-open operation added to the upstream example.
// This is a functional fixture, not a reproduction of the company's bottleneck.
import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {$getRoot, $createParagraphNode, $createTextNode} from 'lexical';

export default function DocumentOperationPlugin() {
  const [editor] = useLexicalComposerContext();
  function openDocument() {
    editor.update(() => {
      const root = $getRoot();
      root.clear();
      for (let i = 0; i < 40; i++) {
        const paragraph = $createParagraphNode();
        const text = $createTextNode(`Section ${i + 1}. ` + 'A knowledge document contains decisions, evidence, and open questions. '.repeat(8));
        if (i % 3 === 0) text.toggleFormat('bold');
        paragraph.append(text);
        root.append(paragraph);
      }
    });
  }
  return <button type="button" data-open-document onClick={openDocument}>Open reference document</button>;
}
