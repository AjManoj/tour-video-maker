{
const $=id=>document.getElementById(id);
const cv=$('cv'),ctx=cv.getContext('2d'),W=720,H=1280;
const TYPES={
 travel:{e:'✈️',n:'Travel',c:'#3d8bfd',t:'On the move',s:'Next stop ahead'},
 route:{e:'🗺️',n:'Route map',c:'#1fa3a8',t:'',s:''},
 arrive:{e:'🏨',n:'Arrive / Enter',c:'#8a63d2',t:'We made it!',s:'Check-in time'},
 breakfast:{e:'☕',n:'Breakfast',c:'#e0a03a',t:'Good morning',s:'Breakfast first'},
 explore:{e:'🧭',n:'Explore',c:'#2fa866',t:'Exploring',s:'Wander mode on'},
 lunch:{e:'🍜',n:'Lunch',c:'#ef7d3c',t:'Lunch break',s:'Refuel stop'},
 beach:{e:'🏖️',n:'Beach / Pool',c:'#14b8c4',t:'Beach time',s:'Sun, sand, repeat'},
 activity:{e:'🎢',n:'Activity',c:'#e5486a',t:'Adventure time',s:'Best part of the day'},
 sunset:{e:'🌅',n:'Sunset',c:'#ff8a4a',t:'Golden hour',s:'Sky on fire'},
 dinner:{e:'🍽️',n:'Dinner',c:'#c0395a',t:'Dinner time',s:'Table for family'},
 exit:{e:'🏁',n:'Exit / Head back',c:'#5d6b78',t:'Heading back',s:'What a day'}};
const TPLS={
 'Travel day':['travel','route','arrive','dinner','exit'],
 'City explore':['breakfast','explore','lunch','explore','sunset','dinner','exit'],
 'Beach day':['breakfast','beach','lunch','activity','sunset','dinner'],
 'Food day':['breakfast','explore','lunch','dinner','exit'],
 'Theme park':['travel','arrive','activity','lunch','activity','exit']};
const THEMES=[['Sunset','#ff6b4a','#ffd166'],['Ocean','#1fa3a8','#bde8ff'],['Tropical','#2fa866','#ffe66d'],['Night','#7b5cff','#ff8fd1']];
let uid=1;const nid=()=>'x'+(uid++);
const mk=(type,o={})=>({id:nid(),type,title:TYPES[type].t,sub:TYPES[type].s,tr:'',media:[],from:'',to:'',...o});
const M=(src,kind,o={})=>({id:nid(),src,kind,dur:3,inT:0,outT:null,...o});
let S={day:{trip:'Sample trip',num:1,place:'Home → Beach town',date:'',intro:1,outro:1},
 style:{theme:0,tr:'fade',td:.7,ph:2.6,cl:3.5,snd:1,badge:1,modes:{pick:'code',cap:'code',sort:'code'}},
 steps:[
  mk('travel',{title:'Vacation mode: ON 🌴',sub:'Airport · gate A',media:[M('samples/gate.jpg','image'),M('samples/term1.mp4','video'),M('samples/term2.mp4','video')]}),
  mk('explore',{title:'Boarding time 🛫',sub:'Off we go',media:[M('samples/jet1.mp4','video'),M('samples/jet2.mp4','video')]}),
  mk('travel',{title:'All aboard! ✈️',sub:'Seat check 💺',media:[M('samples/cabin.mp4','video'),M('samples/selfie.jpg','image')]}),
  mk('route',{from:'Home',to:'Beach town',title:'',sub:'Flight day'}),
  mk('exit',{title:'We made it! 🎉',sub:'Vacation starts now 🌴'})]};
let sel=S.steps[0].id,hist=[],music=null,playing=false,t0=0,tNow=0,exporting=false;
const media=new Map();let AC=null,REC_DST=null,PREV_G=null;
const snap=()=>{hist.push(JSON.stringify(S));if(hist.length>50)hist.shift();$('undo').disabled=false};
const save=()=>{try{localStorage.setItem('tourMaker',JSON.stringify({...S,steps:S.steps.map(s=>({...s,media:s.media.filter(m=>!m.src.startsWith('blob:'))}))}))}catch(e){}};
try{const v=JSON.parse(localStorage.getItem('tourMaker')||'null');if(v&&v.steps){S=v;S.steps.forEach(s=>{s.id=nid();s.media.forEach(m=>m.id=nid())});sel=S.steps[0]?.id}}catch(e){}
function load(m){
 if(media.has(m.src))return media.get(m.src);
 let el;
 if(m.kind==='image'){el=new Image();el.onload=()=>{renderSteps();draw(tNow)};el.src=m.src}
 else{el=document.createElement('video');el.src=m.src;el.playsInline=true;el.preload='auto';el.muted=true;
  el.onloadedmetadata=()=>{for(const s of S.steps)for(const x of s.media)if(x.src===m.src&&x.outT==null){x.outT=+Math.min(el.duration,x.inT+S.style.cl).toFixed(1)}build();renderSteps();draw(tNow)};
  el.onseeked=()=>{if(!playing)draw(tNow)}}
 media.set(m.src,el);return el}
const th=()=>THEMES[S.style.theme].slice(1);
// ---------- timeline ----------
let SEG=[];
function build(){
 SEG=[];const d=S.day,st=S.style;
 const first=S.steps.flatMap(s=>s.media)[0];
 if(+d.intro)SEG.push({k:'intro',dur:2.4,bg:first});
 for(const s of S.steps){
  if(s.type==='route'){SEG.push({k:'route',step:s,dur:4.5});continue}
  if(!s.media.length){SEG.push({k:'card',step:s,dur:2.2});continue}
  s.media.forEach((m,i)=>SEG.push({k:'media',step:s,m,first:i===0,dur:m.kind==='video'?Math.max(.5,(m.outT??m.inT+st.cl)-m.inT):(m.dur||st.ph)}));
 }
 if(+d.outro)SEG.push({k:'outro',dur:2.6,bg:S.steps.flatMap(s=>s.media).slice(-1)[0]});
 let t=0;SEG.forEach((g,i)=>{const td=i<SEG.length-1?Math.min(+st.td,g.dur*.45,SEG[i+1].dur*.45):0;g.s=t;g.e=t+g.dur;g.td=td;t+=g.dur-td});
 $('chap').innerHTML=SEG.map(g=>`<i style="flex:${g.dur};background:${g.step?TYPES[g.step.type].c:th()[0]}"></i>`).join('');
}
const total=()=>SEG.length?SEG[SEG.length-1].e:0;
const ease=p=>p*p*(3-2*p);
// ---------- drawing ----------
function rr(x,y,w,h,r){ctx.beginPath();ctx.roundRect?ctx.roundRect(x,y,w,h,r):ctx.rect(x,y,w,h)}
function cover(el,w,h,z=1,fx=.5,fy=.5){const s=Math.max(W/w,H/h)*z;ctx.drawImage(el,(W-w*s)*fx,(H-h*s)*fy,w*s,h*s)}
function drawMedia(m,local,dur,zin){
 const el=m&&load(m);
 if(!el){grad();return}
 if(m.kind==='video'){if(el.readyState>=2){const vt=m.inT+local;if(!playing||Math.abs(el.currentTime-vt)>.25){try{el.currentTime=vt}catch(e){}}cover(el,el.videoWidth,el.videoHeight)}else grad()}
 else if(el.complete&&el.naturalWidth){const p=Math.min(1,local/dur);cover(el,el.naturalWidth,el.naturalHeight,zin?1+.08*p:1.08-.08*p,.5,.45)}else grad();
}
function grad(c1=th()[0],c2='#0d1a26'){const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,c1);g.addColorStop(1,c2);ctx.fillStyle=g;ctx.fillRect(0,0,W,H)}
function txt(s,x,y,size,weight=800,col='#fff',sh=true){ctx.font=`${weight} ${size}px Poppins, "Segoe UI Emoji","Apple Color Emoji",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';if(sh){ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillText(s,x+3,y+3)}ctx.fillStyle=col;ctx.fillText(s,x,y)}
function pillT(s,y,size=30,bg='rgba(255,255,255,.92)',fg='#13304a'){ctx.font=`700 ${size}px Poppins, "Segoe UI Emoji",sans-serif`;const w=ctx.measureText(s).width+48,h=size+26;ctx.fillStyle=bg;rr(W/2-w/2,y-h/2,w,h,h/2);ctx.fill();ctx.fillStyle=fg;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(s,W/2,y+1)}
function fit(s,max,size){ctx.font=`800 ${size}px Poppins`;while(ctx.measureText(s).width>max&&size>26){size-=2;ctx.font=`800 ${size}px Poppins`}return size}
function overlay(step,a){
 if(a<=0)return;ctx.save();ctx.globalAlpha=a;const T=TYPES[step.type];
 if(+S.style.badge){ctx.font='700 24px Poppins, "Segoe UI Emoji"';const lab=`${T.e} ${T.n}`,w=ctx.measureText(lab).width+36;ctx.fillStyle=T.c;rr(30,40,w,48,24);ctx.fill();ctx.fillStyle='#fff';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(lab,48,65)}
 const g=ctx.createLinearGradient(0,0,0,300);g.addColorStop(0,'rgba(0,0,0,.35)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.globalAlpha=a*.9;ctx.fillStyle=g;ctx.fillRect(0,0,W,300);ctx.globalAlpha=a;
 if(step.title){const sz=fit(step.title,W-80,54);txt(step.title,W/2,150+(1-a)*20,sz)}
 if(step.sub)pillT(step.sub,H-120+(1-a)*20);
 ctx.restore()}
function drawRoute(step,local,dur){
 const [c1,c2]=th();grad('#0f3550','#0b1c2c');
 ctx.save();ctx.globalAlpha=.08;for(let i=0;i<14;i++){ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,i*100);ctx.lineTo(W,i*100);ctx.stroke();ctx.beginPath();ctx.moveTo(i*60,0);ctx.lineTo(i*60,H);ctx.stroke()}ctx.restore();
 const A={x:170,y:930},B={x:560,y:360},C={x:120,y:430};
 const P=u=>({x:(1-u)**2*A.x+2*(1-u)*u*C.x+u*u*B.x,y:(1-u)**2*A.y+2*(1-u)*u*C.y+u*u*B.y});
 const u=ease(Math.min(1,Math.max(0,(local-.5)/(dur-1.3))));
 ctx.setLineDash([14,14]);ctx.strokeStyle='rgba(255,255,255,.45)';ctx.lineWidth=6;ctx.beginPath();for(let k=0;k<=60;k++){const p=P(k/60);k?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)}ctx.stroke();ctx.setLineDash([]);
 ctx.shadowColor=c2;ctx.shadowBlur=24;ctx.strokeStyle=c2;ctx.lineWidth=10;ctx.beginPath();for(let k=0;k<=60*u;k++){const p=P(k/60);k?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)}ctx.stroke();ctx.shadowBlur=0;
 for(const [pt,name] of [[A,step.from||'Start'],[B,step.to||'Finish']]){ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(pt.x,pt.y,16,0,7);ctx.fill();ctx.fillStyle=c1;ctx.beginPath();ctx.arc(pt.x,pt.y,8,0,7);ctx.fill();ctx.font='700 30px Poppins';const w=ctx.measureText('📍 '+name).width+40;ctx.fillStyle='rgba(255,255,255,.92)';rr(pt.x-w/2,pt.y-78,w,52,26);ctx.fill();ctx.fillStyle='#13304a';ctx.textAlign='center';ctx.fillText('📍 '+name,pt.x,pt.y-51)}
 const p=P(u),q=P(Math.min(1,u+.01)),ang=Math.atan2(q.y-p.y,q.x-p.x);
 ctx.save();ctx.translate(p.x,p.y);ctx.rotate(ang+Math.PI/4);ctx.font='64px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji"';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('✈️',0,0);ctx.restore();
 txt(`${step.from||'Start'} → ${step.to||'Finish'}`,W/2,150,fit(`${step.from} → ${step.to}`,W-80,50));
 if(step.sub)pillT(step.sub,H-120);
}
function drawSeg(g,t){
 const L=t-g.s;
 if(g.k==='media'){drawMedia(g.m,L,g.dur,true);if(g.first)overlay(g.step,ease(Math.min(1,(L-.1)/.5))*(1-ease(Math.max(0,(L-(g.dur-.4))/.4))))}
 else if(g.k==='route')drawRoute(g.step,L,g.dur);
 else if(g.k==='card'){grad(TYPES[g.step.type].c);txt(TYPES[g.step.type].e,W/2,H/2-120,120,400,'#fff',false);overlay(g.step,ease(Math.min(1,L/.5)))}
 else{const d=S.day;if(g.bg){drawMedia(g.bg,L,g.dur,g.k==='intro')}else grad();ctx.fillStyle='rgba(8,20,32,.45)';ctx.fillRect(0,0,W,H);
  const a=ease(Math.min(1,L/.6));ctx.save();ctx.globalAlpha=a;
  if(g.k==='intro'){pillT(`DAY ${d.num||1}`,H/2-170,30,th()[0],'#fff');txt(d.trip||'My trip',W/2,H/2-60,fit(d.trip||'',W-80,64));txt(d.place||'',W/2,H/2+30,fit(d.place||'',W-80,40),700);const dt=d.date?new Date(d.date+'T12:00').toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'}):'';if(dt)pillT('🗓️ '+dt,H/2+130,28)}
  else{txt('That’s a wrap!',W/2,H/2-80,62);txt(`Day ${d.num||1} · ${d.place||''}`,W/2,H/2+10,fit(`Day ${d.num} · ${d.place}`,W-80,38),700);pillT('See you tomorrow 🌙',H/2+120,30)}
  ctx.restore()}
}
function draw(t){
 tNow=t;ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);
 if(!SEG.length){grad();txt('Add a step to begin',W/2,H/2,40);return}
 let i=SEG.findIndex(g=>t<g.e);if(i<0)i=SEG.length-1;const A=SEG[i],B=SEG[i+1];
 if(B&&A.td&&t>=A.e-A.td)trans(A,B,t,ease((t-(A.e-A.td))/A.td));else drawSeg(A,t);
 if(!exporting){$('seek').value=Math.round(t/Math.max(.01,total())*1000);$('tc').textContent=fmt(t)+' / '+fmt(total())}
}
function trans(A,B,t,p){
 const k=(A.step&&A.step.tr)||S.style.tr,a=()=>drawSeg(A,t),b=()=>drawSeg(B,t);
 const xf=(f,dx,s=1,al=1)=>{ctx.save();ctx.globalAlpha=al;ctx.translate(W/2+dx,H/2);ctx.scale(s,s);ctx.translate(-W/2,-H/2);f();ctx.restore()};
 if(k==='slide'){xf(a,-p*W);xf(b,W-p*W)}
 else if(k==='whip'){const g=Math.sin(Math.PI*p);for(let j=-2;j<=2;j++){xf(a,-p*W+j*g*34,1,.3);xf(b,W-p*W+j*g*34,1,.3)}}
 else if(k==='zoom'){xf(a,0,1+.6*p);xf(b,0,1.3-.3*p,p)}
 else if(k==='iris'){a();ctx.save();ctx.beginPath();ctx.arc(W/2,H/2,p*Math.hypot(W,H)/2*1.05,0,7);ctx.clip();b();ctx.restore()}
 else{xf(a,0,1+.06*p);xf(b,0,1,p)}
}
const fmt=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
// ---------- playback ----------
function ensureAudio(){if(AC)return;try{AC=new AudioContext();REC_DST=AC.createMediaStreamDestination();PREV_G=AC.createGain();PREV_G.gain.value=0;PREV_G.connect(AC.destination)}catch(e){AC=null}}
function hookAudio(el){if(!AC||el._hooked)return;try{const src=AC.createMediaElementSource(el),g=AC.createGain();g.gain.value=+S.style.snd;src.connect(g);g.connect(REC_DST);src.connect(PREV_G);el.muted=false;el._hooked=g}catch(e){}}
let curVid=null;
function loop(){if(!playing)return;const t=(performance.now()-t0)/1000;if(t>=total()){stop(true);draw(total());return}
 const g=SEG.find(x=>t<x.e);const v=g&&g.k==='media'&&g.m.kind==='video'?media.get(g.m.src):null;
 if(v!==curVid){if(curVid)curVid.pause();curVid=v;if(v){hookAudio(v);try{v.currentTime=g.m.inT+(t-g.s)}catch(e){}v.play().catch(()=>{})}}
 draw(t);requestAnimationFrame(loop)}
function play(){if(!SEG.length)return;ensureAudio();AC&&AC.resume();if(tNow>=total()-.05)tNow=0;playing=true;t0=performance.now()-tNow*1000;if(music){music.currentTime=tNow;music.play().catch(()=>{})}$('play').textContent='❚❚';loop()}
function stop(end){playing=false;if(curVid){curVid.pause();curVid=null}if(music)music.pause();$('play').textContent='▶';if(end&&exporting)setTimeout(()=>rec&&rec.state!=='inactive'&&rec.stop(),300)}
$('play').onclick=()=>playing?stop():play();
$('seek').oninput=e=>{stop();draw(e.target.value/1000*total())};
// ---------- steps UI ----------
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function renderSteps(){
 $('steps').innerHTML=S.steps.map((s,i)=>{const T=TYPES[s.type];return `<div class="step${s.id===sel?' sel':''}" style="--c:${T.c}" data-id="${s.id}">
 <div class="shd" data-act="sel"><span class="em">${T.e}</span><span class="tt"><b>${i+1}. ${esc(s.type==='route'?`${s.from||'Start'} → ${s.to||'Finish'}`:(s.title||T.n))}</b><small>${T.n}${s.type==='route'?' · animated map':` · ${s.media.length} clip${s.media.length===1?'':'s'}`}</small></span>
 <span class="ord"><button class="btn sm" data-act="up" aria-label="Move up" ${i?'':'disabled'}>↑</button><button class="btn sm" data-act="down" aria-label="Move down" ${i<S.steps.length-1?'':'disabled'}>↓</button></span></div>
 <div class="sbody">
  <div class="grid2">
   <label>Step type<select data-f="type">${Object.entries(TYPES).map(([k,v])=>`<option value="${k}" ${k===s.type?'selected':''}>${v.e} ${v.n}</option>`).join('')}</select></label>
   <label>Transition out<select data-f="tr"><option value="">Default</option>${['fade','zoom','slide','whip','iris'].map(x=>`<option ${x===s.tr?'selected':''}>${x}</option>`).join('')}</select></label>
   ${s.type==='route'?`<label>From<input type="text" data-f="from" value="${esc(s.from)}" maxlength="30"></label><label>To<input type="text" data-f="to" value="${esc(s.to)}" maxlength="30"></label>`:`<label>Title<input type="text" data-f="title" value="${esc(s.title)}" maxlength="40"></label>`}
   <label>Caption<input type="text" data-f="sub" value="${esc(s.sub)}" maxlength="44"></label>
  </div>
  ${s.type==='route'?'':`<div class="media">${s.media.map((m,j)=>mediaTile(s,m,j)).join('')}<button class="addm" data-act="add">＋<br>Photos / videos</button></div>
  <div id="trim-${s.id}"></div>`}
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="btn sm" data-act="dup">Duplicate</button><button class="btn sm" data-act="del">Delete step</button>${s.media.some(m=>m.kind==='video')&&S.style.modes.pick!=='you'?`<button class="btn sm" data-act="autoall">${S.style.modes.pick==='ai'?'🤖':'⚙️'} Auto-pick clips</button>`:''}${S.style.modes.cap==='ai'&&s.type!=='route'?`<button class="btn sm" data-act="cap1">🤖 Write caption</button>`:''}</div>
 </div></div>`}).join('');
}
function mediaTile(s,m,j){const el=media.get(m.src)||load(m);const bg=m.kind==='image'?`background-image:url('${m.src}')`:'';
 return `<div class="mi" data-m="${m.id}"><div class="th" style="${bg}">${m.kind==='video'?`<em>${(Math.max(0,(m.outT??0)-m.inT)).toFixed(1)}s</em>`:''}</div><div class="ac"><button data-act="mleft" aria-label="Earlier">‹</button>${m.kind==='video'?'<button data-act="trim" aria-label="Trim">✂</button>':''}<button data-act="mdel" aria-label="Remove">✕</button><button data-act="mright" aria-label="Later">›</button></div></div>`}
function thumbs(){for(const s of S.steps)for(const m of s.media)if(m.kind==='video'){const el=media.get(m.src);const box=document.querySelector(`[data-m="${m.id}"] .th`);if(!el||!box||box._v)continue;const c=document.createElement('canvas');c.width=90;c.height=160;c.style.cssText='width:100%;height:100%;display:block';box.prepend(c);box._v=1;const go=()=>{try{const x=c.getContext('2d'),s2=Math.max(90/el.videoWidth,160/el.videoHeight);x.drawImage(el,(90-el.videoWidth*s2)/2,(160-el.videoHeight*s2)/2,el.videoWidth*s2,el.videoHeight*s2)}catch(e){}};el.readyState>=2?go():el.addEventListener('loadeddata',go,{once:true})}}
const stepOf=e=>S.steps.find(s=>s.id===e.target.closest('.step')?.dataset.id);
$('steps').addEventListener('click',async e=>{
 const b=e.target.closest('[data-act]');if(!b)return;const s=stepOf(e);if(!s)return;const act=b.dataset.act,i=S.steps.indexOf(s);
 if(act==='sel'&&!e.target.closest('button')){sel=sel===s.id?null:s.id;renderSteps();thumbs();const g=SEG.find(x=>x.step===s);if(g){stop();draw(g.s+.05)}return}
 if(act==='up'||act==='down'){snap();const j=i+(act==='up'?-1:1);[S.steps[i],S.steps[j]]=[S.steps[j],S.steps[i]]}
 else if(act==='del'){snap();S.steps.splice(i,1)}
 else if(act==='dup'){snap();S.steps.splice(i+1,0,{...s,id:nid(),media:s.media.map(m=>({...m,id:nid()}))})}
 else if(act==='add'){addTarget=s;$('fileIn').click();return}
 else if(act==='autoall'){for(const m of s.media)if(m.kind==='video')await autoPick(m,s.type);}
 else if(act==='cap1'){snap();try{status('✨ Writing caption…');await captionStep(s);status('Caption updated.')}catch(e){}}
 else{const mi=e.target.closest('[data-m]');const m=s.media.find(x=>x.id===mi?.dataset.m);if(!m)return;const j=s.media.indexOf(m);
  if(act==='mdel'){snap();s.media.splice(j,1)}
  else if(act==='mleft'&&j>0){snap();[s.media[j-1],s.media[j]]=[s.media[j],s.media[j-1]]}
  else if(act==='mright'&&j<s.media.length-1){snap();[s.media[j+1],s.media[j]]=[s.media[j],s.media[j+1]]}
  else if(act==='trim'){openTrim(s,m);return}}
 commit();
});
$('steps').addEventListener('input',e=>{const f=e.target.dataset.f;if(!f)return;const s=stepOf(e);if(!s)return;
 if(f==='type'){snap();const old=TYPES[s.type],n=TYPES[e.target.value];if(s.title===old.t)s.title=n.t;if(s.sub===old.s)s.sub=n.s;s.type=e.target.value;if(s.type==='route'){s.from=s.from||'Start';s.to=s.to||'Finish'}commit();return}
 s[f]=e.target.value;save();build();if(!playing)draw(Math.min(tNow,total()));
 const b=e.target.closest('.step').querySelector('.tt b');if(b)b.textContent=`${S.steps.indexOf(s)+1}. ${s.type==='route'?`${s.from||'Start'} → ${s.to||'Finish'}`:(s.title||TYPES[s.type].n)}`});
$('steps').addEventListener('change',e=>{if(e.target.dataset.f&&e.target.dataset.f!=='type')snap()});
function commit(){save();build();renderSteps();thumbs();if(!playing)draw(Math.min(tNow,total()))}
function openTrim(s,m){const box=$('trim-'+s.id),el=media.get(m.src);if(!el)return;const D=el.duration||0;
 box.innerHTML=`<div class="trim"><b>Trim clip</b><div class="rw"><label style="flex:1">Start ${'<span id="tin"></span>'}<input type="range" id="trIn" min="0" max="${D}" step="0.1" value="${m.inT}"></label></div>
 <div class="rw"><label style="flex:1">Length <span id="tlen"></span><input type="range" id="trLen" min="0.5" max="${Math.min(15,D)}" step="0.1" value="${((m.outT??m.inT+3)-m.inT).toFixed(1)}"></label></div>
 <div class="rw"><button class="btn sm" id="trAuto">${S.style.modes.pick==='ai'?'🤖':'⚙️'} Auto-pick best moment</button><button class="btn sm" id="trDone">Done</button></div><p class="note">${S.style.modes.pick==='ai'?'Code shortlists up to 4 moments, then the AI chosen in Settings picks the best.':'Scores every half-second for sharpness, movement and light, in your browser — no AI usage.'}</p></div>`;
 const upd=()=>{m.inT=+$('trIn').value;m.outT=+Math.min(D,m.inT+ +$('trLen').value).toFixed(1);$('tin').textContent=m.inT.toFixed(1)+'s';$('tlen').textContent=(m.outT-m.inT).toFixed(1)+'s';build();const g=SEG.find(x=>x.m===m);if(g){stop();draw(g.s+.05)}save()};
 $('trIn').oninput=upd;$('trLen').oninput=upd;$('trIn').onchange=$('trLen').onchange=()=>snap();upd();
 $('trAuto').onclick=async()=>{snap();await autoPick(m,s.type);$('trIn').value=m.inT;$('trLen').value=m.outT-m.inT;upd()};
 $('trDone').onclick=()=>{box.innerHTML='';renderSteps();thumbs()}}
// ---------- code-based moment picker ----------
async function autoPick(m,stepType){
 if(S.style.modes.pick==='you'){status('Pick mode is “You”: trim with the sliders.');return}
 const L0=+S.style.cl,file=FILES.get(m.src);
 if(file&&TV.engines.pick('autopick')==='python'){try{status('🐍 Laptop server is scoring the clip…');const j=await TV.engines.autopick(file,L0,4);const D=j.duration||0,L=Math.min(L0,D||L0);
   const cands=(j.candidates||[]).map(c=>({t:+c.t,a:+c.score}));if(cands.length){let pick=cands[0],why='';
    if(useAI('pick')&&cands.length>1){const r=await aiPickWindow(m,cands,L,stepType);if(r){pick=r.c;why=r.why}}
    m.inT=+pick.t.toFixed(1);m.outT=+Math.min(D||pick.t+L,m.inT+L).toFixed(1);status(`${why?'🤖 AI picked':'🐍 Picked'} ${m.inT.toFixed(1)}s – ${m.outT.toFixed(1)}s${why?' · '+why:''}`);return}}
  catch(e){status('Laptop server auto-pick failed; scanning in the browser instead.')}}
 const src=document.createElement('video');src.src=m.src;src.muted=true;src.preload='auto';src.playsInline=true;
 await new Promise(r=>{src.onloadedmetadata=r;src.onerror=r});const D=src.duration;if(!D||!isFinite(D))return;
 const L=Math.min(+S.style.cl,D),step=Math.max(.5,D/120),c=document.createElement('canvas');c.width=48;c.height=86;const x=c.getContext('2d',{willReadFrequently:true});
 const sc=[];let prev=null;status('⚙️ Scanning clip for the best moment…');
 for(let t=0;t<D;t+=step){await new Promise(r=>{src.onseeked=r;src.currentTime=Math.min(D-.05,t)});
  x.drawImage(src,0,0,48,86);const d=x.getImageData(0,0,48,86).data,g=new Float32Array(48*86);let br=0;
  for(let i=0;i<g.length;i++){g[i]=.3*d[i*4]+.59*d[i*4+1]+.11*d[i*4+2];br+=g[i]}br/=g.length;
  let lap=0;for(let yy=1;yy<85;yy++)for(let xx=1;xx<47;xx++){const i=yy*48+xx,v=4*g[i]-g[i-1]-g[i+1]-g[i-48]-g[i+48];lap+=v*v}lap/=46*84;
  let mo=0;if(prev){for(let i=0;i<g.length;i++)mo+=Math.abs(g[i]-prev[i]);mo/=g.length}prev=g;
  sc.push({t,lap,mo,br})}
 const mx=k=>Math.max(...sc.map(s=>s[k]))||1;const ML=mx('lap'),MM=mx('mo');
 const val=sc.map(s=>.6*s.lap/ML+.3*Math.min(1,s.mo/MM*1.4)-.4*Math.max(0,Math.abs(s.br-125)-70)/60);
 const n=Math.max(1,Math.round(L/step));const win=[];for(let i=0;i+n<=val.length;i++){let a=0;for(let j=i;j<i+n;j++)a+=val[j];win.push({i,a,t:sc[i].t})}
 win.sort((p,q)=>q.a-p.a);const cands=[];for(const w of win){if(cands.every(c=>Math.abs(c.t-w.t)>=L))cands.push(w);if(cands.length===4)break}
 let pick=cands[0]||{t:0},why='';
 if(useAI('pick')&&cands.length>1){const r=await aiPickWindow(m,cands,L,stepType);if(r){pick=r.c;why=r.why}}
 m.inT=+pick.t.toFixed(1);m.outT=+Math.min(D,m.inT+L).toFixed(1);status(`${why?'🤖 AI picked':'⚙️ Picked'} ${m.inT.toFixed(1)}s – ${m.outT.toFixed(1)}s${why?' · '+why:''}`);
}
let addTarget=null;
$('fileIn').onchange=async e=>{const s=addTarget;if(!s)return;snap();const fs=[...e.target.files];e.target.value='';
 for(const f of fs){const m=M(URL.createObjectURL(f),f.type.startsWith('video')?'video':'image');FILES.set(m.src,f);s.media.push(m);load(m)}
 commit();status(`Added ${fs.length} file${fs.length===1?'':'s'} to “${s.title||TYPES[s.type].n}”. Files stay on this device.`);
 for(const m of s.media)if(m.kind==='video'&&m.src.startsWith('blob:')&&!m._auto&&S.style.modes.pick!=='you'){m._auto=1;await new Promise(r=>setTimeout(r,300));await autoPick(m,s.type);commit()}};
// library
$('lib').innerHTML=Object.entries(TYPES).map(([k,v])=>`<button class="chip" data-t="${k}">${v.e} ${v.n}</button>`).join('');
$('lib').onclick=e=>{const b=e.target.closest('[data-t]');if(!b)return;snap();const s=mk(b.dataset.t);if(s.type==='route'){s.from='Start';s.to='Finish'}const i=S.steps.findIndex(x=>x.id===sel);S.steps.splice(i<0?S.steps.length:i+1,0,s);sel=s.id;commit()};
// templates
function applyTpl(list){snap();const pool=[...S.steps];S.steps=list.map(t=>{const k=pool.findIndex(p=>p.type===t);if(k>=0)return pool.splice(k,1)[0];const s=mk(t);if(t==='route'){s.from='Start';s.to='Finish'}return s});sel=S.steps[0]?.id;commit();status('Template applied. Undo restores your previous steps.')}
$('tpls').innerHTML=Object.entries(TPLS).map(([n,l])=>`<button class="tpl" data-n="${esc(n)}"><b>${esc(n)}</b><span>${l.map(t=>TYPES[t].e).join('')}</span></button>`).join('');
$('tpls').onclick=e=>{const b=e.target.closest('[data-n]');if(b)applyTpl(TPLS[b.dataset.n])};
const myT=()=>{try{return JSON.parse(localStorage.getItem('tourTpls')||'{}')}catch(e){return{}}};
function renderMy(){const m=myT();$('mytpl').innerHTML=Object.keys(m).length?Object.entries(m).map(([n,l])=>`<button class="chip" data-n="${esc(n)}">${esc(n)} ${l.map(t=>TYPES[t]?.e||'').join('')}</button>`).join(''):'<span class="note">None yet.</span>'}
$('mytpl').onclick=e=>{const b=e.target.closest('[data-n]');if(b)applyTpl(myT()[b.dataset.n])};
$('tplSave').onclick=()=>{const n=$('tplName').value.trim();if(!n){status('Give the template a name first.');return}const m=myT();m[n]=S.steps.map(s=>s.type);try{localStorage.setItem('tourTpls',JSON.stringify(m))}catch(e){}$('tplName').value='';renderMy();status(`Saved template “${n}”.`)};
// day & style
const bindD=(id,k,obj)=>{const el=$(id);el.value=obj()[k];el.addEventListener('change',()=>snap());el.addEventListener('input',()=>{obj()[k]=el.value;if(k==='snd')for(const v of media.values())if(v._hooked)v._hooked.gain.value=+el.value;save();build();if(!playing)draw(Math.min(tNow,total()))})};
[['dTrip','trip'],['dNum','num'],['dPlace','place'],['dDate','date'],['dIntro','intro'],['dOutro','outro']].forEach(([i,k])=>bindD(i,k,()=>S.day));
[['sTr','tr'],['sTd','td'],['sPh','ph'],['sCl','cl'],['sSnd','snd'],['sBadge','badge']].forEach(([i,k])=>bindD(i,k,()=>S.style));
$('themes').innerHTML=THEMES.map((t,i)=>`<button aria-label="${t[0]}" title="${t[0]}" aria-pressed="${i==S.style.theme}" data-i="${i}" style="background:linear-gradient(135deg,${t[1]},${t[2]})"></button>`).join('');
$('themes').onclick=e=>{const b=e.target.closest('[data-i]');if(!b)return;snap();S.style.theme=+b.dataset.i;[...$('themes').children].forEach(x=>x.setAttribute('aria-pressed',x===b));commit()};
document.querySelector('.tabs').onclick=e=>{const b=e.target.closest('.tab');if(!b)return;document.querySelectorAll('.tab').forEach(x=>x.setAttribute('aria-selected',x===b));document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('on',p.id==='p-'+b.dataset.p))};
$('undo').onclick=()=>{const s=hist.pop();if(!s)return;S=JSON.parse(s);$('undo').disabled=!hist.length;S.steps.forEach(st=>st.media.forEach(load));commit()};
$('music').onchange=e=>{const f=e.target.files[0];if(!f)return;music=new Audio(URL.createObjectURL(f));music.loop=true;status('🎵 Music added: '+f.name)};
const status=s=>$('status').textContent=s;
// export
let rec,chunks,downloads=null;
async function saveFile(blob,name){
 if(!downloads){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();status('Saved '+name+' to your Downloads');return}
 try{await downloads.save({filename:name,data:blob});status('Saved '+name)}catch(err){status(err?.code==='declined'?'Save cancelled.':'Could not save: '+(err?.message||err?.code))}}
(async()=>{try{downloads=await window.claude?.use?.('downloads')}catch(e){}})();
$('export').onclick=()=>{
 if(exporting||!SEG.length)return;if(!window.MediaRecorder||!cv.captureStream){status('This browser can’t record video — try Chrome on a computer.');return}
 ensureAudio();AC&&AC.resume();const stream=cv.captureStream(30);
 if(AC){if(music){try{const s=AC.createMediaElementSource(music);s.connect(REC_DST);s.connect(AC.destination)}catch(e){}}REC_DST.stream.getAudioTracks().forEach(t=>stream.addTrack(t))}
 const mime=['video/mp4;codecs=avc1,mp4a','video/mp4','video/webm;codecs=vp9,opus','video/webm'].find(m=>MediaRecorder.isTypeSupported(m))||'';
 chunks=[];rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:8e6});rec.ondataavailable=e=>e.data.size&&chunks.push(e.data);
 rec.onstop=async()=>{exporting=false;$('export').disabled=false;const ext=mime.includes('mp4')?'mp4':'webm',blob=new Blob(chunks,{type:mime}),name=`Day${S.day.num||1}_${(S.day.place||'trip').replace(/[^\w]+/g,'_')}.${ext}`;
  let out=blob,outName=name;const eng=TV.engines.pick('export');
  if(eng==='python'){try{status('🐍 Laptop server is converting to MP4 (H.264)…');out=await TV.engines.transcode(blob);outName=name.replace(/\.\w+$/,'.mp4')}catch(err){status('Server conversion failed; saving the browser recording.');out=blob}}
  else if(eng==='android'){try{const r=await TV.engines.nativeExport({day:S.day,style:S.style,steps:S.steps},outName.replace(/\.\w+$/,'.mp4'));if(r&&r.ok){status('📱 Saved '+(r.path||outName));return}}catch(err){}}
  saveFile(out,outName)};
 exporting=true;$('export').disabled=true;status(`⏺ Recording in real time (${fmt(total())})…`);stop();tNow=0;draw(0);rec.start(250);setTimeout(play,200)};

// ---------- helpers: You / Code / AI per task (uses TV.ai + TV.engines) ----------
if(!S.style.modes)S.style.modes={pick:'code',cap:'code',sort:'code'};
for(const k of Object.keys(S.style.modes))if(S.style.modes[k]==='local')S.style.modes[k]='ai';
const TASKMAP={pick:'pick',cap:'captions',sort:'sort'};
const CFG=()=>TV.config,AIL=()=>TV.ai,ENG=()=>TV.engines;
const MODES={
 pick:{you:['You','Trim each clip yourself with the sliders.','Most control, takes the most time.'],
  code:['Code','Scans every ½ s for sharpness, movement and light. Instant.','Can’t see smiles or who is in the shot.'],
  ai:['AI','Code shortlists 4 moments; the AI picks the one with faces, smiles and action.','≈1.5K tokens per clip; a few seconds each.']},
 cap:{you:['You','Type your own title and caption on each step.','Most personal, takes the most time.'],
  code:['Code','Ready-made lines per step type (“Good morning”, “Golden hour”).','Same lines every day; doesn’t know what’s in the photo.'],
  ai:['AI','Looks at 2 frames and writes a fun title + caption with emoji.','≈1K tokens per step; review before exporting.']},
 sort:{you:['You','Add files to each step yourself.','Slowest for a full day of media.'],
  code:['Code','Groups files by the time they were taken: morning → breakfast, noon → lunch, evening → dinner.','Time-only guess; phone file times can be off.'],
  ai:['AI','Looks at a small thumbnail of each file and sorts by what’s in it (beach, food, pool, travel).','≈300 tokens per file; up to 20 files per call.']}};
const FILES=new Map(); // blob src → File, so engines can upload originals
const costCls=c=>/^Free/.test(c)?'free':'paid';
function provLabel(task){const p=AIL().providerFor(TASKMAP[task]||task);return p?{p,txt:`${p.icon} ${p.name}`,cost:p.cost()}:null}
const useAI=task=>S.style.modes[task]==='ai'&&!!AIL().providerFor(TASKMAP[task]);
function renderModes(){
 document.querySelectorAll('.modes').forEach(box=>{const task=box.dataset.task;box.innerHTML=Object.entries(MODES[task]).map(([k,[n,b,t]])=>{
  let badge='Free',cls='free',dis=false,name=n;
  if(k==='ai'){const pl=provLabel(task);if(pl){name=`AI · ${pl.txt}`;badge=pl.cost;cls=costCls(pl.cost)}else{badge='No AI available';cls='na';dis=true}}
  return `<button class="mode" role="radio" data-k="${k}" aria-checked="${S.style.modes[task]===k}" ${dis?'disabled':''}><span class="mh">${{you:'🙋',code:'⚙️',ai:'🤖'}[k]} ${esc(name)}<span class="bd ${cls}">${esc(badge)}</span></span><p>✅ ${b}</p><p class="tr">⚖️ ${t}</p></button>`}).join('')});
 const cm=S.style.modes.cap;$('capAll').textContent=cm==='ai'?'🤖 Write captions for all steps':(cm==='code'?'⚙️ Reset all captions to templates':'Captions are yours to type');$('capAll').disabled=cm==='you'||(cm==='ai'&&!useAI('cap'));
 $('dropLbl').style.display=S.style.modes.sort==='you'?'none':'';
 const st=AIL().status().filter(x=>x.available);
 $('aiAvail').textContent=st.length?'AI ready: '+st.map(x=>`${x.icon} ${x.name} (${x.cost})`).join(', ')+'. Change in Settings.':'No AI provider available here — You and Code still work. See Settings.';
 const pp=provLabel('plan');$('planBy').textContent=pp?`Uses ${pp.txt} · ${pp.cost}`:'AI off: keyword rules (free)';
}
document.querySelector('#p-help').addEventListener('click',e=>{const b=e.target.closest('.mode');if(!b||b.disabled)return;const task=b.closest('.modes').dataset.task;S.style.modes[task]=b.dataset.k;save();renderModes();renderSteps();thumbs()});
const addTok=info=>{const t=info.totals;$('tokTot').textContent=`≈ ${(t.claude+t.paid).toLocaleString()} tokens`+(t.free?` · free local ${t.free.toLocaleString()}`:'')};
async function frameBlob(m,t,w=384){const h=Math.round(w*16/9),c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');
 if(m.kind==='image'){const el=load(m);if(!el.complete)await new Promise(r=>el.onload=r);const s2=Math.max(w/el.naturalWidth,h/el.naturalHeight);x.drawImage(el,(w-el.naturalWidth*s2)/2,(h-el.naturalHeight*s2)/2,el.naturalWidth*s2,el.naturalHeight*s2)}
 else{const v=document.createElement('video');v.src=m.src;v.muted=true;v.preload='auto';await new Promise(r=>{v.onloadedmetadata=r;v.onerror=r});await new Promise(r=>{v.onseeked=r;v.currentTime=Math.min((v.duration||1)-.05,Math.max(0,t))});const s2=Math.max(w/v.videoWidth,h/v.videoHeight);x.drawImage(v,(w-v.videoWidth*s2)/2,(h-v.videoHeight*s2)/2,v.videoWidth*s2,v.videoHeight*s2)}
 return new Promise(r=>c.toBlob(r,'image/jpeg',.72))}
const aiErr=e=>{const c=e&&e.code;if(AIL().isFatal(e)){AIL().disableClaudeView();renderModes();renderSettings()}
 status(c==='rate_limited'?'The AI is busy or you hit a usage limit. Try again later.':c==='not_granted'?'Claude turned off (permission not given). Code still works.':c==='no_provider'?'No AI provider available. Code result kept.':'AI couldn’t help this time ('+(e&&(e.message||c)||'error')+'). Code result kept.')};
async function aiPickWindow(m,cands,L,stepType){
 try{const imgs=[];for(const c of cands)imgs.push(await frameBlob(m,c.t+L/2,320));const pl=provLabel('pick');status(`🤖 ${pl?pl.txt:'AI'} is choosing the best moment…`);
  const r=await AIL().json('pick',`These ${imgs.length} images are candidate moments (image 1 to ${imgs.length}, in order) from a family travel video for a "${TYPES[stepType]?.n||'travel'}" chapter of a highlight reel. Choose the one that will look best: faces visible, smiles, action, sharp, well lit. Reply with only JSON like {"pick":2,"why":"short reason"}.`,imgs);
  const i=Math.max(1,Math.min(cands.length,Math.round(+r.pick||1)))-1;return {c:cands[i],why:String(r.why||'').slice(0,80)}}
 catch(e){aiErr(e);return null}}
async function captionStep(s){
 const ms=s.media.slice(0,2);if(!ms.length&&s.type!=='route')return;
 if(S.style.modes.cap==='code'){const T=TYPES[s.type];s.title=T.t;s.sub=T.s;return}
 try{const imgs=[];for(const m of ms)imgs.push(await frameBlob(m,(m.inT||0)+.5,320));
  const r=await AIL().json('captions',`You write on-screen text for a vertical family vacation reel. This chapter is "${TYPES[s.type].n}" on day ${S.day.num} in ${S.day.place||'a trip'}. ${imgs.length?'The images show the chapter.':''} Write a fun, warm title (max 26 characters, may end with one emoji) and a short caption (max 30 characters, may include one emoji). Reply only JSON {"title":"...","sub":"..."}.`,imgs,{cache:false});
  if(r&&r.title){s.title=String(r.title).slice(0,40);s.sub=String(r.sub||'').slice(0,44)}}
 catch(e){aiErr(e);throw e}}
$('capAll').onclick=async()=>{snap();const mode=S.style.modes.cap;if(mode==='ai')status('🤖 Writing captions…');
 for(const s of S.steps){if(s.type==='route')continue;try{await captionStep(s)}catch(e){break}commit()}if(mode!=='ai')commit();status(mode==='ai'?'Captions written. Edit any you like.':'Captions reset to templates.')};
function hourType(h){return h<10.5?'breakfast':h<12?'explore':h<14?'lunch':h<17?'explore':h<19?'sunset':'dinner'}
$('dayIn').onchange=async e=>{const fs=[...e.target.files].sort((a,b)=>a.lastModified-b.lastModified);e.target.value='';if(!fs.length)return;snap();
 const items=fs.map(f=>{const m=M(URL.createObjectURL(f),f.type.startsWith('video')?'video':'image');FILES.set(m.src,f);return {f,m}});items.forEach(x=>load(x.m));
 let types=items.map(x=>{const d=new Date(x.f.lastModified);return hourType(d.getHours()+d.getMinutes()/60)});let by='time taken';
 if(useAI('sort')){const pl=provLabel('sort');status(`🤖 ${pl.txt} is sorting ${items.length} files…`);const keys=Object.keys(TYPES).filter(k=>k!=='route');
  try{for(let a=0;a<items.length;a+=20){const chunk=items.slice(a,a+20),imgs=[];for(const x of chunk)imgs.push(await frameBlob(x.m,.8,192));
    const r=await AIL().json('sort',`These ${imgs.length} images are thumbnails of one vacation day's photos and videos, in time order (image 1 first). Label each with the best chapter type from: ${keys.join(', ')}. Reply only JSON like {"labels":["breakfast","beach"]} with ${imgs.length} labels in the same order.`,imgs);
    const arr=Array.isArray(r)?r:(r&&r.labels);if(Array.isArray(arr))arr.forEach((t,j)=>{if(keys.includes(t))types[a+j]=t})}by=pl.txt}catch(err){aiErr(err)}}
 const groups=[];items.forEach((x,i)=>{const t=types[i];if(groups.length&&groups[groups.length-1].type===t)groups[groups.length-1].media.push(x.m);else groups.push({type:t,media:[x.m]})});
 for(const g of groups)S.steps.push(mk(g.type,{media:g.media}));commit();status(`Added ${groups.length} steps from ${items.length} files (sorted by ${by}).`);
 if(S.style.modes.pick!=='you')for(const g of groups)for(const m of g.media)if(m.kind==='video'){await autoPick(m,g.type);commit()}};
// ---------- Plan my day ----------
const PLAN_RULES=[[/breakfast|brunch|coffee|morning/i,'breakfast'],[/lunch/i,'lunch'],[/dinner|supper|hibachi|restaurant/i,'dinner'],[/flight|fly|airport|drive|road|train|bus|ferry|transfer|depart/i,'travel'],
 [/check.?in|hotel|resort|cabin|airbnb|arrive|arrival/i,'arrive'],[/beach|pool|swim|snorkel/i,'beach'],[/sunset|golden hour/i,'sunset'],[/park|ride|tour|hike|trail|zip|museum|show|aquarium|kids club|activity/i,'activity'],
 [/check.?out|head (back|home)|return|leave|goodbye/i,'exit'],[/walk|explore|shop|market|old town|visit|stroll/i,'explore']];
function planByRules(txt){const parts=txt.split(/\n|,|;|\bthen\b|→|->|\. /i).map(x=>x.trim()).filter(Boolean);
 return parts.map(p=>{const hit=PLAN_RULES.find(([re])=>re.test(p));const type=hit?hit[1]:'explore';const t=p.replace(/^[-•*\d.)\s]+/,'');
  return {type,title:(t.charAt(0).toUpperCase()+t.slice(1)).slice(0,34),sub:TYPES[type].s}})}
$('planGo').onclick=async()=>{const txt=$('planTxt').value.trim();if(!txt){status('Paste your plan for the day first.');return}
 let steps=null,by='keyword rules';const keys=Object.keys(TYPES);
 if(AIL().providerFor('plan')){const pl=provLabel('plan');status(`🤖 ${pl.txt} is planning your day…`);
  try{const r=await AIL().json('plan',`Turn this vacation day plan into ordered video chapters. Allowed types: ${keys.join(', ')} (use "route" only for a flight or long drive between two named places, with "from" and "to"). For each chapter give a fun title (max 26 characters, may end with one emoji) and a short caption (max 30 characters). Reply only JSON {"steps":[{"type":"breakfast","title":"...","sub":"...","from":"","to":""}]}.\n\nPlan:\n${txt.slice(0,4000)}`,[]);
   const arr=Array.isArray(r)?r:(r&&r.steps);if(Array.isArray(arr)&&arr.length){steps=arr.filter(x=>keys.includes(x.type));by=pl.txt}}catch(e){aiErr(e)}}
 if(!steps||!steps.length)steps=planByRules(txt);
 snap();S.steps=steps.map(x=>{const s=mk(x.type,{title:String(x.title||TYPES[x.type].t).slice(0,40),sub:String(x.sub||'').slice(0,44)});if(x.type==='route'){s.from=String(x.from||'Start').slice(0,30);s.to=String(x.to||'Finish').slice(0,30);s.title=''}return s});
 sel=S.steps[0]?.id;commit();status(`Planned ${S.steps.length} steps (by ${by}). Add photos and videos to each step.`)};
// ---------- Settings: AI options + Engines ----------
const RT_NOTE={browser:'Web page (e.g. claude.ai). Claude helpers can run here; laptop apps can’t be reached.',file:'Opened from a file on this computer. Ollama and LM Studio can be used directly; Claude needs an API key.',
 server:'Served by the laptop server. AI keys stay on the server; ffmpeg export and server auto-pick are available.',exe:'Desktop app. Everything runs on this computer.',apk:'Android app. Native export and on-device AI when the plugin provides them; can use the laptop server over Wi-Fi.'};
function renderSettings(){
 const C=CFG();$('rtBadge').textContent=C.label();$('rtName').textContent=C.label();$('rtNote').textContent=RT_NOTE[C.runtime]||'';
 const st=AIL().status(),opts=['auto','none',...st.map(x=>x.id)];
 $('aiTasks').innerHTML=Object.entries(AIL().TASKS).map(([k,n])=>{const cur=C.get('ai.tasks.'+k,'auto');const p=AIL().providerFor(k);
  return `<label>${esc(n)}<select data-task="${k}">${opts.map(o=>{const x=st.find(y=>y.id===o);return `<option value="${o}" ${o===cur?'selected':''}>${o==='auto'?'Auto':o==='none'?'None (code only)':`${x.icon} ${x.name}${x.available?'':' (unavailable)'}`}</option>`}).join('')}</select><small style="font-weight:600">${p?`Now: ${p.icon} ${esc(p.name)} · ${esc(p.cost())}`:'Now: code only'}</small></label>`}).join('');
 const FIELD={url:['Address','text'],model:['Model','text'],apiKey:['API key','password']};
 $('aiProv').innerHTML=st.map(x=>{const pc=C.get('ai.providers.'+x.id,{});const fields=AIL().get(x.id).fields||[];
  return `<div class="prov" data-prov="${x.id}"><div class="ph"><b>${x.icon} ${esc(x.name)}</b><span class="pill2 ${costCls(x.cost)}">${esc(x.cost)}</span><span class="sp"></span>
   <label class="tog"><input type="checkbox" data-pf="enabled" ${pc.enabled?'checked':''}> On</label><button class="btn sm" data-ptest="${x.id}">Test</button></div>
   <p class="st ${x.available?'ok':''}" id="pst-${x.id}">${x.available?'✅':'○'} ${esc(x.reason)}</p>
   ${fields.length?`<div class="grid2">${fields.map(f=>`<label>${FIELD[f][0]}<input type="${FIELD[f][1]}" data-pf="${f}" value="${esc(pc[f]||'')}" autocomplete="off"></label>`).join('')}</div>`:''}</div>`}).join('')
  +`<p class="note">Auto order: ${C.get('ai.order',[]).map(id=>AIL().get(id)?.icon||id).join(' → ')}</p>`;
 const es=ENG().status();
 $('engJobs').innerHTML=Object.entries(ENG().JOBS).map(([j,n])=>{const id=ENG().pick(j),e=es.find(x=>x.id===id);return `<div class="jobrow"><span>${esc(n)}</span><b>${e.icon} ${esc(e.name)}</b><small style="width:100%;color:var(--mut)">Order: ${C.get('engines.jobs.'+j,[]).map(x=>ENG().ENGINES[x]?.icon||x).join(' → ')}</small></div>`}).join('');
 $('engList').innerHTML=es.map(e=>`<div class="prov"><div class="ph"><b>${e.icon} ${esc(e.name)}</b><span class="sp"></span><button class="btn sm" data-etest="${e.id}">Test</button></div><p class="st ${e.available?'ok':''}" id="est-${e.id}">${e.available?'✅':'○'} ${esc(e.reason)}</p></div>`).join('');
}
$('p-set').addEventListener('change',e=>{const C=CFG();
 const t=e.target.closest('select[data-task]');if(t){C.set('ai.tasks.'+t.dataset.task,t.value);C.save();renderSettings();renderModes();return}
 const f=e.target.dataset.pf,box=e.target.closest('[data-prov]');if(f&&box){const id=box.dataset.prov;C.set(`ai.providers.${id}.${f}`,f==='enabled'?e.target.checked:e.target.value.trim());C.save();
  (id==='ollama'?AIL().refresh():Promise.resolve()).then(()=>{renderSettings();renderModes()})}});
$('p-set').addEventListener('click',async e=>{const pt=e.target.closest('[data-ptest]'),et=e.target.closest('[data-etest]');
 if(pt){const id=pt.dataset.ptest,el=$('pst-'+id);el.textContent='Testing…';const r=await AIL().test(id);renderSettings();renderModes();const el2=$('pst-'+id);if(el2){el2.textContent=(r.ok?'✅ ':'❌ ')+r.msg;el2.className='st'+(r.ok?' ok':'')}}
 if(et){const id=et.dataset.etest;const r=await ENG().test(id);renderSettings();const el=$('est-'+id);if(el){el.textContent=(r.ok?'✅ ':'❌ ')+r.msg;el.className='st'+(r.ok?' ok':'')}}});
$('setRefresh').onclick=async()=>{status('Checking engines and AI providers…');await CFG().detect();await Promise.all([AIL().refresh(),ENG().refresh()]);renderSettings();renderModes();status('Checked.')};
$('setReset').onclick=async()=>{CFG().reset();await Promise.all([AIL().refresh(),ENG().refresh()]);renderSettings();renderModes();status('Settings reset.')};
// init
if(location.protocol==='file:'){let n=0;S.steps.forEach(st=>{const k=st.media.length;st.media=st.media.filter(m=>!m.src.startsWith('samples/'));n+=k-st.media.length});if(n)setTimeout(()=>status('Opened from a file: sample clips removed (browsers block exporting bundled files). Add your own photos/videos to each step.'),600)}
TV.ai.onTokens=addTok;
renderModes();
(async()=>{try{await TV.config.load()}catch(e){}renderSettings();renderModes();
 try{await Promise.all([TV.ai.init(),TV.engines.init()])}catch(e){}renderSettings();renderModes()})();
S.steps.forEach(s=>s.media.forEach(load));build();renderSteps();renderMy();setTimeout(()=>{thumbs();draw(0)},400);document.fonts?.ready.then(()=>draw(tNow));
}
