import {color,groundPatch,strip,up} from './east-campus-shapes.js';
import {cedar,maple} from './east-campus-plants.js';

// The ten October 2026 views through the bend distinguish an ivy-covered
// stone retaining wall on the slope from a brick sidewalk on the lower side.
export function buildWoodedApproach(W,hAt,B){
  const road=W.explore.roads.find(r=>r.id===78059219);
  if(!road)return;
  const segments=[];let total=0;
  for(let i=1;i<road.p.length;i++){
    const a=road.p[i-1],b=road.p[i],l=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(l<.01)continue;
    segments.push({a,u:[(b[0]-a[0])/l,(b[1]-a[1])/l],start:total,end:total+l});total+=l;
  }
  function centre(t){
    const s=segments.find(q=>t<=q.end)||segments.at(-1);
    return [s.a[0]+s.u[0]*(t-s.start),s.a[1]+s.u[1]*(t-s.start)];
  }
  function point(t,lateral){
    const a=centre(t-.7),b=centre(t+.7),p=centre(t),d=Math.hypot(b[0]-a[0],b[1]-a[1]);
    return [p[0]-(b[1]-a[1])*lateral/d,p[1]+(b[0]-a[0])*lateral/d];
  }
  const h=road.width/2,terrain=(t,v)=>hAt(...point(t,v));
  const raised=(t,v,yOffset=0)=>{const [x,z]=point(t,v);return [x,hAt(x,z)+yOffset,z];};
  const bankTop=t=>terrain(t,h-.08)+1.44+.20*Math.sin(t*.030)+.33*Math.exp(-Math.pow((t-35)/27,2));
  const wall=(t,y,out=0)=>{const [x,z]=point(t,h+.71+out);return [x,y,z];};
  const walker=color(0xc5aa99),mortar=color(0x655f58),moss=[0x687052,0x62664f,0x77705f,0x79776b];
  const end=total-11;
  for(let t=16;t<end;t+=3){
    const e=Math.min(end,t+3),a=centre(t),b=centre(e),l=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const towardRoad=[(b[1]-a[1])/l,0,-(b[0]-a[0])/l],lo=terrain(t,h-.08)-.56,hi=terrain(e,h-.08)-.56;
    strip(B.trim,wall(t,lo),wall(e,hi),wall(e,bankTop(e)),wall(t,bankTop(t)),towardRoad,mortar);
    strip(B.trim,wall(t,bankTop(t)),wall(e,bankTop(e)),wall(e,bankTop(e),.43),wall(t,bankTop(t),.43),up,color(moss[0]));
    for(let k=0;k<4;k++){
      const ht=bankTop(t)-.41*k-.055,he=bankTop(e)-.41*k-.055;
      for(let j=0;j<3;j++){
        const s=t+(e-t)*j/3+.018,q=t+(e-t)*(j+1)/3-.018;
        if(s>=q)continue;
        const ya=ht+(he-ht)*(s-t)/(e-t),yb=ht+(he-ht)*(q-t)/(e-t);
        strip(B.trim,wall(s,ya-.36,-.018),wall(q,yb-.36,-.018),wall(q,yb,-.018),wall(s,ya,-.018),
          towardRoad,color(moss[(Math.floor(t/3)+2*k+j)%moss.length]));
      }
    }
    // Creepers hang over the hillside retaining course with irregular gaps
    // between plants. Leave more exposed stone at the arterial entrance.
    if(t>31){
      const vine=(s,k)=>{
        const y=bankTop(s),phase=(s*.81+k*1.13),drop=.56+.32*Math.sin(s*.16)+.21*Math.cos(s*1.8);
        return [wall(s,y-drop-.15*Math.cos(phase),-.07),wall(s,y+.25+.17*Math.sin(phase),-.22),
          wall(s,y+.70+.14*Math.sin(phase),.12),wall(s,y+.91+.27*Math.sin(phase),.55)];
      };
      const green=[0x436044,0x475e3a,0x4c633e,0x3f573d];
      for(let j=0;j<6;j++){
        const s=t+(e-t)*j/6,q=t+(e-t)*(j+1)/6,left=vine(s,0),right=vine(q,0);
        for(let k=1;k<left.length;k++){
          strip(B.leaf,left[k-1],right[k-1],right[k],left[k],k===3?up:towardRoad,color(green[(Math.floor(t)+j+k)%green.length]));
        }
      }
    }
    const walk=[point(t,-h-.20),point(e,-h-.20),point(e,-h-2.42),point(t,-h-2.42)];
    if(!W.access.isDrivable(...point((t+e)/2,-h-1.3)))groundPatch(B.brick,walk,(x,z)=>hAt(x,z)+.09,walker);
    // A rounded hedge backs the lower sidewalk. Its top follows the terrain.
    const v=-h-3.12,tip=.94+.08*Math.sin(t*.7);
    for(const [v1,y1,v2,y2] of [[v+.52,.19,v+.48,tip*.76],[v+.48,tip*.76,v+.21,tip],[v+.21,tip,v-.32,tip-.08]]){
      strip(B.leaf,raised(t,v1,y1),raised(e,v1,y1),raised(e,v2,y2),raised(t,v2,y2),
        y1<.4?towardRoad.map(q=>-q):up,color(0x455638));
    }
  }
  let trees=0;
  for(let t=20;t<end-1;t+=7.8){
    const i=Math.round(t/7.8),sidewalk=point(t,-h-1.75),slope=point(t+2.4,h+3.35+.73*Math.sin(i*2.2));
    if(!W.access.isDrivable(...sidewalk)){
      maple(B,sidewalk[0],hAt(...sidewalk),sidewalk[1],1.17+.21*Math.sin(i*.84),i*1.7,i%4===0?0x764d42:0x637848);trees++;
    }
    if(!W.access.isDrivable(...slope)){cedar(B,slope[0],hAt(...slope),slope[1],1.21+.13*Math.sin(i*2.67),i*.89);trees++;}
    if(i%2===0){
      const p=point(t,-h-5.31);if(!W.access.isDrivable(...p)){cedar(B,p[0],hAt(...p),p[1],1.13,i*1.28);trees++;}
    }
  }
  return {facility:'Wooded east approach',way:road.id,trees,panoramas:['3AIWcZrYM3f0-UjDI8HBBA','Gf-NLpsriyRD-k3QIv81kg','SV9_mfDWqGD__6YPmBgBRg']};
}
