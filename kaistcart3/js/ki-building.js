import {at,box,color,column,frame,panel,reverseFrame,solid,strip,up,vector} from './east-campus-shapes.js';

export const kiBuildingId=687286872;

// The upper curtain wall is the mapped footprint. The lower curtain wall is
// set back behind columns, external stairs and the sweeping concrete balcony.
// Gansam's completed-building photographs show this detail on both fronts.
export function buildKiBuilding(building,hAt,B){
  const p=building.p,corners=[p[0],p[3],p[5],p[7]];
  const axis=frame(corners[0],corners[1]),length=axis.length;
  const depth=Math.hypot(corners[3][0]-corners[0][0],corners[3][1]-corners[0][1]);
  const point=(u,v)=>[axis.a[0]+u*axis.u[0]+v*axis.n[0],axis.a[1]+u*axis.u[1]+v*axis.n[1]];
  const floor=Math.min(...corners.map(q=>hAt(...q)))+.12;
  const slab=floor+9.7,top=slab+16.6,concrete=color(0xb7b6b0),soffit=color(0x807f79),rail=color(0x676e70);
  const outer=corners.map((q,i)=>reverseFrame(frame(q,corners[(i+1)%4])));
  const inner=[point(6,7.2),point(length-6,7.2),point(length-6,depth-7.2),point(6,depth-7.2)];
  const basement=Math.min(...corners.map(q=>hAt(...q)))-2;
  // Close the entire perimeter of the lobby and both sides of the overhang.
  solid(B.glass,inner,basement,slab+.04,color(0x213637));
  solid(B.trim,corners,slab-.35,slab,soffit);
  for(const ids of [[0,1,2],[0,2,3]]){
    B.trim.tri(...ids.map(i=>[corners[i][0],slab-.35,corners[i][1]]),[0,-1,0],...[0,1,2].map(i=>[i%2,Math.floor(i/2)]),soffit);
  }
  solid(B.trim,corners,top-.12,top+.12,color(0x819093));
  const colours=[0x334e57,0x51646b,0x315365,0x5c7177,0x3c565f,0x456570,0x54636a].map(color);
  const light=color(0x758a90),dark=color(0x233e49),floorStrip=color(0x495f64);
  for(const [side,f] of outer.entries()){
    const bays=Math.round(f.length/.95),span=f.length/bays;
    for(let j=0;j<bays;j++){
      const a=j*span,b=(j+1)*span;
      const shade=colours[(Math.floor(j/2)*3+Math.floor(j/7)+side)%colours.length];
      panel(B.glass,f,a,b,slab,top,0,shade);
      panel(B.trim,f,a,a+.037,slab,top,.018,light);
      if(j%8===3||j%11===5){
        for(let k=0;k<3;k++){
          const y=slab+2.75+k*4.75;
          strip(B.glass,at(f,a+.13,y,.20),at(f,b-.08,y,.20),at(f,b-.08,y+.57,.025),at(f,a+.13,y+.57,.025),vector(...f.n),dark);
        }
      }
    }
    for(let h=1;h<13;h++){
      const y=slab+h*(top-slab)/13;
      panel(B.trim,f,0,f.length,y,y+(h%4===0?.115:.04),.024,h%4===0?floorStrip:light);
    }
    const glass=reverseFrame(frame(inner[side],inner[(side+1)%4]));
    for(let u=0;u<glass.length;u+=1.8)panel(B.trim,glass,u,Math.min(u+.075,glass.length),basement,slab,.025,rail);
    for(const y of [floor+2.5,floor+4.8,floor+7.25])panel(B.trim,glass,0,glass.length,y,y+.1,.03,rail);
    const baysBelow=4;
    for(let k=0;k<=baysBelow;k++){
      // Each corner column belongs to only one adjacent front.
      if(k===baysBelow)continue;
      const [x,,z]=at(f,2.8+k*(f.length-5.6)/baysBelow,0,-2.8);
      column(B.trim,x,z,.79,hAt(x,z)-.55,slab,concrete);
    }
  }
  const balcony=color(0xcdccc3),tread=color(0x8f908b);
  // Two opposite stairs, a landing around the middle of each face, and a
  // curved parapet echo the relief of the occupied floor behind the columns.
  for(const [i,f] of outer.entries()){
    const L=f.length,N=76;
    function section(t){
      const u=t*L;
      const stairProgress=Math.max(0,Math.min(1,Math.min(t-.033,.967-t)/.26));
      const depth=-(1.4+3.10*(1-Math.sin(Math.PI*t))**2);
      const [x,,z]=at(f,u,0,depth),y=floor+.30+4.86*stairProgress;
      return {u,y,depth,ground:hAt(x,z)+.085};
    }
    for(let j=0;j<N;j++){
      const a=section(j/N),b=section((j+1)/N),drop=.62,w=2.95;
      strip(B.trim,at(f,a.u,a.y-drop,a.depth),at(f,b.u,b.y-drop,b.depth),at(f,b.u,b.y+.48,b.depth),at(f,a.u,a.y+.48,a.depth),vector(...f.n),balcony);
      strip(B.trim,at(f,a.u,a.y,a.depth-w),at(f,b.u,b.y,b.depth-w),at(f,b.u,b.y,b.depth),at(f,a.u,a.y,a.depth),up,tread);
      strip(B.trim,at(f,a.u,a.y-.36,a.depth),at(f,b.u,b.y-.36,b.depth),at(f,b.u,b.y-.36,b.depth-w),at(f,a.u,a.y-.36,a.depth-w),[0,-1,0],soffit);
      for(const lift of [.74,1.05]){
        strip(B.trim,at(f,a.u,a.y+lift,a.depth),at(f,b.u,b.y+lift,b.depth),at(f,b.u,b.y+lift+.034,b.depth),at(f,a.u,a.y+lift+.034,a.depth),vector(...f.n),rail);
      }
      if(j%2===0)box(B.trim,f,a.u,a.u+.042,a.depth-.042,a.depth+.018,a.y+.46,a.y+1.07,rail);
      // Horizontal stair nosings on the two flights, at the same grade as the landing.
      if(Math.abs(b.y-a.y)>.012&&i%2===0){
        for(const t of [.25,.75]){
          const u=a.u+(b.u-a.u)*t,y=a.y+(b.y-a.y)*t,d=a.depth+(b.depth-a.depth)*t;
          box(B.trim,f,u,u+.06,d-w,d-.07,y+.008,y+.05,light);
        }
      }
    }
  }
  // Fine mesh around the rooftop plant room is visible above the lake facade.
  const cage=[point(7,13),point(length-11,13),point(length-11,depth-10),point(7,depth-10)];
  const screen=color(0x7e8b90);
  for(let i=0;i<4;i++){
    const f=frame(cage[i],cage[(i+1)%4]);
    for(let j=0;j<=Math.floor(f.length/2.7);j++)box(B.trim,f,j*2.7,j*2.7+.07,-.05,.05,top+.1,top+1.88,rail);
    for(let y=.25;y<1.93;y+=.30)box(B.trim,f,0,f.length,-.04,.04,top+y,top+y+.047,screen);
  }
  return {footprint:building.id,top:top+1.88,facility:'Hong & Park KI Building',
    panoramas:['C-Sz0QoOAA50sVQVSBOyGw','DNCv3UImnxwr6vcQjJ5ocg','5JwXmwbb83KmiIqxLWmZMw']};
}
