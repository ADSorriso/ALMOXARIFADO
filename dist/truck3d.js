/* Interactive projected 3D vehicle: no external libraries or trackers. */
(function(){
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const categoryOf=vehicle=>{
    const explicit=String(vehicle.category||'').toLowerCase();
    if(['bus','truck','machine','motorcycle','skidsteer','van'].includes(explicit))return explicit;
    const name=String(vehicle.model||'').toLowerCase();
    if(/bobiquete|bobcat|mini.?carregadeira|skid.?steer/.test(name))return 'skidsteer';
    if(/moto|motocicleta|honda (cg|biz|bros|xre)|yamaha/.test(name))return 'motorcycle';
    if(/ônibus|onibus|micro.?ônibus|volare|marcopolo/.test(name))return 'bus';
    if(/retroescavadeira|escavadeira|trator|pá carregadeira|patrol|motoniveladora|rolo compactador|máquina/.test(name))return 'machine';
    if(/van|ambulância|ambulancia|sprinter|ducato/.test(name))return 'van';
    return 'truck';
  };
  const layoutOf=vehicle=>{
    const raw=String(vehicle.axleLayout||'2,4').split(',').map(x=>Number(x.trim()));
    return raw.length>=2&&raw.length<=6&&((raw.length===2&&raw.every(n=>n===1)&&categoryOf(vehicle)==='motorcycle')||raw.every(n=>n===2||n===4))?raw:[2,4];
  };
  function positions(vehicle){
    const layout=layoutOf(vehicle),wheels=[];let seq=0;
    layout.forEach((qty,a)=>{
      if(qty===1){seq++;wheels.push({id:`E${a+1}-C1`,num:`P${String(seq).padStart(2,'0')}`,axle:a+1,side:'Central',sideCode:'C',slot:1,description:'Simples',qty});return}
      const each=qty/2;
      for(const side of ['L','R'])for(let slot=1;slot<=each;slot++){
        seq++;
        const id=`E${a+1}-${side}${slot}`;
        wheels.push({id,num:`P${String(seq).padStart(2,'0')}`,axle:a+1,side:side==='L'?'Esquerdo':'Direito',sideCode:side,slot,description:each===1?'Simples':slot===1?'Externo':'Interno',qty});
      }
    });
    return wheels;
  }
  function resolvePosition(vehicle,raw){
    if(!raw)return null;
    const wheels=positions(vehicle),exact=wheels.find(w=>w.id===raw||w.num===raw);
    if(exact)return exact;
    const low=String(raw).toLowerCase();
    const axle=low.includes('dianteiro')?1:low.includes('traseiro')?wheels.reduce((n,w)=>Math.max(n,w.axle),1):null;
    const side=low.includes('esquerdo')?'L':low.includes('direito')?'R':null;
    return wheels.find(w=>(!axle||w.axle===axle)&&(!side||w.sideCode===side))||null;
  }
  function create(container,vehicle,history,onSelect){
    const canvas=container.querySelector('canvas');if(!canvas)return()=>{};
    const ctx=canvas.getContext('2d');if(!ctx)return()=>{};
    const layout=layoutOf(vehicle),wheels=positions(vehicle);
    const latest=new Map();for(const record of history){const wheel=resolvePosition(vehicle,record.position);if(wheel&&(!latest.has(wheel.id)||String(record.date)>=String(latest.get(wheel.id).date)))latest.set(wheel.id,record)}
    let yaw=-0.69,pitch=0.30,zoom=1,drag=false,dragMoved=false,last=null,hitTargets=[],selected=null,raf=0;
    const axleZ=i=>i===0?-2.65:layout.length===2?1.52:-0.15+(i-1)*(3.3/(layout.length-2));
    const point=(p,w,h)=>{
      const [x,y,z]=p,cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
      const X=cy*x+sy*z,Z=-sy*x+cy*z,Y=cp*y-sp*Z,depth=sp*y+cp*Z;
      const scale=Math.min(w/9.4,h/5.5)*zoom*(8.5/(8.5+depth*.18));
      return {x:w/2+X*scale,y:h*.60-Y*scale,d:depth,scale};
    };
    function polygon(points,color,stroke){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=color;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.1;ctx.stroke()}}
    function block(x1,y1,z1,x2,y2,z2,colors,w,h,list){
      const v=[[x1,y1,z1],[x2,y1,z1],[x2,y2,z1],[x1,y2,z1],[x1,y1,z2],[x2,y1,z2],[x2,y2,z2],[x1,y2,z2]].map(p=>point(p,w,h));
      const faces=[[0,1,2,3],[4,5,6,7],[0,4,7,3],[1,5,6,2],[3,2,6,7],[0,1,5,4]];
      faces.forEach((ids,i)=>list.push({depth:ids.reduce((s,j)=>s+v[j].d,0)/4,draw:()=>polygon(ids.map(j=>v[j]),colors[i],i===4?'#91c6fc30':'#172c46')}));
    }
    function surface(coords,fill,width,height,list,stroke='#16324b44'){
      const pts=coords.map(p=>point(p,width,height));
      list.push({depth:pts.reduce((s,p)=>s+p.d,0)/pts.length,draw:()=>polygon(pts,fill,stroke)});
    }
    function bar(a,b,color,lineWidth,width,height,list){
      const p=point(a,width,height),q=point(b,width,height);
      list.push({depth:(p.d+q.d)/2,draw:()=>{ctx.strokeStyle=color;ctx.lineWidth=lineWidth;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke()}});
    }
    function decal(text,a,b,color,fontSize,width,height,list){
      const p=point(a,width,height),q=point(b,width,height);
      list.push({depth:(p.d+q.d)/2,draw:()=>{
        ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(q.y-p.y,q.x-p.x));
        ctx.font=`900 ${clamp(p.scale*fontSize,11,28)}px Manrope, sans-serif`;
        ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(text,0,0);
        ctx.restore();
      }});
    }
    function wheelEntity(w,entry,width,height){
      const z=axleZ(w.axle-1),each=w.qty/2;
      const side=w.sideCode==='L'?-1:1;
      const x=w.sideCode==='C'?0:side*(each===1?1.0:w.slot===1?1.22:.83);
      const center=point([x,.48,z],width,height),rim=point([x+side*.17,.48,z],width,height);
      const radius=Math.max(12,center.scale*.46),bright=Boolean(entry),shade=bright?'#eb484d':'#1b242b';
      return {depth:center.d,center,radius,draw(){
        const rx=clamp(radius*(.43+.55*Math.abs(Math.cos(yaw))),radius*.40,radius);
        ctx.save();ctx.translate(center.x,center.y);ctx.rotate(Math.sin(yaw)*-.10);
        ctx.shadowColor=bright?'#f14a5c99':'#000a';ctx.shadowBlur=bright?18:8;
        ctx.fillStyle=bright?'#8b111e':'#070b0e';ctx.beginPath();ctx.ellipse(0,0,rx*1.19,radius*1.08,0,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
        ctx.fillStyle=shade;ctx.beginPath();ctx.ellipse(0,0,rx,radius,0,0,Math.PI*2);ctx.fill();
        for(let k=0;k<11;k++){const ang=k*Math.PI*2/11;ctx.strokeStyle=bright?'#ff9a9a33':'#85909c2a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(Math.cos(ang)*rx*.79,Math.sin(ang)*radius*.82);ctx.lineTo(Math.cos(ang)*rx*.94,Math.sin(ang)*radius*.98);ctx.stroke()}
        ctx.fillStyle=bright?'#f7a1a4':'#5c7080';ctx.beginPath();ctx.ellipse(0,0,rx*.49,radius*.49,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle=bright?'#90242d':'#253b4d';ctx.beginPath();ctx.ellipse(0,0,rx*.23,radius*.23,0,0,Math.PI*2);ctx.fill();ctx.restore();
      }};
    }
    function draw(){
      const rect=container.getBoundingClientRect(),width=Math.max(320,rect.width),height=Math.max(270,rect.height);
      const dpr=Math.min(window.devicePixelRatio||1,2);if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr)}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
      const gradient=ctx.createRadialGradient(width*.50,height*.40,10,width*.5,height*.5,width*.65);gradient.addColorStop(0,'#edf5ff');gradient.addColorStop(1,'#d6e5f7');ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
      ctx.strokeStyle='#154b9b1b';ctx.lineWidth=1;for(let i=-7;i<=7;i++){const a=point([-6,0,i],width,height),b=point([6,0,i],width,height);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}
      const entities=[],category=categoryOf(vehicle);
      const blue=['#194f9c','#143f80','#2168b9','#174789','#2d7bd0','#102e5d'];
      const yellow=['#e2a818','#d69a12','#eabf35','#bf8b0b','#ffd54d','#8c650e'];
      const glass=['#172c3e','#203c52','#162b3e','#1c394f','#294e64','#102335'];
      if(category==='bus'||category==='van'){
        const bus=category==='bus',on84=bus&&(String(vehicle.patrimony||'')==='0085300'||/^ON[\s-]?84$/i.test(String(vehicle.prefix||''))),roof=bus?2.68:2.36,zFront=bus?-3.44:-3.27,zRear=bus?2.67:2.40;
        const body=bus?yellow:blue;
        block(-.91,.62,zFront,.91,roof,zRear,body,width,height,entities);
        block(-.91,1.71,zFront+.13,.91,roof-.12,zRear-.12,glass,width,height,entities);
        surface([[-.86,1.70,zFront-.013],[.86,1.70,zFront-.013],[.80,roof-.20,zFront-.013],[-.80,roof-.20,zFront-.013]],'#142b40',width,height,entities);
        for(let i=0;i<(bus?7:4);i++){
          const z=zFront+.50+i*(bus?.72:1.05);
          for(const x of [-.924,.924]){
            surface([[x,1.76,z],[x,2.53-(bus?0:.33),z],[x,2.53-(bus?0:.33),z+.58],[x,1.76,z+.58]],i%2?'#263b4a':'#1a3445',width,height,entities);
            bar([x,1.76,z+.61],[x,2.53-(bus?0:.33),z+.61],'#a8b5b999',1.3,width,height,entities);
          }
        }
        block(-.86,.72,zFront-.10,.86,1.12,zFront+.02,['#d9e1e8','#a5b5c8','#b5c3ce','#9eacb8','#cbd7e2','#8295aa'],width,height,entities);
        for(const x of [-.70,.70])surface([[x-.12,.91,zFront-.12],[x+.12,.91,zFront-.12],[x+.10,1.03,zFront-.12],[x-.10,1.03,zFront-.12]],'#f5f5cb',width,height,entities);
        bar([-.88,roof,zFront+.20],[.88,roof,zFront+.20],'#fff1ad',3,width,height,entities);
        bar([-.91,1.65,zFront+.10],[-.91,1.65,zRear-.15],bus?'#f8e4a4':'#a3c7f1',2,width,height,entities);
        bar([.91,1.65,zFront+.10],[.91,1.65,zRear-.15],bus?'#f8e4a4':'#a3c7f1',2,width,height,entities);
        if(on84){
          // ON-84: Volare amarelo com faixa escura da fotografia de referência nº 5.
          for(const x of [-.942,.942]){
            surface([[x,1.16,zFront+.32],[x,1.76,zFront+.32],[x,1.76,zRear-.08],[x,1.16,zRear-.08]],'#111820',width,height,entities);
            bar([x,1.78,zFront+.34],[x,1.78,zRear-.10],'#e8bc28',3,width,height,entities);
            bar([x,1.13,zFront+.35],[x,1.13,zRear-.09],'#c69217',1,width,height,entities);
            // Porta de passageiros, logo atrás do eixo dianteiro.
            surface([[x,1.17,-1.94],[x,2.32,-1.94],[x,2.32,-1.21],[x,1.17,-1.21]],'#172d3a',width,height,entities);
            bar([x,1.19,-1.60],[x,2.34,-1.60],'#a3a9a6',2,width,height,entities);
            bar([x,1.18,-1.94],[x,1.18,-1.21],'#e8ca64',2,width,height,entities);
            decal('ESCOLAR',[x,1.44,.99],[x,1.44,.45],'#fbd02b',.23,width,height,entities);
          }
          // Para-brisa panorâmico inclinado com contorno de borracha.
          surface([[-.81,1.68,zFront-.082],[.81,1.68,zFront-.082],[.72,2.54,zFront+.13],[-.72,2.54,zFront+.13]],'#0a1d2b',width,height,entities,'#071624');
          bar([-.78,1.68,zFront-.086],[.76,1.68,zFront-.086],'#6a8795',2,width,height,entities);
          bar([-.76,1.73,zFront-.094],[.18,1.94,zFront-.077],'#4e6777',2,width,height,entities);
          // Máscara frontal e grade cromada trapezoidal.
          surface([[-.67,.98,zFront-.12],[.67,.98,zFront-.12],[.46,.65,zFront-.12],[-.46,.65,zFront-.12]],'#232a31',width,height,entities);
          for(let g=0;g<4;g++)bar([-.52,.73+g*.063,zFront-.14],[.52,.73+g*.063,zFront-.14],'#8b9ca5',1.4,width,height,entities);
          for(const x of [-.62,.62]){
            surface([[x-.17,1.06,zFront-.135],[x+.17,1.06,zFront-.135],[x+.10,1.19,zFront-.135],[x-.10,1.19,zFront-.135]],'#e2e6dd',width,height,entities);
            bar([x*.93,2.12,zFront+.2],[x*1.65,2.11,zFront-.22],'#32383b',3,width,height,entities);
            bar([x*1.65,2.11,zFront-.22],[x*1.72,1.84,zFront-.27],'#313b43',5,width,height,entities);
          }
          // Faixa de vidro traseiro e lanternas verticais.
          surface([[-.82,1.77,zRear+.026],[.82,1.77,zRear+.026],[.77,2.52,zRear+.026],[-.77,2.52,zRear+.026]],'#142936',width,height,entities);
          for(const x of [-.79,.79]){
            surface([[x-.075,.77,zRear+.05],[x+.075,.77,zRear+.05],[x+.075,1.54,zRear+.05],[x-.075,1.54,zRear+.05]],'#bd2430',width,height,entities);
          }
          decal('ESCOLAR',[0,1.34,zRear+.065],[.80,1.34,zRear+.065],'#14202c',.25,width,height,entities);
          for(const x of [-.92,.92])bar([x,.91,zFront+.35],[x,.91,zRear-.13],'#f6d24b',2,width,height,entities);
        }
      }else if(category==='machine'){
        block(-.83,.55,-2.80,.83,1.15,2.65,yellow,width,height,entities);
        block(-.70,1.08,-.85,.70,2.45,.95,yellow,width,height,entities);
        block(-.72,1.32,-.88,.72,2.29,.92,glass,width,height,entities);
        block(-1.12,.20,-3.85,1.12,.71,-3.12,['#555e65','#677987','#727b82','#48535d','#89949b','#3a414a'],width,height,entities);
        for(const x of [-.93,.93]){
          bar([x,.70,-3.22],[x,.83,-1.10],'#444d56',6,width,height,entities);
          bar([x,.83,-1.10],[x,.56,-3.30],'#8c9fae',4,width,height,entities);
        }
        block(-.7,2.30,-.6,.7,2.51,.82,yellow,width,height,entities);
      }else if(category==='skidsteer'){
        block(-.88,.54,-1.54,.88,1.20,1.72,yellow,width,height,entities);
        block(-.72,1.16,-.45,.72,2.13,1.05,glass,width,height,entities);
        block(-.78,2.08,-.53,.78,2.26,1.12,['#d5a016','#c58e0c','#e9bd28','#b68409','#f5c742','#8c6408'],width,height,entities);
        block(-1.16,.18,-2.71,1.16,.57,-1.93,['#626f76','#545e65','#76838a','#4d585f','#88969e','#3a444b'],width,height,entities);
        for(const x of [-.95,.95])bar([x,.43,-2.42],[x,1.44,-.52],'#49525c',7,width,height,entities);
      }else if(category==='motorcycle'){
        block(-.28,.73,-1.29,.28,1.00,1.21,blue,width,height,entities);
        block(-.34,1.03,-.8,.34,1.28,.28,blue,width,height,entities);
        block(-.39,1.27,.05,.39,1.40,1.07,['#212c34','#253642','#223544','#18232e','#344859','#141e28'],width,height,entities);
        bar([0,.79,-2.55],[0,1.37,-1.09],'#a5b6c4',7,width,height,entities);
        bar([-.69,1.51,-1.34],[.69,1.51,-1.34],'#2e3d49',5,width,height,entities);
        bar([0,.70,1.48],[0,1.23,.20],'#6a8398',6,width,height,entities);
        block(-.27,.91,-1.25,.27,1.06,-.83,['#b6c9da','#9aafbf','#b5c9d9','#95afc7','#dce8f3','#708aa1'],width,height,entities);
      }else{
        block(-.75,.62,-3.33,.75,2.07,-1.66,blue,width,height,entities);
        block(-.82,.67,-1.60,.82,1.46,2.55,blue,width,height,entities);
        block(-.86,.75,-3.42,.86,1.13,-3.25,['#b8d2e7','#1c5ca8','#134b97','#154b89','#2b82cb','#152e5d'],width,height,entities);
        block(-.76,1.50,-3.21,.76,1.94,-2.40,glass,width,height,entities);
        block(-.80,.59,-1.64,.80,.80,2.73,['#15263d','#15263d','#253d56','#253d56','#355774','#1a2e44'],width,height,entities);
        for(const x of [-.68,.68])surface([[x-.12,1.03,-3.44],[x+.12,1.03,-3.44],[x+.1,1.16,-3.44],[x-.1,1.16,-3.44]],'#f3f4d8',width,height,entities);
      }
      for(const w of wheels)entities.push(wheelEntity(w,latest.get(w.id),width,height));
      entities.sort((a,b)=>b.depth-a.depth).forEach(e=>e.draw());
      hitTargets=[];
      for(const w of wheels){const side=w.sideCode==='L'?-1:1;const x=w.sideCode==='C'?0:side*(w.qty===2?1:w.slot===1?1.22:.83);const p=point([x,.48,axleZ(w.axle-1)],width,height);const isChanged=latest.has(w.id);hitTargets.push({w,x:p.x,y:p.y,r:Math.max(16,p.scale*.50)});ctx.font='700 12px Manrope, sans-serif';const pad=7,labelWidth=ctx.measureText(w.num).width+pad*2;const lx=p.x-labelWidth/2,ly=p.y-p.scale*.64-19;ctx.fillStyle=selected===w.id?'#f5f7ff':isChanged?'#e84050':'#111e2cf0';ctx.strokeStyle=isChanged?'#ffadb3':'#52677e';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(lx,ly,labelWidth,23,6);ctx.fill();ctx.stroke();ctx.fillStyle=selected===w.id?'#0f1a24':'#fff';ctx.fillText(w.num,lx+pad,ly+15)}
      ctx.fillStyle='#315b8e';ctx.font='700 11px DM Sans, sans-serif';ctx.fillText(({bus:'ÔNIBUS',truck:'CAMINHÃO',machine:'MÁQUINA',motorcycle:'MOTOCICLETA',skidsteer:'MINICARREGADEIRA',van:'VAN'})[category]+'  •  ARRASTE PARA GIRAR  •  ROLE PARA APROXIMAR',15,height-18);
    }
    function schedule(){if(!raf)raf=requestAnimationFrame(()=>{raf=0;draw()})}
    const pointerDown=e=>{drag=true;dragMoved=false;last={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId)};
    const pointerMove=e=>{if(!drag)return;const dx=e.clientX-last.x,dy=e.clientY-last.y;if(Math.abs(dx)+Math.abs(dy)>1)dragMoved=true;yaw+=dx*.009;pitch=clamp(pitch+dy*.005,-.30,.90);last={x:e.clientX,y:e.clientY};schedule()};
    const pointerUp=e=>{if(!drag)return;drag=false;if(!dragMoved){const r=canvas.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top;const hit=hitTargets.map(h=>({...h,dist:Math.hypot(px-h.x,py-h.y)})).filter(h=>h.dist<h.r).sort((a,b)=>a.dist-b.dist)[0];if(hit){selected=hit.w.id;onSelect(hit.w,latest.get(hit.w.id)||null);schedule()}}};
    const wheel=e=>{e.preventDefault();zoom=clamp(zoom+(e.deltaY<0?.10:-.10),.58,1.8);schedule()};
    const zoomIn=()=>{zoom=clamp(zoom+.15,.58,1.8);schedule()},zoomOut=()=>{zoom=clamp(zoom-.15,.58,1.8);schedule()};
    const reset=()=>{yaw=-.69;pitch=.30;zoom=1;schedule()};
    const resize=new ResizeObserver(schedule);resize.observe(container);
    canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',pointerUp);canvas.addEventListener('wheel',wheel,{passive:false});
    container.parentElement.querySelector('[data-zoom-in]')?.addEventListener('click',zoomIn);container.parentElement.querySelector('[data-zoom-out]')?.addEventListener('click',zoomOut);container.parentElement.querySelector('[data-reset-view]')?.addEventListener('click',reset);schedule();
    return()=>{resize.disconnect();cancelAnimationFrame(raf);canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointermove',pointerMove);canvas.removeEventListener('pointerup',pointerUp);canvas.removeEventListener('pointercancel',pointerUp);canvas.removeEventListener('wheel',wheel)};
  }
  window.Truck3D={positions,layoutOf,resolvePosition,categoryOf,create};
})();
