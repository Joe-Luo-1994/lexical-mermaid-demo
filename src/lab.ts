import mermaid from 'mermaid';
import type {EditorState, LexicalEditor} from 'lexical';
import {fixture} from './fixtures';
export const modes=['placeholder','svg','inline','external'] as const;
export type Mode=typeof modes[number];
export type Sizing='natural'|'fixed';
export const labels:Record<Mode,string>={placeholder:'A · 空白節點',svg:'B · 預生成 SVG',inline:'C · 節點內生成',external:'D · 外部容器生成'};
type Entry={start:number;duration:number};
export type DiagramTiming={id:string;title:string;kind:string;sourceChars:number;requested?:number;resolved?:number;inserted?:number;error?:string};
export type Run={id:number;mode:Mode;sizing:Sizing;chars:number;targetChars:number;lexicalNodes:number;tables:number;nodeTypes:Record<string,number>;diagramCount:number;diagrams:DiagramTiming[];start:number;end?:number;calls:number;error?:string;spans:Record<string,number>;longTasks:Entry[];inputs:{trusted:boolean;handlerDelayMs:number;nextFrameMs?:number}[];domElements?:number;textInserted?:boolean;done:boolean;completed:number};
let editor:LexicalEditor;
let prepared:EditorState|null=null;
let preparedFixture:ReturnType<typeof fixture>;
let preparedMode:Mode='inline';
let preparedSizing:Sizing='natural';
let sequence=0,runSequence=0;
let pending=false,reporting=true;
let observer:PerformanceObserver|undefined;
export let current:Run|undefined;
const svgs=new Map<string,string>();
const warmed=new Set<string>();
const results:Run[]=[];
let onResult=()=>{};
mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:'default',fontFamily:'Arial',flowchart:{htmlLabels:false}});
export function staging(sizing:Sizing='natural') {const el=document.createElement('div');el.className=`diagram staging ${sizing}`;el.setAttribute('aria-hidden','true');document.body.append(el);return el;}
export async function generate(host:HTMLElement,text:string) {return (await mermaid.render(`graph-${++sequence}`,text,host)).svg;}
export function mark(value:Run,name:string) {value.spans[name]=performance.now()-value.start;performance.mark(`run-${value.id}:${name}`);}
export async function prepare(mode:Mode,size:number,count=5,sizing:Sizing='natural') {
 if(pending||(current&&!current.done))throw new Error('A run is still active');
 if(!modes.includes(mode)||!['natural','fixed'].includes(sizing))throw new Error('Invalid configuration');
 pending=true;
 try {
  current=undefined;
  editor.setEditorState(editor.parseEditorState(JSON.stringify({root:{type:'root',version:1,format:'',indent:0,direction:null,children:[{type:'paragraph',version:1,format:'',indent:0,direction:null,children:[]}]}})));
  await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())));
  await document.fonts.ready;
  const begin=performance.now();
  preparedFixture=fixture(size,count);
  // Warm every selected diagram family outside injection measurement.
  for(const diagram of preparedFixture.diagrams) if(!warmed.has(diagram.id)||mode==='svg') {
   const host=staging(sizing);
   try {svgs.set(diagram.id,await generate(host,diagram.source));warmed.add(diagram.id);}finally{host.remove();}
  }
  prepared=editor.parseEditorState(JSON.stringify(preparedFixture.state));
  preparedMode=mode;preparedSizing=sizing;
  editor.getRootElement()?.focus();
  return {mode,size,count,sizing,preparationMs:performance.now()-begin,...preparedFixture.stats};
 }finally{pending=false;}
}
export function prebuiltSvg(id:string) {const svg=svgs.get(id);if(!svg)throw new Error(`Missing SVG ${id}`);return svg;}
export function run() {
 if(!prepared||pending||(current&&!current.done))throw new Error('Prepare a fresh fixture first');
 const f=preparedFixture;
 const value:Run={id:++runSequence,mode:preparedMode,sizing:preparedSizing,chars:f.stats.chars,targetChars:f.target,lexicalNodes:f.stats.nodes,tables:f.stats.tables,nodeTypes:f.stats.types,diagramCount:f.diagrams.length,diagrams:f.diagrams.map(d=>({id:d.id,title:d.title,kind:d.kind,sourceChars:d.source.length})),start:performance.now(),calls:0,spans:{},longTasks:[],inputs:[],done:false,completed:0};
 current=value;
 if(PerformanceObserver.supportedEntryTypes.includes('longtask')) {observer=new PerformanceObserver(list=>{for(const e of list.getEntries())value.longTasks.push({start:e.startTime,duration:e.duration});});observer.observe({type:'longtask',buffered:false});}
 mark(value,'inject-start');editor.setEditorState(prepared,{tag:'benchmark-inject'});prepared=null;mark(value,'api-return');return value.id;
}
export function diagramTiming(value:Run,id:string){const d=value.diagrams.find(d=>d.id===id);if(!d)throw new Error('Unknown diagram');return d;}
export function complete(value:Run,id:string) {
 if(current!==value)return;
 const d=diagramTiming(value,id);if(d.inserted!==undefined)return;
 d.inserted=performance.now()-value.start;mark(value,`${id}:inserted`);value.completed++;
 if(value.completed!==value.diagramCount)return;
 mark(value,'all-svg-inserted');
 requestAnimationFrame(()=>requestAnimationFrame(()=>{
  if(current!==value)return;
  mark(value,'two-raf-after-insert');value.end=performance.now();
  setTimeout(()=>{
   if(observer){for(const e of observer.takeRecords())value.longTasks.push({start:e.startTime,duration:e.duration});observer.disconnect();observer=undefined;}
   value.longTasks=value.longTasks.filter(e=>e.start<value.end!&&e.start+e.duration>value.start);
   value.domElements=editor.getRootElement()?.querySelectorAll('*').length;
   value.done=true;results.push(value);if(reporting)onResult();
  },180);
 }));
}
export function summary(value:Run) {
 const durations=value.longTasks.map(e=>Math.max(0,Math.min(e.start+e.duration,value.end!)-Math.max(e.start,value.start)));
 const generated=value.diagrams.filter(d=>d.requested!==undefined&&d.resolved!==undefined);
 return {...value,preparationExcluded:true,longTaskSupported:PerformanceObserver.supportedEntryTypes.includes('longtask'),generateMs:generated.length?Math.max(...generated.map(d=>d.resolved!))-Math.min(...generated.map(d=>d.requested!)):0,completionProxyMs:value.spans['two-raf-after-insert'],maxOverlappingLongTaskMs:Math.max(0,...durations),blockingOver50Ms:durations.reduce((a,d)=>a+Math.max(0,d-50),0)};
}
export function connect(instance:LexicalEditor,update:()=>void){
 editor=instance;onResult=update;
 const unregister=editor.registerUpdateListener(({tags})=>{if(tags.has('benchmark-inject')&&current)mark(current,'lexical-commit');});
 let priorZ=0;
 const keydown=(event:KeyboardEvent)=>{
  if(event.key!=='z'||!current)return;
  const value=current;priorZ=(editor.getRootElement()?.textContent?.match(/z/g)||[]).length;
  const input={trusted:event.isTrusted,handlerDelayMs:performance.now()-event.timeStamp,nextFrameMs:undefined as number|undefined};value.inputs.push(input);
  requestAnimationFrame(()=>{input.nextFrameMs=performance.now()-event.timeStamp;});
 };
 const input=(event:Event)=>{if(current&&(event as InputEvent).data==='z')current.textInserted=event.isTrusted&&(editor.getRootElement()?.textContent?.match(/z/g)||[]).length>priorZ;};
 editor.getRootElement()?.addEventListener('keydown',keydown);editor.getRootElement()?.addEventListener('input',input);
 window.bench={prepare,run,setReporting:(enabled:boolean)=>{reporting=enabled;},getResult:()=>current?.done?summary(current):null,results:()=>results.map(summary),isReady:()=>true,editorText:()=>editor.getRootElement()?.textContent??'',calls:()=>current?.calls??0};
 return ()=>{unregister();editor.getRootElement()?.removeEventListener('keydown',keydown);editor.getRootElement()?.removeEventListener('input',input);};
}
declare global {interface Window {bench:{prepare:typeof prepare;run:typeof run;setReporting:(enabled:boolean)=>void;getResult:()=>ReturnType<typeof summary>|null;results:()=>ReturnType<typeof summary>[];isReady:()=>boolean;editorText:()=>string;calls:()=>number}}}
