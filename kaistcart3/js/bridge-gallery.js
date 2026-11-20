import * as T from '../lib/three.module.min.js';

// The mapped overhead roof flares out for about 61 metres on each side of
// the river. The 2026 side views show a shallow curved canopy above the busts.
const centre=130.4,half=30.8,top=new T.Color(0x9da9aa),under=new T.Color(0xc4c7bd);
export const galleryCurve=s=>Math.max(0,1-((s-centre)/half)**2);
const roofHeight=s=>1.06+2.67*galleryCurve(s);
const ivory=0xc8cabb,bronze=new T.Color(0x454a40);
const up=[0,1,0],down=[0,-1,0],uv=[0,0];
function panel(batch,a,b,c,d,n,col){batch.quad(a,b,c,d,n,uv,uv,uv,uv,col);}

export function addBridgeGallery(section,side,fixtures,shell,beam,yaw){
  const roofRows=new Map();
  const get=(s,f,h=0)=>{
    if(!roofRows.has(s))roofRows.set(s,section(s));
    const row=roofRows.get(s);
    const inner=row.ordinaryOuter-side*(.18+.44*galleryCurve(s));
    return row.at(inner+(row.outer+side*.13-inner)*f,roofHeight(s)+.10*Math.sin(f*Math.PI)+h);
  };
  const n=34,ms=4;
  for(let i=0;i<n;i++){
    const s=centre-half+2*half*i/n,t=centre-half+2*half*(i+1)/n;
    for(let k=0;k<ms;k++){
      const f=k/ms,g=(k+1)/ms;
      panel(shell,get(s,f),get(s,g),get(t,g),get(t,f),up,top);
      panel(shell,get(s,f,-.065),get(s,g,-.065),get(t,g,-.065),get(t,f,-.065),down,under);
      beam(get(s,f,-.076),get(s,g,-.076),.020,ivory);
    }
    for(let k=0;k<=ms;k++)beam(get(s,k/ms,-.075),get(t,k/ms,-.075),k===0||k===ms?.063:.025,ivory);
  }
  for(let k=1;k<12;k++){
    const s=centre-half+2*half*k/12,row=section(s),q=row.outer-side*.56,h=roofHeight(s);
    const fork=row.at(q,h-.41);
    beam(row.at(q,.016),fork,.094,ivory);
    beam(fork,get(s,.10,-.065),.067,ivory);
    beam(fork,get(s,.92,-.065),.067,ivory);
  }
  // KAIST's 2016 report and the April panorama show seven busts and the
  // reserved eighth pedestal. Small bronze silhouettes and plaques keep
  // that spacing visible from the roadway.
  const bustRings=[[.03,.16,.11],[.12,.29,.135],[.23,.32,.15],[.30,.215,.13],[.33,.083,.072],
    [.37,.084,.075],[.41,.103,.095],[.51,.133,.120],[.62,.128,.113],[.69,.094,.087],[.72,.012,.012]];
  for(let i=0;i<4;i++){
    const anchor=centre+(i-1.5)*5.15,r=section(anchor),q=r.ordinaryOuter+side*.48;
    const block=(w,h,d,y,col,offset=0)=>fixtures.box(new T.Vector3(...r.at(q+offset,y)),w,h,d,yaw,col);
    block(.70,.11,.76,.058,0x75786f);block(.62,.91,.67,.55,0x77796d);
    block(.64,.085,.70,1.04,0x929484);block(.022,.56,.49,.59,0x393d36,-side*.316);
    if(side>0 && i===0)continue;
    const point=(ring,arc)=>{
      const [h,w,d]=ring,a=arc*Math.PI*2,along=w*Math.cos(a);
      const upper=h>.36,front=d*Math.sin(a)*(upper&&Math.sin(a)*side<-.8?1.14:1);
      const p=r.at(q+front,1.084+h);
      p[0]+=Math.sin(yaw)*along;p[2]+=Math.cos(yaw)*along;
      return p;
    };
    for(let j=1;j<bustRings.length;j++)for(let k=0;k<14;k++){
      const f=k/14,g=(k+1)/14,a=point(bustRings[j-1],f),b=point(bustRings[j-1],g),c=point(bustRings[j],g),d=point(bustRings[j],f);
      const center=r.at(q,1.084+(bustRings[j-1][0]+bustRings[j][0])*.5);
      const outward=[(a[0]+b[0])*.5-center[0],0,(a[2]+b[2])*.5-center[2]];
      const normal=new T.Vector3().crossVectors(new T.Vector3(...b).sub(new T.Vector3(...a)),new T.Vector3(...c).sub(new T.Vector3(...a))).normalize();
      if(normal.dot(new T.Vector3(...outward))<0)normal.negate();
      panel(shell,a,b,c,d,normal.toArray(),bronze);
    }
  }
}
