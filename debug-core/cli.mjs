#!/usr/bin/env node
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {initCase,runCase,queryCase} from './core.mjs';

const help=`Agent Debug core v0.1 — Node 24, local artifacts; adapter execution is not sandboxed.

init  --case DIR --project ROOT --operation TEXT [--budget 1800]
      Start AFTER environment/login readiness; scanning/builds count from here.
run   --case DIR --plan FILE -- COMMAND ARGS...
      Snapshot sources and run one trusted adapter under the original deadline.
query --case DIR [--run ID] [--event ID] [--limit 10] [--offset 0]
      Read current case/attempt/event evidence, including failures and stale sources.
serve --case DIR [--port 0]
      Open a read-only loopback viewer; prints its actual URL. Ctrl+C stops it.

No company upload, auto-merge, automatic root-cause verdict or 100ms pass.
See debug-core/README.md for the adapter contract and verified boundaries.`;

export function parseArgs(argv){
  const [command,...rest]=argv;
  if(!command||command==='help'||command==='--help') return {command:'help'};
  const allowed={init:['case','project','operation','budget'],run:['case','plan'],query:['case','run','event','limit','offset'],serve:['case','port']}[command];
  if(!allowed)throw new Error(`Unknown command: ${command}`);
  const options={},child=[];
  for(let i=0;i<rest.length;i++){
    if(rest[i]==='--'){
      if(command!=='run')throw new Error('-- COMMAND is only valid for run');
      child.push(...rest.slice(i+1));break;
    }
    const key=rest[i].slice(2);
    if(!rest[i].startsWith('--')||!allowed.includes(key)||Object.hasOwn(options,key))throw new Error(`Unknown or duplicate option: ${rest[i]}`);
    const value=rest[++i];
    if(!value||value.startsWith('--'))throw new Error(`Missing value for --${key}`);
    options[key]=value;
  }
  if(!options.case)throw new Error('--case is required');
  if(command==='init'&&(!options.project||!options.operation))throw new Error('init needs --project and --operation');
  if(command==='run'&&(!options.plan||!child.length))throw new Error('run needs --plan and -- COMMAND ARGS...');
  if(options.event&&!options.run)throw new Error('--event requires --run');
  for(const [name,min,max] of [['budget',1,1800],['limit',1,20],['offset',0,10000],['port',0,65535]]){
    if(options[name]!==undefined){
      if(!/^\d+$/.test(options[name]))throw new Error(`--${name} must be an integer`);
      options[name]=Number(options[name]);
      if(options[name]<min||options[name]>max)throw new Error(`--${name} must be ${min}..${max}`);
    }
  }
  return {command,options,child};
}

export async function main(argv=process.argv.slice(2)){
  const {command,options:o,child}=parseArgs(argv);
  if(command==='help'){process.stdout.write(help+'\n');return;}
  const caseDir=resolve(o.case);
  if(command==='serve'){
    const {serveCase}=await import('./serve.mjs');
    const server=await serveCase(caseDir,{port:o.port??0});
    const address=server.address();
    process.stdout.write(JSON.stringify({url:`http://127.0.0.1:${address.port}`,caseDir,readOnly:true})+'\n');
    for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{server.close();server.closeAllConnections?.();});
    return;
  }
  if(command==='run'){
    const result=await runCase({caseDir,planPath:resolve(o.plan),command:child});
    process.stdout.write(JSON.stringify(await queryCase(caseDir,{runId:result.attempt.id,limit:5}),null,2)+'\n');
    if(result.attempt.status!=='completed'||!result.validity.valid)process.exitCode=1;
    return;
  }
  const result=command==='init'?await initCase({caseDir,projectRoot:resolve(o.project),operation:o.operation,budgetSeconds:o.budget??1800})
    :await queryCase(caseDir,{runId:o.run,eventId:o.event,limit:o.limit??10,offset:o.offset??0});
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  main().catch(error=>{process.stderr.write(JSON.stringify({error:error.message,next:'Inspect the retained case/attempt with query; do not reset its deadline or relabel invalid evidence.'})+'\n');process.exitCode=1;});
}
