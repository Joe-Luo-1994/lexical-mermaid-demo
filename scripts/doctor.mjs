// Read-only, no third-party dependencies, network, credential or config access.
import {existsSync,readFileSync} from 'node:fs';
import {dirname,resolve,join,delimiter} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
const errors=[],warnings=[];
if(Number(process.versions.node.split('.')[0])!==24) errors.push('需要 Node 24；請用既有管理器或隔離路徑切換當前 shell，不改全域預設。');
const packages=Object.entries({...pkg.dependencies,...pkg.devDependencies}).map(([name,expected])=>{
 let actual=null;try{actual=JSON.parse(readFileSync(join(root,'node_modules',name,'package.json'),'utf8')).version;}catch{}
 return {name,expected,actual,ok:actual===expected};
});
const missing=packages.filter(p=>p.actual===null),different=packages.filter(p=>p.actual!==null&&!p.ok);
if(missing.length) errors.push(`尚缺 ${missing.length} 個直接依賴：在核准網路/套件來源執行 npm ci；離線 cache 完整時可用 npm ci --offline。`);
if(different.length) errors.push(`版本不符：${different.map(p=>`${p.name} ${p.actual}（需要 ${p.expected}）`).join('、')}。依 lockfile 執行 npm ci，不升級依賴。`);
let playwrightBrowser;
try{const require=createRequire(import.meta.url);playwrightBrowser=require('playwright').chromium.executablePath();}catch{}
const candidates=[
 process.env.BROWSER_PATH,
 process.env.PROGRAMFILES&&join(process.env.PROGRAMFILES,'Google/Chrome/Application/chrome.exe'),
 process.env.LOCALAPPDATA&&join(process.env.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe'),
 process.env['PROGRAMFILES(X86)']&&join(process.env['PROGRAMFILES(X86)'],'Microsoft/Edge/Application/msedge.exe'),
 '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome',playwrightBrowser,
].filter(Boolean);
const browser=process.env.BROWSER_PATH ? (existsSync(process.env.BROWSER_PATH)?process.env.BROWSER_PATH:null) : candidates.find(p=>existsSync(p))??null;
if(!browser) warnings.push('未找到可用 browser executable；UI 尚未驗證。設定 BROWSER_PATH，或經網路政策允許後安裝鎖定的 Playwright Chromium。');
const findExecutable=(name)=> (process.env.PATH??'').split(delimiter).flatMap(dir=>(process.platform==='win32'?['.exe','.cmd','']:['']).map(ext=>join(dir,name+ext))).find(p=>existsSync(p))??null;
const openCode=process.env.OPENCODE_PATH??findExecutable('opencode');
if(!openCode) warnings.push('OpenCode 未在 PATH 找到；這是選用工具，CLI/工作台不需要它。版本與 Web 載入需另測。');
const result={ready:errors.length===0,root,platform:process.platform,architecture:process.arch,node:{version:process.version,path:process.execPath},git:findExecutable('git'),browser,openCode,packages,errors,warnings,network:'not tested',ui:'not tested',opencodeRuntime:'not tested'};
if(process.argv.includes('--json'))console.log(JSON.stringify(result,null,2));
else{
 console.log(`Editor Evidence 環境檢查（唯讀）\nNode ${process.version} · ${process.platform}/${process.arch}\n${root}`);
 console.log(`依賴：${packages.filter(p=>p.ok).length}/${packages.length} 符合鎖定版本\n瀏覽器：${browser??'未找到'}\nOpenCode：${openCode??'選用，尚未找到'}`);
 for(const error of errors)console.log('待處理：'+error);
 for(const warning of warnings)console.log('提示：'+warning);
 if(browser)console.log(`Browser 測試前，將 BROWSER_PATH 設為上列路徑（doctor 不修改環境變數）。`);
 console.log(errors.length?'完成待處理項目後重跑 doctor；受阻時可先跑 npm run demo:cli。':'依賴準備完成。下一步 npm run start；實際驗證另跑 npm run validate 與 npm test。');
 console.log('本檢查未測網路、UI、OpenCode runtime，不代表功能已通過。');
}
process.exitCode=errors.length?1:0;
