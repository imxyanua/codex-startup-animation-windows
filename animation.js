(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const authoredDuration = 12000;
  const duration = authoredDuration;
  const params = new URLSearchParams(location.search);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const native = !window.AEMEATH_EXTERNAL && (Boolean(window.webkit?.messageHandlers?.launcher) || params.has('native'));
  const embedded = window.parent!==window && (window.AEMEATH_EXTERNAL || params.has('embedded'));
  const clampDuration = (value,min=6000) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(min, Math.min(20000, Math.round(n))) : authoredDuration;
  };
  let playbackDuration = params.has('duration') ? clampDuration(params.get('duration'), 3000) : authoredDuration;
  const allowedEffect = {classic:1,seeklight:1,ripple:1,veil:1,holo:1};
  const normalizeEffect = value => value==='iris'?'seeklight':(allowedEffect[value] ? value : 'seeklight');
  let introEffect = normalizeEffect(params.get('intro')||params.get('effect'));
  let revealEffect = normalizeEffect(params.get('reveal')||params.get('effect'));
  let soundOn = params.get('sound')!=='0';
  const i18n = window.aemeathI18n || {normalize: value => value === 'vi' ? 'vi' : 'zh', t: (_, key) => key};
  const normalizeLocale = value => i18n.normalize(value);
  let locale = normalizeLocale(params.get('lang') || params.get('locale'));
  const t = key => i18n.t(locale, key);
  const accentApi = window.aemeathAccent || {normalize: value => value === 'custom' || value === 'frost' || value === 'amber' ? value : 'rose', parseHex: value => /^#?[0-9a-f]{6}$/i.test(String(value||'')) ? '#'+String(value).replace('#','').toLowerCase() : '', resolve: () => ({preset:'rose',accent:'#e9a8bf',line:'#c8c0cd',hud:'#fce9f0',glow:'#ee96bc',cool:'#8cc3cd'})};
  const normalizeAccent = value => accentApi.normalize(value);
  const parseAccentHex = value => accentApi.parseHex ? accentApi.parseHex(value) : '';
  const resolveAccent = (name, color) => accentApi.resolve(name, color);
  function accentPaint(name, fallback) {
    return getComputedStyle(root).getPropertyValue(name).trim() || fallback;
  }
  function applyAccent(images) {
    const pack = resolveAccent(images && images.accent, images && images.accentColor);
    root.style.setProperty('--accent', pack.accent);
    root.style.setProperty('--accent-line', pack.line);
    root.style.setProperty('--accent-hud', pack.hud);
    root.style.setProperty('--accent-glow', pack.glow);
    root.style.setProperty('--accent-cool', pack.cool);
    root.dataset.accent = pack.preset;
    lastTrace = -1;
    const customSwatch = $('.accent-swatch-custom');
    if (customSwatch) customSwatch.style.background = pack.preset === 'custom' ? pack.accent : '';
  }
  let skippedFinish = false;
  const assets=window.AEMEATH_ASSETS||{artwork:'assets/artwork.jpg',avatar:'assets/avatar.jpg'};
  if(embedded)document.body.classList.add('embedded');
  const root = $('.window'), art = $('.artwork'), scene = $('.scene');
  root.dataset.effect = introEffect;
  root.dataset.intro = introEffect;
  root.dataset.reveal = revealEffect;
  root.dataset.locale = locale;
  const hud = $('.hud'), intro = $('.intro'), sweep = $('.light-sweep');
  const slider = $('#timeline'), pause = $('#pause'), subtitle = $('.subtitle');
  let liveArtworkUrl='',liveArtworkKey='';
  function artworkSource(images){
    const key=images&&images.artworkBlob instanceof Blob?('blob:'+images.artworkBlob.size+':'+images.artworkBlob.type):(images&&images.artwork)||'';
    if(key&&key===liveArtworkKey&&liveArtworkUrl)return liveArtworkUrl;
    if(liveArtworkUrl){URL.revokeObjectURL(liveArtworkUrl);liveArtworkUrl='';liveArtworkKey='';}
    if(images&&images.artworkBlob instanceof Blob){
      liveArtworkUrl=URL.createObjectURL(images.artworkBlob);
      liveArtworkKey=key;
      return liveArtworkUrl;
    }
    return (images&&images.artwork)||assets.artwork;
  }
  function artMotionOpacity(color,assembling){
    if(root.dataset.animated!=='1')return color;
    return Math.max(color,clamp(assembling)*0.34);
  }
  slider.max=String(duration/1000);
  let playing = false, elapsed = 0, origin = 0, frame = 0, lastUI = -Infinity;
  let completed = false, hiddenPause = false, mode = 'preview', loaded = false, revealed = false;
  const clamp = n => Math.max(0, Math.min(1, n));
  const smooth = n => { const t = clamp(n); return t*t*(3-2*t); };
  const send = (action, details={}) => {
    if(window.webkit?.messageHandlers?.launcher)window.webkit.messageHandlers.launcher.postMessage(action);
    if(window.chrome?.webview?.postMessage)window.chrome.webview.postMessage(action);
    if(embedded){const data={type:'aemeath-boot',action,...details};if(window.AEMEATH_EXTERNAL)window.AEMEATH_SEND(data);else window.parent.postMessage(data,'*');}
  };
  const particles = Array.from({length: reduced ? 0 : 14}, (_, i) => {
    const node = document.createElement('i'); node.className = 'particle';
    const size = i % 4 === 0 ? 3 : 1.5;
    Object.assign(node.style, {width:`${size}px`,height:`${size}px`,left:`${(i*37+7)%100}%`,top:`${(i*23+17)%100}%`});
    $('.particles').appendChild(node); return node;
  });
  const stars = Array.from({length: reduced ? 0 : 28}, (_, i) => {
    const node = document.createElement('i'); node.className = 'star';
    const size = i % 5 === 0 ? 2.4 : 1.1;
    Object.assign(node.style, {width:`${size}px`,height:`${size}px`,left:`${(i*47+13)%100}%`,top:`${(i*29+9)%100}%`});
    $('.starfield').appendChild(node); return node;
  });
  const milestones = [[0,0],[.12,.06],[.35,.41],[.56,.76],[.66,.924],[.72,.97],[.77,1],[1,1]];
  function progress(t) {
    const p = t / duration;
    for (let i=1;i<milestones.length;i++) {
      if (p <= milestones[i][0]) {
        const [a,x] = milestones[i-1], [b,y] = milestones[i];
        return x+(y-x)*smooth((p-a)/(b-a));
      }
    }
    return 1;
  }
  // Split the selected image's own contours once; no particles are allocated per frame.
  const canvas = $('.line-art'), ctx = canvas.getContext('2d');
  function preparePaths(raw) { return raw.map(points => {
    let total=0;
    for(let i=1;i<points.length;i++)total+=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);
    const full=new Path2D();points.forEach((point,i)=>i?full.lineTo(...point):full.moveTo(...point));
    return {points,total,full};
  }); }
  function prepareFragments(paths){
    const result=[],span=Math.max(18,paths.reduce((sum,path)=>sum+path.total,0)/1400);
    const noise=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
    function add(points){
      if(points.length<2)return;
      const first=points[0],last=points[points.length-1],x=(first[0]+last[0])/2,y=(first[1]+last[1])/2;
      const seed=result.length+1;
      result.push({x,y,points:points.map(point=>[point[0]-x,point[1]-y]),
        sx:(x+(noise(seed)-.5)*440+1536)%1536,sy:(y+(noise(seed+271)-.5)*300+1024)%1024,
        angle:(noise(seed+563)-.5)*Math.PI*2,seed:noise(seed+811)*Math.PI*2});
    }
    for(const path of paths){
      if(path.points.length<2)continue;
      let chunk=[path.points[0]],used=0;
      for(let i=1;i<path.points.length;i++){
        let a=path.points[i-1];const b=path.points[i];
        let length=Math.hypot(b[0]-a[0],b[1]-a[1]);
        while(length>0&&used+length>=span){
          const ratio=(span-used)/length,cut=[a[0]+(b[0]-a[0])*ratio,a[1]+(b[1]-a[1])*ratio];
          chunk.push(cut);add(chunk);chunk=[cut];a=cut;used=0;
          length=Math.hypot(b[0]-a[0],b[1]-a[1]);
        }
        if(length>0){chunk.push(b);used+=length;}
      }
      add(chunk);
    }
    return result;
  }
  let paths=preparePaths(window.CONTOUR_PATHS || []),fragments=prepareFragments(paths);
  let constellation={stars:[],links:[]};
  function prepareConstellation(list){
    const step=Math.max(1,Math.ceil(list.length/180));
    const chosen=list.filter((_,i)=>i%step===0).slice(0,180).map((fragment,i)=>({x:fragment.x,y:fragment.y,seed:fragment.seed??i*.17,i}));
    const links=[];
    for(let i=0;i<chosen.length;i++){
      let n0=-1,n1=-1,d0=1e9,d1=1e9;
      for(let j=0;j<chosen.length;j++){
        if(i===j)continue;
        const d=Math.hypot(chosen[i].x-chosen[j].x,chosen[i].y-chosen[j].y);
        if(d<d0){d1=d0;n1=n0;d0=d;n0=j;}else if(d<d1){d1=d;n1=j;}
      }
      if(n0>=0&&d0<120&&i<n0)links.push([i,n0]);
      if(n1>=0&&d1<120&&i<n1)links.push([i,n1]);
    }
    constellation={stars:chosen,links};
  }
  prepareConstellation(fragments);
  let identityTexture=null,identityPieces=[];
  function releaseIdentityTexture(){
    if(identityTexture)identityTexture.width=identityTexture.height=0;
    identityTexture=null;identityPieces=[];
  }
  function prepareIdentityTexture(){
    releaseIdentityTexture();
    const bounds=canvas.getBoundingClientRect(),scale=Math.max(bounds.width/1536,bounds.height/1024);
    if(!scale)return;
    const ox=bounds.left+(bounds.width-1536*scale)/2,oy=bounds.top+(bounds.height-1024*scale)/2;
    const rect=node=>{const r=node.getBoundingClientRect();return {x:(r.left-ox)/scale,y:(r.top-oy)/scale,w:r.width/scale,h:r.height/scale};};
    const texture=document.createElement('canvas');texture.width=1536;texture.height=1024;
    const ink=texture.getContext('2d');ink.imageSmoothingEnabled=false;
    const avatar=rect($('.avatar')),radar=rect($('.radar')),border=rect($('.avatar-frame'));
    const cx=radar.x+radar.w/2,cy=radar.y+radar.h/2;
    ink.strokeStyle='#a397a0';ink.lineWidth=1.3;
    ink.beginPath();ink.arc(cx,cy,radar.w*.4425,0,Math.PI*2);ink.stroke();
    ink.setLineDash([9,12]);ink.globalAlpha=.4;
    ink.beginPath();ink.arc(cx,cy,radar.w*.3775,0,Math.PI*2);ink.stroke();ink.setLineDash([]);ink.globalAlpha=.8;
    for(let i=0;i<60;i++){
      const a=i*Math.PI/30,r0=radar.w*(i%5===0?.4525:.46),r1=radar.w*(i%5===0?.4975:.48);
      ink.beginPath();ink.moveTo(cx+Math.sin(a)*r0,cy-Math.cos(a)*r0);ink.lineTo(cx+Math.sin(a)*r1,cy-Math.cos(a)*r1);ink.stroke();
    }
    ink.globalAlpha=1;ink.strokeRect(border.x,border.y,border.w,border.h);
    ink.drawImage($('.avatar'),avatar.x,avatar.y,avatar.w,avatar.h);
    // Neutralize the bitmap once, not with an expensive live blur/filter on every frame.
    ink.globalCompositeOperation='saturation';ink.fillStyle='#999';
    ink.fillRect(avatar.x,avatar.y,avatar.w,avatar.h);ink.globalCompositeOperation='source-over';
    const textBounds=[];
    for(const selector of ['.boot-title','.boot-caption']){
      const node=$(selector),r=rect(node),style=window.getComputedStyle(node);
      if(node.textContent)textBounds.push(r);
      ink.font=`${style.fontWeight} ${parseFloat(style.fontSize)/scale}px ${style.fontFamily}`;
      ink.textAlign='center';ink.textBaseline='middle';ink.fillStyle=style.color;
      ink.globalAlpha=selector==='.boot-caption'?.5:1;
      ink.letterSpacing=`${(parseFloat(style.letterSpacing)||0)/scale}px`;
      ink.fillText(node.textContent,r.x+r.w/2,r.y+r.h/2,r.w);
    }
    ink.globalAlpha=1;
    ink.globalCompositeOperation='source-atop';ink.globalAlpha=.24;ink.fillStyle='#9b9099';
    ink.fillRect(0,0,1536,1024);ink.globalAlpha=1;ink.globalCompositeOperation='source-over';
    // Geometric tile selection works for file:// images too, without reading protected pixels.
    const tile=36,boxes=[avatar,border,...textBounds];
    const overlaps=(x,y,r)=>x<r.x+r.w&&x+tile>r.x&&y<r.y+r.h&&y+tile>r.y;
    for(let y=0;y<1024;y+=tile)for(let x=0;x<1536;x+=tile){
      const w=Math.min(tile,1536-x),h=Math.min(tile,1024-y);
      const distance=Math.hypot(x+w/2-cx,y+h/2-cy);
      const onRing=[.3775,.4425,.48].some(radius=>Math.abs(distance-radar.w*radius)<tile);
      if(onRing||boxes.some(box=>overlaps(x,y,box)))identityPieces.push({x,y,w,h,target:fragments[(identityPieces.length*37)%fragments.length]});
    }
    identityTexture=texture;
    canvas.dataset.identityPieces=String(identityPieces.length);
    fragments.forEach((fragment,i)=>{
      const tile=identityPieces[i%identityPieces.length];
      fragment.ix=tile?tile.x+tile.w/2:cx;fragment.iy=tile?tile.y+tile.h/2:cy;
    });
    for(const tile of identityPieces){tile.target.ix=tile.x+tile.w/2;tile.target.iy=tile.y+tile.h/2;}
  }
  function drawIdentityPieces(spread){
    if(!identityTexture||spread>=1)return;
    const fade=1-smooth((spread-.03)/.43),size=1-.9*spread;
    if(fade<=0)return;
    ctx.globalAlpha=fade;ctx.imageSmoothingEnabled=false;
    for(const tile of identityPieces){
      const target=tile.target;
      const x=(tile.x+tile.w/2)*(1-spread)+target.sx*spread,y=(tile.y+tile.h/2)*(1-spread)+target.sy*spread;
      const angle=target.angle*spread,cs=Math.cos(angle)*size,sn=Math.sin(angle)*size;
      ctx.setTransform(cs,sn,-sn,cs,x,y);
      ctx.drawImage(identityTexture,tile.x,tile.y,tile.w,tile.h,-tile.w/2,-tile.h/2,tile.w,tile.h);
    }
    ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;
  }
  let lastTrace=-1;
  function trace(p,drift=0,spread=1) {
    const stamp=p===1?1:p+drift*.00001;
    if(stamp===lastTrace)return;lastTrace=stamp;
    ctx.clearRect(0,0,1536,1024);
    ctx.strokeStyle=accentPaint('--accent-line','#c8c0cd');ctx.lineWidth=1.25;ctx.lineCap='round';ctx.lineJoin='round';
    if(p===1){
      ctx.globalAlpha=1;paths.forEach(path=>ctx.stroke(path.full));
    }else{
      drawIdentityPieces(spread);
      if(spread>.04){
      ctx.globalAlpha=.82*smooth((spread-.04)/.36);ctx.beginPath();
      // Arrival time follows target X, so the left edge resolves before the face and right edge.
      const front=p*1.5-.25;
      for(const fragment of fragments){
        const arrival=smooth((front-fragment.x/1536+.16)/.32),loose=1-arrival;
        const angle=fragment.angle*loose,cs=Math.cos(angle),sn=Math.sin(angle);
        const sx=(fragment.ix??fragment.sx)*(1-spread)+fragment.sx*spread;
        const sy=(fragment.iy??fragment.sy)*(1-spread)+fragment.sy*spread;
        const x=sx*loose+fragment.x*arrival+Math.sin(drift*.8+fragment.seed)*7*loose*spread;
        const y=sy*loose+fragment.y*arrival+Math.cos(drift*.6+fragment.seed)*7*loose*spread;
        const size=.16+.84*arrival;
        fragment.points.forEach((point,i)=>{
          const px=x+(point[0]*cs-point[1]*sn)*size,py=y+(point[0]*sn+point[1]*cs)*size;
          if(i)ctx.lineTo(px,py);else ctx.moveTo(px,py);
        });
      }
      ctx.stroke();ctx.globalAlpha=1;
      }
    }
    canvas.dataset.progress=p.toFixed(3);canvas.dataset.fragments=String(fragments.length);
  }
  function drawIdentityOrbit(spread){
    if(!identityTexture||spread>=1)return;
    const fade=1-smooth((spread-.02)/.48),size=1-.72*spread;
    if(fade<=0)return;
    ctx.globalAlpha=fade;ctx.imageSmoothingEnabled=false;
    const cx=768,cy=512;
    for(const tile of identityPieces){
      const ox=tile.x+tile.w/2,oy=tile.y+tile.h/2;
      const a0=Math.atan2(oy-cy,ox-cx),r0=Math.hypot(ox-cx,oy-cy);
      const a=a0+spread*(.85+(tile.w%7)*.04),r=r0+spread*260;
      const x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r,cs=Math.cos(spread)*size,sn=Math.sin(spread*.7)*size;
      ctx.setTransform(cs,sn,-sn,cs,x,y);
      ctx.drawImage(identityTexture,tile.x,tile.y,tile.w,tile.h,-tile.w/2,-tile.h/2,tile.w,tile.h);
    }
    ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;
  }
  function starWeight(star,p){return smooth((p-star.x/1536*.42-star.seed*.1)/.3);}
  function traceSeek(p,drift=0,spread=1){
    const stamp=p===1?1:p+drift*.00001+spread;
    if(stamp===lastTrace)return;lastTrace=stamp;
    ctx.clearRect(0,0,1536,1024);
    if(p<1)drawIdentityOrbit(spread);
    ctx.lineCap='round';ctx.lineJoin='round';
    if(spread>.05){
      const glow=smooth((spread-.05)/.3);
      ctx.strokeStyle=accentPaint('--accent-cool','#d5e8f0');ctx.lineWidth=1.05;ctx.globalAlpha=.55*glow;
      ctx.beginPath();
      for(const [a,b] of constellation.links){
        const sa=constellation.stars[a],sb=constellation.stars[b];
        const on=Math.min(starWeight(sa,p),starWeight(sb,p));
        if(on<=.04)continue;
        ctx.moveTo(sa.x,sa.y);ctx.lineTo(sb.x,sb.y);
      }
      ctx.stroke();
      for(const star of constellation.stars){
        const on=starWeight(star,p);if(on<=.02)continue;
        const twinkle=.65+.35*Math.sin(drift*1.4+star.seed*8);
        ctx.globalAlpha=on*glow*twinkle;ctx.fillStyle=accentPaint('--accent-hud','#f3fbff');
        ctx.beginPath();ctx.arc(star.x,star.y,1.15+on,0,Math.PI*2);ctx.fill();
      }
      ctx.globalAlpha=1;
    }
    if(p>.86){
      ctx.globalAlpha=.22*smooth((p-.86)/.14);ctx.strokeStyle=accentPaint('--accent-line','#c8c0cd');ctx.lineWidth=1.1;
      paths.forEach(path=>ctx.stroke(path.full));ctx.globalAlpha=1;
    }
    canvas.dataset.progress=p.toFixed(3);canvas.dataset.fragments=String(constellation.stars.length);
  }
  function traceRipple(p){
    const stamp='ripple'+p.toFixed(3);
    if(stamp===lastTrace)return;lastTrace=stamp;
    ctx.clearRect(0,0,1536,1024);
    const radius=90+p*1180;
    ctx.save();
    ctx.beginPath();ctx.arc(768,490,radius,0,Math.PI*2);ctx.clip();
    ctx.strokeStyle=accentPaint('--accent-line','#c8c0cd');ctx.lineWidth=1.2;ctx.lineCap='round';ctx.globalAlpha=.9;
    paths.forEach(path=>ctx.stroke(path.full));
    ctx.restore();
    ctx.strokeStyle=accentPaint('--accent-cool','#d5e8f0');ctx.lineWidth=1.4;ctx.globalAlpha=.45+p*.2;
    for(let i=0;i<4;i++){
      const ring=Math.max(0,radius-i*70);
      if(ring<40)continue;
      ctx.beginPath();ctx.arc(768,490,ring,0,Math.PI*2);ctx.stroke();
    }
    ctx.globalAlpha=1;
    canvas.dataset.progress=p.toFixed(3);
  }
  function traceVeil(p){
    const stamp='veil'+p.toFixed(3);
    if(stamp===lastTrace)return;lastTrace=stamp;
    ctx.clearRect(0,0,1536,1024);
    ctx.strokeStyle=accentPaint('--accent-line','#c8c0cd');ctx.lineWidth=1.1;ctx.lineCap='round';ctx.globalAlpha=.25+.65*p;
    const cutoff=1024*(1-p*1.05);
    ctx.save();
    ctx.beginPath();ctx.rect(0,cutoff,1536,1024-cutoff);ctx.clip();
    paths.forEach(path=>ctx.stroke(path.full));
    ctx.restore();
    ctx.globalAlpha=1;
    canvas.dataset.progress=p.toFixed(3);
  }
  function traceHolo(p){
    const stamp='holo'+p.toFixed(3);
    if(stamp===lastTrace)return;lastTrace=stamp;
    ctx.clearRect(0,0,1536,1024);
    ctx.save();
    ctx.beginPath();
    const cut=80+p*980;
    ctx.rect(768-cut,0,cut*2,1024);ctx.clip();
    ctx.strokeStyle=accentPaint('--accent-cool','#9ec9d6');ctx.lineWidth=1.15;ctx.lineCap='butt';
    ctx.setLineDash([5,8]);ctx.lineDashOffset=-p*120;ctx.globalAlpha=.82;
    paths.forEach(path=>ctx.stroke(path.full));
    ctx.setLineDash([]);ctx.strokeStyle=accentPaint('--accent-hud','#fce9f0');ctx.lineWidth=1;ctx.globalAlpha=.35;
    ctx.beginPath();ctx.moveTo(768-cut,40);ctx.lineTo(768-cut,984);ctx.moveTo(768+cut,40);ctx.lineTo(768+cut,984);ctx.stroke();
    ctx.restore();ctx.globalAlpha=1;
    canvas.dataset.progress=p.toFixed(3);
  }
  function closeOut(s,scale=true){
    const collapse=smooth((s-11)/.32),pinch=smooth((s-11.65)/.35),closing=s>=11;
    root.classList.toggle('closing',closing);document.body.classList.toggle('closing',closing);
    scene.style.opacity=collapse>=1?'0':'1';
    scene.style.transform=scale?`scale(${Math.max(.001,1-collapse*.06)}) scaleY(${Math.max(.001,1-collapse)})`:`scaleY(${Math.max(.001,1-collapse)})`;
    scene.style.filter=closing?`brightness(${1+collapse*1.7})`:'none';
    const line=$('.shutter-line');
    line.style.opacity=String(smooth((s-11.15)/.15)*(1-smooth((s-11.96)/.04)));
    line.style.transform=`scaleX(${1-pinch})`;
    if(closing&&!revealed){revealed=true;send('reveal');}
    return closing;
  }
  function paintHud(t,phase,stage){
    const s=t/1000,p=progress(t);
    if(Math.abs(t-lastUI)>60 || t===0 || t>=duration){
      lastUI=t;
      $('#ratio').textContent=`${(p*100).toFixed(2).padStart(5,'0')}%`;
      $('.sync-phase').textContent=phase;
      $('#timecode').textContent=`00:${String(Math.floor(s)).padStart(2,'0')}:${String(Math.floor(s%1*30)).padStart(2,'0')}`;
      slider.value=String(s);
      $('#elapsed').innerHTML=`${s.toFixed(1).padStart(4,'0')} <span>/ 12.0s</span>`;
      root.dataset.elapsed=s.toFixed(2);
      root.dataset.stage=s>=11?'shutter':stage;
    }
  }
  function renderIntroClassic(s){
    $('.identity').style.opacity=String(smooth((s-1.05)/.65));
    $('.identity').style.transform=`translate(-50%,-43%) scale(${.94+.06*smooth((s-1.05)/.65)})`;
    const beat=reduced?0:Math.pow((1-Math.cos(Math.max(0,s-1.05)*Math.PI*2/1.08))/2,2);
    $('.avatar-frame').style.transform=`translateY(${-4*beat}px) scale(${1+.025*beat})`;
    $('.avatar-frame').style.clipPath='none';
    $('.pulse').style.opacity=String(1-smooth((s-1.15)/.5));
    document.querySelectorAll('.pulse i').forEach((ring,i)=>{const phase=(s*.75+i*.5)%1;ring.style.transform=`scale(${.25+phase*.9})`;ring.style.opacity=String((1-phase)*.8);});
    $('.dashed').style.transformOrigin='200px 200px';$('.dashed').style.transform=`rotate(${reduced?0:s*16}deg)`;
    $('.boot-title').style.clipPath=`inset(0 ${(1-clamp((s-1.9)/.7))*100}% 0 0)`;
    $('.boot-title').style.opacity='1';
    $('.boot-caption').style.opacity=String(smooth((s-2.5)/.35)*.5);
    $('.wave').style.transform=`scaleY(${reduced?1:.6+Math.sin(s*6)*.4})`;
    $('.classic-logs').style.opacity=String(.55);
    document.querySelectorAll('.classic-logs div').forEach((line,i)=>line.style.opacity=String(smooth((s-.15-i*.38)/.3)));
    $('.seek-logs').style.opacity='0';
    const core=$('.seek-core');if(core)core.style.opacity='0';
  }
  function renderIntroSeek(s){
    $('.identity').style.opacity=String(smooth((s-1.12)/.8));
    $('.identity').style.transform=`translate(-50%,-43%) scale(${.9+.1*smooth((s-1.12)/.8)})`;
    $('.avatar-frame').style.transform='none';
    $('.avatar-frame').style.clipPath=`circle(${8+92*smooth((s-1.2)/.95)}% at 50% 50%)`;
    $('.pulse').style.opacity=String(1-smooth((s-1.2)/.55));
    const core=$('.seek-core');
    if(core){
      core.style.opacity=String(s<4.3?1-smooth((s-1.05)/.7):0);
      core.querySelector('b').style.transform=`translate(-50%,-50%) scale(${.8+smooth(s/1.1)*2.2})`;
      core.querySelector('i').style.opacity=String(smooth((s-.2)/.6)*(1-smooth((s-1.35)/.5)));
      core.querySelector('i').style.transform=`translate(-50%,-50%) scale(${.7+s*.12})`;
    }
    $('.dashed').style.transformOrigin='200px 200px';$('.dashed').style.transform=`rotate(${reduced?0:s*9}deg)`;
    $('.boot-title').style.clipPath='none';
    $('.boot-title').style.opacity=String(smooth((s-1.7)/.55));
    $('.boot-title').style.letterSpacing=`${.18+.14*(1-smooth((s-1.7)/.8))}em`;
    $('.boot-caption').style.opacity=String(smooth((s-2.4)/.4)*.55);
    $('.wave').style.transform=`scaleY(${reduced?1:.5+.5*Math.sin(s*2.2)})`;
    $('.classic-logs').style.opacity='0';
    $('.seek-logs').style.opacity=String(.62);
    document.querySelectorAll('.seek-logs div').forEach((row,i)=>row.style.opacity=String(smooth((s-.2-i*.42)/.35)));
    stars.forEach((node,i)=>{
      const born=smooth((s-.15-i*.07)/.4);
      node.style.opacity=String(born*(.25+.55*(.5+.5*Math.sin(s*.6+i))));
      node.style.transform=`translate(${Math.sin(s*.15+i)*6}px,${Math.cos(s*.12+i)*4}px)`;
    });
  }
  function renderIntroRipple(s){
    $('.identity').style.opacity=String(smooth((s-1.1)/.75));
    $('.identity').style.transform=`translate(-50%,-43%) scale(${.9+.1*smooth((s-1.1)/.75)})`;
    $('.avatar-frame').style.transform='none';
    $('.avatar-frame').style.clipPath=`circle(${12+88*smooth((s-1.15)/.9)}% at 50% 50%)`;
    $('.pulse').style.opacity=String(1-smooth((s-3.4)/.7));
    document.querySelectorAll('.pulse i').forEach((ring,i)=>{const phase=(s*.55+i*.35)%1;ring.style.transform=`scale(${.2+phase*1.8})`;ring.style.opacity=String((1-phase)*.7);});
    const core=$('.seek-core');
    if(core){
      core.style.opacity=String(s<4.4?1-smooth((s-1.1)/.65):0);
      core.querySelector('b').style.transform=`translate(-50%,-50%) scale(${.7+smooth(s/1.2)*2})`;
      core.querySelector('i').style.opacity=String(smooth((s-.15)/.5)*(1-smooth((s-1.5)/.5)));
      core.querySelector('i').style.transform=`translate(-50%,-50%) scale(${.6+s*.18})`;
    }
    $('.dashed').style.transformOrigin='200px 200px';$('.dashed').style.transform=`rotate(${reduced?0:s*7}deg)`;
    $('.boot-title').style.clipPath='none';
    $('.boot-title').style.opacity=String(smooth((s-1.65)/.5));
    $('.boot-caption').style.opacity=String(smooth((s-2.3)/.4)*.55);
    $('.wave').style.transform=`scaleY(${reduced?1:.5+.5*Math.sin(s*2)})`;
    $('.classic-logs').style.opacity='0';
    $('.seek-logs').style.opacity=String(.6);
    document.querySelectorAll('.seek-logs div').forEach((row,i)=>row.style.opacity=String(smooth((s-.2-i*.4)/.35)));
  }
  function renderIntroVeil(s){
    $('.identity').style.opacity=String(smooth((s-1.08)/.8));
    $('.identity').style.transform=`translate(-50%,-43%) scale(${.93+.07*smooth((s-1.08)/.8)})`;
    $('.avatar-frame').style.transform='none';
    $('.avatar-frame').style.clipPath='none';
    $('.pulse').style.opacity=String(1-smooth((s-1.4)/.55));
    const core=$('.seek-core');if(core)core.style.opacity='0';
    $('.dashed').style.transformOrigin='200px 200px';$('.dashed').style.transform=`rotate(${reduced?0:s*5}deg)`;
    $('.boot-title').style.clipPath=`inset(${(1-smooth((s-1.7)/.8))*100}% 0 0 0)`;
    $('.boot-title').style.opacity=String(smooth((s-1.7)/.55));
    $('.boot-caption').style.opacity=String(smooth((s-2.4)/.4)*.5);
    $('.wave').style.transform=`scaleY(${reduced?1:.7+.3*Math.sin(s*1.4)})`;
    $('.classic-logs').style.opacity='0';
    $('.seek-logs').style.opacity=String(.5);
    document.querySelectorAll('.seek-logs div').forEach((row,i)=>row.style.opacity=String(smooth((s-.25-i*.4)/.35)));
    stars.forEach((node,i)=>{
      const born=smooth((s-.2-i*.05)/.5);
      node.style.opacity=String(born*(.2+.5*(.5+.5*Math.sin(s*.4+i))));
      node.style.transform=`translate(${Math.sin(s*.1+i)*8}px,${-s*(1.5+i%3)}px)`;
    });
  }
  function renderIntroHolo(s){
    $('.identity').style.opacity=String(smooth((s-1.02)/.7));
    $('.identity').style.transform=`translate(-50%,-43%) scale(${.86+.14*smooth((s-1.02)/.7)})`;
    $('.avatar-frame').style.transform=`skewX(${Math.sin(s*18)*0.6}deg)`;
    $('.avatar-frame').style.clipPath=`inset(${(1-smooth((s-1.15)/.85))*50}% 0 ${(1-smooth((s-1.15)/.85))*50}% 0)`;
    $('.pulse').style.opacity=String(1-smooth((s-1.25)/.5));
    const core=$('.seek-core');
    if(core){
      core.style.opacity=String(s<4.35?1-smooth((s-1.05)/.75):0);
      core.querySelector('b').style.transform=`translate(-50%,-50%) scale(${1+smooth(s/1.3)*1.8})`;
      core.querySelector('i').style.opacity=String(smooth((s-.12)/.4)*(1-smooth((s-1.6)/.5)));
      core.querySelector('i').style.transform=`translate(-50%,-50%) scale(${.45+s*.22})`;
    }
    $('.dashed').style.transformOrigin='200px 200px';$('.dashed').style.transform=`rotate(${reduced?0:s*28}deg)`;
    const glitch=reduced?0:(Math.sin(s*40)>0.82?8:0);
    $('.boot-title').style.clipPath='none';
    $('.boot-title').style.opacity=String(smooth((s-1.55)/.45));
    $('.boot-title').style.transform=`translateX(${glitch}px)`;
    $('.boot-caption').style.opacity=String(smooth((s-2.2)/.35)*.6);
    $('.wave').style.transform=`scaleY(${reduced?1:.3+.7*((s*3)%1)})`;
    $('.classic-logs').style.opacity='0';
    $('.seek-logs').style.opacity=String(.7);
    document.querySelectorAll('.seek-logs div').forEach((row,i)=>row.style.opacity=String(smooth((s-.15-i*.32)/.3)));
    const scan=$('.holo-scan');
    if(scan){scan.style.opacity=String(smooth((s-.3)/.4)*(1-smooth((s-3.8)/.5)));scan.style.transform=`translateY(${(-20+s*18)}%)`;}
    stars.forEach((node,i)=>{
      const born=smooth((s-.1-i*.06)/.35);
      node.style.opacity=String(born*(.15+.4*(.5+.5*Math.sin(s*1.1+i))));
    });
  }
  function renderRevealClassic(t,color){
    const s=t/1000,dissolve=smooth((s-4.18)/.56),assembling=clamp((s-5.08)/2.02);
    $('.transition-flash').style.opacity=String(reduced?0:smooth((s-7.18)/.035)*(1-smooth((s-7.22)/.2))*.8);
    if(s>=4.18&&s<7.43)trace(reduced?1:assembling,s-4.18,reduced?1:dissolve);
    if(s>=4.74&&identityTexture)releaseIdentityTexture();
    canvas.style.opacity=String((reduced?smooth((s-4.18)/.56):s>=4.18?1:0)*(1-color));
    art.style.opacity=String(artMotionOpacity(color,assembling));
    art.style.clipPath='none';
    art.style.transform=reduced?'none':`scale(${1+.012*smooth((s-7.42)/3.58)})`;
    $('.shade').style.opacity=String(color);
    sweep.style.opacity=reduced?'0':String(Math.sin(clamp((s-7.18)/.8)*Math.PI)*.1);
    sweep.style.transform=`translateX(${(-60+clamp((s-7.18)/.8)*120)}%)`;
    particles.forEach((node,i)=>{
      node.style.opacity=String(color*(.12+.28*(.5+.5*Math.sin(s*.9+i))));
      node.style.transform=`translate(${Math.sin(s*.4+i)*8}px,${-s*(2+i%3)}px)`;
    });
  }
  function renderRevealSeek(t,color){
    const s=t/1000,dissolve=smooth((s-4.22)/.7),assembling=clamp((s-5.02)/2.16),develop=smooth((s-7.22)/.9);
    $('.transition-flash').style.opacity=String(reduced?0:smooth((s-7.22)/.08)*(1-smooth((s-7.4)/.35))*.28);
    if(s>=4.22&&s<7.55)traceSeek(reduced?1:assembling,s-4.22,reduced?1:dissolve);
    if(s>=4.85&&identityTexture)releaseIdentityTexture();
    canvas.style.opacity=String((reduced?smooth((s-4.22)/.7):s>=4.22?1:0)*(1-color));
    art.style.opacity=String(artMotionOpacity(color,assembling));
    art.style.clipPath=reduced||develop>=1?'none':`circle(${8+92*develop}% at 50% 46%)`;
    art.style.transform=reduced?'none':`scale(${1.03-0.03*develop})`;
    $('.shade').style.opacity=String(color*.85);
    sweep.style.opacity=reduced?'0':String(Math.sin(clamp((s-7.22)/1.1)*Math.PI)*.08);
    sweep.style.transform=`translateX(${(-40+clamp((s-7.22)/1.1)*80)}%)`;
    particles.forEach(node=>{node.style.opacity='0';});
  }
  function renderRevealRipple(t,color){
    const s=t/1000,assembling=clamp((s-4.3)/2.4),develop=smooth((s-7.2)/.95);
    $('.transition-flash').style.opacity=String(reduced?0:smooth((s-7.2)/.08)*(1-smooth((s-7.4)/.3))*.22);
    if(s>=4.2&&s<7.6)traceRipple(reduced?1:assembling);
    if(s>=4.8&&identityTexture)releaseIdentityTexture();
    canvas.style.opacity=String((reduced?smooth((s-4.2)/.7):s>=4.2?1:0)*(1-color));
    art.style.opacity=String(artMotionOpacity(color,assembling));
    art.style.clipPath=reduced||develop>=1?'none':`circle(${6+94*develop}% at 50% 48%)`;
    art.style.transform=reduced?'none':`scale(${1.04-.04*develop})`;
    $('.shade').style.opacity=String(color*.85);
    sweep.style.opacity=reduced?'0':String(Math.sin(clamp((s-7.2)/1.1)*Math.PI)*.08);
    sweep.style.transform=`translateX(${(-40+clamp((s-7.2)/1.1)*80)}%)`;
    particles.forEach(node=>{node.style.opacity='0';});
  }
  function renderRevealVeil(t,color){
    const s=t/1000,assembling=clamp((s-4.35)/2.35),lift=smooth((s-7.25)/1.05);
    $('.transition-flash').style.opacity=String(reduced?0:smooth((s-7.25)/.1)*(1-smooth((s-7.5)/.35))*.16);
    if(s>=4.25&&s<7.7)traceVeil(reduced?1:assembling);
    if(s>=4.9&&identityTexture)releaseIdentityTexture();
    canvas.style.opacity=String((reduced?smooth((s-4.25)/.7):s>=4.25?1:0)*(1-color));
    art.style.opacity=String(artMotionOpacity(color,assembling));
    art.style.clipPath=reduced||lift>=1?'none':`inset(${(1-lift)*100}% 0 0 0)`;
    art.style.transform=reduced?'none':`translateY(${(1-lift)*18}px)`;
    $('.shade').style.opacity=String(color*.9);
    sweep.style.opacity=reduced?'0':String(Math.sin(clamp((s-7.25)/1.2)*Math.PI)*.06);
    sweep.style.transform=`translateY(${(-20+clamp((s-7.25)/1.2)*40)}%)`;
    particles.forEach((node,i)=>{
      node.style.opacity=String((.12+.3*(.5+.5*Math.sin(s*.7+i)))*(1-color*.4));
      node.style.transform=`translate(${Math.sin(s*.3+i)*10}px,${-s*(6+i%4)}px)`;
    });
  }
  function renderRevealHolo(t,color){
    const s=t/1000,assembling=clamp((s-4.15)/2.45),develop=smooth((s-7.12)/.82);
    $('.transition-flash').style.opacity=String(reduced?0:smooth((s-7.12)/.05)*(1-smooth((s-7.28)/.22))*.32);
    if(s>=4.12&&s<7.55)traceHolo(reduced?1:assembling);
    if(s>=4.75&&identityTexture)releaseIdentityTexture();
    canvas.style.opacity=String((reduced?smooth((s-4.12)/.55):s>=4.12?1:0)*(1-color));
    art.style.opacity=String(artMotionOpacity(color,assembling));
    art.style.clipPath=reduced||develop>=1?'none':`polygon(${50-50*develop}% 50%,50% ${50-50*develop}%,${50+50*develop}% 50%,50% ${50+50*develop}%)`;
    art.style.transform=reduced?'none':`scale(${1.04-.04*develop})`;
    art.style.filter=color>0.08&&color<1?`drop-shadow(1px 0 ${accentPaint('--accent-cool','#8cc3cd')}) drop-shadow(-1px 0 ${accentPaint('--accent','#e9a8bf')})`:'none';
    $('.shade').style.opacity=String(color*.75);
    sweep.style.opacity=reduced?'0':String(Math.sin(clamp((s-7.12)/.9)*Math.PI)*.14);
    sweep.style.transform=`translateX(${(-70+clamp((s-7.12)/.9)*140)}%)`;
    const floor=$('.holo-floor');
    if(floor)floor.style.opacity=String(smooth((s-4.2)/.6)*(1-color*.7));
    particles.forEach(node=>{node.style.opacity='0';});
  }
  for(let i=0;i<60;i++){
    const tick=document.createElementNS('http://www.w3.org/2000/svg','line');
    const angle=i*Math.PI/30,inner=i%5===0?181:184;
    tick.setAttribute('x1',200+Math.sin(angle)*inner);tick.setAttribute('y1',200-Math.cos(angle)*inner);
    tick.setAttribute('x2',200+Math.sin(angle)*(i%5===0?199:192));tick.setAttribute('y2',200-Math.cos(angle)*(i%5===0?199:192));
    tick.style.opacity=i%5===0?'.9':'.55';$('.ticks').appendChild(tick);
  }
  function render(t) {
    const s=t/1000,p=progress(t),color=smooth((s-7.2)/.45);
    intro.style.opacity=String(reduced?1-smooth((s-4.2)/.65):s<4.2?1:0);
    $('.boot-grid').style.opacity=String(smooth((s-.7)/.6)*(1-color)*.4);
    $('.boot-corners').style.opacity=String(smooth((s-.7)/.6)*(1-color));
    if(introEffect==='classic')renderIntroClassic(s);
    else if(introEffect==='ripple')renderIntroRipple(s);
    else if(introEffect==='veil')renderIntroVeil(s);
    else if(introEffect==='holo')renderIntroHolo(s);
    else renderIntroSeek(s);
    if(introEffect!=='seeklight'&&introEffect!=='veil'&&introEffect!=='holo')stars.forEach(node=>{node.style.opacity='0';});
    if(revealEffect==='classic')renderRevealClassic(t,color);
    else if(revealEffect==='ripple')renderRevealRipple(t,color);
    else if(revealEffect==='veil')renderRevealVeil(t,color);
    else if(revealEffect==='holo')renderRevealHolo(t,color);
    else renderRevealSeek(t,color);
    const scan=$('.holo-scan');if(scan&&introEffect!=='holo')scan.style.opacity='0';
    const floor=$('.holo-floor');if(floor&&revealEffect!=='holo')floor.style.opacity='0';
    if(color>=1)art.style.filter='none';
    const veil=$('.effect-veil');
    if(veil)veil.style.opacity=(introEffect==='veil'||revealEffect==='veil')?String((1-color)*(.5+.2*Math.sin(s*.8))):'0';
    hud.style.opacity=String(smooth((s-7.4)/.5));
    $('.sync-fill').style.transform=`scaleX(${p})`;
    subtitle.style.opacity=String(smooth((s-7.7)/.45)*(1-smooth((s-10.65)/.25)));
    closeOut(s,revealEffect!=='classic');
    const holo=introEffect==='holo'||revealEffect==='holo';
    paintHud(t,s<6.4?(holo?'LINKING':'INITIALIZING'):p<1?(holo?'MATERIALIZE':'SYNCHRONIZING'):'SYNC COMPLETE',s>=11?'shutter':s<4.2?'intro':s<7.2?'reveal':'portrait');
  }
  function updateButton() { pause.textContent=playing?t('pause'):t('resume'); root.dataset.playing=String(playing); }
  function stop() { playing=false; cancelAnimationFrame(frame); frame=0; updateButton(); if(window.aemeathAudio)window.aemeathAudio.stop(); }
  function finish(skipped=false) {
    skippedFinish=skipped;
    stop(); elapsed=duration; render(elapsed); completed=true;
    root.classList.add('finished'); root.dataset.completed='true';
    pause.textContent=t('finished'); pause.disabled=true;
    $('.end-description').textContent=mode==='launch'?t('showingCodex'):skipped?t('skipped'):t('previewEnded');
    send('complete');
  }
  function tick(now) {
    if(!playing)return;
    const wall=Math.min(playbackDuration,now-origin);
    elapsed=wall*authoredDuration/playbackDuration; render(elapsed);
    if(wall>=playbackDuration){finish();return;}
    frame=requestAnimationFrame(tick);
  }
  function warmIdentityTexture(){
    if(reduced||identityTexture||elapsed>=4740)return;
    const restoreTime=elapsed;
    // Prepare the final avatar layout before starting the playback clock, never in tick().
    render(4179);prepareIdentityTexture();drawIdentityPieces(0);
    ctx.clearRect(0,0,1536,1024);lastTrace=-1;render(restoreTime);
  }
  function play() {
    if(!loaded)return;
    if(elapsed>=duration)elapsed=0;
    warmIdentityTexture();
    completed=false; root.classList.remove('finished'); root.dataset.completed='false';
    pause.disabled=false; origin=performance.now()-elapsed*playbackDuration/authoredDuration; playing=true;updateButton();
    if(window.aemeathAudio)window.aemeathAudio.play({from:elapsed,duration:playbackDuration,muted:!soundOn,rich:introEffect==='holo'||revealEffect==='holo'});
    cancelAnimationFrame(frame);frame=requestAnimationFrame(tick);
  }
  function replay(){revealed=false;hiddenPause=false;stop();elapsed=0;lastUI=-Infinity;render(0);play();}
  $('#replay').addEventListener('click',replay);$('.replay-end').addEventListener('click',replay);
  pause.addEventListener('click',()=>{hiddenPause=false;if(playing){elapsed=Math.min(duration,performance.now()-origin);stop();render(elapsed);}else play();});
  $('.skip').addEventListener('click',()=>finish(true));
  slider.addEventListener('input',()=>{hiddenPause=false;stop();elapsed=Number(slider.value)*1000;warmIdentityTexture();if(elapsed>=duration){finish();return;}lastUI=-Infinity;completed=false;root.classList.remove('finished');root.dataset.completed='false';pause.disabled=false;render(elapsed);});
  window.addEventListener('keydown',event=>{
    if((event.metaKey||event.ctrlKey)&&event.altKey&&event.code==='KeyB'){
      event.preventDefault();if(!$('#settings-dialog').open)openSettings();return;
    }
    if($('#settings-dialog').open)return;
    if(event.key==='Escape'){event.preventDefault();finish(true);}
    if(event.code==='Space'&&event.target.tagName!=='INPUT'&&event.target.tagName!=='BUTTON'){event.preventDefault();pause.click();}
  });
  document.addEventListener('visibilitychange',()=>{
    if(native)return;
    if(document.hidden&&playing){elapsed=Math.min(duration,performance.now()-origin);hiddenPause=true;stop();}
    else if(!document.hidden&&hiddenPause&&!completed){hiddenPause=false;play();}
  });
  // Narrow native bridge: the host may select launch mode or report its own launch error.
  window.launcherUI={
    openSettings,
    beginLaunch(){mode='launch';document.body.classList.add('launch-mode');replay();},
    error(message){stop();scene.style.opacity='0';root.classList.add('finished');$('.end-description').textContent=message;$('.eyebrow').textContent=t('launchUnavailable');$('.end-screen h1').textContent=t('cannotOpen');},
    waiting(){ $('.end-description').textContent=t('waitingCodex'); }
  };
  if(native){
    document.body.classList.add('native');
  }
  function ready(){if(loaded)return;loaded=true;render(0);send('ready');if(window.AEMEATH_OPEN_SETTINGS||new URLSearchParams(location.search).has('settings'))openSettings();else play();}
  function failed(){stop();applyLocale(locale);$('#asset-error').hidden=false;send('assetError');}
  let savedImages={},pendingImages={},busy=false;
  const settings=$('#settings-dialog'),status=$('#settings-status');
  const textFields=[
    {key:'introTitle',input:'#intro-title',target:'.boot-title',fallback:'飞行雪绒',limit:16},
    {key:'introCaption',input:'#intro-caption',target:'.boot-caption',fallback:'CODEX INITIALIZE / TYPE-0',limit:48},
    {key:'artworkSubtitle',input:'#artwork-subtitle',target:'#subtitle',fallback:'幽灵来到…你身边～',limit:60}
  ];
  const textValue=(images,field)=>typeof images[field.key]==='string'?images[field.key].slice(0,field.limit):field.fallback;
  function setStatus(key,suffix=''){
    status.dataset.key=key||'';
    status.dataset.suffix=suffix;
    status.textContent=(key?t(key):'')+suffix;
  }
  function applyLocale(next){
    locale=normalizeLocale(next);
    if(window.imageSettings)window.imageSettings.locale=locale;
    document.documentElement.lang=locale==='vi'?'vi':'zh-CN';
    document.title=t('docTitle');
    root.dataset.locale=locale;
    document.querySelectorAll('[data-i18n]').forEach(node=>{node.textContent=t(node.getAttribute('data-i18n'));});
    document.querySelectorAll('[data-i18n-aria]').forEach(node=>{node.setAttribute('aria-label',t(node.getAttribute('data-i18n-aria')));});
    document.querySelectorAll('[data-i18n-title]').forEach(node=>{node.setAttribute('title',t(node.getAttribute('data-i18n-title')));});
    document.querySelectorAll('[data-i18n-alt]').forEach(node=>{node.setAttribute('alt',t(node.getAttribute('data-i18n-alt')));});
    if(status.dataset.key)status.textContent=t(status.dataset.key)+(status.dataset.suffix||'');
    if(completed){
      pause.textContent=t('finished');
      $('.end-description').textContent=mode==='launch'?t('showingCodex'):skippedFinish?t('skipped'):t('previewEnded');
    }else if(loaded) updateButton();
  }
  function thumbnails(){
    $('#avatar-preview').src=pendingImages.avatar||assets.avatar;
    $('#artwork-preview').src=artworkSource(pendingImages);
    $('#wallpaper-strength').value=String(pendingImages.wallpaperStrength??42);
    $('#wallpaper-value').textContent=$('#wallpaper-strength').value+'%';
    $('#playback-duration').value=String(Math.round((pendingImages.durationMs??authoredDuration)/1000));
    $('#playback-duration-value').textContent=$('#playback-duration').value+'s';
    const chosenIntro=normalizeEffect(pendingImages.introEffect||pendingImages.effect);
    const chosenReveal=normalizeEffect(pendingImages.revealEffect||pendingImages.effect);
    document.querySelectorAll('input[name=introEffect]').forEach(node=>{node.checked=node.value===chosenIntro;});
    document.querySelectorAll('input[name=revealEffect]').forEach(node=>{node.checked=node.value===chosenReveal;});
    const chosenLocale=normalizeLocale(pendingImages.locale);
    document.querySelectorAll('input[name=locale]').forEach(node=>{node.checked=node.value===chosenLocale;});
    const chosenAccent=normalizeAccent(pendingImages.accent);
    document.querySelectorAll('input[name=accent]').forEach(node=>{node.checked=node.value===chosenAccent;});
    const pack=resolveAccent(pendingImages.accent,pendingImages.accentColor);
    $('#accent-color').value=pack.accent;
    $('#boot-sound').checked=pendingImages.sound!==false;
    for(const field of textFields)$(field.input).value=textValue(pendingImages,field);
  }
  function setEffects(images={}){
    const fallback=normalizeEffect(images.effect);
    introEffect=normalizeEffect(images.introEffect||fallback);
    revealEffect=normalizeEffect(images.revealEffect||fallback);
    root.dataset.effect=introEffect;
    root.dataset.intro=introEffect;
    root.dataset.reveal=revealEffect;
    lastTrace=-1;
    art.style.clipPath='none';
    $('.avatar-frame').style.clipPath='none';
    const veil=$('.effect-veil');if(veil)veil.style.opacity='0';
  }
  function openSettings(){
    if(mode==='launch'||settings.open)return;
    hiddenPause=false;stop();pendingImages={...savedImages};
    pendingImages.locale=normalizeLocale((params.has('lang')||params.has('locale'))?locale:pendingImages.locale);
    thumbnails();
    applyLocale(pendingImages.locale);
    applyAccent(pendingImages);
    setStatus('openHint');
    settings.dataset.opened='1';
    settings.returnValue='';settings.showModal();send('settings-open');
  }
  function setBusy(value){
    busy=value;
    settings.querySelectorAll('input,button').forEach(node=>node.disabled=value);
  }
  async function applyImages(images){
    releaseIdentityTexture();
    art.src=artworkSource(images);$('.avatar').src=images.avatar||assets.avatar;
    root.dataset.animated=images.animated||images.artworkBlob?'1':'';
    await Promise.all([art,$('.avatar')].map(img=>img.decode()));
    const traced=window.imageSettings&&window.imageSettings.traceImage?window.imageSettings.traceImage(art):[];
    const raw=traced.length?traced:(images.contours||window.CONTOUR_PATHS||[]);
    paths=preparePaths(raw);fragments=prepareFragments(paths);prepareConstellation(fragments);lastTrace=-1;
    if(!params.has('intro')&&!params.has('reveal')&&!params.has('effect'))setEffects(images);
    else setEffects({effect:params.get('effect'),introEffect:params.get('intro'),revealEffect:params.get('reveal')});
    applyAccent((params.has('accent')||params.has('color'))?{accent:params.get('accent'),accentColor:params.get('color')}:images);
    applyLocale((params.has('lang')||params.has('locale'))?locale:images.locale);
    if(typeof images.sound==='boolean')soundOn=images.sound;
    $('#boot-sound').checked=soundOn;
    if(!paths.length)throw new Error(t('missingContours'));
    for(const field of textFields)$(field.target).textContent=textValue(images,field);
    $('.boot-title').classList.toggle('long-title',Array.from(textValue(images,textFields[0])).length>6);
    if(images.artworkBlob instanceof Blob){
      send('background',{blob:images.artworkBlob,strength:images.wallpaperStrength??42});
    }else{
      const wallpaperCanvas=document.createElement('canvas');
      wallpaperCanvas.width=1536;wallpaperCanvas.height=1024;
      wallpaperCanvas.getContext('2d').drawImage(art,0,0,1536,1024);
      send('background',{image:wallpaperCanvas.toDataURL('image/jpeg',0.72),strength:images.wallpaperStrength??42});
    }
    if(!params.has('duration'))playbackDuration=clampDuration(images.durationMs??authoredDuration);
  }
  for(const field of textFields)$(field.input).addEventListener('input',event=>{
    pendingImages[field.key]=event.target.value.slice(0,field.limit);
  });
  $('#wallpaper-strength').addEventListener('input',event=>{
    pendingImages.wallpaperStrength=Number(event.target.value);
    $('#wallpaper-value').textContent=event.target.value+'%';
  });
  $('#playback-duration').addEventListener('input',event=>{
    pendingImages.durationMs=Number(event.target.value)*1000;
    $('#playback-duration-value').textContent=event.target.value+'s';
  });
  document.querySelectorAll('input[name=introEffect]').forEach(node=>node.addEventListener('change',()=>{
    pendingImages.introEffect=normalizeEffect(node.value);
    pendingImages.effect=pendingImages.introEffect;
    setEffects(pendingImages);if(loaded)render(elapsed||0);
  }));
  document.querySelectorAll('input[name=revealEffect]').forEach(node=>node.addEventListener('change',()=>{
    pendingImages.revealEffect=normalizeEffect(node.value);
    setEffects(pendingImages);if(loaded)render(elapsed||0);
  }));
  document.querySelectorAll('input[name=locale]').forEach(node=>node.addEventListener('change',()=>{
    pendingImages.locale=normalizeLocale(node.value);
    applyLocale(pendingImages.locale);
  }));
  document.querySelectorAll('input[name=accent]').forEach(node=>node.addEventListener('change',()=>{
    pendingImages.accent=normalizeAccent(node.value);
    applyAccent(pendingImages);thumbnails();
  }));
  $('#boot-sound').addEventListener('change',()=>{pendingImages.sound=$('#boot-sound').checked;soundOn=pendingImages.sound;});
  $('#accent-color').addEventListener('input',event=>{
    pendingImages.accent='custom';
    pendingImages.accentColor=parseAccentHex(event.target.value)||'#e9a8bf';
    applyAccent(pendingImages);thumbnails();
  });
  $('#image-settings').addEventListener('click',openSettings);
  if(window.AEMEATH_EXTERNAL){$('#restore-appearance').hidden=false;$('#restore-appearance').addEventListener('click',()=>send('restore'));}
  settings.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  settings.addEventListener('close',()=>{
    if(!loaded||settings.dataset.opened!=='1')return;
    delete settings.dataset.opened;
    if(settings.returnValue==='preview'){send('settings-close');replay();}
    else {applyLocale(savedImages.locale);finish(true);}
  });
  for(const kind of ['avatar','artwork'])$('#'+kind+'-file').addEventListener('change',async event=>{
    const file=event.target.files[0];if(!file)return;
    setBusy(true);setStatus(kind==='artwork'?'preparingArtwork':'preparingAvatar');
    // Let the progress text paint before the one-time contour computation.
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    try{
      pendingImages={...pendingImages,...await window.imageSettings.importImage(file,kind)};
      if(kind==='artwork'){delete pendingImages.contours;if(pendingImages.animated)delete pendingImages.artwork;}
      thumbnails();
      setStatus('imageReady');
    }catch(error){setStatus('',error.message);}
    finally{setBusy(false);event.target.value='';}
  });
  $('#reset-images').addEventListener('click',()=>{pendingImages={effect:'seeklight',introEffect:'seeklight',revealEffect:'seeklight',locale:normalizeLocale(pendingImages.locale),accent:normalizeAccent(pendingImages.accent),accentColor:pendingImages.accentColor};thumbnails();applyAccent(pendingImages);setStatus('resetHint');});
  $('#preview-images').addEventListener('click',async()=>{
    setBusy(true);setStatus('saving');
    try{
      pendingImages.locale=normalizeLocale(pendingImages.locale);
      pendingImages.introEffect=normalizeEffect(pendingImages.introEffect||pendingImages.effect);
      pendingImages.revealEffect=normalizeEffect(pendingImages.revealEffect||pendingImages.effect);
      pendingImages.effect=pendingImages.introEffect;
      pendingImages.sound=$('#boot-sound').checked;
      soundOn=pendingImages.sound;
      pendingImages.accent=normalizeAccent(pendingImages.accent);
      if(pendingImages.accent==='custom')pendingImages.accentColor=parseAccentHex(pendingImages.accentColor)||'#e9a8bf';
      delete pendingImages.contours;
      await applyImages(pendingImages);await window.imageSettings.save(pendingImages);savedImages={...pendingImages};settings.close('preview');
    }catch(error){await applyImages(savedImages);setStatus('saveFail',error.message);}
    finally{setBusy(false);}
  });
  window.imageSettings.load().catch(()=>({})).then(async images=>{
    savedImages=images;
    try{await applyImages(images);}catch{savedImages={};await applyImages({});}
    ready();
  }).catch(failed);
})();
