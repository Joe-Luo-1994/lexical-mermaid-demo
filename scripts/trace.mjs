import {mkdir,writeFile} from 'node:fs/promises';
import {openLab} from './browser.mjs';
const lab=await openLab();
try {
  const mode=process.argv[2]||'inline';
  const size=Number(process.argv[3]||80000);
  const count=Number(process.argv[4]||10);
  await lab.page.evaluate(async({mode,size,count})=>window.bench.prepare(mode,size,count),{mode,size,count});
  const events=[];
  lab.cdp.on('Tracing.dataCollected',({value})=>events.push(...value));
  await lab.cdp.send('Tracing.start',{categories:'devtools.timeline,blink.user_timing,v8.execute,disabled-by-default-devtools.timeline',transferMode:'ReportEvents'});
  await lab.page.evaluate(()=>window.bench.run());
  await lab.page.waitForFunction(()=>window.bench.getResult()!==null);
  const done=new Promise(resolve=>lab.cdp.once('Tracing.tracingComplete',resolve));
  await lab.cdp.send('Tracing.end');await done;
  await mkdir('results',{recursive:true});
  const path=`results/${mode}-${size}-${count}.trace.json`;
  await writeFile(path,JSON.stringify({traceEvents:events}));
  const start=events.find(e=>e.name.endsWith?.(':inject-start'));
  const end=events.find(e=>e.name.endsWith?.(':two-raf-after-insert'));
  const totals={};
  if(start&&end) for(const event of events) {
    if(event.pid!==start.pid||event.tid!==start.tid||event.ph!=='X'||!['Layout','UpdateLayoutTree','Paint'].includes(event.name)) continue;
    const duration=Math.max(0,Math.min(event.ts+event.dur,end.ts)-Math.max(event.ts,start.ts))/1000;
    totals[event.name]=(totals[event.name]||0)+duration;
  }
  await writeFile(`results/${mode}-${size}-${count}.trace-summary.json`,JSON.stringify({mode,size,count,traceOverhead:true,windowFound:!!(start&&end),mainThreadEventMs:totals,result:await lab.page.evaluate(()=>window.bench.getResult())},null,2));
  console.log(`Saved ${path}; import it in Chrome Performance.`,totals);
} finally {await lab.close();}
