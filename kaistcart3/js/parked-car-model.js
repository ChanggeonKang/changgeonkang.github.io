import * as T from '../lib/three.module.min.js';

// Original unbranded campus saloon. The front points towards local +Z.
// Different instances share the geometry, including their depth/shadow pass.
class Panels {
  constructor(){this.xyz=[];this.rgb=[];}
  face(points,tint,out){
    const n=new T.Vector3().subVectors(new T.Vector3(...points[1]),new T.Vector3(...points[0]))
      .cross(new T.Vector3().subVectors(new T.Vector3(...points[2]),new T.Vector3(...points[0])));
    if(n.lengthSq()<1e-12)return;
    if(n.dot(new T.Vector3(...out))<0)points=[...points].reverse();
    const rgb=new T.Color(tint).toArray();
    for(let i=1;i<points.length-1;i++)for(const v of [points[0],points[i],points[i+1]]){
      this.xyz.push(...v);this.rgb.push(...rgb);
    }
  }
  geometry(){
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(this.xyz,3));
    g.setAttribute('color',new T.Float32BufferAttribute(this.rgb,3));g.computeVertexNormals();g.computeBoundingSphere();return g;
  }
}
const white=0xffffff,glassBlue=0x46555b;
const shape=[
  [-2.15,.67,.67],[-2.08,.81,.82],[-1.90,.86,.91],[-1.56,.895,.96],[-1.08,.905,1.02],
  [-.50,.91,1.04],[.48,.91,1.02],[1.14,.905,.965],[1.68,.885,.88],[1.95,.83,.82],[2.10,.74,.74],[2.15,.63,.67]
];
const interpolate=(row,key,z)=>{
  const i=row.findIndex(a=>a[0]>=z),b=row[Math.max(0,i)],a=row[Math.max(0,i-1)];
  return a[key]+(b[key]-a[key])*(z-a[0])/(b[0]-a[0]||1);
};

export function makeParkedCar(){
  const body=new Panels(),glass=new Panels(),trim=new Panels();
  // Cut wheel arches into the side panels. The tyre is visible within the
  // opening from the side, with a dark wheel well behind it.
  const stops=new Set(shape.map(a=>a[0]));
  for(const wheel of [-1.39,1.39])for(let j=0;j<=12;j++)stops.add(wheel+.384*Math.cos(Math.PI*j/12));
  const zs=[...stops].sort((a,b)=>a-b);
  const width=z=>interpolate(shape,1,z),height=z=>interpolate(shape,2,z);
  const bottom=z=>{
    const wheel=Math.min(Math.abs(z+1.39),Math.abs(z-1.39));
    return wheel<=.384?.32+Math.sqrt(Math.max(0,.384**2-wheel**2)):.32;
  };
  const section=(z,sign)=>{
    const w=width(z),h=height(z);
    return [[sign*(w-.08),bottom(z),z],[sign*w,Math.max(bottom(z)+.018,h-.23),z],[sign*(w-.025),h-.073,z],[sign*(w-.125),h,z]];
  };
  for(let j=1;j<zs.length;j++){
    const a=zs[j-1],b=zs[j],mid=(a+b)/2;
    for(const side of [-1,1]){
      const p=section(a,side),q=section(b,side);
      for(let i=0;i<3;i++)body.face([p[i],q[i],q[i+1],p[i+1]],i===0?0xe4e6e4:white,[side,.15,0]);
      if(Math.min(Math.abs(mid-1.39),Math.abs(mid+1.39))<.384){
        trim.face([p[0],[.65*side,.30,a],[.65*side,.30,b],q[0]],0x232629,[side,.08,0]);
      }
      const mx=[0,height(a)+.022,a],my=[0,height(b)+.022,b];
      body.face([p[3],q[3],my,mx],white,[0,1,0]);
    }
  }
  for(const z of [zs[0],zs.at(-1)]){
    const sideA=section(z,-1),sideB=section(z,1),sign=Math.sign(z);
    body.face([...sideA,...sideB.reverse()],white,[0,0,sign]);
  }
  const baseLeft=[[-.79,1.005,-1.53],[-.61,1.51,-.85],[-.605,1.57,-.47],[-.60,1.54,.35],[-.615,1.49,.50],[-.781,.97,1.20]];
  const point=(i,side)=>[Math.abs(baseLeft[i][0])*side,baseLeft[i][1],baseLeft[i][2]];
  for(let i=0;i<baseLeft.length-1;i++){
    const surface=i===0||i===4?glass:body,tint=surface===glass?0x596b71:white;
    surface.face([point(i,-1),point(i,1),point(i+1,1),point(i+1,-1)],tint,[0,1,0]);
  }
  for(const side of [-1,1]){
    const strip=(z,y,w)=>[side*w,y,z];
    const rocker=[strip(-1.47,1.015,.789),strip(1.17,.985,.784)];
    glass.face([rocker[0],point(1,side),point(2,side),point(3,side),point(4,side),rocker[1]],glassBlue,[side,.1,0]);
    const band=(a,b,width,color)=>{
      trim.face([[a[0],a[1]-.5*width,a[2]],[b[0],b[1]-.5*width,b[2]],[b[0],b[1]+.5*width,b[2]],[a[0],a[1]+.5*width,a[2]]],color,[side,0,0]);
    };
    band(strip(-1.47,1.027,.794),strip(1.17,.993,.793),.039,0xaeb9bb);
    trim.face([strip(-.32,1.018,.796),strip(-.39,1.566,.619),strip(-.29,1.565,.619),strip(-.23,1.017,.796)],0x1c252b,[side,.1,0]);
    for(const z of [-.68,.45])band(strip(z-.08,.922,.902),strip(z+.08,.922,.902),.032,0xabb0ad);
    for(const [i,j] of [[0,1],[4,5]]){
      const a=point(i,side),b=point(j,side);
      body.face([a,b,[b[0]-side*.052,b[1]+.006,b[2]],[a[0]-side*.052,a[1]+.006,a[2]]],white,[side,1,0]);
    }
    body.face([strip(.65,1.06,.772),strip(.72,1.145,.938),strip(.93,1.12,.93),strip(.89,1.03,.79)],white,[side,.5,0]);
    // The lamps wrap around the wings into the sloping nose and tail.
    for(const zSign of [-1,1]){
      const dark=zSign>0?0x535e61:0x643d3a,light=zSign>0?0xdfe9e7:0xb6453f;
      const a=strip(2.145*zSign,.59,.35),b=strip(2.095*zSign,.69,.72),c=strip(1.91*zSign,.79,.834);
      trim.face([a,b,c,[c[0],c[1]-.09,c[2]],[b[0],b[1]-.09,b[2]],[a[0],a[1]-.065,a[2]]],dark,[side,.20,zSign]);
      trim.face([[a[0],a[1]+.007,a[2]+.004*zSign],[b[0],b[1]+.007,b[2]+.004*zSign],
        [c[0]+.004*side,c[1]+.007,c[2]],[b[0],b[1]-.030,b[2]+.009*zSign]],light,[side,.4,zSign]);
    }
  }
  for(const sign of [-1,1]){
    const z=2.154*sign;
    trim.face([[-.59,.32,z],[.59,.32,z],[.48,.50,z],[-.48,.50,z]],0x343a3e,[0,0,sign]);
    // Neutral plate without any identifying characters.
    trim.face([[-.205,.415,z+.004*sign],[.205,.415,z+.004*sign],[.205,.51,z+.004*sign],[-.205,.51,z+.004*sign]],0xd0d3c9,[0,0,sign]);
  }
  return {body:body.geometry(),glass:glass.geometry(),trim:trim.geometry()};
}

export function varyRoof(material,kind='paint'){
  material.customProgramCacheKey=()=>'parked-roof-'+kind;
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec2 anchor=instanceMatrix[3].xz;
        float model=mod(floor(abs(anchor.x*3.21+anchor.y*7.43)),3.);
        float roof=smoothstep(1.01,1.50,position.y);
        transformed.y+=model*.092*roof;
        transformed.z-=model*.115*roof*smoothstep(.18,.80,-position.z);
      #endif`);
  };
  return material;
}
