import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Schema} from 'effect';
import {Host} from '@opencode/plugin/host';
import {Config} from '@opencode/schema/config';
import plugin from './editor-evidence.ts';

const report={schemaVersion:1,id:'sdk-check',environment:{lexical:'0.18.0'},configuration:{mode:'inline'},metrics:{completionProxyMs:10},events:[{id:'e1',kind:'render',label:'render',start:0,duration:8}],diagrams:[],findings:[],limitations:['SDK helper test, not full server validation']};

test('actual v2 host resolves package directory and canonical configuration',()=>{
  const resolved=Host.resolve({directory:fileURLToPath(new URL('.',import.meta.url))});
  assert.ok(resolved.server.endsWith('/editor-evidence.ts'));
  const config=Schema.decodeUnknownSync(Config.Info)({plugins:['./docs/integrations'],mcp:{servers:{probe:{type:'local',command:['node','example.js'],disabled:true}}}});
  assert.equal(config.plugins[0],'./docs/integrations');
  assert.equal(config.mcp.servers.probe.disabled,true);
});

test('actual v2.2.5 Plugin API registers and executes a bounded read tool',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'evidence-plugin-'));
  let registered,disposed=false;
  try {
    await writeFile(join(directory,'recording.json'),JSON.stringify(report));
    const cleanup=await plugin.setup({location:{directory},tool:{transform:async callback=>{callback({add:tool=>{registered=tool;}});return {dispose:async()=>{disposed=true;}};}}});
    assert.equal(plugin.id,'editor-evidence');
    assert.equal(registered.name,'editor-evidence');
    assert.equal(registered.options.codemode,false);
    const args=Schema.decodeUnknownSync(registered.input)({file:'recording.json',eventId:'e1',limit:2});
    const result=await registered.execute(args,{});
    assert.equal(JSON.parse(result.content).event.id,'e1');
    const missing=await registered.execute({file:'recording.json',eventId:'missing'},{});
    assert.match(JSON.parse(missing.content).error,/not found/);
    const invalid=await registered.execute({file:'recording.json',limit:21},{});
    assert.match(JSON.parse(invalid.content).error,/limit/);
    assert.throws(()=>Schema.decodeUnknownSync(registered.input)({file:22}));
    await cleanup();assert.equal(disposed,true);
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('tool rejects outside-location files, including symlinks',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'evidence-plugin-root-'));
  const outside=await mkdtemp(join(tmpdir(),'evidence-plugin-outside-'));
  let registered;
  try {
    await writeFile(join(outside,'recording.json'),JSON.stringify(report));
    await symlink(join(outside,'recording.json'),join(directory,'link.json'));
    const cleanup=await plugin.setup({location:{directory},tool:{transform:async callback=>{callback({add:tool=>{registered=tool;}});return {dispose:async()=>{}};}}});
    for(const file of [join(outside,'recording.json'),'link.json']) {
      const result=await registered.execute({file},{});
      assert.match(JSON.parse(result.content).error,/inside the active/);
    }
    await cleanup();
  }finally{await rm(directory,{recursive:true,force:true});await rm(outside,{recursive:true,force:true});}
});
