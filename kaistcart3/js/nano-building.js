import {at,box,color,column,frame,panel,plaque,solid,strip,up} from './east-campus-shapes.js';
import {clippedConifer,maple,redPine} from './east-campus-plants.js';

export const nanoBuildingId=49931569;

// The owner lists a nine-floor research tower, two fab floors and a separate
// four-floor support building. The three roof outlines are visible from above.
export function buildNanoBuilding(building,hAt,B,group){
  const p=building.p,index=ids=>ids.map(i=>p[i]),ground=Math.min(...p.map(q=>hAt(...q)))-.4;
  const foot=hAt(464.1,185.8)+.15,towerTop=foot+35.1,plantTop=foot+18.3,fabTop=foot+15.65;
  const silver=color(0xb4bac0),dark=color(0x2b3c4c),stone=color(0xc3b8b4),blue=color(0x365e76),grey=color(0x929a9c);
  const research=index([8,9,10,11,12,13,14,15,16,17,18,19]),plant=index([3,4,5,6]);
  const fab=index([0,1,2,3,6,7,8,19,20,21,22,23,24,25]);
  solid(B.trim,research,ground,towerTop,silver);
  solid(B.trim,fab,ground,fabTop,silver);
  solid(B.trim,fab,fabTop,fabTop+.12,color(0x537668));
  solid(B.trim,plant,ground,plantTop,silver);
  const towerFront=frame(p[11],p[15]);
  for(const [i,q] of research.entries()){
    const f=frame(q,research[(i+1)%research.length]);
    if(f.length<3)continue;
    const curtain=f.n[1]>.43 && f.n[0]>.16, h=towerTop-foot;
    for(let j=0;j<9;j++){
      const y=foot+j*h/9,lo=y+.33,hi=y+h/9-.46;
      panel(B.glass,f,0,f.length,lo,hi,.04,curtain?color([0x32697d,0x396578,0x416d7e][j%3]):blue);
      for(let a=.8;a<f.length-.1;a+=1.56)panel(B.trim,f,a,a+.044,lo,hi,.074,color(0x506675));
      panel(B.trim,f,0,f.length,hi-.55,hi-.51,.062,grey);
    }
  }
  // The vertical glazed feature at the southwest end interrupts the horizontal
  // bands on the long south face; a pale stone end tower rises above it.
  const L=towerFront.length;
  panel(B.glass,towerFront,L-15.8,L-5.7,foot,towerTop,.105,color(0x346779));
  for(let a=L-15.5;a<L-5.7;a+=1.6)panel(B.trim,towerFront,a,a+.052,foot,towerTop,.145,grey);
  for(let j=1;j<22;j++)panel(B.trim,towerFront,L-15.8,L-5.7,foot+1.57*j,foot+1.57*j+.043,.146,grey);
  panel(B.trim,towerFront,L-5.65,L-.35,ground,towerTop+.12,.107,stone);
  for(let i=0;i<8;i++)panel(B.glass,towerFront,L-4.8,L-1.01,foot+1.37+i*3.86,foot+2.94+i*3.86,.144,dark);
  plaque(group,'KAIST',towerFront,L-10.5,towerTop-1.25,.19,6.5,1.52,'#f5f4f0');
  const porch=34.25;
  box(B.trim,towerFront,porch-6.3,porch+6.3,-.03,5.15,foot+4.10,foot+4.40,silver);
  for(const u of [porch-5.85,porch+5.85]){const [x,,z]=at(towerFront,u,0,4.71);column(B.trim,x,z,.31,hAt(x,z)-.38,foot+4.11,silver);}
  const roofTile=(f,u,v,w,d,shade)=>{
    strip(B.trim,at(f,u,towerTop+.15,v),at(f,u+w,towerTop+.15,v),at(f,u+w,towerTop+.45,v-d),at(f,u,towerTop+.45,v-d),up,shade);
  };
  for(let i=0;i<20;i++)for(let j=0;j<4;j++)roofTile(towerFront,5.5+2.17*i,-1.35-1.33*j,2.12,1.27,color(0x384e60));
  // The fab is clad in long silver panels. The street-side corner has a
  // separate midnight-blue support wing and projecting shutter landings.
  for(const [i,q] of fab.entries()){
    const f=frame(q,fab[(i+1)%fab.length]);
    for(let y=foot+1.3;y<fabTop-.1;y+=1.23)panel(B.trim,f,0,f.length,y,y+.038,.021,grey);
    if(f.length>16)for(let u=2.0;u<f.length-3;u+=12.6){
      box(B.trim,f,u,Math.min(f.length-.2,u+5.42),.04,.45,foot+4.1,fabTop-.48,silver);
      for(let j=0;j<19;j++)panel(B.trim,f,u+.30,Math.min(f.length-.5,u+4.92),foot+7.11+.21*j,foot+7.17+.21*j,.465,grey);
    }
  }
  const supportFront=frame(p[5],p[6]),roadSide=frame(p[4],p[5]);
  for(const f of [supportFront,roadSide]){
    panel(B.trim,f,0,f.length,ground,plantTop,.025,dark);
    for(let y=foot+.84;y<plantTop-.1;y+=.98)panel(B.trim,f,0,f.length,y,y+.036,.05,color(0x23313f));
    const stripStart=f===roadSide?f.length*.25:.75,stripEnd=f===roadSide?f.length*.68:3.5;
    for(let i=0;i<4;i++)panel(B.glass,f,stripStart,stripEnd,foot+1.2+i*4.23,foot+2.02+i*4.23,.066,color(0x444f50));
  }
  const entrance=frame(p[6],p[8]),half=entrance.length/2;
  for(const f of [frame(p[8],p[9]),frame(p[9],p[10])]){
    panel(B.stone,f,0,f.length,ground,towerTop,.052,stone);
    for(let y=foot+.77,row=0;y<towerTop-.1;y+=.84,row++){
      panel(B.trim,f,0,f.length,y,y+.019,.066,grey);
      for(let u=.34+(row%2)*.61;u<f.length-.02;u+=1.22)panel(B.trim,f,u,u+.015,y+.019,Math.min(towerTop,y+.84),.067,grey);
    }
  }
  for(let j=0;j<4;j++){
    const y=foot+4.27*j,u=4.88,w=3.0;
    box(B.trim,supportFront,u-.14,u+w+.14,.04,.16,y,y+2.78,silver);
    panel(B.trim,supportFront,u,u+w,y+.12,y+2.64,.178,color(0xc4c3bd));
    for(let k=0;k<17;k++)panel(B.trim,supportFront,u,u+w,y+.21+k*.137,y+.232+k*.137,.187,grey);
    if(!j)continue;
    box(B.trim,supportFront,u-.79,u+w+.79,.13,1.32,y-.16,y+.035,silver);
    const rails=color(0x879498);
    for(const a of [u-.72,u+.74,u+2.29,u+w+.73])box(B.trim,supportFront,a-.031,a+.031,1.19,1.26,y,y+.93,rails);
    for(const h of [.46,.91])box(B.trim,supportFront,u-.76,u+w+.76,1.18,1.26,y+h,y+h+.045,rails);
  }
  // Six stone steps rise from the end of the short vehicle approach. The
  // photographed door is opaque and is set between the returning walls.
  const g=hAt(464.1,185.8)+.12,high=g+1.02;
  const end=entrance.length,frameMetal=color(0x58606a);
  panel(B.trim,entrance,0,end,ground,plantTop,.05,color(0x7a8591));
  for(const u of [0,end-.43])box(B.trim,entrance,u,u+.43,.072,.72,high,plantTop,frameMetal);
  box(B.trim,entrance,.43,end-.43,.08,.72,high+3.42,plantTop,frameMetal);
  panel(B.trim,entrance,.46,end-.46,high+3.47,plantTop-.36,.731,color(0x87909a));
  panel(B.trim,entrance,half-.79,half+.79,high+3.83,plantTop-.36,.741,color(0x5a626f));
  for(let y=high+4.48;y<plantTop-.25;y+=1.10)panel(B.trim,entrance,.46,end-.46,y,y+.023,.75,grey);
  panel(B.glass,entrance,.45,end-.45,high,high+3.38,.093,color(0x303b44));
  for(let j=0;j<3;j++)panel(B.glass,entrance,half-1.3+.87*j,half-.46+.87*j,high+.06,high+2.53,.12,color(j===1?0x53615e:0x3c5357));
  for(const a of [half-1.32,half-.44,half+.44,half+1.32])box(B.trim,entrance,a-.031,a+.031,.13,.18,high,high+2.57,grey);
  panel(B.trim,entrance,half-1.33,half+1.33,high+2.55,high+2.62,.16,grey);
  panel(B.trim,entrance,half-.86,half+.86,high+3.02,high+3.065,.13,color(0xd5d3b5));
  box(B.trim,entrance,.18,end-.18,.05,1.26,g-.16,high,color(0xaaaba7));
  for(let k=0;k<6;k++)box(B.trim,entrance,.19,end-.19,.18,3.59-.39*k,g-.13,g+.17*(k+1),color(0xaaaba7));
  for(const u of [.17,end-.37])box(B.trim,entrance,u,u+.22,.12,3.62,g-.16,high+.42,stone);
  // Two silver handrails descend beside the stairs. The lawn and lamp stand
  // alongside this approach, outside the paving used by the kart.
  for(const u of [.29,end-.26]){
    const y=high+1.02,l=g+.92,metal=color(0x7d8689);
    for(const [depth,h] of [[.83,y],[3.33,l]]){
      const [x,,z]=at(entrance,u,0,depth);column(B.trim,x,z,.025,g+.26,h,metal);
    }
    strip(B.trim,at(entrance,u-.035,y,.83),at(entrance,u+.035,y,.83),
      at(entrance,u+.035,l,3.33),at(entrance,u-.035,l,3.33),up,metal);
  }
  const lawnTrees=[[.95,5.0,2.15],[10.4,4.75,2.85],[17.75,5.55,2.92],[24.1,4.65,2.54],
    [44.3,5.65,2.83],[54.4,4.30,2.62],[60.35,4.85,2.79]];
  for(const [u,d,r] of lawnTrees){
    const [x,,z]=at(towerFront,u,0,d);redPine(B,x,hAt(x,z),z,r,r*2.33,u);
  }
  for(const [x,z,size,seed] of [[469.7,187.3,.73,7],[472.9,190.9,1.38,16],[475.75,198.4,1.47,18]]){
    if(size<1)clippedConifer(B,x,hAt(x,z),z,size,seed);else maple(B,x,hAt(x,z),z,size,seed,0x734e44);
  }
  const lampX=473.1,lampZ=184.1,lampBase=hAt(lampX,lampZ)+.03,aluminum=color(0xa4aaad);
  column(B.trim,lampX,lampZ,.17,lampBase-.05,lampBase+.21,aluminum);
  column(B.trim,lampX,lampZ,.065,lampBase+.18,lampBase+3.84,aluminum);
  const lampFrame=frame([lampX,lampZ],[lampX+entrance.u[0],lampZ+entrance.u[1]]);
  box(B.trim,lampFrame,-.04,.39,-.035,.035,lampBase+3.72,lampBase+3.78,aluminum);
  const light=at(lampFrame,.32,lampBase+3.56,.015);
  column(B.trim,light[0],light[2],.10,light[1]-.13,light[1]+.09,color(0xd3d6c3));
  return {footprint:building.id,top:towerTop+.2,facility:'National Nanofab Center',researchFloors:9,fabFloors:2,supportFloors:4,
    panoramas:['7soDrL8vu8aHQ-AfESMO6g','1cY8bPFf-OSot9i6uDFslA','Ilnoqv0o-An8zhPYKl6acg','YO_D-5SOG6hk04t75D40OA']};
}
