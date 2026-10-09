import {execFile as rawExec} from 'node:child_process';
import {promisify} from 'node:util';
import {access,readdir} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {executableBelongsToInstall,isCodexMainProcess,isCodexPackageIdentity,isOpenAIPublisher} from './security.mjs';

const exec=promisify(rawExec);
const powershell=process.env.SystemRoot?join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe'):'powershell.exe';

async function command(file,args,{timeout=20000}={}){
  return (await exec(file,args,{timeout,windowsHide:true,maxBuffer:2*1024*1024})).stdout.trim();
}

function parseJson(text,fallback){
  if(!text)return fallback;
  try{return JSON.parse(text);}catch{return fallback;}
}

async function exists(file){
  try{await access(file,constants.F_OK);return true;}catch{return false;}
}

export async function powershellJson(script){
  const output=await command(powershell,['-NoProfile','-STA','-ExecutionPolicy','Bypass','-Command',script]);
  return parseJson(output,null);
}

export function packagedExecutable(installLocation){
  const root=String(installLocation||'').replace(/[\\/]+$/,'');
  return root?join(root,'app','ChatGPT.exe'):'';
}

export function unpackagedCandidates(env=process.env){
  const local=env.LOCALAPPDATA||join(homedir(),'AppData','Local');
  const program=env.ProgramFiles||'C:\\Program Files';
  const x86=env['ProgramFiles(x86)']||'C:\\Program Files (x86)';
  const names=['ChatGPT\\ChatGPT.exe','Codex\\ChatGPT.exe','Codex\\Codex.exe','chat gpt\\ChatGPT.exe'];
  return [...new Set([local,program,x86].flatMap(base=>names.map(name=>join(base,'Programs',name))))];
}

export async function findBundledNode(installRoot){
  const direct=join(installRoot,'app','resources','cua_node','bin','node.exe');
  if(await exists(direct))return direct;
  const unpacked=join(process.env.LOCALAPPDATA||join(homedir(),'AppData','Local'),'OpenAI','Codex','runtimes','cua_node');
  try{
    const versions=await readdir(unpacked, {withFileTypes:true});
    for(const entry of versions){
      const node=join(unpacked,entry.name,'bin','node.exe');
      if(entry.isDirectory()&&await exists(node))return node;
    }
  }catch{}
  return null;
}

function asArray(value){return value==null?[]:Array.isArray(value)?value:[value];}

export function selectPackagedInstall(packages){
  const list=(Array.isArray(packages)?packages:[packages]).filter(Boolean).filter(isCodexPackageIdentity);
  const chosen=list.sort((a,b)=>String(b.Version||'').localeCompare(String(a.Version||''),undefined,{numeric:true}))[0];
  if(!chosen)return null;
  const root=String(chosen.InstallLocation||'').replace(/[\\/]+$/,'');
  const executable=packagedExecutable(root);
  return {
    kind:'packaged',
    name:chosen.Name,
    family:chosen.PackageFamilyName,
    aumid:`${chosen.PackageFamilyName}!App`,
    publisher:chosen.Publisher,
    version:String(chosen.Version||''),
    root,
    executable
  };
}

export function selectUnpackagedInstall(entries){
  for(const entry of entries||[]){
    const executable=String(entry.InstallLocation?join(entry.InstallLocation,'ChatGPT.exe'):(entry.DisplayIcon||entry.Path||'')).replace(/"+/g,'').split(',')[0];
    const company=entry.Publisher||entry.CompanyName||'';
    const product=entry.DisplayName||entry.ProductName||'';
    if(!/ChatGPT\.exe$|Codex\.exe$/i.test(executable))continue;
    if(!isOpenAIPublisher(company)&&!isOpenAIPublisher(product))continue;
    const root=executable.replace(/\\app\\ChatGPT\.exe$/i,'').replace(/\\ChatGPT\.exe$/i,'').replace(/\\Codex\.exe$/i,'');
    return {kind:'unpackaged',name:product||'Codex',publisher:company,version:String(entry.DisplayVersion||''),root,executable};
  }
  return null;
}

async function runningCodex(){
  const list=asArray(await powershellJson(`Get-CimInstance Win32_Process -Filter "Name='ChatGPT.exe' OR Name='Codex.exe'" | Select-Object ProcessId,Name,ExecutablePath,CommandLine | ConvertTo-Json -Compress`));
  return list.filter(item=>item&&item.ExecutablePath&&isCodexMainProcess(item.CommandLine,item.ExecutablePath)).map(item=>({pid:Number(item.ProcessId),path:item.ExecutablePath,commandLine:item.CommandLine}));
}

async function authenticodePublisher(executable){
  const data=await powershellJson(`$s=Get-AuthenticodeSignature -LiteralPath ${JSON.stringify(executable)}; @{Status=[string]$s.Status; Subject=$s.SignerCertificate.Subject; Publisher=$s.SignerCertificate.Subject} | ConvertTo-Json -Compress`);
  return data||{};
}

export async function verifyInstallIdentity(install){
  if(!install?.executable||!await exists(install.executable))throw new Error('没有找到官方 Codex / ChatGPT 应用。');
  if(install.kind==='packaged'){
    if(!isCodexPackageIdentity({Name:install.name,PackageFamilyName:install.family,Publisher:install.publisher}))throw new Error('应用标识不匹配');
    return install;
  }
  const signature=await authenticodePublisher(install.executable);
  if(!isOpenAIPublisher(signature.Subject||signature.Publisher))throw new Error('未识别为预期的 OpenAI 签名，停止启动');
  return install;
}

export async function findCodexInstall(){
  const packages=asArray(await powershellJson(`Get-AppxPackage | Where-Object { $_.Name -match 'Codex|ChatGPT' -or $_.PackageFamilyName -like 'OpenAI.Codex_*' } | Select-Object Name,PackageFullName,PackageFamilyName,Publisher,Version,InstallLocation | ConvertTo-Json -Compress`));
  const packaged=selectPackagedInstall(packages);
  if(packaged&&await exists(packaged.executable)){
    packaged.node=await findBundledNode(packaged.root);
    packaged.running=await runningCodex();
    return verifyInstallIdentity(packaged);
  }
  const uninstall=asArray(await powershellJson(`$keys=@('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'); Get-ItemProperty $keys -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -match 'Codex|ChatGPT' } | Select-Object DisplayName,DisplayVersion,InstallLocation,DisplayIcon,Publisher | ConvertTo-Json -Compress`));
  const fromRegistry=selectUnpackagedInstall(uninstall);
  const files=(await Promise.all(unpackagedCandidates().map(async path=>({Path:path,exists:await exists(path)})))).filter(item=>item.exists).map(item=>({Path:item.Path,DisplayName:'Codex',Publisher:'OpenAI'}));
  const unpackaged=fromRegistry||selectUnpackagedInstall(files);
  if(!unpackaged)throw new Error('没有找到已安装的 Codex / ChatGPT 桌面应用。');
  unpackaged.node=await findBundledNode(unpackaged.root);
  unpackaged.running=await runningCodex();
  return verifyInstallIdentity(unpackaged);
}

export async function activateCodex(install){
  if(install.aumid){
    await command(powershell,['-NoProfile','-ExecutionPolicy','Bypass','-Command',`Start-Process "shell:AppsFolder\\${install.aumid}"`]);
    return;
  }
  await command(powershell,['-NoProfile','-ExecutionPolicy','Bypass','-Command',`$p=Get-Process | Where-Object { $_.Path -eq ${JSON.stringify(install.executable)} -and $_.MainWindowHandle -ne 0 } | Select-Object -First 1; if($p){ Add-Type -Name W -Namespace N -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h); [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int n);'; [N.W]::ShowWindow($p.MainWindowHandle,9); [N.W]::SetForegroundWindow($p.MainWindowHandle) } else { Start-Process -FilePath ${JSON.stringify(install.executable)} }`]);
}

export async function launchOfficial(install,args=[]){
  if(args.length){
    // Store/MSIX 需要把 Chromium 开关写进进程命令行；直接启动 exe 才能带上 127.0.0.1 调试端口。
    const quoted=args.map(value=>`'${String(value).replace(/'/g,"''")}'`).join(',');
    await command(powershell,['-NoProfile','-ExecutionPolicy','Bypass','-Command',`Start-Process -FilePath ${JSON.stringify(install.executable)} -ArgumentList @(${quoted})`]);
    return;
  }
  const {spawn}=await import('node:child_process');
  const child=spawn(install.executable,[],{detached:true,stdio:'ignore',windowsHide:false});
  child.unref();
  return child.pid;
}

export async function mainProcessCommandLines(executable){
  const rows=asArray(await powershellJson(`Get-CimInstance Win32_Process -Filter "Name='ChatGPT.exe' OR Name='Codex.exe'" | Select-Object ProcessId,ExecutablePath,CommandLine | ConvertTo-Json -Compress`));
  const target=String(executable||'').toLowerCase();
  return rows.filter(item=>item&&String(item.ExecutablePath||'').toLowerCase()===target&&isCodexMainProcess(item.CommandLine,item.ExecutablePath)).map(item=>String(item.CommandLine||''));
}

export {executableBelongsToInstall};
