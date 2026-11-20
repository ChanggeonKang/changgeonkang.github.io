// Code-native facades inferred from user-supplied April 2025 captures.
// Footprints are unchanged OSM source geometry. Storey height, roofs, materials,
// facade divisions and decorative equipment are visual estimates, not surveys.
// No screenshot pixels or third-party photographs are used as runtime textures.
import * as THREE from '../lib/three.module.min.js';
import { buildingProfile, campusName } from './campus-identity.js';

const C = n => new THREE.Color(n), mix=(a,b,t)=>a+(b-a)*t;
const PALETTE={brick:C(0x86584f),brickDark:C(0x674c46),white:C(0xd8d9d0),cream:C(0xc8c7b7),glass:C(0x426872),frame:C(0xaeb8b5),roof:C(0x654e4b),pink:C(0xc8aca4),gold:C(0xb4a35e),blue:C(0x4c8297),silver:C(0xacb6b7)};
const CONFIG={
  'W4-3':{style:'tower',photos:[2,3],roadviews:['N1i9ntMVKR_eY6ih9ZqkPQ','Mxh30ab8myU6YMf9PsqFFg'],floors:15,height:48.0,color:0xe0ddd2,accent:0xc8aca4},
  'W4-4':{style:'tower',photos:[2,3],roadviews:['N1i9ntMVKR_eY6ih9ZqkPQ','MCjwoxe6YTQnkWMZebVu0Q'],floors:15,height:48.0,color:0xe1e4dc,accent:0xc9aaa6},
  'W5-1':{style:'village',photos:[],roadviews:['Mxh30ab8myU6YMf9PsqFFg','MCjwoxe6YTQnkWMZebVu0Q'],floors:4,height:12.65,color:0xdbdcd2},
  'W5-2':{style:'village',photos:[4,5],roadviews:['SzePpuQkbBXNmMG-eRPNzA'],floors:4,height:12.65,color:0xe0dfd4},
  'W5-3':{style:'village',photos:[],roadviews:['CEzgwz5As6EHvZ79Ata3-g'],floors:4,height:12.65,color:0xdcd9cf},
  'W5-4':{style:'village',photos:[4,5,7],roadviews:['CEzgwz5As6EHvZ79Ata3-g'],floors:4,height:12.65,color:0xe0dfd4},
  'W5-5':{style:'village',photos:[],roadviews:['CEzgwz5As6EHvZ79Ata3-g'],floors:4,height:12.65,color:0xe3dfd1},
  W6:{style:'greyDorm',photos:[5,7,8],color:0xbcbfc0,accent:0xa77954},
  W11:{style:'faculty',photos:[9,10,11,15,16],color:0xc9cecb,accent:0xa6a05b},
  W10:{style:'service',photos:[12,13,14],height:6.3,color:0xdbded7},
  N16:{style:'brickDorm',photos:[21,22,23],roadviews:['LXkbQTH1xmalb08lSY3rlw','7wQ_2F4ssIDqclXE68uQJg'],floors:5,color:0x985c51},
  N14:{style:'brickDorm',photos:[24,25,26],floors:5,color:0x976052},
  N17:{style:'yellowDorm',photos:[27,28,29],floors:5,color:0x956356},
  N18:{style:'brickDorm',photos:[30],floors:5,color:0x976453},
  N12:{style:'brickHall',photos:[29,30,31],floors:3,color:0x85584c},
  N15:{style:'brickHall',photos:[31],floors:2,color:0x906054},
  N10:{style:'ventHall',photos:[32,33],height:10.7,color:0x815c50},
  N9:{style:'workshop',photos:[34,35,36],height:6.2,color:0x855c50},
  N5:{style:'deepEave',photos:[37,38,39],height:14.4,color:0x76534b},
  N6:{style:'facultyClub',photos:[40,41],height:8.8,color:0x8d6253},
  N1:{style:'itc',photos:[40,41,42,43],color:0xd4d9d4,accent:0xb9a952},
  N2:{style:'deepEave',photos:[48,49],height:12.4,color:0x855c50},
  E15:{style:'auditorium',photos:[47,48,49,50,51,52],height:10.2,color:0x79594c},
  E14:{style:'academic',photos:[55],color:0xceccc0,confidence:'medium; footprint-relative image match, label not legible'},
  'E16-1':{style:'academicGlass',photos:[55],height:18.2,color:0xcac9c1,confidence:'medium; footprint-relative image match, label not legible'}
};
const sign=p=>Math.sign(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0))||1;
function inside(x,z,p){let r=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])r=!r;}return r;}
function dist(x,z,p){let d=Infinity;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));d=Math.min(d,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz));}return d;}
function validRing(q,p){return q.every((a,i)=>{const b=q[(i+1)%q.length],n=Math.max(1,Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])));for(let k=0;k<=n;k++){const x=mix(a[0],b[0],k/n),z=mix(a[1],b[1],k/n);if(!inside(x,z,p)&&dist(x,z,p)>.004)return false;}return true;});}
class Batch{
  constructor(){this.p=[];this.n=[];this.c=[];}
  tri(a,b,c,color,normal){let n=new THREE.Vector3().subVectors(new THREE.Vector3(...b),new THREE.Vector3(...a)).cross(new THREE.Vector3().subVectors(new THREE.Vector3(...c),new THREE.Vector3(...a)));if(n.lengthSq()<1e-12)return;if(normal&&n.dot(new THREE.Vector3(...normal))<0)[b,c]=[c,b];n=normal||n.normalize().toArray();for(const v of[a,b,c]){this.p.push(...v);this.n.push(...n);this.c.push(color.r,color.g,color.b);}}
  quad(a,b,c,d,color,n){this.tri(a,b,c,color,n);this.tri(a,c,d,color,n);}
  geometry(g,color,p){const q=g.index?g.toNonIndexed():g,A=q.attributes.position,N=q.attributes.normal;let ok=true;for(let i=0;i<A.count;i++)if(!inside(A.getX(i),A.getZ(i),p)&&dist(A.getX(i),A.getZ(i),p)>.002){ok=false;break;}if(ok)for(let i=0;i<A.count;i++){this.p.push(A.getX(i),A.getY(i),A.getZ(i));this.n.push(N.getX(i),N.getY(i),N.getZ(i));this.c.push(color.r,color.g,color.b);}if(q!==g)q.dispose();g.dispose();return ok;}
  mesh(material,name){const g=new THREE.BufferGeometry();for(const [key,a]of[['position',this.p],['normal',this.n],['color',this.c]])g.setAttribute(key,new THREE.Float32BufferAttribute(a,3));g.computeBoundingBox();g.computeBoundingSphere();const m=new THREE.Mesh(g,material);m.name=name;m.castShadow=true;m.receiveShadow=true;return m;}
}
function faces(p,fn){const s=sign(p);p.forEach((a,i)=>{const b=p[(i+1)%p.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L>.02)fn(a,b,L,[s*(b[1]-a[1])/L,0,-s*(b[0]-a[0])/L],i);});}
function panel(B,a,b,t0,t1,y0,y1,c,n){if(t1<=t0||y1<=y0)return;B.quad([mix(a[0],b[0],t0),y0,mix(a[1],b[1],t0)],[mix(a[0],b[0],t1),y0,mix(a[1],b[1],t1)],[mix(a[0],b[0],t1),y1,mix(a[1],b[1],t1)],[mix(a[0],b[0],t0),y1,mix(a[1],b[1],t0)],c,n);}
function roof(B,p,y,c){for(const t of THREE.ShapeUtils.triangulateShape(p.map(a=>new THREE.Vector2(...a)),[]))B.tri(...t.map(i=>[p[i][0],y,p[i][1]]),c,[0,1,0]);}
function volume(B,p,y0,y1,c){faces(p,(a,b,L,n)=>panel(B,a,b,0,1,y0,y1,c,n));roof(B,p,y1,c);}
function clip(p,axis,value,less){let q=[];p.forEach((a,i)=>{const b=p[(i+1)%p.length],da=(a[axis]-value)*(less?1:-1),db=(b[axis]-value)*(less?1:-1);if(da<=0)q.push(a);if((da<=0)!==(db<=0)){const t=da/(da-db);q.push([mix(a[0],b[0],t),mix(a[1],b[1],t)]);}});return q;}
function rectInside(p,x,z,w,d){const q=[[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2]];return validRing(q,p)?q:null;}
function inset(p,d){const s=sign(p),out=[];for(let i=0;i<p.length;i++){const a=p[(i+p.length-1)%p.length],b=p[i],c=p[(i+1)%p.length],u=[b[0]-a[0],b[1]-a[1]],v=[c[0]-b[0],c[1]-b[1]],lu=Math.hypot(...u),lv=Math.hypot(...v);if(lu<.01||lv<.01)return p;u[0]/=lu;u[1]/=lu;v[0]/=lv;v[1]/=lv;const n1=[-s*u[1],s*u[0]],n2=[-s*v[1],s*v[0]],den=1+n1[0]*n2[0]+n1[1]*n2[1];if(den<.15)return p;out.push([b[0]+d*(n1[0]+n2[0])/den,b[1]+d*(n1[1]+n2[1])/den]);}return validRing(out,p)?out:p;}
function hipRoof(B,p,y,rise,color){
  const sample=a=>[a[0],y+Math.min(rise,dist(a[0],a[1],p)*.65),a[1]];
  function tri(a,b,c,level=0){const ab=Math.hypot(a[0]-b[0],a[1]-b[1]),bc=Math.hypot(b[0]-c[0],b[1]-c[1]),ca=Math.hypot(c[0]-a[0],c[1]-a[1]);if(Math.max(ab,bc,ca)<3||level>=7){const va=sample(a),vb=sample(b),vc=sample(c);if((vb[2]-va[2])*(vc[0]-va[0])-(vb[0]-va[0])*(vc[2]-va[2])<0)B.tri(va,vc,vb,color);else B.tri(va,vb,vc,color);return;}const m=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];if(ab>=bc&&ab>=ca){const q=m(a,b);tri(a,q,c,level+1);tri(q,b,c,level+1);}else if(bc>=ca){const q=m(b,c);tri(a,b,q,level+1);tri(a,q,c,level+1);}else{const q=m(c,a);tri(a,b,q,level+1);tri(q,b,c,level+1);}}
  for(const t of THREE.ShapeUtils.triangulateShape(p.map(a=>new THREE.Vector2(...a)),[]))tri(...t.map(i=>p[i]));
}
function windows(B,p,base,H,{floors=3,width=2.5,ratio=.64,windowHeight=1.5,band=false,skip=()=>false}={}){
  faces(p,(a,b,L,n)=>{if(skip(a,b,L,n))return;const count=Math.max(1,Math.round(L/width));for(let f=0;f<floors;f++){const y=base+.95+f*(H-.8)/floors;if(band){panel(B.glass,a,b,.035,.965,y,Math.min(base+H-.45,y+windowHeight),PALETTE.glass,n);for(let j=1;j<count;j++)panel(B.detail,a,b,j/count-.025/L,j/count+.025/L,y,y+windowHeight,PALETTE.frame,n);}else for(let j=0;j<count;j++){const t=(j+.5)/count,w=ratio/count;panel(B.glass,a,b,t-w/2,t+w/2,y,Math.min(base+H-.45,y+windowHeight),PALETTE.glass,n);panel(B.detail,a,b,t-.035/L,t+.035/L,y,y+windowHeight,PALETTE.frame,n);panel(B.detail,a,b,t-w/2,t+w/2,y-.06,y+.02,PALETTE.white,n);}}});
}
function villageFacades(B,p,base,H,entrances){
  // Embedded entrance nodes often split one long wall into short pieces.
  // Merge straight runs for the facade rhythm while preserving the actual
  // building, its stepped wings, and all mapped entrances.
  const ring=p.filter((b,i)=>{
    const a=p[(i+p.length-1)%p.length],c=p[(i+1)%p.length];
    const dx=c[0]-a[0],dz=c[1]-a[1];
    return Math.abs((b[0]-a[0])*dz-(b[1]-a[1])*dx)>.10*Math.hypot(dx,dz);
  });
  const pale=C(0xd2cec2),rail=C(0xb3b7af),panelBlue=C(0x415463),frame=C(0xd9dbd3);
  faces(ring,(a,b,len,n)=>{
    if(len<4)return;
    const pt=(s,y,out)=>[mix(a[0],b[0],s/len)+n[0]*out,y,mix(a[1],b[1],s/len)+n[2]*out];
    const rect=(target,s0,s1,y0,y1,out,color)=>
      target.quad(pt(s0,y0,out),pt(s1,y0,out),pt(s1,y1,out),pt(s0,y1,out),color,n);
    if(Math.abs(n[0])>.7){
      // The narrow gabled ends are plaster with two horizontal bands.
      for(const f of [1.4,3.15])rect(B.detail,0,len,base+f*H/4,base+f*H/4+.18,.011,pale);
      return;
    }
    if(n[2]<-.65){
      // The opposite side is glazed in shallow rectangular bays, with
      // narrow, half-landing stair windows over the actual entry doors.
      const dir=[(b[0]-a[0])/len,(b[1]-a[1])/len];
      const near=(entrances||[]).map(([x,z])=>({s:(x-a[0])*dir[0]+(z-a[1])*dir[1],v:(x-a[0])*n[0]+(z-a[1])*n[2]}))
        .filter(({s,v})=>Math.abs(v)<.22&&s>1.3&&s<len-1.3).map(e=>e.s);
      const beige=C(0xbbae99),panes=C(0x617477),door=C(0x485958),hood=C(0x634441);
      for(let floor=0;floor<4;floor++){
        const y=base+.81+floor*(H-.46)/4;
        rect(B.detail,0,len,y-.42,y-.18,.011,beige);
        for(const s of near){
          if(floor===0)continue;
          const wh=floor===3?1.42:.91;
          rect(B.detail,s-.86,s+.86,y-.28,y+wh+.10,.035,beige);
          rect(B.glass,s-.69,s+.69,y-.12,y+wh-.055,.06,panes);
          rect(B.detail,s-.026,s+.026,y-.12,y+wh-.055,.080,frame);
          if(floor===3)rect(B.detail,s-.69,s+.69,y+.63,y+.67,.081,frame);
        }
      }
      for(const s of near){
        rect(B.detail,s-1.04,s+1.04,base+.05,base+2.40,.03,beige);
        rect(B.glass,s-.75,s+.75,base+.08,base+2.23,.057,door);
        rect(B.detail,s-.023,s+.023,base+.08,base+2.2,.079,frame);
        const u0=s-1.25,u1=s+1.25;
        B.detail.quad(pt(u0,base+2.47,.02),pt(u1,base+2.47,.02),pt(u1,base+2.18,1.02),pt(u0,base+2.18,1.02),hood,[0,1,0]);
        B.detail.quad(pt(u0,base+2.39,.02),pt(u0,base+2.10,1.02),pt(u1,base+2.10,1.02),pt(u1,base+2.39,.02),beige,[0,-1,0]);
        rect(B.detail,u0,u1,base+2.10,base+2.18,1.02,hood);
        for(const u of [u0,u1])B.detail.quad(pt(u,base+2.47,.02),pt(u,base+2.39,.02),pt(u,base+2.10,1.02),pt(u,base+2.18,1.02),hood);
      }
      const bays=Math.max(2,Math.round(len/3.60)),pitch=len/bays;
      for(let i=0;i<bays;i++){
        const s=(i+.5)*pitch,dist=Math.min(Infinity,...near.map(e=>Math.abs(s-e)));
        if(dist<1.29)continue;
        const narrow=dist<3.7,w=narrow?1.02:Math.min(3.22,pitch-.15),out=narrow?.04:.40;
        if(!narrow){
          for(const u of [s-w/2-.085,s+w/2+.085])
            B.wall.quad(pt(u,base+.27,0),pt(u,base+.27,out),pt(u,base+H,out),pt(u,base+H,0),pale);
          rect(B.wall,s-w/2-.085,s+w/2+.085,base+.27,base+H,out,pale);
          B.detail.quad(pt(s-w/2-.085,base+H,0),pt(s+w/2+.085,base+H,0),pt(s+w/2+.085,base+H,out),pt(s-w/2-.085,base+H,out),pale,[0,1,0]);
        }
        for(let floor=0;floor<4;floor++){
          const y=base+.81+floor*(H-.46)/4,wh=narrow?1.04:1.73,offset=out+.025;
          rect(B.glass,s-w/2,s+w/2,y,y+wh,offset,panes);
          rect(B.detail,s-w/2-.05,s+w/2+.05,y-.062,y+.031,offset+.025,frame);
          const panesAcross=narrow?2:4;
          for(let k=1;k<panesAcross;k++){
            const u=s-w/2+w*k/panesAcross;
            rect(B.detail,u-.035,u+.035,y,y+wh,offset+.028,frame);
          }
          if(!narrow)rect(B.detail,s-w/2-.085,s+w/2+.085,y-.42,y-.18,out+.009,beige);
        }
      }
      return;
    }
    const bays=Math.max(2,Math.round(len/4.9)),pitch=len/bays;
    for(let i=0;i<bays;i++)for(let floor=0;floor<4;floor++){
      const s=pitch*(i+.5),y=base+.86+floor*(H-.56)/4,w=pitch*.72;
      rect(B.glass,s-w/2,s+w/2,y,y+1.64,.023,PALETTE.glass);
      rect(B.detail,s-w/2,s+w/2,y-.07,y+.03,.085,frame);
      for(const u of [-.23,.23])rect(B.detail,s+w*u-.03,s+w*u+.03,y,y+1.64,.055,frame);
      const left=s-w/2-.09,right=s+w/2+.09;
      B.detail.quad(pt(left,y-.08,0),pt(right,y-.08,0),pt(right,y-.08,.47),pt(left,y-.08,.47),pale,[0,1,0]);
      rect(B.detail,left,right,y-.17,y-.06,.47,pale);
      for(const h of [.12,.62])rect(B.detail,left,right,y+h,y+h+.05,.46,rail);
      for(let k=0;k<8;k++){const u=left+(right-left)*k/7;rect(B.detail,u-.019,u+.019,y+.04,y+.63,.46,rail);}
      // The south balconies carry small tilted blue photovoltaic panels,
      // visually distinct from the clear window and metal rail above.
      if((i+floor)%5!==3){
        const w0=s-.77,w1=s+.77,lo=y+.02,hi=y+.60;
        B.glass.quad(pt(w0,lo,.72),pt(w1,lo,.72),pt(w1,hi,.47),pt(w0,hi,.47),panelBlue);
        for(const t of [1/3,2/3]){
          const u=w0+(w1-w0)*t;
          B.detail.quad(pt(u-.014,lo,.731),pt(u+.014,lo,.731),pt(u+.014,hi,.481),pt(u-.014,hi,.481),rail);
        }
      }
      if((i*2+floor)%4===1)rect(B.detail,s+w*.34-.25,s+w*.34+.25,y+.06,y+.47,.475,frame);
    }
  });
}

function villageRoof(B,p,top){
  const xs=p.map(a=>a[0]),left=Math.min(...xs),right=Math.max(...xs),mid=(left+right)/2;
  // Real wings have a longitudinal ridge, two pitched faces, vertical
  // gable ends and separate front-facing, roofed dormers on each wing.
  // Use near-end cross sections so a small offset at the adjoining wall
  // does not widen both halves of the building.
  for(const [lo,hi] of [[left,mid],[mid,right]]){
    const far=lo===left?left:right;
    const edge=p.filter(q=>Math.abs(q[0]-far)<2.1);
    if(edge.length<2)continue;
    const z0=Math.min(...edge.map(q=>q[1]))-.07,z1=Math.max(...edge.map(q=>q[1]))+.07;
    if(z1-z0<4)continue;
    const zc=(z0+z1)/2,rise=2.42,topY=top+rise;
    const roof=C(0x784d48),gables=C(0xdad7ca),trim=C(0x5d4946);
    for(const [z,side] of [[z0,-1],[z1,1]]){
      B.detail.quad([lo,top,z],[hi,top,z],[hi,topY,zc],[lo,topY,zc],roof,[0,1,.35*side]);
      const lip=.09*side;
      B.detail.quad([lo,top-.12,z+lip],[hi,top-.12,z+lip],[hi,top+.10,z+lip],[lo,top+.10,z+lip],trim,[0,0,side]);
      for(let x=lo+3.05;x<hi-1.5;x+=7.8){
        const front=z-.24*side,back=z-1.8*side,bottom=top+.12,high=top+1.18,peak=top+1.58,d=.94;
        B.detail.quad([x-d,bottom,front],[x+d,bottom,front],[x+d,high,front],[x-d,high,front],gables,[0,0,side]);
        B.glass.quad([x-.65,bottom+.15,front+.015*side],[x+.65,bottom+.15,front+.015*side],
          [x+.65,high-.10,front+.015*side],[x-.65,high-.10,front+.015*side],PALETTE.glass,[0,0,side]);
        B.detail.tri([x-d,high,front],[x+d,high,front],[x,peak,front],gables,[0,0,side]);
        for(const sign of [-1,1]){
          B.detail.quad([x+sign*d,bottom,front],[x+sign*d,bottom,back],[x+sign*d,high,back],[x+sign*d,high,front],gables,[sign,0,0]);
          B.detail.quad([x+sign*(d+.09),high,front+.10*side],[x+sign*(d+.09),high,back],[x,peak+.06,back],[x,peak+.06,front+.10*side],trim,[.3*sign,1,0]);
        }
      }
    }
    for(const x of [lo,hi])B.detail.tri([x,top,z0],[x,top,z1],[x,topY,zc],gables,[x===lo?-1:1,0,0]);
  }
}

function residentialTowerPlan(p,ref){
  // The two mapped outlines touch at the glazed, low connecting hall.
  // Pull only the residential storeys back from the diagonal seam visible
  // in the public orthophoto. KAIST describes the twin halls as 15 storeys.
  const side=ref==='W4-3'?1:-1,limit=ref==='W4-3'?9.7:14.5;
  const distance=q=>side*(.526*(q[0]+455.2)+.850*(q[1]-188.25))-limit;
  const result=[];
  for(let i=0;i<p.length;i++){
    const a=p[i],b=p[(i+1)%p.length],da=distance(a),db=distance(b);
    if(da>=0)result.push(a);
    if((da>=0)!==(db>=0)){
      const t=da/(da-db);result.push([mix(a[0],b[0],t),mix(a[1],b[1],t)]);
    }
  }
  return result.length>=3?result:p;
}
function buildOne(B,b,p,base,cfg){
  const profile=buildingProfile(b), style=cfg.style, H=cfg.height||((cfg.floors||b.lv||0)>0?(cfg.floors||b.lv)*(style.includes('Dorm')||style==='tower'||style==='faculty'?3.05:3.6)+.8:profile.height);
  const floors=cfg.floors||b.lv||Math.max(1,Math.round(H/3.3)), color=C(cfg.color), top=base+H;
  const deep=['deepEave','brickHall','facultyClub','ventHall','auditorium'].includes(style);
  // N9's road-facing wall is set back behind its exposed silver service ducts.
  const tower=style==='tower',podium=5.25;
  const wall=tower?residentialTowerPlan(p,b.ref):style==='workshop'?p.map(([x,z])=>[x,z< -486?z+1.35:z]):deep?inset(p,.62):p;
  volume(B.wall,p,base,base+.25,PALETTE.cream);
  if(tower){
    volume(B.wall,p,base+.25,base+podium,C(0xa19d9c));
    faces(p,(a,c,L,n)=>{
      if(L<4)return;
      const panes=Math.max(2,Math.round(L/1.42));
      for(let k=0;k<panes;k++)panel(B.glass,a,c,(k+.095)/panes,(k+.905)/panes,base+.72,base+podium-.52,C(0x536e70),n);
      panel(B.detail,a,c,0,1,base+podium-.27,base+podium,PALETTE.silver,n);
    });
  }
  volume(B.wall,wall,base+(tower?podium:.25),top,color);
  const feature=[];
  if(style==='village'){
    villageFacades(B,wall,base,H,b.entrances);
    feature.push('four-storey plaster housing','south balconies with tilted solar panels','north bay windows and porch hoods','stepped gable and roof dormers');
  }else if(style==='service'){
    windows(B,wall,base+H*.62,H*.32,{floors:1,width:6,ratio:.24,windowHeight:.7});windows(B,wall,base,H,{floors:1,width:12,ratio:.2,windowHeight:2.8});feature.push('low white laboratory','sparse clerestory windows');
  }else if(style==='workshop'){
    windows(B,wall,base,H,{floors:1,width:5,ratio:.7,windowHeight:2.7});faces(wall,(a,b,L,n)=>panel(B.detail,a,b,0,1,top-1.5,top,PALETTE.white,n));
    // Photos 35–36 show two banks of elbowed ducts running in front of
    // the pale parapet. Both ends turn back toward the building.
    for (const x of [-48,-46,-44,-42,-15,-13,-11]) {
      const z=-486.40+(x+71.7)*.004;
      const controls=[[base+3.2,z+1.05],[base+3.2,z+.35],[base+3.55,z],[top-.2,z],[top+.28,z+.18],[top+.36,z+1.65]];
      const bend=new THREE.CatmullRomCurve3(controls.map(([y,d])=>new THREE.Vector3(x,y,d)),false,'centripetal');
      B.detail.geometry(new THREE.TubeGeometry(bend,20,.255,10,false),PALETTE.silver,p);
      for (const y of [base+3.7,top-1.37,top-.72]) {
        const collar=new THREE.CylinderGeometry(.28,.28,.075,10).translate(x,y,z);
        B.detail.geometry(collar,PALETTE.frame,p);
      }
    }
    feature.push('white flat parapet','two groups of exposed elbowed silver ducts');
  }else if(style==='deepEave'){
    windows(B,wall,base,H,{floors:3,width:5.2,ratio:.63,windowHeight:1.3});faces(wall,(a,b,L,n)=>{for(let s=0;s<L;s+=7.2)panel(B.detail,a,b,s/L,Math.min(1,(s+.36)/L),base+.2,top,PALETTE.brickDark,n);});feature.push('deep roof eave','brick piers','three narrow window levels');
  }else if(style==='facultyClub'){
    windows(B,wall,base,H,{floors:2,width:5,ratio:.35,windowHeight:1.3});faces(wall,(a,b,L,n)=>{if(n[2]>.8&&L>10){panel(B.glass,a,b,.37,.7,base+1.2,top-.65,PALETTE.blue,n);for(let y=base+2;y<top-.6;y+=1.5)panel(B.detail,a,b,.37,.7,y,y+.09,PALETTE.frame,n);}});feature.push('compact brick faculty club','large south teal window','tiled hipped roof');
  }else if(style==='auditorium'){
    windows(B,wall,base,H,{floors:2,width:7,ratio:.24,windowHeight:1.65});const hall=clip(clip(wall,0,105,true),1,-222,true);if(hall.length>2&&validRing(hall,p)){volume(B.wall,hall,top,base+18.5,color);faces(hall,(a,b,L,n)=>{windows(B,[a,b,[b[0]-n[0]*.1,b[1]-n[2]*.1],[a[0]-n[0]*.1,a[1]-n[2]*.1]],base+12,5.5,{floors:1,width:5.5,ratio:.12,windowHeight:2.2});for(const y of[7.6,11.3])panel(B.detail,a,b,0,1,base+y,base+y+.22,PALETTE.brick,n);});hipRoof(B.detail,hall,base+18.6,2.2,PALETTE.roof);}feature.push('high mostly solid auditorium hall','layered broad roof planes','slit windows');
  }else if(style==='ventHall'){
    windows(B,wall,base,H,{floors:2,width:4.3,ratio:.75,windowHeight:2.1});faces(wall,(a,b,L,n)=>{panel(B.detail,a,b,0,1,base+3.3,base+4.6,PALETTE.white,n);for(let s=.2;s<L;s+=5.2)panel(B.detail,a,b,s/L,Math.min(1,(s+.42)/L),base,top,PALETTE.white,n);});const q=rectInside(p,-165,-482,6,5);if(q){volume(B.wall,q,base,base+24,PALETTE.white);faces(q,(a,b,L,n)=>{panel(B.glass,a,b,.08,.92,base+20.4,base+21.8,PALETTE.blue,n);for(let j=0;j<5;j++)panel(B.detail,a,b,.12+j*.16,.16+j*.16,base+20,base+22.7,PALETTE.white,n);});const v=q.map(a=>[a[0],base+24+(a[0]+168)*.36,a[1]]);B.wall.quad(...v,PALETTE.white,[0,1,0]);}feature.push('white colonnade bands','slanted-top white vent tower');
  }else if(style==='itc'){
    windows(B,wall,base,H,{floors,width:4.3,ratio:.54,windowHeight:1.65});faces(wall,(a,b,L,n)=>{if(n[0]<-.7){panel(B.glass,a,b,.45,.65,base+3,top-2,PALETTE.blue,n);for(let f=2;f<floors;f++)panel(B.detail,a,b,.42,.68,base+f*3.6,base+f*3.6+.32,C(cfg.accent),n);}for(let s=3;s<L;s+=13)panel(B.detail,a,b,s/L,Math.min(1,(s+.7)/L),base+5,top-1,PALETTE.white,n);});feature.push('pale irregular footprint','yellow window-core accents','blue grouped glazing');
  }else if(style==='academic'||style==='academicGlass'){
    windows(B,wall,base,H,{floors:style==='academicGlass'?5:floors,width:2.7,band:true,windowHeight:1.6});if(style==='academicGlass')faces(wall,(a,b,L,n)=>{if(L>20)panel(B.glass,a,b,.35,.6,base+1,top-.7,PALETTE.blue,n);});feature.push('pale academic facade','horizontal dark glazing bands');
  }else{
    const dorm=['brickDorm','yellowDorm','brickHall'].includes(style);
    const isFaculty=style==='faculty';
    windows(B,wall,base+(tower?podium:0),H-(tower?podium:0),{floors:tower?floors-2:floors,width:3.2,ratio:isFaculty?.66:.52,windowHeight:tower?1.55:1.7,skip:(a,b,L)=>isFaculty&&L<12});
    faces(wall,(a,b,L,n)=>{
      if(style==='greyDorm'){if(n[0]<-.7){panel(B.detail,a,b,.02,.98,base+.3,base+6.2,C(cfg.accent),n);for(let f=1;f<Math.min(3,floors);f++)for(let j=0;j<Math.max(1,Math.round(L/3.2));j++){const count=Math.max(1,Math.round(L/3.2));panel(B.glass,a,b,(j+.25)/count,(j+.75)/count,base+.8+f*2.6,base+2.1+f*2.6,PALETTE.glass,n);}}}
      if(tower){if(L<13)panel(B.detail,a,b,0,1,base+podium,top,C(cfg.accent),n);else for(let f=2;f<floors;f++)panel(B.detail,a,b,0,1,base+f*3.05,base+f*3.05+.15,PALETTE.white,n);}
      if(isFaculty){if(L<13){panel(B.detail,a,b,0,1,base+.3,top-7,C(cfg.accent),n);panel(B.detail,a,b,0,1,top-7,top,PALETTE.white,n);}else for(let f=1;f<floors;f++){panel(B.detail,a,b,0,1,base+f*3.05,base+f*3.05+.25,PALETTE.white,n);}}
      if(dorm)panel(B.detail,a,b,0,1,base+3.05,base+3.45,PALETTE.white,n);
      if(style==='yellowDorm'&&n[2]>.7){if((a[0]+b[0])/2>-289&&(a[0]+b[0])/2<-275){panel(B.detail,a,b,0,1,base+1,top+2.2,C(0xd3bd62),n);panel(B.glass,a,b,.2,.73,base+1.6,top+1.9,PALETTE.blue,n);}else if(L>18)for(let f=2;f<5;f++)panel(B.detail,a,b,.34,.7,base+f*3.05,base+f*3.05+.62,C(0xd3bd62),n);}
    });
    feature.push(style==='yellowDorm'?'yellow vertical glass core and three yellow balcony bands':style==='faculty'?'mustard end walls and white-grey residential bands':style==='tower'?'white tower and pink end-wall panels':style==='greyDorm'?'gray dormitory with orange lower facade':'brick dormitory with white belt and repeated windows');
  }
  if(deep){
    volume(B.detail,p,top,top+.48,PALETTE.roof);
    for(let i=0;i<p.length;i++){
      const j=(i+1)%p.length, corners=[p[i],p[j],wall[j],wall[i]].map(q=>[q[0],top,q[1]]);
      B.detail.quad(...corners,PALETTE.roof,[0,-1,0]);
    }
    hipRoof(B.detail,p,top+.48,style==='facultyClub'?2.9:1.8,PALETTE.roof);
  }
  if(style==='village'){
    villageRoof(B,p,top);
  }
  if(tower){const q=inset(wall,.75);faces(q,(a,b,L,n)=>{if(L<8)return;panel(B.detail,a,b,0,1,top+2.5,top+3.1,PALETTE.pink,n);for(let s=.5;s<L;s+=6)panel(B.detail,a,b,s/L,Math.min(1,(s+.55)/L),top,top+3.1,PALETTE.white,n);});}
  return {heightM:H,top:base+(style==='auditorium'?20.8:style==='ventHall'?26.3:H+(style==='tower'?3.1:deep?3.4:style==='village'?3:style==='yellowDorm'?2.2:0)),features:feature,heightBasis:cfg.height?'photo-informed approximate height':b.lv?'OSM levels multiplied by estimated storey height':profile.source};
}
function buildDome(B,b,p,base){
  const x=-120.55,z=-532.7,r=5.6,segments=48,rings=14;volume(B.wall,p,base,base+2.4,PALETTE.white);
  const point=(j,k)=>{const a=j/segments*Math.PI*2,t=k/rings*Math.PI/2,rr=r*Math.cos(t)*(1+.08*Math.sin(t*2));return[x+Math.cos(a)*rr,base+2.4+7.5*Math.sin(t),z+Math.sin(a)*rr];};
  for(let k=0;k<rings;k++)for(let j=0;j<segments;j++){const q=[point(j,k),point(j+1,k),point(j+1,k+1),point(j,k+1)];if(q.every(a=>inside(a[0],a[2],p)))B.detail.quad(...q.reverse(),j%6===0?C(0xb6c4c8):C(0xe0e4df));}
  return{heightM:9.9,top:base+9.9,features:['white segmented dome','low pale drum'],heightBasis:'photo-informed approximate; unnamed source footprint'};
}

/** Three shared draw calls regardless of building count. No DOM or textures. */
export function buildCapturedArchitecture(scene,D={},hAt=()=>0){
  const result={handledIds:new Set(),labels:[],models:[],metadata:{reference:'map_resource/*.png, April 2025 screenshot UI',scope:'code-native, photo-informed approximations',drawCalls:0,models:[],excludedUncertain:['distant water tower in 55','far endpoint of the N5 covered walkway','KBSI external building identity']}};
  const B={wall:new Batch(),glass:new Batch(),detail:new Batch()};
  for(const b of D.buildings||[]){const cfg=CONFIG[b.ref],dome=b.id===1534507881;if((!cfg&&!dome)||!b.p||b.p.length<3)continue;
    const p=b.p.filter((a,i)=>i===0||Math.hypot(a[0]-b.p[i-1][0],a[1]-b.p[i-1][1])>.01).map(a=>[...a]);if(p.length>3&&Math.hypot(p[0][0]-p.at(-1)[0],p[0][1]-p.at(-1)[1])<.01)p.pop();if(p.some(a=>!a.every(Number.isFinite)))continue;
    const heights=p.map(a=>hAt(...a));if(!heights.every(Number.isFinite))continue;const base=Math.min(...heights)-.65,start=Object.fromEntries(Object.entries(B).map(([k,v])=>[k,v.p.length/3]));
    const detail=dome?buildDome(B,b,p,base):buildOne(B,b,p,base,cfg),ranges=Object.fromEntries(Object.entries(B).map(([k,v])=>[k,[start[k],v.p.length/3]]));
    const model={id:b.id,ref:b.ref||'',name:campusName(b),sourceFootprint:p,baseElevationM:base,...detail,capturePhotos:dome?[32,33]:cfg.photos,matchConfidence:cfg?.confidence||'high route/building identification; approximate facade dimensions',geometryRanges:ranges};
    if(cfg?.roadviews)model.roadviewStations=cfg.roadviews;
    result.models.push(model);result.metadata.models.push(model);result.handledIds.add(b.id);if(b.ref)result.labels.push({ref:b.ref,name:campusName(b),en:campusName(b),x:p.reduce((s,a)=>s+a[0],0)/p.length,z:p.reduce((s,a)=>s+a[1],0)/p.length,y:detail.top+5});
  }
  for(const [kind,b]of Object.entries(B)){if(!b.p.length)continue;const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:kind==='glass'?.24:kind==='detail'?.64:.86,metalness:kind==='glass'?.35:kind==='detail'?.14:.01,polygonOffset:true,polygonOffsetFactor:kind==='glass'?-2:kind==='detail'?-3:0,polygonOffsetUnits:kind==='glass'?-2:kind==='detail'?-3:0});const mesh=b.mesh(material,`captured-architecture-${kind}`);mesh.userData={captureArchitecture:true,kind};scene.add(mesh);result.metadata.drawCalls++;}
  result.metadata.triangles=Object.values(B).reduce((s,b)=>s+b.p.length/9,0);return result;
}
