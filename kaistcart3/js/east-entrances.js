import * as THREE from '../lib/three.module.min.js';
import {at,box,color,column,frame,groundPoint,panel,plaque,reverseFrame,solid,strip,up,vector} from './east-campus-shapes.js';
import {sejongParts} from './sejong-parts.js';
import {redPine} from './east-campus-plants.js';

export const clinicId=195638213;

export function buildClinicShell(b,hAt,B,group,W){
  const p=b.p,y0=Math.min(...p.map(q=>hAt(...q)))-.15,top=y0+16.2,bridge=y0+3.85;
  const stone=color(0xc5b9bb),tile=color(0x9e959b),glaze=color(0x376d87),glass2=color(0x426a7c);
  const mullion=color(0xabb7b8),silver=color(0xc5c5c3),shade=color(0x4e5961);
  const ccw=THREE.ShapeUtils.area(p.map(q=>new THREE.Vector2(...q)))>0;
  const face=(a,b)=>ccw?frame(a,b):reverseFrame(frame(a,b));
  solid(B.trim,p,top-.17,top+.13,shade);
  for(let i=0;i<p.length;i++){
    const f=face(p[i],p[(i+1)%p.length]),L=f.length;
    if(i===4||i===5)continue; // Two pieces of the same blank, overhanging gable.
    const entrance=i<4,rest=i>8;
    panel(B.glass,f,0,L,y0-1,top,0,rest?stone:entrance?glaze:glass2);
    if(rest){
      for(let u=.7;u<L-.8;u+=3.3){
        for(let y=y0+2.05;y<top-1;y+=3.36)panel(B.glass,f,u,Math.min(L-.2,u+1.72),y,y+1.30,.016,glass2);
      }
    }else{
      for(let u=.12;u<L;u+=1.3)panel(B.trim,f,u,Math.min(L,u+.05),y0,top,.025,mullion);
      for(let y=y0+1.7;y<top-.3;y+=1.8)panel(B.trim,f,0,L,y,y+.06,.034,shade);
      for(const y of [bridge,y0+11.80])panel(B.trim,f,0,L,y,y+.33,.06,silver);
    }
  }
  const end=face(p[4],p[6]),L=end.length;
  const gableBase=y0+7.95;
  panel(B.stone,end,0,L,gableBase,top,.075,stone);
  for(let u=1.5;u<L;u+=1.51)panel(B.trim,end,u,u+.03,gableBase,top,.09,tile);
  for(let y=gableBase+1.42;y<top;y+=1.43)panel(B.trim,end,0,L,y,y+.027,.09,tile);
  panel(B.glass,end,0,L,y0-.25,bridge,-.07,glaze);
  for(let u=.15;u<L;u+=1.04)panel(B.trim,end,u,Math.min(u+.066,L),y0,bridge,-.045,mullion);
  // The first-floor bridge and recessed second-floor terrace both have back
  // walls. Keep the outdoor gap between them open around the round piers.
  panel(B.glass,end,0,L,bridge,gableBase,-2.50,shade);
  box(B.trim,end,0,L,-2.56,.07,gableBase-.19,gableBase,shade);
  box(B.trim,end,0,L,-2.57,.16,bridge-.20,bridge+.08,silver);
  for(let i=0;i<3;i++){const [x,,z]=at(end,1.00+(L-2)*i/2,0,-1.05);column(B.trim,x,z,.31,bridge+.04,gableBase,silver);}
  for(let u=.7;u<L;u+=1.23)box(B.trim,end,u,u+.04,-.12,-.06,bridge,bridge+.89,mullion);
  for(const y of [.32,.57,.87])box(B.trim,end,0,L,-.12,-.065,bridge+y,bridge+y+.035,mullion);
  plaque(group,'E21',end,L*.22,top-1.83,.108,2.34,1.24,'#a96634');
  const front=face(p[0],p[3]);
  // A shallow concave metal canopy spans the main glazed entrance. The dark
  // band below its rim leaves the line of the top truss visible from the road.
  for(let i=0;i<24;i++){
    const u=front.length*i/24,v=front.length*(i+1)/24;
    const roof=s=>top+.14+1.62*((s/front.length-.55)*1.9)**2;
    strip(B.trim,at(front,u,roof(u),.63),at(front,v,roof(v),.63),at(front,v,roof(v)+.26,.63),at(front,u,roof(u)+.26,.63),vector(...front.n),silver);
    strip(B.trim,at(front,u,roof(u)+.26,.63),at(front,v,roof(v)+.26,.63),at(front,v,roof(v)+.26,-2.7),at(front,u,roof(u)+.26,-2.7),up,shade);
    strip(B.glass,at(front,u,top-.11,-1.32),at(front,v,top-.11,-1.32),at(front,v,roof(v),-1.32),at(front,u,roof(u),-1.32),vector(...front.n),color(0x314f5e));
    if(i%3===0)box(B.trim,front,u,u+.095,-1.25,-1.03,top,roof(u)+.08,mullion);
  }
  const por=face(p[1],p[3]),width=Math.min(8.8,por.length-.55);
  box(B.trim,por,.25,.25+width,-.12,1.55,y0+3.05,y0+3.53,shade);
  plaque(group,'KAIST Clinic',por,.25+width/2,y0+3.29,1.57,width-.45,.41,'#f5f5ec');
  const tree=[675.1,61.7];if(!W.access.isDrivable(...tree))redPine(B,tree[0],hAt(...tree),tree[1],2.54,3.9,3.4);
  return {footprint:b.id,top:top+1.64,facility:'KAIST Clinic',panoramas:['-kcl-nhnhdinnQRMKXWq_w','I6sW9DWDTU0zD6Nl7Ce3Ow','O-MGlPlnocVbOdhOS0i0ww']};
}

function soffit(batch,ring,y,shade){
  const outline=ring.map(p=>new THREE.Vector2(...p));
  for(const indices of THREE.ShapeUtils.triangulateShape(outline,[]))
    batch.tri(...indices.map(i=>[ring[i][0],y,ring[i][1]]),[0,-1,0],...indices.map(i=>ring[i]),shade);
}

export function buildSejongEntrance(W,hAt,B,group){
  const lobby=W.D.buildings.find(b=>b.id===1524891713);
  const ring=sejongParts.find(part=>part.type==='canopy')?.p;
  if(!lobby||!ring)return;
  const ground=Math.max(...ring.map(q=>hAt(...q))),eave=ground+3.18;
  const limestone=color(0xbdb9ab),glass=color(0x657c88),silver=color(0xabb0ae),slate=color(0x3c3d43);
  const green=color(0x779486);
  solid(B.trim,lobby.p,Math.min(...lobby.p.map(q=>hAt(...q)))-.28,eave+.04,limestone);
  solid(B.trim,lobby.p,eave+.04,eave+.20,green);
  // The shallow glazed canopy traces the mapped bends from one gallery baldachin to the other.
  solid(B.trim,ring,eave-.17,eave,slate);soffit(B.trim,ring,eave-.17,color(0x9a9b94));
  const sections=[
    [[390.5,-103.8],[388.7,-106.6]],[[394.8,-106.5],[392.8,-109.3]],
    [[399.2,-109.3],[398,-112.8]],[[405.1,-108.1],[405.8,-111.1]],
    [[409.8,-107.1],[413.5,-109.5]],[[412.8,-102.8],[416.4,-105.3]],
    [[415.4,-99.1],[419,-101.6]]
  ];
  const map=(s,t,y)=>[s[0][0]+t*(s[1][0]-s[0][0]),y,s[0][1]+t*(s[1][1]-s[0][1])];
  const mix=(p,q,k)=>p.map((v,i)=>v+(q[i]-v)*k);
  for(let i=1;i<sections.length;i++){
    const a=sections[i-1],b=sections[i],m=.53,height=eave+1.61;
    for(const [edge,left,right] of [[0,eave+.01,height],[1,eave+.01,height]]){
      const v=map(a,edge,left),w=map(b,edge,left),x=map(b,m,right),y=map(a,m,right);
      const normal=new THREE.Vector3().crossVectors(new THREE.Vector3(...w).sub(new THREE.Vector3(...v)),new THREE.Vector3(...y).sub(new THREE.Vector3(...v))).normalize();
      if(normal.y<0)normal.multiplyScalar(-1);
      strip(B.trim,v,w,x,y,normal.toArray(),slate);
      for(let j=1;j<=5;j++){
        const t=j/6,lo=mix(v,y,t),hi=mix(w,x,t);
        strip(B.trim,lo,hi,mix(w,x,t+.016),mix(v,y,t+.016),normal.toArray(),color(0x666871));
      }
      const glazing=edge===0&&i>1&&i<6;
      if(glazing){
        const lift=p=>p.map((n,k)=>n+(k===1?.025:0));
        strip(B.glass,lift(mix(v,y,.59)),lift(mix(w,x,.59)),lift(x),lift(y),normal.toArray(),glass);
      }
      const count=Math.ceil(Math.hypot(v[0]-w[0],v[2]-w[2])/.70);
      for(let j=0;j<count;j++){
        const k=j/count,l=Math.min(1,k+.035/count);
        strip(B.trim,mix(v,w,k).map((n,i)=>n+(i===1?.012:0)),mix(v,w,l).map((n,i)=>n+(i===1?.012:0)),
          mix(y,x,l).map((n,i)=>n+(i===1?.012:0)),mix(y,x,k).map((n,i)=>n+(i===1?.012:0)),up,silver);
      }
    }
  }
  for(const s of [sections[0],sections.at(-1)]){
    const a=map(s,0,eave),b=map(s,1,eave),tip=map(s,.53,eave+1.61);
    const f=frame([a[0],a[2]],[b[0],b[2]]),n=s===sections[0]?vector(-f.n[0],-f.n[1]):vector(...f.n);
    B.screen.tri(a,b,tip,n,[0,0],[1,0],[.5,1],color(0x675549));
  }
  // Keep all street-facing columns outside the three mapped service approaches.
  for(const s of [sections[0],sections[2],sections[4],sections[6]]){
    for(const q of s){
      if(W.access.isDrivable(...q))continue;
      column(B.trim,...q,.17,hAt(...q)-.08,eave-.10,silver);
    }
  }
  const front=frame([403.4,-111.7],[408.3,-110.6]),out=reverseFrame(front);
  const width=out.length;
  panel(B.glass,out,.18,width-.18,ground+.08,eave-.14,.045,glass);
  for(const u of [.24,width*.49,width-.24])panel(B.trim,out,u,u+.08,ground+.08,eave-.14,.057,silver);
  plaque(group,'SEJONG HALL',out,width/2,eave-.37,.085,width*.68,.28,'#deddd1');
  return {facility:'Sejong Hall entrance and glazed canopy',ways:[lobby.id,1530600485],panoramas:['DWVthHdi5zfPEJt-MrA4yQ','3kLyt58se_e84leF-o4nKg']};
}

export function buildClinicRamp(W,hAt,B){
  const ramp=W.D.buildings.find(b=>b.id===1524542411);
  if(ramp?.p.length!==4)return;
  // OSM outlines the occupied high end. The November road view and the public
  // overhead photograph continue the grass slope to a narrow north-west tip.
  const [west,east,lowEast,lowWest]=ramp.p,tip=[636.3,-11.7];
  const ring=[tip,lowWest,west,east,lowEast],along=frame(tip,west);
  const curb=color(0xd2d1c9),timber=color(0xb78463),joint=color(0x886448),lawn=color(0x839153),rail=color(0x9b9e9d);
  const grade=q=>Math.max(0,Math.min(1,((q[0]-tip[0])*along.u[0]+(q[1]-tip[1])*along.u[1])/along.length));
  const low=hAt(...tip)+.12,upper=Math.max(hAt(...west),hAt(...east))+3.72;
  const top=q=>low+(upper-low)*grade(q);
  for(const ids of THREE.ShapeUtils.triangulateShape(ring.map(q=>new THREE.Vector2(...q)),[])){
    const pts=ids.map(i=>ring[i]);
    B.track.tri(...pts.map(q=>[q[0],top(q),q[1]]),up,...pts,lawn);
  }
  for(let i=0;i<ring.length;i++){
    const f=frame(ring[i],ring[(i+1)%ring.length]),distance=f.length;
    const normal=vector(-f.n[0],-f.n[1]);
    const point=(u,y,out=0)=>at(f,u,y,-out);
    const point2=u=>{const [x,,z]=point(u,0);return [x,z];};
    const sections=Math.max(1,Math.ceil(distance/1.48));
    for(let s=0;s<sections;s++){
      const u=s*distance/sections,v=(s+1)*distance/sections,a=point2(u),b=point2(v);
      const ha=top(a),hb=top(b);
      const ga=hAt(...a),gb=hAt(...b),ca=ha-.55*grade(a),cb=hb-.55*grade(b);
      strip(B.trim,point(u,ga-.20),point(v,gb-.20),point(v,cb),point(u,ca),normal,timber);
      strip(B.trim,point(u,ca,.016),point(v,cb,.016),point(v,hb+.035,.016),point(u,ha+.035,.016),normal,curb);
      // Horizontal timber courses terminate exactly where they meet the
      // sloping pale coping at the high end of the entrance ramp.
      for(let offset=.16;Math.min(ga+offset-ca,gb+offset-cb)<-.026;offset+=.165){
        const aGap=ca-ga-offset-.02,bGap=cb-gb-offset-.02;
        const t=aGap*bGap<0?aGap/(aGap-bGap):0;
        const ta=aGap<0?t:0,tb=bGap<0?t:1;
        if(tb<=ta)continue;
        const line=(k,h)=>point(u+(v-u)*k,ga+(gb-ga)*k+offset+h,.010);
        strip(B.trim,line(ta,0),line(tb,0),line(tb,.013),line(ta,.013),normal,joint);
      }
      if(i===2||Math.max(grade(a),grade(b))<.16)continue;
      column(B.trim,a[0],a[1],.038,ha-.05,ha+.94,rail);
      for(const level of [.34,.66,.90])strip(B.screen,point(u,ha+level),point(v,hb+level),point(v,hb+level+.035),point(u,ha+level+.035),normal,rail);
    }
  }
  const flank=reverseFrame(frame(lowWest,west)),u=2.28,win=at(flank,u,0),wy=hAt(win[0],win[2])+1.45;
  panel(B.trim,flank,u,u+.53,wy,wy+1.04,.024,curb);
  panel(B.glass,flank,u+.065,u+.465,wy+.075,wy+.97,.032,color(0x59646a));
  const bridge=[west,east,[680.8,33.1],[672.1,40.6]];
  const crossingFloor=Math.max(...bridge.map(q=>hAt(...q)));
  const high=Math.max(top(west),top(east),crossingFloor+3.64);
  solid(B.trim,bridge,high-.31,high,curb);soffit(B.trim,bridge,high-.31,color(0x8b8b81));
  for(const ends of [[bridge[0],bridge[3]],[bridge[1],bridge[2]]]){
    const f=frame(...ends);
    for(let u=0;u<=f.length;u+=1.15){
      const [x,,z]=at(f,u,high);column(B.trim,x,z,.034,high,high+.91,rail);
    }
    for(const h of [.34,.65,.91])box(B.trim,f,0,f.length,-.024,.024,high+h,high+h+.032,rail);
  }
  return {facility:'KAIST Clinic planted ramp and overhead walkway',way:ramp.id,clearanceM:high-.31-crossingFloor,panoramas:['I6sW9DWDTU0zD6Nl7Ce3Ow','-kcl-nhnhdinnQRMKXWq_w']};
}
