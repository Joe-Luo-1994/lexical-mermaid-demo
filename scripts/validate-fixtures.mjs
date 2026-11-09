import assert from 'node:assert/strict';
import {createHeadlessEditor} from '@lexical/headless';
import {DecoratorNode} from 'lexical';
import {richNodes} from '../src/nodes.ts';
import {fixture,diagrams,stats} from '../src/fixtures.ts';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window=dom.window;globalThis.document=dom.window.document;
const {default:mermaid}=await import('mermaid');
// Headless stand-in preserves serialized diagram data; rendering is browser-only.
class FixtureDiagram extends DecoratorNode {
 static getType(){return 'mermaid';}
 static clone(n){return new FixtureDiagram(n.data,n.__key);}
 static importJSON(data){return new FixtureDiagram(data);}
 constructor(data,key){super(key);this.data=data;}
 exportJSON(){return this.data;}
 decorate(){return null;}
 isInline(){return false;}
}
for(const count of [5,10])for(const target of [20000,50000,80000]){
 const f=fixture(target,count);
 const editor=createHeadlessEditor({namespace:'validation',nodes:[...richNodes,FixtureDiagram],onError:e=>{throw e;}});
 const state=editor.parseEditorState(JSON.stringify(f.state));editor.setEditorState(state);
 const roundtrip=state.toJSON();const after=stats(roundtrip.root);
 assert.equal(after.diagrams,count);assert.equal(after.tables,count);assert.ok(after.chars>=target);assert.equal(after.chars,f.stats.chars);
 assert.equal(new Set(f.diagrams.map(d=>d.kind)).size,count);
 for(const type of ['heading','quote','link','code','list','listitem','table','tablerow','tablecell','mermaid'])assert.ok(after.types[type]>0,type);
 assert.equal(roundtrip.root.children.filter(n=>n.type==='mermaid').length,count);
 console.log(`PASS fixture ${target}/${count}: ${after.chars} chars, ${after.nodes} nodes, ${after.tables} tables`);
}
for(const d of diagrams){await mermaid.parse(d.source);console.log(`PASS Mermaid syntax: ${d.id}`);}
console.log('Headless data and syntax checks only; this does not validate browser rendering.');
