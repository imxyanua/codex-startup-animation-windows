import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer,request as httpRequest} from 'node:http';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {
  assertLoopbackListener,assertSafeDebugArgs,commandLineHasDebugPort,debuggingArgs,executableBelongsToInstall,
  isCodexMainProcess,isCodexPackageIdentity,isOpenAIPublisher,localStaticPath,
  parseListeningAddresses,recoveryPlan,freePort
} from '../windows/security.mjs';
import {packagedExecutable,selectPackagedInstall,selectUnpackagedInstall,unpackagedCandidates} from '../windows/codex-install.mjs';
import {serveLocal} from '../windows/http-local.mjs';
import {previewPageTarget} from '../windows/smoke.mjs';
import {previewArgs} from '../windows/preview.mjs';

const require=createRequire(import.meta.url);
const {vectorize,imageKind}=require('../image-settings.js');
const {normalize:normalizeLocale,t:translate}=require('../locale.js');
const root=dirname(dirname(fileURLToPath(import.meta.url)));

test('调试参数只绑定 127.0.0.1',()=>{
  assert.deepEqual(debuggingArgs(9341),['--remote-debugging-address=127.0.0.1','--remote-debugging-port=9341']);
  assert.deepEqual(assertSafeDebugArgs(debuggingArgs(9341)),debuggingArgs(9341));
  assert.throws(()=>debuggingArgs(0));
  assert.throws(()=>assertSafeDebugArgs(['--remote-debugging-address=0.0.0.0','--remote-debugging-port=9341']));
  assert.throws(()=>assertSafeDebugArgs(['--remote-debugging-address=127.0.0.1','--remote-debugging-port=9341','--remote-debugging-address=::']));
  assert.equal(commandLineHasDebugPort('"ChatGPT.exe" --remote-debugging-address=127.0.0.1 --remote-debugging-port=62137',62137),true);
  assert.equal(commandLineHasDebugPort('"ChatGPT.exe" --remote-debugging-address=0.0.0.0 --remote-debugging-port=62137',62137),false);
  assert.equal(commandLineHasDebugPort('"ChatGPT.exe"',62137),false);
});

test('netstat 解析拒绝局域网和全接口监听',()=>{
  const ok='  TCP    127.0.0.1:9341         0.0.0.0:0              LISTENING       4242\r\n';
  assert.deepEqual(parseListeningAddresses(ok,9341),[{address:'127.0.0.1',pid:4242}]);
  assert.deepEqual(assertLoopbackListener(parseListeningAddresses(ok,9341),9341),[4242]);
  assert.throws(()=>assertLoopbackListener(parseListeningAddresses('  TCP    0.0.0.0:9341           0.0.0.0:0              LISTENING       4242\r\n',9341),9341));
  assert.throws(()=>assertLoopbackListener(parseListeningAddresses('  TCP    192.168.1.8:9341       0.0.0.0:0              LISTENING       4242\r\n',9341),9341));
  assert.throws(()=>assertLoopbackListener(parseListeningAddresses('  TCP    [::]:9341              [::]:0                 LISTENING       4242\r\n',9341),9341));
  assert.throws(()=>assertLoopbackListener([
    ...parseListeningAddresses(ok,9341),
    ...parseListeningAddresses('  TCP    0.0.0.0:9341           0.0.0.0:0              LISTENING       4242\r\n',9341)
  ],9341));
});

test('只接受安装目录内的 Codex 主进程',()=>{
  const rootPath='C:\\Program Files\\WindowsApps\\OpenAI.Codex_26.1002.7124.0_x64__2p2nqsd0c76g0';
  const exe=rootPath+'\\app\\ChatGPT.exe';
  assert.equal(executableBelongsToInstall(exe,rootPath),true);
  assert.equal(executableBelongsToInstall('C:\\Windows\\System32\\cmd.exe',rootPath),false);
  assert.equal(isCodexMainProcess('"'+exe+'"',exe),true);
  assert.equal(isCodexMainProcess('"'+exe+'" --type=renderer',exe),false);
  assert.equal(isCodexMainProcess('"C:\\Windows\\notepad.exe"', 'C:\\Windows\\notepad.exe'),false);
  assert.equal(isCodexMainProcess('"C:\\Users\\demo\\AppData\\Local\\OpenAI\\Codex\\bin\\abc\\codex.exe"','C:\\Users\\demo\\AppData\\Local\\OpenAI\\Codex\\bin\\abc\\codex.exe'),false);
});

test('识别 Store 包与 OpenAI 发布者，拒绝无关应用',()=>{
  assert.equal(isOpenAIPublisher('CN=50BDFD77-8903-4850-9FFE-6E8522F64D5B'),true);
  assert.equal(isOpenAIPublisher('CN="OpenAI OpCo, LLC", O="OpenAI OpCo, LLC"'),true);
  assert.equal(isOpenAIPublisher('CN=Contoso'),false);
  const pkg={Name:'OpenAI.Codex',PackageFamilyName:'OpenAI.Codex_2p2nqsd0c76g0',Publisher:'CN=50BDFD77-8903-4850-9FFE-6E8522F64D5B',Version:'26.1002.7124.0',InstallLocation:'C:\\Apps\\Codex'};
  assert.equal(isCodexPackageIdentity(pkg),true);
  assert.equal(isCodexPackageIdentity({Name:'Contoso.Notes',Publisher:'CN=Contoso'}),false);
  const install=selectPackagedInstall([pkg,{Name:'OpenAI.Codex',PackageFamilyName:'OpenAI.Codex_2p2nqsd0c76g0',Publisher:pkg.Publisher,Version:'26.0.0.0',InstallLocation:'C:\\Apps\\Old'}]);
  assert.equal(install.kind,'packaged');
  assert.equal(install.version,'26.1002.7124.0');
  assert.equal(install.executable,packagedExecutable(pkg.InstallLocation));
  assert.equal(install.aumid,'OpenAI.Codex_2p2nqsd0c76g0!App');
});

test('非固定路径：支持常见解包安装位置且校验发布者',()=>{
  const found=selectUnpackagedInstall([
    {DisplayName:'Other',Publisher:'Contoso',Path:'C:\\Other\\ChatGPT.exe'},
    {DisplayName:'Codex',Publisher:'OpenAI OpCo, LLC',Path:'D:\\Apps\\ChatGPT\\ChatGPT.exe'}
  ]);
  assert.equal(found.executable,'D:\\Apps\\ChatGPT\\ChatGPT.exe');
  assert.equal(selectUnpackagedInstall([{DisplayName:'ChatGPT',Publisher:'Contoso',Path:'C:\\Temp\\ChatGPT.exe'}]),null);
  const candidates=unpackagedCandidates({LOCALAPPDATA:'C:\\Users\\demo\\AppData\\Local',ProgramFiles:'C:\\Program Files','ProgramFiles(x86)':'C:\\Program Files (x86)'});
  assert.ok(candidates.some(path=>path.endsWith('Programs\\ChatGPT\\ChatGPT.exe')));
  assert.ok(!candidates.some(path=>path==='C:\\Codex\\ChatGPT.exe'));
});

test('接入失败时回退到官方启动，不修改安装包',()=>{
  const before=recoveryPlan(new Error('尚未找到主窗口'),{launchedWithDebugging:false});
  assert.equal(before.action,'launch-official');
  assert.equal(before.fallback,'official-startup');
  const after=recoveryPlan(new Error('调试端口不属于目标 Codex 应用'),{launchedWithDebugging:true});
  assert.equal(after.action,'keep-running');
  assert.match(after.message,/完全退出/);
});

test('本地静态资源禁止目录穿越',()=>{
  const base='D:\\codex-startup-animation';
  assert.equal(localStaticPath(base,'/index.html'),base+'\\index.html');
  assert.equal(localStaticPath(base,'/assets/avatar.jpg'),base+'\\assets\\avatar.jpg');
  assert.equal(localStaticPath(base,'/../windows/run.mjs'),null);
  assert.equal(localStaticPath(base,'/%2e%2e/windows/run.mjs'),null);
  assert.equal(localStaticPath(base,'/assets/../../windows/run.mjs'),null);
});

test('预览服务只绑定回环地址，并拒绝穿越请求',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'aemeath-http-'));
  await writeFile(join(dir,'index.html'),'<html>ok</html>');
  const server=await serveLocal(dir);
  try{
    assert.equal(server.host,'127.0.0.1');
    const ok=await fetch(server.url,{redirect:'error'});
    assert.equal(ok.status,200);
    assert.equal(await ok.text(),'<html>ok</html>');
    const denied=await new Promise((resolve,reject)=>{
      const req=httpRequest({host:'127.0.0.1',port:server.port,path:'/../windows/run.mjs'},res=>{resolve(res.statusCode);res.resume();});
      req.on('error',reject);req.end();
    });
    assert.equal(denied,403);
  }finally{
    await server.close();
    await rm(dir,{recursive:true,force:true});
  }
});

test('freePort 绑定 127.0.0.1',async()=>{
  const port=await freePort();
  assert.ok(port>0);
  await new Promise((resolve,reject)=>{
    const server=createServer();
    server.once('error',reject);
    server.listen(port,'127.0.0.1',()=>server.close(resolve));
  });
});

test('预览页筛选只接受本机动画页',()=>{
  const origin='http://127.0.0.1:8765';
  assert.equal(previewPageTarget({type:'page',url:origin+'/index.html?native=1'},origin),true);
  assert.equal(previewPageTarget({type:'page',url:'https://example.com/index.html'},origin),false);
  assert.equal(previewPageTarget({type:'page',url:origin+'/index.html'},'http://127.0.0.1:9'),false);
  const {args,href}=previewArgs('http://127.0.0.1:8765/',{duration:4000});
  assert.match(href,/native=1/);
  assert.match(href,/duration=4000/);
  assert.ok(args.some(value=>value.startsWith('--app=http://127.0.0.1:8765/')));
});

test('菜单支持中文和越南语',()=>{
  assert.equal(normalizeLocale('vi'),'vi');
  assert.equal(normalizeLocale('zh'),'zh');
  assert.equal(normalizeLocale('en'),'zh');
  assert.equal(translate('zh','settingsTitle'),'换成你喜欢的画面');
  assert.equal(translate('vi','settingsTitle'),'Đổi thành hình bạn thích');
  assert.equal(translate('vi','localeGroup'),'Ngôn ngữ giao diện');
  assert.equal(translate('vi','savePreview'),'Lưu và xem lại');
});

test('注入脚本包含语言选项和越南语词条',async()=>{
  const {buildInjection}=await import('../extension/payload.mjs');
  const source=await buildInjection(root);
  assert.match(source,/name=\\"locale\\"/);
  assert.match(source,/value=\\"vi\\"/);
  assert.match(source,/Tiếng Việt/);
  assert.match(source,/Đổi thành hình bạn thích/);
  assert.match(source,/aemeathI18n/);
});

test('导入图片认 MIME 和 Windows 空 type/.jpg',()=>{
  assert.equal(imageKind({type:'image/jpeg',name:'a.jpg'}),'jpeg');
  assert.equal(imageKind({type:'image/jpg',name:'a.jpg'}),'jpeg');
  assert.equal(imageKind({type:'',name:'nền.JPG'}),'jpeg');
  assert.equal(imageKind({type:'',name:'cat.jfif'}),'jpeg');
  assert.equal(imageKind({type:'image/png',name:'x.bin'}),'png');
  assert.equal(imageKind({type:'',name:'bg.webp'}),'webp');
  assert.equal(imageKind({type:'',name:'shot.bmp'}),'bmp');
  assert.equal(imageKind({type:'',name:'note.txt'}),'');
  assert.equal(imageKind({type:'application/pdf',name:'a.pdf'}),'');
});

test('自定义背景轮廓可从像素生成',()=>{
  const width=48,height=32,data=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=(y*width+x)*4,on=x>20&&x<28&&y>4&&y<28;
    data[i]=data[i+1]=data[i+2]=on?255:0;data[i+3]=255;
  }
  const paths=vectorize(data,width,height);
  assert.ok(paths.length>0);
  assert.ok(paths[0].length>=8);
  assert.equal(paths[0][0].length,2);
});

test('线稿轮廓跟随当前图片，而不是固定素材',()=>{
  const width=64,height=48;
  function bar(vertical){
    const data=new Uint8ClampedArray(width*height*4);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const i=(y*width+x)*4,on=vertical?(x>28&&x<36):(y>20&&y<28);
      data[i]=data[i+1]=data[i+2]=on?255:0;data[i+3]=255;
    }
    return vectorize(data,width,height);
  }
  const vertical=bar(true),horizontal=bar(false);
  assert.ok(vertical.length>0);
  assert.ok(horizontal.length>0);
  assert.notDeepEqual(vertical[0],horizontal[0]);
});

test('Ctrl+Alt+B 菜单可切换 tiếng Việt',async()=>{
  const {runSmoke}=await import('../windows/smoke.mjs');
  const {findEdge}=await import('../windows/preview.mjs');
  const result=await runSmoke({root,edge:findEdge(),duration:4000,lang:'vi',settings:true});
  assert.equal(result.locale,'vi');
  assert.equal(result.htmlLang,'vi');
  assert.equal(result.settingsOpen,true);
  assert.equal(result.settingsTitle,'Đổi thành hình bạn thích');
  assert.equal(result.saveLabel,'Lưu và xem lại');
  assert.equal(result.localeLabel,'Ngôn ngữ giao diện');
});

test('独立动画可用 Esc 跳过',async()=>{
  const {runSmoke}=await import('../windows/smoke.mjs');
  const {findEdge}=await import('../windows/preview.mjs');
  const result=await runSmoke({root,edge:findEdge(),duration:8000,skipAfter:1500});
  assert.equal(result.completed,'true');
  assert.ok(Number(result.imageWidth)>0);
  assert.ok(Number(result.avatarWidth)>0);
});

test('检测本机已安装的官方 Codex 包',async()=>{
  const {findCodexInstall}=await import('../windows/codex-install.mjs');
  const install=await findCodexInstall();
  assert.equal(install.kind,'packaged');
  assert.match(install.family,/OpenAI\.Codex_/);
  assert.ok(install.executable.toLowerCase().endsWith('\\app\\chatgpt.exe'));
  assert.equal(executableBelongsToInstall(install.executable,install.root),true);
});
