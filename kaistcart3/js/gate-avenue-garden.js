import * as T from '../lib/three.module.min.js';

// View north and south from QDbYRuzJJdStiC_n8uwwhA and D7xstRl on
// Naver, October 2026. Both outer verges have clipped shrubs and pines.
// The median footprint is mapped. The planting intervals are photo estimates.
const islandId=1524647458;

export function foliage(){
  const geometry=new T.SphereGeometry(1,16,10);
  const positions=geometry.getAttribute('position'),colors=[];
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
    const variation=Math.sin(27*x+5*y)*Math.sin(21*z-8*y);
    const radius=1+variation*.032;
    positions.setXYZ(i,x*radius,y*radius,z*radius);
    const tone=.83+.11*y+.055*variation;
    colors.push(tone,Math.min(1,tone*1.015),tone*.94);
  }
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();return geometry;
}

export function plantBatch(scene,name,geometry,records,vertexColors=false){
  if(!records.length){geometry.dispose();return;}
  const material=new T.MeshStandardMaterial({roughness:.94,vertexColors});
  if(vertexColors){
    material.onBeforeCompile=shader=>{
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vPlantPosition;')
        .replace('#include <project_vertex>','#include <project_vertex>\nvPlantPosition=(modelMatrix*instanceMatrix*vec4(transformed,1.)).xyz;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
        varying vec3 vPlantPosition;
        float plantHash(vec3 p){p=fract(p*vec3(.1031,.1030,.0973));p+=dot(p,p.yxz+33.33);return fract((p.x+p.y)*p.z);}
        float plantNoise(vec3 p){vec3 k=floor(p),s=fract(p);s=s*s*(3.-2.*s);
          return mix(mix(mix(plantHash(k),plantHash(k+vec3(1,0,0)),s.x),mix(plantHash(k+vec3(0,1,0)),plantHash(k+vec3(1,1,0)),s.x),s.y),
                     mix(mix(plantHash(k+vec3(0,0,1)),plantHash(k+vec3(1,0,1)),s.x),mix(plantHash(k+vec3(0,1,1)),plantHash(k+vec3(1)),s.x),s.y),s.z);}`)
        .replace('#include <color_fragment>',`#include <color_fragment>
          float footprint=length(fwidth(vPlantPosition));
          float shade=mix(plantNoise(vPlantPosition*2.6),.5,smoothstep(.12,.5,footprint))-.5;
          shade+=.68*(mix(plantNoise(vPlantPosition*18.),.5,smoothstep(.018,.09,footprint))-.5);
          diffuseColor.rgb*=1.+.85*shade;`);
    };
    material.customProgramCacheKey=()=>'gate-pruned-foliage-1';
  }
  const m=new T.InstancedMesh(geometry,material,records.length);
  m.name=name;m.castShadow=true;m.receiveShadow=true;
  const tint=new T.Color();
  records.forEach(([matrix,color],i)=>{m.setMatrixAt(i,matrix);m.setColorAt(i,tint.setHex(color));});
  m.computeBoundingSphere();scene.add(m);
}

export function paintGateAvenue(roadIndex,face,quad,markings,color){
  const inbound=r=>r.id===468250683;
  for(const [kind,x,z] of [['speed',115.3,385.5],['diamond',79.7,331.5]]){
    const hit=roadIndex.nearest(x,z,8,inbound);
    if(!hit)continue;
    const s=hit.s,along=(hit.x-s.a[0])*s.dx+(hit.z-s.a[1])*s.dz;
    for(const lane of [-s.road.width/4,s.road.width/4]){
      // u increases in the traffic direction, v to the driver's right.
      const point=(u,v)=>face(s,along+u,lane-v,.022);
      const strip=(outer,inner)=>{
        for(let i=1;i<outer.length;i++){
          quad(markings,point(...outer[i-1]),point(...outer[i]),point(...inner[i]),point(...inner[i-1]),color);
        }
      };
      if(kind==='diamond'){
        strip([[-1.55,0],[0,.55],[1.55,0],[0,-.55],[-1.55,0]],
              [[-1.21,0],[0,.40],[1.21,0],[0,-.40],[-1.21,0]]);
        continue;
      }
      const ellipse=(rx,ry)=>Array.from({length:17},(_,i)=>{
        const t=i*Math.PI/8;return [ry*Math.cos(t),.385+rx*Math.sin(t)];
      });
      strip(ellipse(.31,1.19),ellipse(.20,1.04));
      for(const offset of [-.57,.57]){
        const arc=(rx,ry)=>Array.from({length:13},(_,i)=>{
          const t=-.84*Math.PI+i*1.60*Math.PI/12;
          return [offset+ry*Math.sin(t),-.41+rx*Math.cos(t)];
        });
        strip(arc(.34,.62),arc(.22,.48));
      }
    }
  }
}

export function buildGateAvenueGarden(scene,data,hAt,surfAt){
  const island=data.areas.find(a=>a.id===islandId);
  if(island?.p.length!==4)return;
  const [a,b,c,d]=island.p;
  const x0=(a[0]+b[0])/2,z0=(a[1]+b[1])/2,x1=(c[0]+d[0])/2,z1=(c[1]+d[1])/2;
  const length=Math.hypot(x1-x0,z1-z0);
  const dx=(x1-x0)/length,dz=(z1-z0)/length,rot=Math.atan2(dx,dz);
  const place=(along,across)=>[x0+dx*along+dz*across,z0+dz*along-dx*across];
  const leaves=[],woody=[],metal=[];
  const vertical=new T.Vector3(0,1,0);
  function crown(x,y,z,width,height,depth,angle,color){
    const q=new T.Quaternion().setFromAxisAngle(vertical,angle);
    leaves.push([new T.Matrix4().compose(new T.Vector3(x,y,z),q,new T.Vector3(width,height,depth)),color]);
  }
  function pole(list,a,b,radius,color){
    const start=new T.Vector3(...a),end=new T.Vector3(...b),span=end.clone().sub(start);
    const q=new T.Quaternion().setFromUnitVectors(vertical,span.clone().normalize());
    list.push([new T.Matrix4().compose(start.add(end).multiplyScalar(.5),q,new T.Vector3(radius,span.length(),radius)),color]);
  }
  // Shaped banks with visible strips of lawn between them. Three overlapping
  // lobes give the shrubs a broad level top and rounded ends.
  for(const [from,to] of [[2,9.3],[12,19.5],[23,32],[35,43.5],[47,55],[58,66]]){
    for(let i=0;i<3;i++){
      const t=from+(to-from)*(.22+i*.28),[x,z]=place(t,0);
      crown(x,hAt(x,z)+.30,z,1.08,.52,(to-from)*.25,rot,0x465332+i*0x020100);
    }
  }
  const flowers=[0xe7bd3f,0xe9c549,0xb65b87,0xdbb3c3,0xeec84c];
  for(let row=0;row<26;row++){
    const u=length-17+.57*row;
    for(let col=0;col<5;col++){
      const [x,z]=place(u+.05*Math.sin(row*col),.405*(col-2)),y=hAt(x,z);
      const swath=Math.floor(row*.29+col*.7)%flowers.length;
      crown(x,y+.17,z,.27,.17,.32,rot,0x637a3d);
      crown(x,y+.28,z,.225,.12,.28,rot,flowers[swath]);
    }
  }
  for(const side of [-1,1]){
    for(let i=0;i<15;i++){
      const along=1+i*6.6+(side+1)*.85,[x,z]=place(along,side*(12.2+.45*Math.sin(i*1.7)));
      if(surfAt(x,z)!==0)continue;
      crown(x,hAt(x,z)+.38,z,1.23,.58,1.48,rot+i*.28,i%3?0x526931:0x617a3c);
    }
    for(let i=0;i<8;i++){
      const [x,z]=place(3+i*12.35+(side+1)*2.1,side*(16.4+1.3*Math.sin(i*1.4)));
      if(surfAt(x,z)!==0)continue;
      const y=hAt(x,z),h=4.55+.35*Math.sin(i*1.5);
      pole(woody,[x,y-.08,z],[x+.06,y+h,z],.12,0x655848);
      crown(x+.06,y+h,z,1.72,1.74,1.62,rot+i,0x748b40);
    }
    for(let i=0;i<7;i++){
      const along=3+i*14.1+(side+1)*1.6,off=side*(21+2.9*Math.sin(i*2.3+side));
      const [x,z]=place(along,off);
      if(surfAt(x,z)!==0)continue;
      const y=hAt(x,z),height=6.6+.9*Math.cos(i*2+.7*side);
      for(let k=0;k<4;k++){
        const ang=i*1.8+k*2.18,spread=k===3?.42:2.0;
        const ex=x+Math.cos(ang)*spread,ez=z+Math.sin(ang)*spread,ey=y+height-(k===3?0:1.35+.4*k);
        const joint=[x+.55*Math.cos(ang),y+height*.48,z+.55*Math.sin(ang)];
        pole(woody,[x,y-.1,z],joint,k===3?.19:.12,0x654e40);
        pole(woody,joint,[ex,ey,ez],.105,0x635347);
        crown(ex,ey,ez,2.42+.29*k,.76,2.08,ang,0x344e35+k*0x020302);
        crown(ex+.48,ey+.30,ez+.25,1.88,.58,1.63,ang+.41,0x415f3e);
      }
    }
    // Slender dark L-arm lamps face the carriageway from the outer walk.
    for(const t of [11,48,86]){
      const [x,z]=place(t,side*10.4),[hx,hz]=place(t,side*8.5),y=hAt(x,z);
      pole(metal,[x,y+.02,z],[x,y+6.7,z],.085,0x46515a);
      pole(metal,[x,y+6.7,z],[hx,y+6.85,hz],.064,0x46515a);
      pole(metal,[hx,y+6.85,hz],[hx-dz*side*.43,y+6.83,hz+dx*side*.43],.13,0x535e62);
    }
  }
  plantBatch(scene,'E1 avenue pines, flower borders and clipped shrubs',foliage(),leaves,true);
  plantBatch(scene,'E1 avenue pine branches and topiary trunks',new T.CylinderGeometry(.74,1,1,7),woody);
  plantBatch(scene,'E1 avenue street furniture lamps',new T.CylinderGeometry(.82,1,1,7),metal);
}
