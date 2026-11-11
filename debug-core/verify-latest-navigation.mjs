// CI convenience only: verify the case produced by verify-runtime immediately before this step.
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const result=JSON.parse(await readFile(new URL('../results/debug-runtime/latest.json',import.meta.url),'utf8'));
if(typeof result.caseDir!=='string'||typeof result.runId!=='string')throw new Error('Run verify-runtime.mjs first; latest.json has no case/run identity');
const child=spawn(process.execPath,[fileURLToPath(new URL('./verify-navigation.mjs',import.meta.url)),result.caseDir,result.runId],{stdio:'inherit'});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('exit',(code,signal)=>{process.exitCode=signal?1:code??1;});
