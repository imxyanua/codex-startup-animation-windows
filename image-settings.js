/* Local image import and one-time contour tracing. No network or app privileges. */
(function (scope) {
  'use strict';
  function vectorize(rgba, width, height) {
    const count=width*height, gray=new Float32Array(count), mag=new Float32Array(count), angle=new Uint8Array(count), edge=new Uint8Array(count);
    for(let i=0;i<count;i++)gray[i]=rgba[i*4]*.299+rgba[i*4+1]*.587+rgba[i*4+2]*.114;
    for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
      const i=y*width+x;
      const gx=-gray[i-width-1]+gray[i-width+1]-2*gray[i-1]+2*gray[i+1]-gray[i+width-1]+gray[i+width+1];
      const gy=-gray[i-width-1]-2*gray[i-width]-gray[i-width+1]+gray[i+width-1]+2*gray[i+width]+gray[i+width+1];
      mag[i]=Math.hypot(gx,gy);
      const a=(Math.atan2(gy,gx)*180/Math.PI+180)%180;
      angle[i]=a<22.5||a>=157.5?0:a<67.5?1:a<112.5?2:3;
    }
    const pairs=[[1,-1],[width+1,-width-1],[width,-width],[width-1,-width+1]];
    for(let y=2;y<height-2;y++)for(let x=2;x<width-2;x++){
      const i=y*width+x,[a,b]=pairs[angle[i]];
      if(mag[i]>32&&mag[i]>=mag[i+a]&&mag[i]>mag[i+b])edge[i]=1;
    }
    const neighbors=[-width-1,-width,-width+1,-1,1,width-1,width,width+1];
    const visited=new Uint8Array(count), paths=[];
    function walk(start){
      let current=start,previous=-1;const points=[];
      while(current>=0&&!visited[current]){
        visited[current]=1;points.push([current%width,Math.floor(current/width)]);
        let next=-1,best=-Infinity;
        for(const d of neighbors){const n=current+d;if(n<0||n>=count||!edge[n]||visited[n])continue;
          const dx=n%width-current%width,dy=Math.floor(n/width)-Math.floor(current/width);
          const score=previous<0?mag[n]:dx*(current%width-previous%width)+dy*(Math.floor(current/width)-Math.floor(previous/width));
          if(score>best){best=score;next=n;}
        }
        previous=current;current=next;
      }
      if(points.length>=8)paths.push(points.filter((_,i)=>i%2===0||i===points.length-1).map(([x,y])=>[Math.round(x*1536/width),Math.round(y*1024/height)]));
    }
    // Start at endpoints first, then trace the remaining closed loops.
    for(let i=0;i<count;i++)if(edge[i]&&!visited[i]&&neighbors.reduce((n,d)=>n+(edge[i+d]||0),0)<=1)walk(i);
    for(let i=0;i<count;i++)if(edge[i]&&!visited[i])walk(i);
    return paths.sort((a,b)=>b.length-a.length).slice(0,1200);
  }
  function imageKind(file){
    const type=String(file&&file.type||'').toLowerCase();
    const name=String(file&&file.name||'').toLowerCase();
    if(type==='image/jpeg'||type==='image/jpg'||type==='image/pjpeg'||/\.(jpe?g|jfif)$/.test(name))return 'jpeg';
    if(type==='image/png'||/\.png$/.test(name))return 'png';
    if(type==='image/webp'||/\.webp$/.test(name))return 'webp';
    if(type==='image/gif'||/\.gif$/.test(name))return 'gif';
    if(type==='image/bmp'||type==='image/x-ms-bmp'||/\.bmp$/.test(name))return 'bmp';
    if(type==='image/avif'||/\.avif$/.test(name))return 'avif';
    return '';
  }
  function traceImage(img){
    try{
      if(!img||!img.naturalWidth)return [];
      const small=document.createElement('canvas');
      small.width=768;small.height=512;
      const ctx=small.getContext('2d',{willReadFrequently:true});
      ctx.fillStyle='#08060d';
      ctx.fillRect(0,0,768,512);
      ctx.drawImage(img,0,0,768,512);
      return vectorize(ctx.getImageData(0,0,768,512).data,768,512);
    }catch{
      return [];
    }
  }
  if(typeof module!=='undefined') {module.exports={vectorize,traceImage,imageKind};return;}
  function text(code,fallback){
    const i18n=scope.aemeathI18n;
    return i18n?i18n.t(scope.imageSettings&&scope.imageSettings.locale,code):fallback;
  }
  async function database(action,value){
    return new Promise((resolve,reject)=>{
      const open=indexedDB.open('aemeath-startup-images',1);
      open.onupgradeneeded=()=>open.result.createObjectStore('settings');
      open.onerror=()=>reject(open.error);
      open.onsuccess=()=>{
        const db=open.result,tx=db.transaction('settings',action==='read'?'readonly':'readwrite'),store=tx.objectStore('settings');
        const request=action==='read'?store.get('images'):store.put(value,'images');
        tx.oncomplete=()=>{db.close();resolve(action==='read'?request.result||{}:value);};
        tx.onerror=tx.onabort=()=>{db.close();reject(tx.error||new Error(text('saveFailed','保存失败')));};
      };
    });
  }
  async function importImage(file,kind){
    if(file.size>30*1024*1024)throw new Error(text('fileTooLarge','请选择小于 30 MB 的图片。'));
    if(!imageKind(file))throw new Error(text('fileType','请选择 PNG、JPEG、WebP、GIF、BMP 或 AVIF 图片。'));
    const url=URL.createObjectURL(file),img=new Image();
    try{
      img.src=url;await img.decode();
      const canvas=document.createElement('canvas');canvas.width=kind==='avatar'?512:1536;canvas.height=kind==='avatar'?512:1024;
      const ctx=canvas.getContext('2d');ctx.fillStyle='#08060d';ctx.fillRect(0,0,canvas.width,canvas.height);
      const scale=Math.max(canvas.width/img.naturalWidth,canvas.height/img.naturalHeight);
      const w=img.naturalWidth*scale,h=img.naturalHeight*scale;
      ctx.drawImage(img,(canvas.width-w)/2,(canvas.height-h)/2,w,h);
      const image=canvas.toDataURL('image/jpeg',kind==='avatar'?0.92:0.85);
      if(kind==='avatar')return {avatar:image};
      return {artwork:image,contours:undefined};
    }catch(error){throw new Error(error.message||text('unreadable','图片无法读取，请换一张图片。'));}
    finally{URL.revokeObjectURL(url);}
  }
  scope.imageSettings={load:()=>database('read'),save:images=>database('write',images),importImage,traceImage,locale:'zh'};
})(typeof window==='undefined'?{}:window);
