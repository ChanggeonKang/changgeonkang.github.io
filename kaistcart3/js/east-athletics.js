import {at,box,color,column,frame,groundPoint,panel,plaque,reverseFrame,strip,up,vector} from './east-campus-shapes.js';
import {clippedConifer,maple} from './east-campus-plants.js';

// OSM way 540131709 fixes the field centre and heading. The November street
// panoramas and the aerial photograph show four continuous red lanes, a wider
// sprint straight in front of the stand, and a dark outer skating lane.
const PITCH=540131709;
export const GRANDSTAND=540132003;
function ovalSections(halfStraight){
  const section=[];
  for(let i=0;i<36;i++)section.push([halfStraight*(i/18-1),0,0,-1]);
  for(let i=0;i<48;i++){const t=i*Math.PI/48;section.push([halfStraight,0,Math.sin(t),-Math.cos(t)]);}
  for(let i=0;i<36;i++)section.push([halfStraight*(1-i/18),0,0,1]);
  for(let i=0;i<48;i++){const t=i*Math.PI/48;section.push([-halfStraight,0,-Math.sin(t),Math.cos(t)]);}
  return section;
}
function runningTrack(f,hAt,B){
  const inner=35.45,lane=1.24,half=(400-2*Math.PI*(inner+.30))/4;
  const sections=ovalSections(half),red=color(0x9c6155),dark=color(0x645c5b),white=color(0xbdb7a4);
  const path=(s,r,lift)=>groundPoint(f,s[0]+r*s[2],s[1]+r*s[3],hAt,lift);
  const ribbon=(r1,r2,lift,shade,dashed=false)=>{
    for(let i=0;i<sections.length;i++){
      const a=sections[i],b=sections[(i+1)%sections.length],mid=a.map((v,k)=>(v+b[k])/2);
      strip(B.track,path(a,r1,lift),path(dashed?mid:b,r1,lift),path(dashed?mid:b,r2,lift),path(a,r2,lift),up,shade);
    }
  };
  ribbon(inner+lane*4,inner+lane*4+4.5,.085,dark);
  ribbon(inner,inner+lane*4,.085,red);
  for(let k=0;k<=4;k++)ribbon(inner+k*lane-.035,inner+k*lane+.035,.115,white);
  ribbon(inner+lane*4+3.75,inner+lane*4+3.84,.12,white,true);
  // Two straight sprint lanes extend beyond the tangent points on the stands side.
  const start=-half-8.3,end=half+8.3;
  for(let u=start;u<end;u+=2.35){
    const next=Math.min(end,u+2.35);
    const panel=(a,b,lift,shade)=>strip(B.track,groundPoint(f,u,-a,hAt,lift),groundPoint(f,next,-a,hAt,lift),
      groundPoint(f,next,-b,hAt,lift),groundPoint(f,u,-b,hAt,lift),up,shade);
    panel(inner+lane*4,inner+lane*6,.128,red);
    for(let k=4;k<=6;k++)panel(inner+lane*k-.035,inner+lane*k+.035,.15,white);
  }
  return {officialDistanceM:400,innerRadiusM:inner,straightM:2*half,estimate:'Oval registered to the mapped pitch and public Naver overhead view'};
}
function soccerGoals(f,half,hAt,B){
  const white=color(0xebece4),net=color(0x94a6a2);
  for(const sign of [-1,1]){
    const u=half*sign,depth=1.9*sign,w=3.66;
    const l=groundPoint(f,u,-w,hAt,.12),r=groundPoint(f,u,w,hAt,.12);
    const floor=(l[1]+r[1])/2,top=floor+2.44;
    for(const end of [l,r])column(B.trim,end[0],end[2],.058,end[1]-.055,top,white);
    box(B.trim,f,u-.055,u+.055,-w-.05,w+.05,top-.055,top+.055,white);
    for(const side of [-w,w]){
      const a=groundPoint(f,u,side,hAt,.13),b=groundPoint(f,u+depth,side,hAt,.13);
      const d=at(f,u,top,side),c=at(f,u+depth*.56,top-.38,side);
      strip(B.wire,a,b,c,d,vector(...f.u),net);
    }
    strip(B.wire,groundPoint(f,u+depth,-w,hAt,.13),groundPoint(f,u+depth,w,hAt,.13),
      at(f,u+depth*.56,top-.38,w),at(f,u+depth*.56,top-.38,-w),vector(...f.u),net);
  }
}
function floodlight(f,u,d,hAt,B){
  const p=groundPoint(f,u,d,hAt),floor=p[1],steel=color(0x727e7d);
  column(B.trim,p[0],p[2],.16,floor-.2,floor+16.2,steel);
  box(B.trim,f,u-1.35,u+1.35,d-.16,d+.16,floor+15.35,floor+16.75,steel);
  for(let i=0;i<4;i++)for(let j=0;j<2;j++){
    const start=u-1.17+i*.64;
    box(B.trim,f,start,start+.43,d-.24,d+.24,floor+15.45+j*.60,floor+15.86+j*.60,color(0xd6d2be));
  }
}
export function buildEastTrack(W,hAt,B){
  const pitch=W.D.areas.find(a=>a.id===PITCH);if(pitch?.p.length!==4)return;
  const p=pitch.p,mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
  const a=mid(p[0],p[1]),b=mid(p[2],p[3]),f=frame(a,b),length=f.length;f.a=mid(a,b);
  const detail=runningTrack(f,hAt,B);
  soccerGoals(f,length/2,hAt,B);
  // Lighting masts are on the grass outside the oval and inside the perimeter street.
  for(const [u,d] of [[-38,49.5],[39,49.5],[-38,-50.7],[39,-50.7]]){
    const p=groundPoint(f,u,d,hAt);
    if(!W.access.isDrivable(p[0],p[2]))floodlight(f,u,d,hAt,B);
  }
  // The second, uncovered terrace (OSM 653988258) runs between the oval
  // and clinic-side parking. The November panorama shows clipped evergreens
  // between the rear rim and the noses of the cars.
  const terrace=frame([611,-22.8],[654.1,44.6]),step=color(0xc1b9a3),face=color(0xb2aa94);
  const count=Math.ceil(terrace.length/2.75);
  for(let i=0;i<count;i++){
    const a=terrace.length*i/count,b=terrace.length*(i+1)/count;
    const ha=groundPoint(terrace,a,-3.3,hAt)[1],hb=groundPoint(terrace,b,-3.3,hAt)[1];
    for(let j=0;j<8;j++){
      const d=-7.08+j*.885,rise=(j+1)*.205;
      strip(B.trim,at(terrace,a,ha+rise,d),at(terrace,b,hb+rise,d),at(terrace,b,hb+rise,d+.885),at(terrace,a,ha+rise,d+.885),up,step);
      strip(B.trim,at(terrace,a,ha+rise-.21,d),at(terrace,b,hb+rise-.21,d),at(terrace,b,hb+rise,d),at(terrace,a,ha+rise,d),vector(-terrace.n[0],-terrace.n[1]),face);
    }
    strip(B.trim,at(terrace,a,ha-.20),at(terrace,b,hb-.20),at(terrace,b,hb+1.64),at(terrace,a,ha+1.64),vector(...terrace.n),face);
  }
  for(let i=0;i<13;i++){
    const [x,y,z]=groundPoint(terrace,3+i*6.0,.9,hAt);
    if(!W.access.isDrivable(x,z))clippedConifer(B,x,y,z,1.30+.15*Math.sin(i),i*1.63);
  }
  return {facility:'East Field (E17)',way:PITCH,stand:GRANDSTAND,clinicSideBleachers:653988258,...detail,panoramas:['uhzJy5PW3EQFMpoChetc3g','I6sW9DWDTU0zD6Nl7Ce3Ow','g_hweEBJfwXK0mJ6O360yw']};
}
export function buildEastStand(b,hAt,B,group,access){
  // The long stepped terrace follows the footprint. Only its central pavilion
  // has the blue roof and eight white transverse frames seen from the parking lot.
  const f=frame(b.p[2],b.p[5]),L=f.length,porcelain=color(0xd4d3c8),step=color(0xc4c1b1),glass=color(0x344f53);
  const roomStart=L*.328,roomEnd=L*.635,mid=(roomStart+roomEnd)/2;
  const slab=groundPoint(f,mid,-2.2,hAt,.03)[1];
  const rows=8,depth=6.42;
  for(let s=0;s<L;s+=2){
    const e=Math.min(L,s+2),yl=groundPoint(f,s,3,hAt,.08)[1],yr=groundPoint(f,e,3,hAt,.08)[1];
    for(let j=0;j<rows;j++){
      const out=depth*(1-j/rows),inside=depth*(1-(j+1)/rows),rise=(j+1)*.315;
      strip(B.trim,at(f,s,yl+rise,out),at(f,e,yr+rise,out),at(f,e,yr+rise,inside),at(f,s,yl+rise,inside),up,step);
      strip(B.trim,at(f,s,yl+rise-.33,out),at(f,e,yr+rise-.33,out),at(f,e,yr+rise,out),at(f,s,yl+rise,out),vector(...f.n),porcelain);
    }
    strip(B.trim,at(f,s,yl-.15,0),at(f,e,yr-.15,0),at(f,e,yr+rows*.315,0),at(f,s,yl+rows*.315,0),vector(-f.n[0],-f.n[1]),porcelain);
  }
  const top=slab+7.3,back=reverseFrame(f),width=roomEnd-roomStart;
  box(B.trim,f,roomStart,roomEnd,-5.65,.02,slab-.35,slab+2.48,porcelain);
  for(let j=0;j<6;j++){
    const s=roomStart+1.05+j*(width-2)/6,e=roomStart+1.05+(j+1)*(width-2)/6;
    panel(B.glass,back,L-e+.09,L-s-.09,slab+.47,slab+2.17,5.69,glass);
  }
  // Window mullions surround a pair of glazed entrance doors. The two stair
  // flights start at the parking level and reach the upper seating walkway.
  const centreBack=L-mid;
  panel(B.trim,back,centreBack-1.72,centreBack+1.72,slab-.05,slab+2.37,5.71,color(0xc0c2b9));
  for(const c of [centreBack-.64,centreBack+.64]){
    panel(B.glass,back,c-.59,c+.59,slab+.08,slab+2.14,5.733,color(0x4e6260));
    panel(B.trim,back,c-.59,c+.59,slab+.82,slab+.90,5.75,color(0x929c97));
  }
  for(const [s,e] of [[roomStart-1.62,roomStart-.08],[roomEnd+.08,roomEnd+1.62]]){
    const y=groundPoint(f,(s+e)/2,-5.4,hAt,.06)[1],high=slab+2.52;
    for(let j=0;j<13;j++){
      const d=-6.18+j*.46,rise=y+(high-y)*(j+1)/13;
      box(B.trim,f,s,e,d,d+.47,y-.16,rise,step);
      strip(B.trim,at(f,s,rise,d),at(f,e,rise,d),at(f,e,rise,d+.055),at(f,s,rise,d+.055),up,porcelain);
    }
    for(const u of [s-.07,e+.07]){
      const front=at(f,u,y+.54,-6.18),rear=at(f,u,high+.58,-.15);
      strip(B.screen,front,rear,[rear[0],rear[1]+.11,rear[2]],[front[0],front[1]+.11,front[2]],vector(...f.u),porcelain);
    }
  }
  for(let j=0;j<8;j++){
    const u=roomStart+j*width/7,thick=.29,inner=.26;
    // Slightly raked frame legs with broad exposed white faces.
    for(const side of [-1,1]){
      const d0=side===-1?-4.55:3.20,d1=side===-1?-5.55:4.12;
      const A=at(f,u-thick,slab+.18,d0-inner),B1=at(f,u+thick,slab+.18,d0-inner),
        C=at(f,u+thick,top+.30,d1-inner),D=at(f,u-thick,top+.30,d1-inner);
      const A2=at(f,u-thick,slab+.18,d0+inner),B2=at(f,u+thick,slab+.18,d0+inner),
        C2=at(f,u+thick,top+.30,d1+inner),D2=at(f,u-thick,top+.30,d1+inner);
      strip(B.trim,A,B1,C,D,vector(-f.n[0],-f.n[1]),porcelain);strip(B.trim,A2,B2,C2,D2,vector(...f.n),porcelain);
      strip(B.trim,A,A2,D2,D,vector(-f.u[0],-f.u[1]),porcelain);strip(B.trim,B1,B2,C2,C,vector(...f.u),porcelain);
    }
    box(B.trim,f,u-thick,u+thick,-5.85,4.45,top-.30,top+.54,porcelain);
  }
  for(const out of [-5.44,-3.05,4.1])box(B.trim,f,roomStart-.25,roomEnd+.25,out-.19,out+.19,top-.68,top-.14,porcelain);
  box(B.trim,f,roomStart+.06,roomEnd-.06,-4.85,-4.53,slab+4.30,slab+4.80,porcelain);
  for(const u of [roomStart+2.25,roomEnd-3.32]){
    for(const d of [-7.27,-6.48,-5.90]){
      const [x,y,z]=groundPoint(f,u,d,hAt);
      if(access.isDrivable(x,z))continue;
      box(B.trim,f,u-.96,u+.96,d-.62,d+.62,y-.09,y+.41,porcelain);
      maple(B,x,y+.40,z,1.61,u*.39);break;
    }
  }
  box(B.trim,f,roomStart-.18,roomEnd+.18,-5.48,4.15,top-.13,top+.02,color(0x8eacb1));
  plaque(group,'E17',back,L-(roomEnd-2.25),top-.42,5.66,2.15,.88,'#b86c2b');
  return {facility:'East Field grandstand',way:b.id,top,panoramas:['g_hweEBJfwXK0mJ6O360yw','EVXgpxipOLIuHrKcbDx0EQ']};
}
