// Runtime-only appearance layer. No writes to the installed application.
export function installRenderer(payload, mount) {
  if(window.top!==window)return {installed:false,reason:'child-frame'};
  if(window.__aemeathExtension)return {installed:true,alreadyActive:true};
  let frame=null,watchdog=0,observer=null,priorFocus=null,disposed=false;
  let ready=false,completed=false,phase='loading',wallpaperURL=null,lastImage=null;
  const root=document.documentElement;
  const before=new Map(['--aemeath-wallpaper','--aemeath-wash'].map(key=>[key,[root.style.getPropertyValue(key),root.style.getPropertyPriority(key)]]));
  const originalAttribute=root.getAttribute('data-aemeath-skin');
  const style=document.createElement('style');style.id='aemeath-extension-style';style.textContent=payload.skin;
  const asWallpaper=value=>{
    const image=typeof value==='string'?value.trim():'';
    return /^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(image)?image:'';
  };
  function removeOverlay(){
    clearTimeout(watchdog);observer?.disconnect();observer=null;
    frame?.remove();frame=null;
    if(priorFocus?.isConnected)priorFocus.focus();priorFocus=null;
  }
  function dispose(){
    if(disposed)return;disposed=true;removeOverlay();style.remove();
    if(wallpaperURL)URL.revokeObjectURL(wallpaperURL);wallpaperURL=null;lastImage=null;
    originalAttribute===null?root.removeAttribute('data-aemeath-skin'):root.setAttribute('data-aemeath-skin',originalAttribute);
    for(const [key,[value,priority]] of before)value?root.style.setProperty(key,value,priority):root.style.removeProperty(key);
    window.removeEventListener('message',message);window.removeEventListener('keydown',keyboard,true);
    delete window.__aemeathExtension;
  }
  function background(data){
    const blob=data.blob instanceof Blob?data.blob:null;
    const image=blob?'':asWallpaper(data.image);
    if(!blob&&!image)return;
    if(!style.isConnected)document.head.appendChild(style);
    const strength=Number.isFinite(data.strength)?Math.max(0,Math.min(75,data.strength)):42;
    const token=blob?('blob:'+blob.size+':'+blob.type):image;
    if(strength>0&&token!==lastImage){
      const previous=wallpaperURL;
      if(blob)wallpaperURL=URL.createObjectURL(blob);
      else {
        const comma=image.indexOf(','),mime=image.slice(5,image.indexOf(';'))||'image/jpeg';
        const bytes=Uint8Array.from(atob(image.slice(comma+1)),c=>c.charCodeAt(0));
        wallpaperURL=URL.createObjectURL(new Blob([bytes],{type:mime}));
      }
      lastImage=token;
      root.style.setProperty('--aemeath-wallpaper',`url(${JSON.stringify(wallpaperURL)})`);
      if(previous)URL.revokeObjectURL(previous);
    }
    if(strength===0){root.style.removeProperty('--aemeath-wallpaper');if(wallpaperURL)URL.revokeObjectURL(wallpaperURL);wallpaperURL=null;lastImage=null;}
    root.style.setProperty('--aemeath-wash',String(1-strength/100));
    root.toggleAttribute('data-aemeath-skin',strength>0);
  }
  function show(settings=false){
    if(disposed||frame)return;
    priorFocus=document.activeElement;phase=settings?'settings':'loading';
    frame=document.createElement('iframe');frame.id='aemeath-extension-overlay';frame.title='启动动画';
    Object.assign(frame.style,{position:'fixed',inset:'0',width:'100%',height:'100%',border:'0',zIndex:'2147483646',background:'transparent',colorScheme:'dark'});
    const current=frame;
    current.addEventListener('load',()=>{
      if(frame!==current||disposed)return;
      try{
        const win=current.contentWindow,doc=win.document;
        // No inline script, eval, network server, or CSP change is needed.
        doc.documentElement.innerHTML=payload.html;
        const css=doc.createElement('style');css.textContent=payload.css;doc.head.appendChild(css);
        win.AEMEATH_EXTERNAL=true;win.AEMEATH_ASSETS=payload.assets;win.AEMEATH_OPEN_SETTINGS=settings;
        // The function is compiled in the parent realm. A closure-bound bridge
        // preserves frame identity without weakening postMessage source checks.
        win.AEMEATH_SEND=data=>message({source:win,data});
        mount(win);current.focus();
        background({image:payload.assets?.artwork,strength:42});
      }catch(error){phase='failed';console.error('Aemeath extension:',error.message);removeOverlay();}
    },{once:true});
    current.src='about:blank';document.body.appendChild(current);
    watchdog=setTimeout(()=>{phase='timeout';removeOverlay();},25000);
  }
  function message(event){
    if(!frame||event.source!==frame.contentWindow||event.data?.type!=='aemeath-boot')return;
    const data=event.data;
    if(data.action==='background')background(data);
    if(data.action==='ready'){ready=true;phase='playing';}
    if(data.action==='complete'){completed=true;phase='complete';removeOverlay();}
    if(data.action==='assetError'){phase='failed';removeOverlay();}
    if(data.action==='settings-open'){phase='settings';clearTimeout(watchdog);}
    if(data.action==='settings-close'){phase='playing';watchdog=setTimeout(removeOverlay,25000);}
    if(data.action==='restore')dispose();
  }
  function keyboard(event){
    if((event.metaKey||event.ctrlKey)&&event.altKey&&event.code==='KeyB'){event.preventDefault();show(true);}
  }
  window.addEventListener('message',message);window.addEventListener('keydown',keyboard,true);
  window.__aemeathExtension={dispose,openSettings:()=>show(true),status:()=>({ready,completed,phase,overlay:!!frame,wallpaper:root.hasAttribute('data-aemeath-skin'),imageBytes:root.style.getPropertyValue('--aemeath-wallpaper').length})};
  if(document.body)show();
  else{observer=new MutationObserver(()=>{if(document.body){observer.disconnect();observer=null;show();}});observer.observe(document,{childList:true,subtree:true});}
  return {installed:true};
}

export function wallpaperDataUrl(value){
  const image=typeof value==='string'?value.trim():'';
  return /^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(image)?image:'';
}
