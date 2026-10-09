import {execFile as rawExec} from 'node:child_process';
import {promisify} from 'node:util';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {buildInjection} from '../extension/payload.mjs';
import {connect,pageTarget,localSocket} from '../extension/cdp.mjs';
import {findCodexInstall,focusCodexWindow,launchOfficial,mainProcessCommandLines,quitCodex} from './codex-install.mjs';
import {assertLoopbackListener,assertSafeDebugArgs,commandLineHasDebugPort,debuggingArgs,executableBelongsToInstall,freePort,parseListeningAddresses,recoveryPlan} from './security.mjs';

const exec=promisify(rawExec);
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const powershell=process.env.SystemRoot?join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe'):'powershell.exe';

async function command(file,args,{timeout=15000}={}){
  return (await exec(file,args,{timeout,windowsHide:true,maxBuffer:1024*1024})).stdout.trim();
}

async function processOwner(pid){
  const script=`$o=Invoke-CimMethod -InputObject (Get-CimInstance Win32_Process -Filter "ProcessId=${pid}") -MethodName GetOwner -ErrorAction Stop; $o.User`;
  return command(powershell,['-NoProfile','-ExecutionPolicy','Bypass','-Command',script]);
}

export async function verifyListener(port,installRoot){
  const text=await command('netstat',['-ano','-p','TCP']);
  const pids=assertLoopbackListener(parseListeningAddresses(text,port),port);
  const currentUser=(process.env.USERNAME||'').toLowerCase();
  for(const pid of pids){
    try{
      const owner=await processOwner(pid);
      if(owner&&currentUser&&owner.toLowerCase()!==currentUser)throw new Error('端口所属用户不匹配');
    }catch(error){
      if(/端口所属用户不匹配/.test(error.message))throw error;
      throw new Error('无法确认调试端口所属用户');
    }
    const executable=await command(powershell,['-NoProfile','-ExecutionPolicy','Bypass','-Command',`(Get-Process -Id ${pid}).Path`]);
    if(!executableBelongsToInstall(executable,installRoot))throw new Error('调试端口不属于目标 Codex 应用');
  }
  return pids;
}

async function inject(port,source){
  const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(1200),redirect:'error'});
  if(!response.ok)throw new Error('调试页面尚未就绪');
  const targets=await response.json();if(!Array.isArray(targets))throw new Error('无效页面列表');
  const target=targets.find(pageTarget);if(!target)throw new Error('尚未找到主窗口');
  const client=await connect(localSocket(target.webSocketDebuggerUrl,port));
  try{
    await client.call('Page.bringToFront').catch(()=>{});
    const result=await client.call('Runtime.evaluate',{expression:source,returnByValue:true,awaitPromise:true});
    if(result.exceptionDetails||result.result?.value?.installed!==true)throw new Error('外观脚本未能加载');
    for(let attempt=0;attempt<50;attempt++){
      const answer=await client.call('Runtime.evaluate',{expression:'globalThis.__aemeathExtension?.status()',returnByValue:true});
      const state=answer.result?.value;
      if(state?.ready){
        await client.call('Page.bringToFront').catch(()=>{});
        return state;
      }
      if(state?.phase==='failed'||state?.phase==='timeout')throw new Error('动画素材加载失败，覆盖层已移除');
      await delay(100);
    }
    throw new Error('动画启动确认超时');
  }finally{client.close();}
}

export async function startWithDebugging(install,port){
  const args=assertSafeDebugArgs(debuggingArgs(port));
  await launchOfficial(install,args);
  const deadline=Date.now()+10000;
  while(Date.now()<deadline){
    const lines=await mainProcessCommandLines(install.executable);
    if(lines.some(line=>commandLineHasDebugPort(line,port)))return args;
    await delay(200);
  }
  throw new Error('官方应用未接受本机调试参数');
}

export async function fallbackLaunch(install,error,{launchedWithDebugging=false}={}){
  const plan=recoveryPlan(error,{launchedWithDebugging});
  if(plan.action==='launch-official'){
    try{await launchOfficial(install);}catch{}
  }
  return plan;
}

export async function main(argv=process.argv){
  const probe=argv.includes('--probe');
  const install=await findCodexInstall();
  if(probe){
    console.log(JSON.stringify({application:install.executable,kind:install.kind,version:install.version,running:install.running.map(item=>item.pid),node:install.node||null},null,2));
    return install;
  }
  if(install.running.length){
    console.log('Codex 正在运行，将先完全退出以便播放启动动画…');
    await quitCodex(install);
    install.running=[];
  }
  const source=await buildInjection(root);
  const port=await freePort();
  let launchedWithDebugging=false;
  try{
    await startWithDebugging(install,port);
    launchedWithDebugging=true;
    const deadline=Date.now()+45000;let lastError='等待 Codex 页面';
    const focusTick=setInterval(()=>focusCodexWindow(install).catch(()=>{}),800);
    try{
      while(Date.now()<deadline){
        try{
          await verifyListener(port,install.root);
          const state=await inject(port,source);
          await delay(400);
          const still=await mainProcessCommandLines(install.executable);
          if(!still.length)throw new Error('Codex 在动画注入后退出');
          await focusCodexWindow(install).catch(()=>{});
          console.log('已在 Codex 窗口开始播放。辅助进程现在退出；Ctrl+Alt+B 打开图片设置。');
          return {injected:true,port,install,state};
        }catch(error){lastError=error.message;}
        await delay(150);
      }
      throw new Error(lastError);
    }finally{
      clearInterval(focusTick);
    }
  }catch(error){
    const plan=await fallbackLaunch(install,error,{launchedWithDebugging});
    console.error(plan.message);
    process.exitCode=1;
    return plan;
  }
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  main().catch(error=>{console.error(error.message);process.exitCode=1;});
}
