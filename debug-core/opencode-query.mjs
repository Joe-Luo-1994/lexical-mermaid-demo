import {realpath,stat,readFile} from 'node:fs/promises';
import {relative,resolve,isAbsolute} from 'node:path';
import {queryCase} from './core.mjs';

function inside(root,path){const delta=relative(root,path);return delta!== '..'&&!delta.startsWith('../')&&!delta.startsWith('..\\')&&!isAbsolute(delta);}

// Read-only boundary for the OpenCode active project. This is not a host sandbox.
export async function queryLocationCase({location,casePath,runId,eventId,limit=5,offset=0}){
  if(typeof casePath!=='string'||!casePath)throw new Error('casePath is required');
  const root=await realpath(location);
  const caseDir=await realpath(resolve(root,casePath));
  if(!inside(root,caseDir))throw new Error('Case must be inside the active OpenCode project location');
  const manifest=await realpath(resolve(caseDir,'case.json'));
  if(!inside(caseDir,manifest))throw new Error('Case manifest must stay inside its case directory');
  if((await stat(manifest)).size>8*1024*1024)throw new Error('Case manifest exceeds the 8 MiB read limit');
  const parsed=JSON.parse(await readFile(manifest,'utf8'));
  if(typeof parsed.root!=='string')throw new Error('Missing case project root');
  const project=await realpath(parsed.root);
  if(!inside(root,project))throw new Error('Case project root must be inside the active OpenCode project location');
  const result=await queryCase(caseDir,{runId,eventId,limit,offset});
  const content=JSON.stringify(result);
  if(content.length>24000)throw new Error('Query exceeds the 24000-character tool response limit; use a smaller limit or a specific run/event through the local CLI');
  return content;
}
