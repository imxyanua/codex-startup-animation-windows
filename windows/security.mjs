import {createServer} from 'node:net';
import {sep} from 'node:path';

export async function freePort(){
  return new Promise((resolve,reject)=>{
    const server=createServer();
    server.on('error',reject);
    server.listen(0,'127.0.0.1',()=>{
      const port=server.address().port;
      if(server.address().address!=='127.0.0.1'){
        server.close();
        reject(new Error('端口必须绑定 127.0.0.1'));
        return;
      }
      server.close(error=>error?reject(error):resolve(port));
    });
  });
}

export function debuggingArgs(port){
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('调试端口无效');
  return [`--remote-debugging-address=127.0.0.1`,`--remote-debugging-port=${port}`];
}

export function commandLineHasDebugPort(commandLine,port){
  const line=String(commandLine||'');
  return line.includes('--remote-debugging-address=127.0.0.1')&&line.includes(`--remote-debugging-port=${port}`)&&!/\b0\.0\.0\.0\b/.test(line)&&!/\[::\]/.test(line);
}

export function assertSafeDebugArgs(args){
  const list=Array.isArray(args)?args:[];
  const text=list.join(' ');
  if(list.some(value=>/(0\.0\.0\.0|::)(?!\d)/.test(value))||/\b0\.0\.0\.0\b/.test(text)){
    throw new Error('拒绝在非回环地址上打开调试端口');
  }
  const address=list.find(value=>value.startsWith('--remote-debugging-address='));
  const port=list.find(value=>value.startsWith('--remote-debugging-port='));
  if(address!=='--remote-debugging-address=127.0.0.1')throw new Error('调试地址必须是 127.0.0.1');
  if(!port||!/^--remote-debugging-port=\d+$/.test(port))throw new Error('缺少本机调试端口');
  return list;
}

export function parseListeningAddresses(netstatText,port){
  const records=[];
  const line=new RegExp(String.raw`^\s*TCP\s+(\[::\]|\[::1\]|\d+\.\d+\.\d+\.\d+):${port}\s+\S+\s+LISTENING\s+(\d+)\s*$`,'gmi');
  let match;
  while((match=line.exec(netstatText)))records.push({address:match[1].replace(/^\[|\]$/g,''),pid:Number(match[2])});
  return records;
}

export function assertLoopbackListener(records,port){
  if(!records.length)throw new Error('调试端口没有处于监听状态');
  if(records.some(item=>item.address!=='127.0.0.1'))throw new Error('调试端口没有严格限定在 127.0.0.1，停止连接');
  if(records.some(item=>!Number.isInteger(item.pid)||item.pid<=0))throw new Error('无法确认调试端口所属进程');
  return [...new Set(records.map(item=>item.pid))];
}

export function normalizeWindowsPath(value){
  return String(value||'').replace(/^[\\/]+/,'').replace(/\//g,'\\').replace(/\\+$/,'');
}

export function executableBelongsToInstall(executable,installRoot){
  const exe=normalizeWindowsPath(executable).toLowerCase();
  const root=normalizeWindowsPath(installRoot).toLowerCase();
  if(!exe||!root)return false;
  return exe===root||exe.startsWith(root+sep.toLowerCase())||exe.startsWith(root+'\\');
}

export function isCodexMainProcess(commandLine,executable){
  const path=String(executable||'').replace(/\//g,'\\').toLowerCase();
  const args=String(commandLine||'');
  if(/\s--type=/.test(args))return false;
  if(path.endsWith('\\chatgpt.exe'))return true;
  if(!path.endsWith('\\codex.exe'))return false;
  if(path.includes('\\openai\\codex\\bin\\')||path.includes('\\resources\\codex.exe'))return false;
  return true;
}

export function isOpenAIPublisher(value){
  const text=String(value||'');
  return /OpenAI/i.test(text)||/50BDFD77-8903-4850-9FFE-6E8522F64D5B/i.test(text);
}

export function isCodexPackageIdentity(pkg){
  if(!pkg)return false;
  const name=String(pkg.Name||pkg.name||'');
  const family=String(pkg.PackageFamilyName||pkg.packageFamilyName||'');
  const publisher=String(pkg.Publisher||pkg.publisher||'');
  const display=String(pkg.DisplayName||pkg.displayName||'');
  const openai=isOpenAIPublisher(publisher)||isOpenAIPublisher(display);
  return openai&&(/OpenAI\.Codex/i.test(name)||/^OpenAI\.Codex_/i.test(family)||/Codex|ChatGPT/i.test(name));
}

export function localStaticPath(root,requestPath){
  const decoded=decodeURIComponent(String(requestPath||'/').split('?')[0]);
  const relative=normalizeWindowsPath(decoded).replace(/^\\+/,'');
  if(!relative||relative.split(/\\|\//).some(part=>part==='..'))return null;
  const base=normalizeWindowsPath(root).toLowerCase();
  const resolved=normalizeWindowsPath(root+(relative?('\\'+relative):'')).toLowerCase();
  if(resolved!==base&&!resolved.startsWith(base+'\\'))return null;
  return (root.replace(/[\\/]+$/,'')+(relative?'\\'+relative:'')).replace(/\//g,'\\');
}

export function recoveryPlan(error,{launchedWithDebugging=false}={}){
  const message=error instanceof Error?error.message:String(error||'接入失败');
  if(launchedWithDebugging){
    return {action:'keep-running',fallback:'official-startup',message:`本版本暂未完成接入：${message}。Codex 安装包未修改；完全退出后从原图标打开即可关闭调试端口。`};
  }
  return {action:'launch-official',fallback:'official-startup',message:`本版本暂未完成接入：${message}。将改用官方方式打开 Codex。`};
}
