import {constants} from 'node:fs';
import {mkdir, readFile, writeFile, rename, realpath, stat, open, unlink} from 'node:fs/promises';
import {resolve, relative, isAbsolute, join, dirname} from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {spawn, execFile} from 'node:child_process';
import {promisify} from 'node:util';
const execFileAsync=promisify(execFile);

export const CORE_VERSION = '0.1.0';
const LIMITS = Object.freeze({maxEvents:2000,maxCaptureBytes:2097152,maxArtifactBytes:33554432});
const MAX_META = 8 * 1024 * 1024;
const MAX_SOURCE = 256 * 1024;
const MAX_LOG = 256 * 1024;
const MAX_ATTEMPTS = 100;
const NOTES = [
  'Runner validates referenced files and adapter output; authorized adapter commands are not sandboxed.',
  'Adapter records and source attribution are assertions backed by retained artifacts, not proof of semantic equivalence or causality.',
  'Visible-response 100 ms validation, external viewer integration and improvement validation are not implemented.',
  'Host clock changes, arbitrary shell access and unobserved project files are outside this runner enforcement boundary.',
];
const hash = data => createHash('sha256').update(data).digest('hex');
export const CORE_SHA256 = hash(await readFile(new URL(import.meta.url)));
const json = x => JSON.stringify(x,null,2)+'\n';
function fail(message){throw new Error(message);}
function text(x,name,max=2000){if(typeof x!=='string'||!x.trim()||x.length>max)fail(`${name} must be nonempty text <= ${max} characters`);return x;}
function array(x,name,max=50){if(!Array.isArray(x)||x.length>max)fail(`${name} must be an array <= ${max}`);return x;}
function texts(x,name,max=32){return array(x,name,max).map(v=>text(v,name));}
function identifier(x,name='id'){text(x,name,120);if(!/^[A-Za-z0-9][A-Za-z0-9:_.-]*$/.test(x))fail(`Invalid ${name}`);return x;}
function relPath(x){text(x,'path',500);if(isAbsolute(x)||x.includes('\\')||x.split('/').some(v=>!v||v==='.'||v==='..')||x.includes('\0'))fail('Path must be a normalized relative path');return x;}
function within(root,path){const r=relative(root,path);return r===''||(!isAbsolute(r)&&r!=='..'&&!r.startsWith('../')&&!r.startsWith('..\\'));}
async function boundedRead(path,limit){const fd=await open(path,constants.O_RDONLY);try{const s=await fd.stat();if(!s.isFile()||s.size>limit)fail(`File not regular or too large: ${path}`);const b=Buffer.alloc(Math.min(limit+1,s.size+1));const {bytesRead}=await fd.read(b,0,b.length,0);if(bytesRead>limit)fail(`File exceeds limit: ${path}`);return b.subarray(0,bytesRead);}finally{await fd.close();}}
async function scopedFile(root,path,limit){relPath(path);const file=await realpath(resolve(root,path));if(!within(root,file))fail(`Path escapes scope: ${path}`);return {file,data:await boundedRead(file,limit)};}
async function readJSON(path,limit=MAX_META){return JSON.parse((await boundedRead(path,limit)).toString('utf8'));}
async function scopedJSON(root,path,limit=MAX_META){return JSON.parse((await scopedFile(root,path,limit)).data.toString('utf8'));}
async function scopedDir(root,path){relPath(path);const dir=await realpath(join(root,path));if(!within(root,dir)||(await stat(dir)).isDirectory()===false)fail('Directory escapes scope: '+path);return dir;}
async function atomic(path,value){const temp=path+'.'+randomUUID()+'.tmp';await writeFile(temp,json(value),{flag:'wx',mode:0o600});await rename(temp,path);}
const header = c => ({kind:c.kind,version:c.version,id:c.id,root:c.root,operation:c.operation,startedAt:c.startedAt,deadlineAt:c.deadlineAt,budgetSeconds:c.budgetSeconds,limits:c.limits,coreVersion:c.coreVersion,coreSha256:c.coreSha256});
async function loadCase(caseDir){const dir=await realpath(caseDir);const c=await scopedJSON(dir,'case.json');if(c.kind!=='agent-debug-case'||c.version!==1)fail('Unsupported case format');if(c.coreSha256!==CORE_SHA256)fail('Core implementation fingerprint differs from case. Use the pinned original core to read this case; create a new case for this implementation, preserving prior evidence and accumulated costs.');identifier(c.id,'case id');if(hash(JSON.stringify(header(c)))!==c.identityHash)fail('Case identity/deadline integrity mismatch');if(JSON.stringify(c.limits)!==JSON.stringify(LIMITS))fail('Unsupported case limits');if(Date.parse(c.deadlineAt)-Date.parse(c.startedAt)!==c.budgetSeconds*1000)fail('Case deadline mismatch');array(c.attempts,'attempts',MAX_ATTEMPTS);return {dir,c};}
function remaining(c){return Math.max(0,(Date.parse(c.deadlineAt)-Date.now())/1000);}
function attemptView(a){if(a.status==='running'){let alive=false;try{process.kill(a.controllerPid,0);alive=true;}catch{}return {...a,status:alive?'running':'interrupted',interruption:alive?null:'Controller no longer running; no automatic retry or deadline reset'};}return a;}

export async function initCase({caseDir,projectRoot,operation,budgetSeconds=1800}){
  text(operation,'operation');if(!Number.isInteger(budgetSeconds)||budgetSeconds<1||budgetSeconds>1800)fail('budgetSeconds must be 1..1800');
  const root=await realpath(projectRoot);if(!(await stat(root)).isDirectory())fail('Project root must be a directory');
  const dir=resolve(caseDir);await mkdir(dir,{recursive:false,mode:0o700});
  const startedAt=new Date().toISOString();const c={kind:'agent-debug-case',version:1,id:randomUUID(),root,operation,startedAt,deadlineAt:new Date(Date.parse(startedAt)+budgetSeconds*1000).toISOString(),budgetSeconds,limits:LIMITS,coreVersion:CORE_VERSION,coreSha256:CORE_SHA256,attempts:[]};c.identityHash=hash(JSON.stringify(header(c)));
  await mkdir(join(dir,'runs'),{mode:0o700});await atomic(join(dir,'case.json'),c);return {...c,remainingSeconds:remaining(c),limitations:NOTES};
}

async function acquire(dir){const file=join(dir,'.run.lock');try{const f=await open(file,'wx',0o600);await f.writeFile(json({pid:process.pid,createdAt:new Date().toISOString()}));await f.close();return ()=>unlink(file);}catch(e){if(e.code==='EEXIST')fail('Case is locked by an active or interrupted runner. Inspect .run.lock and attempts; do not silently clear a live lock.');throw e;}}
function planCheck(p){if(Buffer.byteLength(JSON.stringify(p))>8192)fail('Plan exceeds 8 KiB');text(p.question,'plan.question');texts(p.outcomes,'plan.outcomes');if(p.outcomes.length<2)fail('Plan requires at least two outcome branches');texts(p.limitations,'plan.limitations');array(p.sources,'plan.sources',32);if(!p.sources.length)fail('Plan needs explicit source scope');p.sources.forEach(relPath);if(new Set(p.sources).size!==p.sources.length)fail('Duplicate plan source');}
async function snapshots(root,paths){const out=[];let total=0;for(const path of paths){const {data}=await scopedFile(root,path,MAX_SOURCE);total+=data.length;if(total>4*1024*1024)fail('Source snapshot total exceeds 4 MiB');if(data.includes(0))fail(`Source is not text: ${path}`);out.push({path,sha256:hash(data),text:data.toString('utf8')});}return out;}
async function freshness(root,sources){return Promise.all(sources.map(async s=>{try{const {data}=await scopedFile(root,s.path,MAX_SOURCE);const currentSha256=hash(data);return {...s,currentSha256,freshness:currentSha256===s.sha256?'current':'stale'};}catch{return {...s,currentSha256:null,freshness:'missing'};}}));}

async function provenance(root,command,sources){
  const info={node:process.version,platform:process.platform,command,adapter:null,git:{status:'unknown'},sourceScope:'Only declared sources and adapter are snapshotted; dependency/build completeness is not attested.'};
  const candidate=command.slice(1).find((arg,i)=>i===0 && /\.(mjs|cjs|js|ts|py)$/.test(arg));
  if(candidate){const actual=await realpath(resolve(root,candidate));if(!within(root,actual))fail('Adapter script outside project scope');const path=relative(root,actual).split('\\').join('/');const source=sources.find(s=>s.path===path);if(!source)fail('Adapter script must be listed in plan.sources');info.adapter={path,sha256:source.sha256};}
  else info.adapter={kind:'command-argv',sha256:hash(JSON.stringify(command)),limitation:'Inline code or non-script executable; command argv is retained, transitive executable code is not attested.'};
  try{const opts={cwd:root,timeout:1000,maxBuffer:4*1024*1024,encoding:'utf8'};const repositoryRoot=await realpath((await execFileAsync('git',['rev-parse','--show-toplevel'],opts)).stdout.trim());const head=(await execFileAsync('git',['rev-parse','HEAD'],opts)).stdout.trim();const status=(await execFileAsync('git',['status','--porcelain=v1','--untracked-files=normal','--','.'],opts)).stdout;const diff=(await execFileAsync('git',['diff','--binary','HEAD','--','.'],opts)).stdout;info.git={status:repositoryRoot===root?'captured':'enclosing-repository',repositoryRoot,projectRoot:root,head,dirty:status.length>0,statusSha256:hash(status),trackedDiffSha256:hash(diff),limitation:repositoryRoot===root?'Untracked file contents are covered only when listed in plan.sources.':'Project is nested inside an enclosing repository; this HEAD is not independent project origin. Only declared source hashes attest copied/untracked contents.'};}catch(e){info.git={status:'unknown',reason:'Not a Git checkout or Git metadata unavailable within bounded probe'};}
  return info;
}

function numeric(x,name){if(typeof x!=='number'||!Number.isFinite(x)||x<0)fail(`${name} must be finite and nonnegative`);}
function equalEvent(a,b){return ['id','name','startMs','durationMs'].every(k=>a[k]===b[k])&&JSON.stringify(a.source??null)===JSON.stringify(b.source??null);}

async function validateCapture(capture,runId,runDir,sources){
  if(capture.kind!=='agent-debug-capture'||capture.version!==1||capture.runId!==runId)fail('Capture identity mismatch');
  if(capture.clock?.unit!=='ms')fail('Capture clock unit must be ms');text(capture.clock.origin,'clock.origin',200);numeric(capture.clock.timeOrigin,'clock.timeOrigin');
  const events=array(capture.events,'events',LIMITS.maxEvents), relations=array(capture.relations,'relations',4000), files=array(capture.artifacts,'artifacts',24);
  if(new Set(files).size!==files.length)fail('Duplicate artifact');const artifacts={};let total=0;
  for(const path of files){relPath(path);if(path==='capture.json'||path.startsWith('.core/')||['stdout.log','stderr.log'].includes(path))fail('Reserved artifact path');const {data}=await scopedFile(runDir,path,LIMITS.maxArtifactBytes);total+=data.length;if(total>LIMITS.maxArtifactBytes)fail('Artifact total exceeds 32 MiB');artifacts[path]={sha256:hash(data),bytes:data.length,data};}
  const ids=new Map(),raw=new Map(),rawArrays=new Map();
  for(const e of events){identifier(e.id,'event id');if(ids.has(e.id))fail('Duplicate event id');text(e.name,'event.name',300);numeric(e.startMs,'event.startMs');numeric(e.durationMs,'event.durationMs');
    if(e.source!=null){const source=sources.find(s=>s.path===e.source.path);if(!source)fail(`Unknown source: ${e.source.path}`);if(!Number.isInteger(e.source.line)||e.source.line<1||e.source.line>source.text.split('\n').length)fail('Source line outside snapshot');}
    if(!e.rawRef||!Object.hasOwn(artifacts,e.rawRef.artifact)||!Number.isInteger(e.rawRef.index)||e.rawRef.index<0)fail('Invalid event rawRef');
    if(!rawArrays.has(e.rawRef.artifact)){const records=JSON.parse(artifacts[e.rawRef.artifact].data.toString('utf8'));array(records,'raw event array',LIMITS.maxEvents);rawArrays.set(e.rawRef.artifact,records);}
    const record=rawArrays.get(e.rawRef.artifact)[e.rawRef.index];if(!record||!equalEvent(e,record))fail('Raw event reference does not match normalized event');ids.set(e.id,e);raw.set(e.id,record);
  }
  for(const edge of relations){if(!ids.has(edge.from)||!ids.has(edge.to)||edge.from===edge.to)fail('Invalid relation endpoint');text(edge.reason,'relation.reason');if(!['captured-call','temporal-association','static-call','hypothesis'].includes(edge.type))fail('Unsupported relation type (captured-schedule not implemented)');if(edge.type==='captured-call'){const child=raw.get(edge.to);if(child.parentId!==edge.from||child.parentType!=='sync-call')fail('Captured call lacks explicit raw sync parent');const a=ids.get(edge.from),b=ids.get(edge.to);if(b.startMs<a.startMs||b.startMs+b.durationMs>a.startMs+a.durationMs+0.001)fail('Captured sync call outside parent interval');}}
  const parents=new Map();for(const edge of relations.filter(e=>e.type==='captured-call')){if(parents.has(edge.to)&&parents.get(edge.to)!==edge.from)fail('Captured call has multiple parents');parents.set(edge.to,edge.from);}for(const id of ids.keys()){const seen=new Set();let at=id;while(parents.has(at)){if(seen.has(at))fail('Captured-call cycle');seen.add(at);at=parents.get(at);}}
  texts(capture.coverage?.installed,'coverage.installed');texts(capture.coverage?.limitations,'coverage.limitations');if(!Number.isInteger(capture.coverage?.dropped)||capture.coverage.dropped<0)fail('coverage.dropped required');
  const findings=array(capture.findings,'findings',50),findingIds=new Set();for(const f of findings){identifier(f.id,'finding id');if(findingIds.has(f.id))fail('Duplicate finding id');findingIds.add(f.id);if(!['observed','hypothesis','unknown'].includes(f.status))fail('Unsupported finding status');text(f.text,'finding.text');texts(f.limitations,'finding.limitations');array(f.eventIds,'finding.eventIds',100).forEach(id=>{if(!ids.has(id))fail('Finding references missing event');});if(f.status==='observed'&&!f.eventIds.length)fail('Observed finding requires evidence');}
  const next=capture.nextExperiment;text(next?.question,'nextExperiment.question');text(next?.intervention,'nextExperiment.intervention');texts(next?.controls,'nextExperiment.controls');texts(next?.outcomes,'nextExperiment.outcomes');if(!next.controls.length||next.outcomes.length<2)fail('Next experiment requires controls and outcome branches');
  if(capture.capabilities?.visibleResponse!=='unverified'||capture.capabilities?.externalViewer!=='unverified')fail('v0.1 cannot grant visible-response or external-viewer validation');
  if(capture.costs?.tokens!==null||capture.costs?.fee!==null)fail('v0.1 usage meter unavailable: costs must be null, not fabricated');
  return Object.fromEntries(Object.entries(artifacts).map(([k,v])=>[k,{sha256:v.sha256,bytes:v.bytes}]));
}

function execute(command,{cwd,env,timeoutMs,runDir}){
  return new Promise(async resolveResult=>{
    const started=performance.now();let child,reason=null,killTimer,timer,total=0,stdout=[],stderr=[],finished=false;
    const kill=signal=>{if(!child?.pid)return;try{if(process.platform==='win32')child.kill(signal);else process.kill(-child.pid,signal);}catch{}};
    const stop=why=>{if(reason)return;reason=why;kill('SIGTERM');killTimer=setTimeout(()=>kill('SIGKILL'),500);};
    const interrupt=()=>stop('cancelled');process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
    const done=async(code,error)=>{if(finished)return;finished=true;clearTimeout(timer);clearTimeout(killTimer);kill('SIGKILL');process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);try{await Promise.all([writeFile(join(runDir,'stdout.log'),Buffer.concat(stdout),{flag:'wx',mode:0o600}),writeFile(join(runDir,'stderr.log'),Buffer.concat(stderr),{flag:'wx',mode:0o600})]);}catch(e){error=e;reason=reason??'log-write-failed';}resolveResult({exitCode:code,reason:reason??(error?'spawn-error':null),error:error?String(error):null,elapsedMs:performance.now()-started,logBytes:total});};
    try{child=spawn(command[0],command.slice(1),{cwd,env,stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32',windowsHide:true});}catch(e){await done(null,e);return;}
    for(const [stream,buffers] of [[child.stdout,stdout],[child.stderr,stderr]])stream.on('data',chunk=>{const available=Math.max(0,MAX_LOG-total);if(available)buffers.push(chunk.subarray(0,available));total+=chunk.length;if(total>MAX_LOG)stop('log-limit');});
    timer=setTimeout(()=>stop('budget-exhausted'),Math.max(1,timeoutMs));
    child.once('error',e=>done(null,e));child.once('close',code=>done(code,null));
  });
}

export async function runCase({caseDir,planPath,command}){
  const {dir}=await loadCase(caseDir);const release=await acquire(dir);let c,attempt,runDir;
  try{
    ({c}=await loadCase(dir));if(!remaining(c))fail('Case budget exhausted; query and handoff remain available');if(c.attempts.length>=MAX_ATTEMPTS)fail('Case attempt limit reached');
    if(!Array.isArray(command)||!command.length||command.length>100||command.some(x=>typeof x!=='string'||x.length>8000)||!command[0]||Buffer.byteLength(JSON.stringify(command))>8192)fail('command must be an argv array');
    const plan=await readJSON(planPath);planCheck(plan);const sources=await snapshots(c.root,plan.sources);
    if(!remaining(c))fail('Budget exhausted during source snapshot');
    const identity=await provenance(c.root,command,sources);await scopedDir(dir,'runs');if(!remaining(c))fail('Budget exhausted during provenance capture');const id=randomUUID();runDir=join(dir,'runs',id);await mkdir(runDir,{mode:0o700});await mkdir(join(runDir,'.core'),{mode:0o700});
    attempt={id,status:'running',startedAt:new Date().toISOString(),controllerPid:process.pid,command,plan,provenance:identity,coreVersion:CORE_VERSION,coreSha256:CORE_SHA256};
    c.attempts.push(attempt);await atomic(join(dir,'case.json'),c);
    const result=await execute(command,{cwd:c.root,runDir,timeoutMs:remaining(c)*1000,env:{...process.env,DEBUG_RUN_DIR:runDir,DEBUG_RUN_ID:id,DEBUG_DEADLINE:c.deadlineAt}});
    attempt={...attempt,...result,finishedAt:new Date().toISOString(),status:result.reason==='budget-exhausted'?'budget-exhausted':result.reason==='cancelled'?'cancelled':result.exitCode!==0||result.reason?'failed':'completed',issues:[]};
    const fresh=await freshness(c.root,sources);let capture=null,artifactDigests={};
    if(attempt.status==='completed'){
      try{capture=await scopedJSON(runDir,'capture.json',LIMITS.maxCaptureBytes);artifactDigests=await validateCapture(capture,id,runDir,sources);if(fresh.some(s=>s.freshness!=='current'))fail('Source changed or disappeared during capture');}
      catch(e){attempt.status='invalid-capture';attempt.issues.push(e.message);}
    }
    // Seal core-controlled source snapshots after the adapter exits; retain failures.
    await scopedDir(runDir,'.core');await atomic(join(runDir,'.core','sources.json'),sources);await atomic(join(runDir,'.core','attempt.json'),attempt);
    const seal={version:1,runId:id,files:{...artifactDigests}};
    for(const path of ['.core/sources.json','.core/attempt.json','stdout.log','stderr.log','capture.json']){try{const {data}=await scopedFile(runDir,path,path==='capture.json'?LIMITS.maxCaptureBytes:5*1024*1024);seal.files[path]={sha256:hash(data),bytes:data.length};}catch{if(path!=='capture.json')throw new Error('Cannot seal '+path);}}
    await atomic(join(runDir,'.core','seal.json'),seal);attempt.sealHash=hash((await scopedFile(runDir,'.core/seal.json',MAX_META)).data);
    c.attempts[c.attempts.length-1]=attempt;await atomic(join(dir,'case.json'),c);return await getRun(dir,id);
  }catch(e){if(attempt&&runDir){try{attempt={...attempt,status:'interrupted',issues:[e.message],finishedAt:new Date().toISOString()};c.attempts[c.attempts.length-1]=attempt;await atomic(join(dir,'case.json'),c);}catch{}}throw e;}
  finally{await release();}
}

async function runRecord(caseDir,runId){const {dir,c}=await loadCase(caseDir);identifier(runId,'run id');const attempt=c.attempts.find(a=>a.id===runId);if(!attempt)fail('Unknown run id');const runDir=await realpath(join(dir,'runs',runId));if(!within(dir,runDir))fail('Run escapes case');return {dir,c,attempt:attemptView(attempt),runDir};}
async function integrity(runDir,attempt){const issues=[];let seal=null;try{const bytes=(await scopedFile(runDir,'.core/seal.json',MAX_META)).data;if(hash(bytes)!==attempt.sealHash)fail('Seal digest mismatch');seal=JSON.parse(bytes.toString('utf8'));if(seal.runId!==attempt.id)fail('Seal run identity mismatch');if(!seal.files||typeof seal.files!=='object'||Array.isArray(seal.files)||Object.keys(seal.files).length>29)fail('Invalid seal file table');for(const [path,entry] of Object.entries(seal.files)){const {data}=await scopedFile(runDir,path,Math.max(LIMITS.maxArtifactBytes,5*1024*1024));if(data.length!==entry.bytes||hash(data)!==entry.sha256)issues.push('Artifact integrity mismatch: '+path);}}catch(e){issues.push(e.message);}return {seal,issues};}

export async function getRun(caseDir,runId){
  const {c,attempt,runDir}=await runRecord(caseDir,runId);const {seal,issues}=await integrity(runDir,attempt);let capture=null,sources=[];
  if(!issues.length)try{const stored=await scopedJSON(runDir,'.core/attempt.json');const comparable={...attempt};delete comparable.sealHash;if(JSON.stringify(stored)!==JSON.stringify(comparable))issues.push('Attempt ledger differs from sealed execution record');}catch(e){issues.push('Attempt record unavailable: '+e.message);}
  if(!issues.length)try{sources=await scopedJSON(runDir,'.core/sources.json',5*1024*1024);array(sources,'source snapshots',32);sources=await freshness(c.root,sources);}catch(e){issues.push('Source snapshot unavailable: '+e.message);}
  if(!issues.length&&attempt.status==='completed'&&seal?.files['capture.json'])try{capture=await scopedJSON(runDir,'capture.json',LIMITS.maxCaptureBytes);if(!issues.length&&attempt.status==='completed')await validateCapture(capture,runId,runDir,sources);}catch(e){issues.push('Capture validation: '+e.message);capture=null;}
  if(attempt.status!=='completed')issues.push('Attempt status: '+attempt.status);
  const valid=issues.length===0;const fresh=sources.some(s=>s.freshness!=='current')?'stale':sources.length?'current':'unknown';
  return {attempt,capture:valid?capture:null,sources:valid?sources:[],validity:{valid,issues},freshness:fresh,limitations:[...NOTES,...(capture?.coverage?.limitations??[]),...(attempt.plan?.limitations??[]),...(fresh!=='current'?['Historical source snapshot is not applicable to the current project without revalidation.']:[])]};
}

export async function getSource(caseDir,runId,path){relPath(path);const r=await getRun(caseDir,runId);if(!r.validity.valid)fail('Run integrity invalid; source navigation disabled');const s=r.sources.find(s=>s.path===path);if(!s)fail('Source not in this run');return {...s,snapshotIntegrity:'verified'};}
export async function getArtifact(caseDir,runId,path){relPath(path);const {runDir,attempt}=await runRecord(caseDir,runId);const {seal,issues}=await integrity(runDir,attempt);if(issues.length)fail('Run integrity invalid: '+issues.join('; '));if(!Object.hasOwn(seal.files,path)||path.startsWith('.core/'))fail('Artifact not exposed');const {data}=await scopedFile(runDir,path,LIMITS.maxArtifactBytes);return {path,sha256:seal.files[path].sha256,data};}

function short(s,max=400){return typeof s==='string'&&s.length>max?s.slice(0,max)+'… [truncated; inspect full run artifact]':s;}
function shortList(values,maxItems=8,maxChars=300){return {items:(values??[]).slice(0,maxItems).map(s=>short(s,maxChars)),omitted:Math.max(0,(values?.length??0)-maxItems),truncated:(values??[]).some(s=>typeof s==='string'&&s.length>maxChars)};}
function nextSummary(n){if(!n)return null;return {question:short(n.question),intervention:short(n.intervention),controls:shortList(n.controls),outcomes:shortList(n.outcomes)};}
function findingsPage(findings,offset,limit){return findings.slice(offset,offset+limit).map(f=>({...f,text:short(f.text,600),eventIds:f.eventIds.slice(0,10),eventIdsOmitted:Math.max(0,f.eventIds.length-10),limitations:shortList(f.limitations,4,200)}));}
function provenanceSummary(p){if(!p)return null;const command=p.command??[];return {...p,command:command.slice(0,8).map(a=>short(a,200)),commandArgumentsOmitted:Math.max(0,command.length-8),commandTruncated:command.length>8||command.some(a=>a.length>200),commandSha256:hash(JSON.stringify(command))};}
function budgetOutput(value){
  // Keep identity/status/deadline/page shape even when content is too large.
  const size=()=>Buffer.byteLength(JSON.stringify(value));const max=24000;if(size()<=max)return value;
  value.truncated=true;value.next='Use next offsets or event IDs for omitted records; inspect the sealed run for full text. Omitted evidence is not absent evidence.';
  const summary=value.latest??value;
  while(size()>max && summary.findings?.length){summary.findings.pop();summary.findingsOmitted++;summary.findingsNextOffset=(summary.findingsOffset??0)+summary.findings.length;}
  while(size()>max && value.attempts?.length>1){value.attempts.pop();value.attemptsOmitted++;value.nextOffset=value.offset+value.attempts.length;}
  while(size()>max && value.relations?.length){value.relations.pop();value.relationsOmitted++;value.nextOffset=(value.offset??0)+value.relations.length;}
  if(size()>max && summary.provenance)summary.provenance={coreVersion:CORE_VERSION,commandSha256:summary.provenance.commandSha256,omitted:true,next:'Full provenance remains in the sealed attempt record.'};
  if(size()>max && value.source?.excerpt)value.source.excerpt='[Excerpt omitted by response budget; use source navigation]';
  if(size()>max)fail('Query metadata exceeds response budget; request limit=1. Case and all attempt evidence are retained.');
  return value;
}
export async function queryCase(caseDir,{runId,eventId,limit=10,offset=0}={}){
  if(!Number.isInteger(limit)||limit<1||limit>50)fail('limit must be 1..50');if(!Number.isInteger(offset)||offset<0||offset>10000)fail('offset must be 0..10000');const {c}=await loadCase(caseDir);
  if(eventId&&!runId)fail('Event query requires run id');
  if(runId){const r=await getRun(caseDir,runId);if(eventId){identifier(eventId,'event id');if(!r.validity.valid)fail('Run integrity invalid; event navigation disabled');const event=r.capture.events.find(e=>e.id===eventId);if(!event)fail('Unknown event id in run');const source=event.source?r.sources.find(s=>s.path===event.source.path):null;const lines=source?.text.split('\n');const edges=r.capture.relations.filter(e=>e.from===eventId||e.to===eventId);return budgetOutput({kind:'agent-debug-event',version:1,caseId:c.id,runId,event,offset,limit,relations:edges.slice(offset,offset+limit).map(e=>({...e,reason:short(e.reason)})),relationsTotal:edges.length,relationsOmitted:Math.max(0,edges.length-Math.min(limit,Math.max(0,edges.length-offset))),nextOffset:offset+limit<edges.length?offset+limit:null,source:source?{path:source.path,sha256:source.sha256,currentSha256:source.currentSha256,freshness:source.freshness,line:event.source.line,startLine:Math.max(1,event.source.line-5),excerpt:lines.slice(Math.max(0,event.source.line-6),event.source.line+5).join('\n').slice(0,8000),excerptBounded:true}:null,validity:r.validity,freshness:r.freshness,limitations:shortList(r.limitations,16)});}
    return budgetOutput({kind:'agent-debug-run-summary',version:1,caseId:c.id,...summarizeRun(r,limit,offset)});
  }
  const attempts=[...c.attempts].reverse().slice(offset,offset+limit).map(a=>{const v=attemptView(a);return {id:v.id,status:v.status,startedAt:v.startedAt,finishedAt:v.finishedAt??null,issues:shortList(v.issues??[],4),exitCode:v.exitCode??null};});let latest=null;if(c.attempts.length)latest=summarizeRun(await getRun(caseDir,c.attempts.at(-1).id),limit,0);
  return budgetOutput({kind:'agent-debug-summary',version:1,id:c.id,operation:c.operation,root:c.root,startedAt:c.startedAt,deadlineAt:c.deadlineAt,budgetSeconds:c.budgetSeconds,remainingSeconds:remaining(c),attempts,offset,limit,attemptsTotal:c.attempts.length,attemptsOmitted:c.attempts.length-attempts.length,nextOffset:offset+limit<c.attempts.length?offset+limit:null,latest,limitations:NOTES});
}
function summarizeRun(r,limit,offset=0){const capture=r.capture;const hasPath=capture?.relations.some(e=>e.type==='captured-call'&&capture.events.find(v=>v.id===e.from)?.source&&capture.events.find(v=>v.id===e.to)?.source);const findings=capture?.findings??[],events=capture?.events??[];return {runId:r.attempt.id,status:r.attempt.status,validity:r.validity,freshness:r.freshness,verdict:hasPath&&capture.coverage.dropped===0?'supported-path':'insufficient-evidence',verdictMeaning:'Recorded path only; not a root-cause or improvement claim. Historical validity and current applicability are separate.',findings:findingsPage(findings,offset,limit),findingsOffset:offset,findingsTotal:findings.length,findingsOmitted:Math.max(0,findings.length-Math.min(limit,Math.max(0,findings.length-offset))),findingsNextOffset:offset+limit<findings.length?offset+limit:null,eventCount:events.length,eventIds:events.slice(offset,offset+limit).map(e=>e.id),eventsOmitted:Math.max(0,events.length-Math.min(limit,Math.max(0,events.length-offset))),eventsNextOffset:offset+limit<events.length?offset+limit:null,nextExperiment:nextSummary(capture?.nextExperiment),coverage:capture?{installed:shortList(capture.coverage.installed),dropped:capture.coverage.dropped,limitations:shortList(capture.coverage.limitations)}:null,costs:capture?.costs??{tokens:null,fee:null},limitations:shortList(r.limitations,16),provenance:provenanceSummary(r.attempt.provenance)};}
