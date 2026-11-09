import {DecoratorNode,type NodeKey,type SerializedLexicalNode} from 'lexical';
import {useEffect,useLayoutEffect,useRef,type JSX} from 'react';
import {complete,current,diagramTiming,generate,mark,prebuiltSvg,staging} from './lab';
function MermaidView({text,id,title,kind}:{text:string;id:string;title:string;kind:string}){
 const ref=useRef<HTMLDivElement>(null);const value=current;
 useLayoutEffect(()=>{if(value)mark(value,`${id}:decorator-commit`);},[value,id]);
 useEffect(()=>{
  if(!value||!ref.current)return;
  let stale=false;const target=ref.current;
  void(async()=>{
   let host:HTMLElement|undefined;const timing=diagramTiming(value,id);
   try {
    if(value.mode==='svg')target.innerHTML=prebuiltSvg(id);
    else if(value.mode!=='placeholder'){
     host=value.mode==='external'?staging(value.sizing):target;
     value.calls++;timing.requested=performance.now()-value.start;mark(value,`${id}:generate-start`);
     const svg=await generate(host,text);
     timing.resolved=performance.now()-value.start;mark(value,`${id}:generate-end`);
     if(stale||current!==value)return;target.innerHTML=svg;
    }else target.textContent='圖表佔位 · 不執行生成';
    if(!stale&&current===value)complete(value,id);
   }catch(error){if(!stale&&current===value){timing.error=String(error);value.error=`${title}: ${error}`;target.textContent=timing.error;complete(value,id);}}
   finally{if(host&&host!==target)host.remove();}
  })();return()=>{stale=true;};
 },[value,text,id,title]);
 return <figure className="diagram-figure" contentEditable={false}><figcaption>{title}<span>{kind}</span></figcaption><div ref={ref} className={`diagram ${value?.sizing??'natural'}`} data-testid="diagram" data-diagram-id={id} aria-label={title}/></figure>;
}
type SerializedMermaid=SerializedLexicalNode&{source:string;diagramId:string;title:string;kind:string};
export class MermaidNode extends DecoratorNode<JSX.Element>{
 __source:string;__diagramId:string;__title:string;__kind:string;
 constructor(text='',id='',title='',kind='',key?:NodeKey){super(key);this.__source=text;this.__diagramId=id;this.__title=title;this.__kind=kind;}
 static getType(){return 'mermaid';}
 static clone(n:MermaidNode){return new MermaidNode(n.__source,n.__diagramId,n.__title,n.__kind,n.__key);}
 static importJSON(j:SerializedMermaid){return new MermaidNode(j.source,j.diagramId,j.title,j.kind);}
 exportJSON():SerializedMermaid{return {...super.exportJSON(),type:'mermaid',version:1,source:this.__source,diagramId:this.__diagramId,title:this.__title,kind:this.__kind};}
 createDOM(){const el=document.createElement('div');el.className='diagram-node';return el;}
 updateDOM(){return false;}
 isInline(){return false;}
 decorate(){return <MermaidView text={this.__source} id={this.__diagramId} title={this.__title} kind={this.__kind}/>;}
}
