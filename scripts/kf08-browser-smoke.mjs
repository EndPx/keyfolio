import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
const dir='docs/evidence/KF-08/browser-smoke'; await mkdir(dir,{recursive:true});
const env={SystemRoot:process.env.SystemRoot,PATH:process.env.PATH,TEMP:process.env.TEMP,TMP:process.env.TMP,KEYFOLIO_MODE:'TESTNET',NEAR_NETWORK:'testnet',NEAR_RPC_URL:'https://rpc.testnet.near.org',DATABASE_URL:'postgres://synthetic:synthetic@127.0.0.1:1/synthetic',PROVIDER_BASE_URL:'https://provider.synthetic.example',ACCESS_CONTRACT_ID:'keyfolio-access.testnet',NEXT_PUBLIC_ACCESS_CONTRACT_ID:'keyfolio-access.testnet'};
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3459'],{cwd:'apps/web',env,stdio:'ignore'});
let browser; const output=[];
try {
 for(let i=0;i<60;i++){try{await fetch('http://127.0.0.1:3459');break}catch{await new Promise(r=>setTimeout(r,500));}}
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 for(const width of [1440,390]) for(const route of ['/checkout/carla','/keys','/studio']) {
 const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}); const page=await context.newPage(); const errors=[];
 page.on('pageerror',e=>errors.push('pageerror: '+e.message)); page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())}); page.on('requestfailed',r=>errors.push('requestfailed: '+r.url()+' '+r.failure()?.errorText));
 await page.goto('http://127.0.0.1:3459'+route,{waitUntil:'domcontentloaded',timeout:30000}); await page.waitForTimeout(12000);
 const body=await page.locator('body').innerText(); const buttons=await page.locator('button').evaluateAll(es=>es.map(e=>({text:e.innerText,disabled:e.disabled}))); const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
 await page.screenshot({path:`${dir}/${width}-${route.replaceAll('/','-').slice(1)}.png`,fullPage:true}); output.push({width,route,body,buttons,overflow,errors}); await context.close();
 }
 const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'}); const page=await context.newPage(); await page.route('**/api/rpc',r=>r.abort()); await page.goto('http://127.0.0.1:3459/checkout/carla'); await page.waitForTimeout(9000); output.push({scenario:'synthetic RPC blocked',body:await page.locator('body').innerText(),buttons:await page.locator('button').evaluateAll(es=>es.map(e=>({text:e.innerText,disabled:e.disabled})))}); await page.screenshot({path:`${dir}/blocked-rpc.png`,fullPage:true}); await context.close();
} catch(e){output.push({fatal:String(e)}); process.exitCode=1} finally {if(browser)await browser.close();server.kill();await writeFile(`${dir}/observations.json`,JSON.stringify(output,null,2));} 
