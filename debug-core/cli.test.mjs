import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,symlink,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {parseArgs} from './cli.mjs';
import {initCase} from './core.mjs';
import {queryLocationCase} from './opencode-query.mjs';

test('CLI rejects ambiguous actions and invalid budgets instead of silently resetting defaults',()=>{
  assert.throws(()=>parseArgs(['init','--case','x','--project','.','--operation','open','--budget','1801']),/budget/);
  assert.throws(()=>parseArgs(['query','--case','x','--event','e1']),/requires --run/);
  assert.throws(()=>parseArgs(['run','--case','x','--plan','p.json']),/COMMAND/);
  assert.throws(()=>parseArgs(['query','--case','x','--case','y']),/duplicate/);
  assert.throws(()=>parseArgs(['query','--case','x','--offset','NaN']),/integer/);
  const parsed=parseArgs(['run','--case','x','--plan','p.json','--','node','adapter.mjs','--flag']);
  assert.deepEqual(parsed.child,['node','adapter.mjs','--flag']);
});

test('OpenCode case query preserves active-project boundary, including case symlinks and external manifest roots',async()=>{
  const location=await mkdtemp(join(tmpdir(),'debug-location-'));
  const outside=await mkdtemp(join(tmpdir(),'debug-outside-'));
  try{
    const caseDir=join(location,'.debug-cases','case');
    await mkdir(join(location,'.debug-cases'));
    await initCase({caseDir,projectRoot:location,operation:'Open document',budgetSeconds:60});
    const content=await queryLocationCase({location,casePath:'.debug-cases/case'});
    assert.ok(JSON.parse(content));
    await assert.rejects(queryLocationCase({location,casePath:outside}),/inside the active/);
    const outsideCase=join(outside,'case');
    await initCase({caseDir:outsideCase,projectRoot:outside,operation:'Other project',budgetSeconds:60});
    await symlink(outsideCase,join(location,'linked'),process.platform==='win32'?'junction':'dir');
    await assert.rejects(queryLocationCase({location,casePath:'linked'}),/inside the active/);
    const manifest=JSON.parse(await readFile(join(caseDir,'case.json'),'utf8'));
    await writeFile(join(caseDir,'case.json'),JSON.stringify({...manifest,root:outside}));
    await assert.rejects(queryLocationCase({location,casePath:'.debug-cases/case'}),/project root must be inside/);
  }finally{await rm(location,{recursive:true,force:true});await rm(outside,{recursive:true,force:true});}
});
