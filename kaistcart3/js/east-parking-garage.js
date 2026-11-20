import {addParkedCars} from './campus-parking.js';
import {at,box,color,column,frame,groundPatch,panel,plaque,solid,strip,up,vector} from './east-campus-shapes.js';

export const eastGarageId=1524527051;

export function buildEastGarage(b,hAt,B,group){
  const ring=[b.p[0],b.p[2],b.p[3],b.p[4]],front=frame(ring[0],ring[1]);
  const floor=hAt(...b.p[1])+.17,spacing=2.95,roof=floor+3*spacing;
  const grey=color(0xaaaeb0),dark=color(0x545b5e),steel=color(0x9fa6ab),cream=color(0xd4ce92);
  const blue=color(0x4165a7),silver=color(0xc2c5c5),green=color(0x376150);
  const uv=(u,d)=>{const [x,,z]=at(front,u,0,-d);return [x,z];};
  const depth=frame(ring[1],ring[2]).length,width=front.length;
  const inner=[uv(5.7,6.3),uv(width-5.3,6.3),uv(width-5.3,depth-6),uv(5.7,depth-6)];
  // The camera can see the cars inside the outer bays and their rear wall.
  solid(B.trim,inner,floor-.16,roof-.18,dark);
  for(let level=0;level<=3;level++){
    const y=floor+spacing*level;
    solid(B.trim,ring,y-.29,y,level===3?grey:dark);
    if(level)B.trim.quad(...ring.map(([x,z])=>[x,y-.29,z]),[0,-1,0],[0,0],[1,0],[1,1],[0,1],color(0x555b5c));
  }
  for(let side=0;side<4;side++){
    const f=frame(ring[side],ring[(side+1)%4]),n=Math.round(f.length/.43),cols=Math.ceil(f.length/7.2);
    for(let i=0;i<cols;i++){
      const u=i*f.length/cols;
      box(B.trim,f,u-.20,u+.20,-.49,-.1,floor-.16,roof,steel);
    }
    for(let level=1;level<=3;level++){
      const y=floor+level*spacing;
      panel(B.trim,f,.03,f.length-.03,y-.37,y-.035,.015,steel);
      for(const h of [.32,.75])panel(B.trim,f,.03,f.length-.03,y+h,y+h+.045,-.10,silver);
    }
    for(let i=0;i<n;i++){
      const u=(i+.5)*f.length/n,edge=floor+2.03,high=roof+.97;
      const inside=(w,y)=>at(f,u+w,y,.06),outside=(w,y)=>at(f,u+w-.155,y,.42);
      const sheet=(y0,y1,shade)=>strip(B.screen,inside(-.03,y0),outside(.02,y0),outside(.02,y1),inside(-.03,y1),vector(f.n[0]*.76+f.u[0]*.65,f.n[1]*.76+f.u[1]*.65),shade);
      const wave=.5+.5*Math.sin(u*.189+side*1.7),colorBottom=floor+3.5+2.92*wave;
      sheet(edge,high,silver);
      // Blue and pale-yellow projecting edges follow the photographed diagonal wave.
      panel(B.trim,f,u-.174,u-.065,colorBottom,high,.425,blue);
      panel(B.trim,f,u-.161,u-.082,Math.max(edge,colorBottom-1.17),colorBottom,.428,cream);
    }
    for(let k=0;k<Math.floor(f.length/5);k++){
      const u=2.5+k*5;if(side===0&&u<14.4)continue;
      for(const y of [.39,.88])panel(B.trim,f,u-2.45,u+2.45,floor+y,floor+y+.045,.04,steel);
      const [x,,z]=at(f,u,floor,.04);column(B.trim,x,z,.036,floor+.08,floor+.93,steel);
      box(B.trim,f,u-1.84,u+1.84,.18,.58,floor,floor+.34,color(0x8d7569));
      box(B.trim,f,u-1.75,u+1.75,.21,.55,floor+.34,floor+.46,color(0x68774e));
    }
  }
  // The ground-level vehicle portal is at the end of way 1524527052.
  const entrance=frame(ring[0],b.p[1]).length,port=7.15;
  for(const u of [entrance-port/2,entrance+port/2])box(B.trim,front,u-.20,u+.20,.13,.67,floor-.03,floor+3.15,green);
  box(B.trim,front,entrance-port/2-.2,entrance+port/2+.2,.13,.67,floor+2.15,floor+3.15,green);
  plaque(group,'PARKING',front,entrance,floor+2.90,.686,5.16,.50,'#f5f4ed');
  plaque(group,'OUT   2.0M   IN',front,entrance,floor+2.44,.688,6.1,.39,'#f5f4ed');
  // A full-width inset return closes the sight line behind the entrance lanes.
  box(B.trim,front,entrance-5.5,entrance+5.5,-7.2,-6.8,floor-.09,floor+spacing,dark);
  for(const u of [entrance-port/2-.27,entrance+port/2+.27]){
    box(B.trim,front,u-.11,u+.11,-7.05,-.46,floor-.09,floor+spacing,dark);
  }
  for(const [a,c] of [[0,entrance-port/2-.26],[entrance+port/2+.26,width]]){
    groundPatch(B.brick,[uv(a,-3.83),uv(c,-3.83),uv(c,-.16),uv(a,-.16)],(x,z)=>hAt(x,z)+.07,color(0xaf8b7c));
  }
  const towerEnd=entrance-port/2-.35;
  box(B.trim,front,.05,towerEnd,-.28,.06,floor+.12,roof+1.45,color(0xc4c3be));
  for(let k=0;k<26;k++)box(B.trim,front,-.03,towerEnd+.10,.07,.54,floor+.46+k*.37,floor+.56+k*.37,blue);
  for(const u of [towerEnd*.25,towerEnd*.78])box(B.trim,front,u-.063,u+.063,.10,.32,floor+.18,roof+1.26,blue);
  for(const u of [entrance-2.64,entrance+2.64]){
    const [x,,z]=at(front,u,floor,.9);column(B.trim,x,z,.071,floor+.02,floor+.97,color(0xe4b754));
    column(B.trim,x,z,.073,floor+.42,floor+.61,color(0x3d4340));
  }

  // Only the short barrel-vaulted strip on the roof is covered. The other
  // roof bays and their painted dividers are visible in the registered aerial.
  const addTop=(a,c,d,e,y,shade)=>{
    const point=(u,v)=>{const [x,z]=uv(u,v);return [x,y,z];};
    strip(B.trim,point(a,d),point(c,d),point(c,e),point(a,e),up,shade);
  };
  for(const [u0,u1,d0,d1] of [[1.1,6.1,2.2,depth-2],[width-5.9,width-1.05,2.2,depth-2],
                                  [8,width-7,1,5.9],[8,width-7,depth-6,depth-1]]){
    if(d1-d0>u1-u0){
      for(let d=d0;d<=d1;d+=2.65)addTop(u0,u1,d,d+.085,roof+.019,silver);
      addTop(u0,u0+.075,d0,d1,roof+.019,silver);
    }else{
      for(let u=u0;u<=u1;u+=2.65)addTop(u,u+.085,d0,d1,roof+.019,silver);
      addTop(u0,u1,d0,d0+.075,roof+.019,silver);
    }
  }
  const coverA=width-9.1,coverB=width-1.05,coverFrom=13.1,coverTo=32.8;
  const vault=(t,d)=>{const [x,z]=uv(coverA+(coverB-coverA)*t,d);return [x,roof+2.14+.70*Math.sin(t*Math.PI),z];};
  for(let i=0;i<10;i++){
    const a=i/10,c=(i+1)/10;
    strip(B.screen,vault(a,coverFrom),vault(c,coverFrom),vault(c,coverTo),vault(a,coverTo),up,color(0xc5cccc));
    for(let d=coverFrom;d<coverTo;d+=2.5){
      const lift=p=>[p[0],p[1]+.015,p[2]];
      strip(B.trim,lift(vault(a,d)),lift(vault(c,d)),lift(vault(c,d+.055)),lift(vault(a,d+.055)),up,grey);
    }
  }
  for(const u of [coverA+.2,coverB-.2])for(let d=coverFrom;d<=coverTo;d+=4.9){
    const [x,z]=uv(u,d);column(B.trim,x,z,.065,roof-.02,roof+2.25,steel);
  }

  const cars=[];
  for(let i=0;i<9;i++){
    const u=2.2+i*4.05;if(Math.abs(u-entrance)<4.2)continue;
    const [x,z]=uv(u,3.12);cars.push({x,z,u:front.u.map(v=>-v),v:front.n,facing:i%3===0?-1:1,colour:[0,1,2,7,4,5,0,3,6][i]});
  }
  for(const [u,d,colour] of [[3.8,depth-6.6,1],[12.1,depth-3.4,0]]){
    const [x,z]=uv(u,d);cars.push({x,z,u:front.u.map(v=>-v),v:front.n,facing:1,colour,rooftop:true});
  }
  const roadCars=cars.filter(c=>!c.rooftop),roofCars=cars.filter(c=>c.rooftop);
  for(const [list,y] of [[roadCars,floor],[roofCars,roof]])for(const mesh of addParkedCars(group,list,()=>y-.168)){
    mesh.name='Parking garage '+mesh.name;mesh.userData.passageLining=true;
    if(list===roadCars)mesh.material.color.multiplyScalar(.55);
  }
  return {footprint:b.id,top:roof+2.85,facility:'East campus parking garage',panoramas:['CAO7eMxg64BSGBZxtk9rzQ','lAoX1EEi6YnrFO8WFAFQhA','CKEHucTlK9pLcEPbGPA7Jw']};
}
