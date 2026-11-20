import {at,box,color,column,frame,groundPatch,panel,reverseFrame,solid,strip,up} from './east-campus-shapes.js';
import {redPine} from './east-campus-plants.js';

export const ibsBuildingId=1524854835;

// The aerial distinguishes the three roof masses from the atrium and the
// western laboratory's rooftop garden. The public entrance faces the north lot.
const wall=color(0xb7bfc1),rim=color(0x8c989e),cap=color(0xbec4c3),roof=color(0xb3ada1);
const glass=color(0x496572),darkGlass=color(0x354b54),mullion=color(0x89999e),shadow=color(0x4b5157);
const between=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
function facades(ring){
  const signed=ring.reduce((v,p,i)=>{const n=ring[(i+1)%ring.length];return v+p[0]*n[1]-n[0]*p[1];},0);
  return ring.map((p,i)=>{const edge=frame(p,ring[(i+1)%ring.length]);return signed>0?edge:reverseFrame(edge);});
}
function underside(B,ring,y){
  // All cantilever undersides here are simple convex quadrilaterals.
  B.trim.quad(...ring.map(([x,z])=>[x,y,z]),[0,-1,0],[0,0],[1,0],[1,1],[0,1],shadow);
}
function curtain(B,f,bottom,top){
  const count=Math.max(1,Math.round(f.length/1.52));
  for(let j=0;j<count;j++){
    const a=f.length*j/count,b=f.length*(j+1)/count;
    panel(B.glass,f,a,b,bottom,top,.006,j%5===2?color(0x586f77):glass);
    for(let k=0;k<Math.ceil((top-bottom)/4.1);k++){
      const y=bottom+k*4.1,span=Math.min(4.1,top-y),tint=[0x496773,0x4e707c,0x536e79,0x405c67,0x59737c];
      panel(B.glass,f,a+.055,b-.038,y+.045,y+span*.55,.020,color(tint[(3*j+2*k)%tint.length]));
      panel(B.glass,f,a+.055,b-.038,y+span*.57,y+span*.90,.020,color(k===0?0x405956:0x60777a));
      if(k>0 && (j+2*k)%5===1)panel(B.trim,f,a+.28,b-.24,y+span*.78,y+span*.78+.033,.034,color(0xaaab98));
    }
    panel(B.trim,f,a,a+.057,bottom,top,.052,mullion);
  }
  for(let y=bottom+1.35;y<top;y+=1.36)panel(B.trim,f,0,f.length,y,y+.045,.052,mullion);
}
function ribbed(B,f,bottom,top,rows){
  const end=f.length,width=.36,bays=Math.max(2,Math.round((end-2*width)/2.15));
  panel(B.glass,f,0,end,bottom,top,.02,darkGlass);
  box(B.trim,f,0,width,-.05,.45,bottom,top,cap);
  box(B.trim,f,end-width,end,-.05,.45,bottom,top,cap);
  for(const y of [bottom,top-.35])box(B.trim,f,0,end,-.05,.45,y,y+.35,wall);
  const low=bottom+.39,high=top-.39;
  for(let j=0;j<bays;j++){
    const a=width+(end-2*width)*j/bays,b=width+(end-2*width)*(j+1)/bays;
    // Wide pale blades have dark reveals between the blade and the window.
    box(B.trim,f,a+.09,a+.47*(b-a),-.04,.31,low,high,wall);
    for(let k=1;k<rows*3;k++){
      const y=low+(high-low)*k/(rows*3);
      panel(B.trim,f,a+.47*(b-a),b,y,y+.045,.06,mullion);
    }
  }
  for(let k=1;k<rows;k++){
    const y=low+(high-low)*k/rows;
    box(B.trim,f,width,end-width,-.04,.35,y-.055,y+.075,cap);
    panel(B.trim,f,width,end-width,y-.18,y-.06,.16,shadow);
  }
}
function shell(B,ring,base,bottom,top,rows,glazed){
  const center=ring.reduce((s,p)=>[s[0]+p[0]/4,s[1]+p[1]/4],[0,0]);
  const core=ring.map(p=>between(p,center,.18));
  solid(B.glass,core,base-1.8,bottom,darkGlass);
  for(const f of facades(core))curtain(B,f,base-.4,bottom);
  solid(B.trim,ring,bottom,top,roof);
  underside(B,ring,bottom);
  const sides=facades(ring);
  for(const [i,f] of sides.entries()){
    if(glazed.includes(i)){
      curtain(B,f,bottom+.16,top-.18);
      box(B.trim,f,0,f.length,-.08,.11,top-.26,top+.08,cap);
    }else ribbed(B,f,bottom,top,rows);
    const count=Math.max(1,Math.round(f.length/8.9));
    for(let j=0;j<count;j++){
      const [x,,z]=at(f,(j+.35)*f.length/count,0,-1.27);
      column(B.trim,x,z,.33,base-.75,bottom,cap);
    }
  }
  return sides;
}
function rooftopPlant(B,f,width,depth,y){
  box(B.trim,f,1.8,width-1.8,-depth-1.1,-1.5,y,y+2.45,cap);
  const metal=color(0xb1b5b1),fan=color(0x657171);
  for(let u=2.15;u<width-2.1;u+=.46)panel(B.trim,f,u,u+.21,y+.43,y+2.08,-1.48,metal);
  for(let u=4;u<width-3;u+=4.8)for(let d=3.7;d<depth-.9;d+=4.2){
    const [x,,z]=at(f,u,y,-d);
    column(B.trim,x,z,1.36,y+2.45,y+2.57,fan);
    column(B.trim,x,z,.34,y+2.57,y+2.62,metal);
  }
}
export function buildIbsCampus(building,hAt,B){
  const p=building.p,floor=hAt(...p[17])+.13,top=floor+24.7;
  const west=[p[28],p[26],p[1],p[0]],innerEast=[482.85,87.78];
  const east=[p[17],p[14],p[12],innerEast],south=[p[5],p[4],innerEast,p[6]];
  const westFront=shell(B,west,floor,floor+8.2,top,4,[1])[0];
  const eastFront=shell(B,east,floor,floor+4.28,top,5,[3])[0];
  const southFaces=shell(B,south,floor,floor+4.15,top-.10,5,[0]);
  rearLoadingBay(B,p,floor,hAt);
  // A shorter glazed atrium joins the wings across the north end of the court.
  const atrium=[p[26],p[17],p[3],p[2]];
  solid(B.glass,atrium,floor+4.12,top-4.05,darkGlass);
  for(const f of facades(atrium))curtain(B,f,floor+4.16,top-4.08);
  const lobby=[between(p[26],p[2],.16),between(p[17],p[3],.16),p[3],p[2]];
  solid(B.glass,lobby,floor-.72,floor+4.15,darkGlass);
  for(const f of facades(lobby))curtain(B,f,floor+.13,floor+4.13);
  const tower=[p[22],p[21],between(p[21],p[3],.39),between(p[22],p[2],.39)];
  solid(B.glass,tower,top-4.13,top+.06,glass);
  for(const f of facades(tower))curtain(B,f,top-4.12,top+.09);
  // This is a covered walk to a closed lobby, including its visible soffit.
  const front=frame(p[28],p[14]),end=front.length;
  const xy=(u,d)=>{const [x,,z]=at(front,u,0,d);return [x,z];};
  const canopy=[xy(.4,4.25),xy(end-.4,4.25),xy(end-.4,-6.55),xy(.4,-6.55)];
  solid(B.trim,canopy,floor+3.79,floor+4.15,rim);underside(B,canopy,floor+3.79);
  const doors=frame(lobby[0],lobby[1]);
  curtain(B,doors,floor+.19,floor+3.81);
  for(const along of [.35,.52]){
    const u=doors.length*along;
    for(const dx of [-1.0,0,1.0])box(B.trim,doors,u+dx-.034,u+dx+.034,-.04,.045,floor+.19,floor+2.68,cap);
    panel(B.trim,doors,u-1.05,u+1.05,floor+2.60,floor+2.68,.045,cap);
  }
  for(let u=2;u<end-1.5;u+=7.5){const [x,z]=xy(u,3.29);column(B.trim,x,z,.37,hAt(x,z)-.33,floor+3.81,cap);}
  groundPatch(B.trim,[xy(.32,5.7),xy(end-.32,5.7),xy(end-.32,-6.25),xy(.32,-6.25)],(x,z)=>hAt(x,z)+.085,color(0xaaa9a3));
  roofDetails(B,westFront,eastFront,southFaces[2],top);
  // The near trees stand in two islands outside the covered entrance apron.
  for(const [x,z,h,r] of [[401.1,11.5,7.5,3.1],[407.8,6.7,8.6,3.5],[430.4,-10.1,7.7,3.1]]){
    const ring=Array.from({length:18},(_,i)=>{
      const a=i*Math.PI/9,dx=1.99*Math.cos(a),dz=1.08*Math.sin(a);
      return [x+front.u[0]*dx+front.n[0]*dz,z+front.u[1]*dx+front.n[1]*dz];
    });
    const y=hAt(x,z)+.25;
    solid(B.trim,ring,y-.29,y+.12,cap);
    solid(B.trim,ring.map(v=>[x+.90*(v[0]-x),z+.90*(v[1]-z)]),y+.12,y+.15,color(0x657149));
    redPine(B,x,hAt(x,z),z,r,h,x);
  }
  return {footprint:building.id,top:top+3.15,facility:'IBS KAIST Campus',floors:6,
    panoramas:['mrsM6M9BDg94iec2XTLB5w','oDR6p2p0PoPXWShVLkClFg','CgKuCNS-EKioAuiYBl4qkQ']};
}
function rearLoadingBay(B,p,floor,hAt){
  const rear=frame(p[12],p[6]),u=41.25,slab=floor+4.15;
  const shade=color(0xa1a5a4),door=color(0x737c7c),joints=color(0x929898);
  const grade=hAt(473.4,96.8)+.17;
  // Closed loading doors face the actual service driveway. They sit beneath
  // the full-span rear facade. The ends return into the enclosed ground floor.
  box(B.trim,rear,2.4,rear.length-1.71,-3.4,-1.2,floor-1.45,slab,shade);
  for(let a=2.4;a<rear.length-2;a+=1.09)panel(B.trim,rear,a,a+.029,grade,slab,-1.18,joints);
  for(let y=grade+.91;y<slab;y+=1.08)panel(B.trim,rear,2.4,rear.length-1.71,y,y+.025,-1.175,joints);
  for(const [s,e,h] of [[u-3.25,u+3.25,2.96],[u-10.1,u-6.9,3.12]]){
    box(B.trim,rear,s-.14,e+.14,-1.29,-.95,grade-.07,grade+h+.15,shadow);
    panel(B.trim,rear,s,e,grade+.025,grade+h,-.938,door);
    for(let y=grade+.13;y<grade+h;y+=.16)panel(B.trim,rear,s,e,y,y+.018,-.922,shadow);
    for(const a of [s-.25,e+.25]){
      const [x,,z]=at(rear,a,0,-.69);
      column(B.trim,x,z,.085,grade-.09,grade+.93,color(0xd9b448));
      column(B.trim,x,z,.086,grade+.43,grade+.61,shadow);
    }
  }
  const apron=[2.4,rear.length-1.71].flatMap(a=>[at(rear,a,0,-1.17),at(rear,a,0,.2)]);
  groundPatch(B.trim,[apron[0],apron[1],apron[3],apron[2]].map(v=>[v[0],v[2]]),(x,z)=>hAt(x,z)+.077,shade);
}
function roofDetails(B,west,east,south,top){
  rooftopPlant(B,east,east.length,11.3,top);
  // The long, low west roof plant sits behind the roof garden.
  box(B.trim,west,3.3,west.length-3.5,-45.9,-17.9,top,top+2.15,color(0xcac8bd));
  for(const [u,d,s] of [[4.2,4.4,5.5],[12.6,10.8,4.8]]){
    box(B.trim,west,u,u+s,-d-s,-d,top,top+.32,rim);
    box(B.trim,west,u+.24,u+s-.24,-d-s+.24,-d-.24,top+.32,top+.46,color(0x637157));
  }
  const half=Math.min(25.3,south.length*.58),navy=color(0x354b58);
  for(let i=0;i<12;i++)for(let j=0;j<3;j++){
    const a=2.8+i*half/12,b=a+half/12-.045,d=-1.6-j*1.43,e=d-1.38;
    strip(B.trim,at(south,a,top+.33,d),at(south,b,top+.33,d),at(south,b,top+.68,e),at(south,a,top+.68,e),up,navy);
  }
}
