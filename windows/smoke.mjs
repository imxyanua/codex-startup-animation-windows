import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {connect,localSocket} from '../extension/cdp.mjs';
import {serveLocal} from './http-local.mjs';
import {assertLoopbackListener,debuggingArgs,freePort,parseListeningAddresses} from './security.mjs';
import {findEdge} from './preview.mjs';
import {execFile as rawExec} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const exec=promisify(rawExec);

export function previewPageTarget(target,origin){
  try{
    const url=new URL(target.url);
    return target.type==='page'&&url.origin===origin&&(url.pathname==='/'||url.pathname.endsWith('/index.html'));
  }catch{return false;}
}

async function waitForListener(port){
  const deadline=Date.now()+15000;
  let last='等待预览调试端口';
  while(Date.now()<deadline){
    try{
      const text=(await exec('netstat',['-ano','-p','TCP'],{windowsHide:true,timeout:8000})).stdout;
      assertLoopbackListener(parseListeningAddresses(text,port),port);
      return;
    }catch(error){last=error.message;}
    await delay(150);
  }
  throw new Error(last);
}

export async function runSmoke({root,url,edge,duration=12000,skipAfter=0}={}){
  const server=url?null:await serveLocal(root);
  const page=new URL(url||server.url);
  page.searchParams.set('native','1');
  page.searchParams.set('smoke','1');
  if(duration!==12000)page.searchParams.set('duration',String(duration));
  const port=await freePort();
  const profile=await mkdtemp(join(tmpdir(),'aemeath-smoke-'));
  const browser=spawn(edge||findEdge(),[
    ...debuggingArgs(port),
    '--remote-allow-origins=http://127.0.0.1',
    '--headless=new',
    '--no-first-run',
    '--disable-extensions',
    '--disable-gpu',
    '--user-data-dir='+profile,
    page.href
  ],{stdio:'ignore',windowsHide:true});
  try{
    await waitForListener(port);
    const origin=page.origin;
    const started=Date.now();
    const deadline=started+Math.max(20000,duration+8000);
    let lastError='等待动画页面';
    let skipped=false;
    while(Date.now()<deadline){
      let client;
      try{
        const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(1200),redirect:'error'});
        if(!response.ok)throw new Error('调试页面尚未就绪');
        const targets=await response.json();
        const target=targets.find(item=>previewPageTarget(item,origin));
        if(!target)throw new Error('尚未找到预览窗口');
        client=await connect(localSocket(target.webSocketDebuggerUrl,port));
        if(skipAfter&&!skipped&&Date.now()-started>=skipAfter){
          skipped=true;
          await client.call('Runtime.evaluate',{expression:'window.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))',returnByValue:true});
        }
        const result=await client.call('Runtime.evaluate',{expression:`(()=>{const root=document.querySelector('.window');return root?{elapsed:root.dataset.elapsed,playing:root.dataset.playing,completed:root.dataset.completed,stage:root.dataset.stage,imageWidth:document.querySelector('.artwork')?.naturalWidth,avatarWidth:document.querySelector('.avatar')?.naturalWidth,trace:document.querySelector('.line-art')?.dataset}:null})()`,returnByValue:true});
        const value=result.result?.value;
        if(value?.completed==='true')return value;
        lastError=value?'动画尚未结束':'页面尚未就绪';
      }catch(error){lastError=error.message;}
      finally{client?.close();}
      await delay(200);
    }
    throw new Error('SMOKE FAIL: '+lastError);
  }finally{
    try{await exec('taskkill',['/PID',String(browser.pid),'/T','/F'],{windowsHide:true});}catch{try{browser.kill();}catch{}}
    if(server)await server.close();
    await rm(profile,{recursive:true,force:true}).catch(()=>{});
  }
}
