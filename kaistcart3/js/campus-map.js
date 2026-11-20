import {campusName} from './campus-identity.js';

const $ = id => document.getElementById(id);
const neighborhoods = {E:'East campus',W:'West campus',N:'North campus'};
const searchNames = {E9:'library art museum academic cultural complex',N11:'Kaimaru student cafeteria north cafeteria',E1:'south main entrance gate',N0:'east gate',N3:'gym sports complex'};
const clamp = (v,min,max) => Math.min(max,Math.max(min,v));
const favoriteRefs = ['E1','E9','N3','N11','E4','E14','W2','W4-2','N25','W6','N1','N7','E16','N0'];
const latScale=110574;

export function segmentsFor(roads) {
  const segments=[];
  for(const road of roads.filter(r=>r.drivable)) for(let i=1;i<road.p.length;i++){
    const [x,z]=road.p[i-1], [x2,z2]=road.p[i], dx=x2-x,dz=z2-z, length2=dx*dx+dz*dz;
    if(length2>.01) segments.push({x,z,dx,dz,length2,road});
  }
  return segments;
}

export function snapToStreet(segments,x,z,access) {
  let best=null, cost=Infinity;
  for(const s of segments){
    const u=clamp(((x-s.x)*s.dx+(z-s.z)*s.dz)/s.length2,0,1);
    const px=s.x+u*s.dx,pz=s.z+u*s.dz,distance=Math.hypot(x-px,z-pz);
    if(distance>=cost)continue;
    let heading=Math.atan2(s.dx,s.dz);
    const groundHint=s.road.bridge?Infinity:-Infinity;
    if(!access.canPlace(px,pz,heading,groundHint))continue;
    const clearance=angle=>{
      for(let ahead=1;ahead<=8;ahead++)if(!access.canPlace(px+Math.sin(angle)*ahead,pz+Math.cos(angle)*ahead,angle,groundHint))return ahead-1;
      return 8;
    };
    let room=clearance(heading);
    if(room<8){const opposite=clearance(heading+Math.PI);if(opposite>room){room=opposite;heading+=Math.PI;}}
    const score=distance+(8-room)*2;
    if(score>=cost)continue;
    best={x:px,z:pz,th:heading,distance,groundHint,road:s.road};cost=score;
  }
  return best;
}

export function geographicPoint(origin,x,z){
  return {lat:origin.lat-z/latScale,lon:origin.lon+x/(111320*Math.cos(origin.lat*Math.PI/180))};
}

export function makePlaces(world){
  const out=[], used=new Set();
  for(const b of world.D.buildings){
    if(!b.ref||!b.p?.length)continue;
    const name=b.ref==='E1'?'Main Gate':campusName(b), key=b.ref+' '+name;
    if(used.has(key))continue;
    const p=b.p, n=p.length-(p.length>1&&p[0][0]===p.at(-1)[0]&&p[0][1]===p.at(-1)[1]?1:0);
    if(!n)continue;
    const x=p.slice(0,n).reduce((a,v)=>a+v[0],0)/n,z=p.slice(0,n).reduce((a,v)=>a+v[1],0)/n;
    used.add(key);out.push({name,ref:b.ref,x,z,outline:b.p});
  }
  for(const v of world.explore.landmarks||[]){
    if(!Number.isFinite(v.x)||!Number.isFinite(v.z))continue;
    const name=(v.en||v.name||'').trim();
    if(!name||/[\uac00-\ud7af]/.test(name)||out.some(p=>p.ref && p.ref===v.ref || p.name===name&&Math.hypot(v.x-p.x,v.z-p.z)<50))continue;
    out.push({name,ref:v.ref||'',x:v.x,z:v.z});
  }
  return out.sort((a,b)=>{
    const i=favoriteRefs.indexOf(a.ref), j=favoriteRefs.indexOf(b.ref);
    return (i<0?100:i)-(j<0?100:j)||a.ref.localeCompare(b.ref,'en',{numeric:true})||a.name.localeCompare(b.name);
  });
}

function distanceToPlace(place,x,z){
  let distance=Math.hypot(place.x-x,place.z-z);
  for(let i=0;i<(place.outline?.length||0);i++){
    const a=place.outline[i],b=place.outline[(i+1)%place.outline.length],dx=b[0]-a[0],dz=b[1]-a[1];
    const u=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1),0,1);
    distance=Math.min(distance,Math.hypot(x-a[0]-u*dx,z-a[1]-u*dz));
  }
  return distance;
}

export function vehicleApproach(place,segments,access){
  // The W2 pedestrian esplanade and visitor drop-off lie on opposite sides of
  // the building. Its documented vehicle arrival is the small one-way loop.
  if(place.ref==='W2'){
    const loop=segments.filter(s=>s.road.id===504338833);
    const arrival=snapToStreet(loop,place.x,place.z,access);
    if(arrival)return arrival;
  }
  return snapToStreet(segments,place.x,place.z,access);
}

function mapTexture(world){
  const {bounds,roads}=world.explore, {x0,x1,z0,z1}=bounds;
  const scale=2048/Math.max(x1-x0,z1-z0), canvas=document.createElement('canvas');
  canvas.width=Math.ceil((x1-x0)*scale);canvas.height=Math.ceil((z1-z0)*scale);
  const ctx=canvas.getContext('2d');ctx.fillStyle='#314940';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.setTransform(scale,0,0,scale,-x0*scale,-z0*scale);
  function trace(points){ctx.beginPath();for(let i=0;i<points.length;i++){if(i===0)ctx.moveTo(...points[i]);else ctx.lineTo(...points[i]);}}
  function fill(points,color,holes=[]){if(!points?.length)return;trace(points);ctx.closePath();for(const h of holes){if(!h.length)continue;ctx.moveTo(...h[0]);for(const p of h.slice(1))ctx.lineTo(...p);ctx.closePath();}ctx.fillStyle=color;ctx.fill('evenodd');}
  const colors={forest:'#233e33',wood:'#233e33',grass:'#475e46',park:'#405e47',water:'#3a6570',wetland:'#3a6570',pitch:'#5a7252',parking:'#46534b'};
  for(const a of world.D.areas||[])fill(a.p,a.k==='parking'&&a.drivable?'#797f6b':colors[a.k]||'#3d5546',a.holes);
  for(const b of world.D.buildings||[])fill(b.p,b.ref?'#8b9f90':'#6b8074',b.holes);
  ctx.lineCap='round';ctx.lineJoin='round';
  for(const path of [true,false])for(const r of roads){
    if((!r.drivable)!==path||!r.p?.length)continue;
    trace(r.p);ctx.strokeStyle=path?'#8b9f8c':'#f2efcf';ctx.lineWidth=path?Math.max(1.1,r.width*.48||1.5):Math.max(2.9,r.width*.92||4);ctx.stroke();
  }
  for(const gate of world.explore.vehicleGates||[]){
    if(gate.passable||!gate.onDrivableRoad||!Number.isFinite(gate.heading))continue;
    const radius=Math.max(2.5,(gate.width||5)*.5),dx=Math.cos(gate.heading)*radius,dz=-Math.sin(gate.heading)*radius;
    const [x,z]=gate.p;ctx.beginPath();ctx.moveTo(x-dx,z-dz);ctx.lineTo(x+dx,z+dz);ctx.lineWidth=2.1;ctx.strokeStyle='#f59a69';ctx.stroke();
  }
  return {canvas,bounds};
}

function arrow(ctx,x,y,angle,r){
  ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI-angle);ctx.beginPath();ctx.moveTo(0,-r);ctx.lineTo(r*.65,r*.68);ctx.lineTo(0,r*.35);ctx.lineTo(-r*.65,r*.68);ctx.closePath();
  ctx.lineWidth=2.3;ctx.strokeStyle='#18372d';ctx.stroke();ctx.fillStyle='#d5f781';ctx.fill();ctx.restore();
}

export function createCampusMap(world,panoramas){
  const texture=mapTexture(world), bounds=texture.bounds, segments=segmentsFor(world.explore.roads), places=makePlaces(world);
  const extent={w:bounds.x1-bounds.x0,h:bounds.z1-bounds.z0}, lonScale=111320*Math.cos(world.D.origin.lat*Math.PI/180);
  for(const v of panoramas){v.x=(v.lon-world.D.origin.lon)*lonScale;v.z=(world.D.origin.lat-v.lat)*latScale;}
  const mini=$('mini'),full=$('mapCanvas'), origin=world.D.origin;
  let player={x:0,z:0,th:0}, zoom=1, focus, selected, transform, open=false, drag=null, onTravel=null;
  const setFocus=()=>{focus={x:(bounds.x0+bounds.x1)/2,z:(bounds.z0+bounds.z1)/2};};setFocus();
  const nearestPlace=(x,z)=>{let d=Infinity,ans=null;for(const p of places){const v=distanceToPlace(p,x,z);if(v<d){ans=p;d=v;}}return {place:ans,distance:d};};
  const title=p=>[p?.ref,p?.name].filter(Boolean).join(' · ');
  function here(x,z){
    const v=nearestPlace(x,z);
    return v.place && v.distance<105?title(v.place):neighborhoods[v.place?.ref[0]]||'KAIST main campus';
  }
  function paint(ctx,w,h,cx,cz,scale){
    ctx.fillStyle='#273d33';ctx.fillRect(0,0,w,h);
    ctx.drawImage(texture.canvas,(bounds.x0-cx)*scale+w/2,(bounds.z0-cz)*scale+h/2,extent.w*scale,extent.h*scale);
  }
  function update(p){
    player=p;const c=mini.getContext('2d'),w=mini.width,h=mini.height, s=w/275;
    paint(c,w,h,p.x,p.z,s);arrow(c,w/2,h/2,p.th,13);
    const name=here(p.x,p.z);if($('placeName').textContent!==name)$('placeName').textContent=name;
  }
  function draw(){
    if(!open)return;
    const {width:w,height:h}=full.getBoundingClientRect();if(w<5||h<5)return;
    const ratio=Math.min(devicePixelRatio||1,2),c=full.getContext('2d');
    if(full.width!==Math.round(w*ratio)||full.height!==Math.round(h*ratio)){full.width=Math.round(w*ratio);full.height=Math.round(h*ratio);}
    c.setTransform(ratio,0,0,ratio,0,0);
    const scale=Math.min((w-24)/extent.w,(h-24)/extent.h)*zoom;
    const sx=x=>(x-focus.x)*scale+w/2,sy=z=>(z-focus.z)*scale+h/2;
    transform={scale,w,h};paint(c,w,h,focus.x,focus.z,scale);
    const claimed=[];c.font='bold 10px system-ui';c.lineWidth=3;c.lineJoin='round';c.strokeStyle='#203c33';c.fillStyle='#f7f6d8';
    for(const p of places){
      if(!p.ref)continue;
      const x=sx(p.x),y=sy(p.z);if(x<8||x>w-32||y<15||y>h-8||claimed.some(q=>Math.abs(x-q[0])<32&&Math.abs(y-q[1])<16))continue;
      c.strokeText(p.ref,x,y);c.fillText(p.ref,x,y);claimed.push([x,y]);
    }
    if(selected){
      if(selected.place && selected.distance>12){
        c.save();c.strokeStyle='#ffe5a9';c.lineWidth=1.5;c.setLineDash([3,3]);c.beginPath();c.moveTo(sx(selected.x),sy(selected.z));c.lineTo(sx(selected.place.x),sy(selected.place.z));c.stroke();c.restore();
      }
      c.beginPath();c.arc(sx(selected.x),sy(selected.z),7,0,2*Math.PI);c.strokeStyle='#172824';c.lineWidth=5;c.stroke();c.strokeStyle='#ffd57e';c.lineWidth=2.5;c.stroke();
    }
    arrow(c,sx(player.x),sy(player.z),player.th,9);
  }
  function links(p){
    const {lat,lon}=geographicPoint(origin,p.x,p.z),r=Math.PI/180, mx=6378137*lon*r,my=6378137*Math.log(Math.tan(Math.PI/4+lat*r/2));
    const nearby=panoramas.reduce((v,a)=>{const d=Math.hypot(a.x-p.x,a.z-p.z);return d<v.d?{a,d}:v;},{d:35});
    $('streetLink').href=nearby.a?nearby.a.url:'https://map.kakao.com/link/roadview/'+lat.toFixed(6)+','+lon.toFixed(6);
    $('streetLink').textContent=nearby.a?'Naver street view ↗':'Kakao road view ↗';
    $('naverLink').href='https://map.naver.com/p?c='+mx.toFixed(2)+','+my.toFixed(2)+',18.00,0,0,0,adh';
  }
  function refreshSelection(){
    const p=selected||player;
    $('selectedLabel').textContent=selected?'Selected location':'Your location';
    $('selectedName').textContent=selected?.name||here(p.x,p.z);
    $('mapMessage').textContent=selected?(selected.place?'Vehicle approach · '+Math.round(selected.distance)+' m from this place.':''):'Choose a drivable road, car park or building.';
    $('travel').disabled=!selected;links(p);draw();
  }
  function select(x,z,place,pan=false){
    const access=world.access;
    let found=place?vehicleApproach(place,segments,access):snapToStreet(segments,x,z,access);
    // Map taps select the actual vehicle surface, including the open interior of
    // a car park. Named places resolve to their closest accessible approach.
    if(!place){
      const heading=found?.th||0;
      const hint=found?.distance<3?found.groundHint:undefined;
      if(access.canPlace(x,z,heading,hint))found={x,z,th:heading,groundHint:hint};
      else {selected=null;refreshSelection();list();$('mapMessage').textContent='Vehicle access ends here. Select a light-coloured road or car park.';return;}
    }
    if(!found || (place&&found.distance>300)){
      selected=null;refreshSelection();list();$('mapMessage').textContent='No nearby vehicle entrance was found.';return;
    }
    selected={...found,name:place?title(place):here(found.x,found.z),place,distance:place?distanceToPlace(place,found.x,found.z):0};
    if(pan&&zoom>1){focus={x:selected.x,z:selected.z};}
    refreshSelection();list();
  }
  function list(){
    const search=$('placeSearch').value.trim().toLowerCase(), list=$('placeList');list.replaceChildren();
    for(const p of places.filter(p=>(title(p)+' '+(searchNames[p.ref]||'')).toLowerCase().includes(search))){
      const row=document.createElement('button'),ref=document.createElement('small');row.className='place-row';row.type='button';row.setAttribute('aria-pressed',String(selected?.name===title(p)));ref.textContent=p.ref;
      row.append(ref,document.createTextNode(p.name));row.onclick=()=>select(p.x,p.z,p,true);list.append(row);
    }
    if(!list.childNodes.length)list.textContent='No matching place.';
  }
  function point(e){const rect=full.getBoundingClientRect();return {x:focus.x+(e.clientX-rect.left-transform.w/2)/transform.scale,z:focus.z+(e.clientY-rect.top-transform.h/2)/transform.scale};}
  const updateZoom=factor=>{zoom=clamp(zoom*factor,1,8);if(zoom===1)setFocus();draw();};
  $('zoomIn').onclick=()=>updateZoom(1.6);$('zoomOut').onclick=()=>updateZoom(1/1.6);$('fit').onclick=()=>{zoom=1;setFocus();draw();};
  full.onwheel=e=>{e.preventDefault();const p=point(e);if(e.deltaY<0)focus=p;updateZoom(e.deltaY>0?1/1.3:1.3);};
  full.onpointerdown=e=>{drag={id:e.pointerId,x:e.clientX,y:e.clientY,cx:focus.x,cz:focus.z,moved:false};full.setPointerCapture(e.pointerId);};
  full.onpointermove=e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>5)drag.moved=true;if(drag.moved&&zoom>1){focus.x=clamp(drag.cx-dx/transform.scale,bounds.x0,bounds.x1);focus.z=clamp(drag.cz-dy/transform.scale,bounds.z0,bounds.z1);draw();}};
  full.onpointerup=e=>{if(!drag)return;const click=!drag.moved;drag=null;if(click){const p=point(e);select(p.x,p.z,null,false);}};full.onpointercancel=()=>{drag=null;};
  $('placeSearch').oninput=list;$('travel').onclick=()=>{if(selected&&!onTravel(selected))$('mapMessage').textContent='This spot is obstructed. Select another road nearby.';};
  new ResizeObserver(draw).observe(full);
  return {update,initialPose(){const s=snapToStreet(segments,159,462,world.access);if(!s)throw Error('Missing main gate road');if(Math.cos(s.th)>0)s.th+=Math.PI;return s;},
    show(p,travel){open=true;player=p;zoom=1;setFocus();selected=null;onTravel=travel;$('placeSearch').value='';list();refreshSelection();},hide(){open=false;drag=null;}};
}
