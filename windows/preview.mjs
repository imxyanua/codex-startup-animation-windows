import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {serveLocal} from './http-local.mjs';

const root=dirname(dirname(fileURLToPath(import.meta.url)));

export function findEdge(){
  const env=process.env;
  const names=['msedge.exe','msedge'];
  const dirs=[
    join(env.ProgramFiles||'C:\\Program Files','Microsoft','Edge','Application'),
    join(env['ProgramFiles(x86)']||'C:\\Program Files (x86)','Microsoft','Edge','Application'),
    join(env.LOCALAPPDATA||'','Microsoft','Edge','Application')
  ];
  for(const dir of dirs){
    const file=join(dir,'msedge.exe');
    if(existsSync(file))return file;
  }
  return names[0];
}

export function previewArgs(url,{userDataDir,smoke=false,duration}={}){
  const page=new URL(url);
  page.searchParams.set('native','1');
  if(smoke)page.searchParams.set('smoke','1');
  if(duration)page.searchParams.set('duration',String(duration));
  const args=['--app='+page.href,'--no-first-run','--no-default-browser-check','--disable-extensions','--disable-features=Translate,MediaRouter'];
  if(userDataDir)args.unshift('--user-data-dir='+userDataDir);
  if(smoke)args.unshift('--headless=new','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0');
  return {href:page.href,args};
}

export async function main(argv=process.argv){
  const smoke=argv.includes('--smoke-test');
  const durationFlag=argv.indexOf('--duration');
  const duration=durationFlag>=0?Number(argv[durationFlag+1]):undefined;
  if(smoke){
    const {runSmoke}=await import('./smoke.mjs');
    const result=await runSmoke({root,edge:findEdge(),duration:Number.isFinite(duration)?duration:12000});
    console.log('ANIMATION COMPLETE');
    console.log('SMOKE RESULT: '+JSON.stringify(result));
    if(result.completed!=='true')process.exitCode=1;
    return result;
  }
  const server=await serveLocal(root);
  try{
    const profile=join(process.env.LOCALAPPDATA||root,'AemeathStartup','preview-profile');
    const {href,args}=previewArgs(server.url,{userDataDir:profile,duration});
    console.log(href);
    const child=spawn(findEdge(),args,{stdio:'ignore'});
    await new Promise((resolve,reject)=>{
      child.once('exit',resolve);
      child.once('error',reject);
    });
  }finally{
    await server.close();
  }
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  main().catch(error=>{console.error(error.message);process.exitCode=1;});
}
