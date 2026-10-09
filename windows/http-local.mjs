import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {extname} from 'node:path';
import {localStaticPath} from './security.mjs';

const types={
  '.html':'text/html; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg',
  '.png':'image/png',
  '.webp':'image/webp',
  '.svg':'image/svg+xml',
  '.ico':'image/x-icon'
};

export function serveLocal(root,{port=0}={}){
  const server=createServer(async(request,response)=>{
    try{
      if(request.method!=='GET'&&request.method!=='HEAD'){response.writeHead(405);response.end();return;}
      if(/(^|[\\/])\.\.([\\/]|$)/.test(request.url||'')){response.writeHead(403);response.end();return;}
      const url=new URL(request.url||'/','http://127.0.0.1');
      const relative=url.pathname==='/'?'index.html':url.pathname;
      const file=localStaticPath(root,relative);
      if(!file){response.writeHead(403);response.end();return;}
      const info=await stat(file);
      if(!info.isFile()){response.writeHead(404);response.end();return;}
      const body=request.method==='HEAD'?undefined:await readFile(file);
      response.writeHead(200,{'Content-Type':types[extname(file).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'});
      response.end(body);
    }catch{
      response.writeHead(404);response.end();
    }
  });
  return new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(port,'127.0.0.1',()=>{
      const address=server.address();
      if(!address||address.address!=='127.0.0.1'){
        server.close();
        reject(new Error('预览服务必须绑定 127.0.0.1'));
        return;
      }
      resolve({port:address.port,host:address.address,url:`http://127.0.0.1:${address.port}/`,close:()=>new Promise(done=>server.close(done))});
    });
  });
}
