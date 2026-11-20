import * as T from '../lib/three.module.min.js';
import { FixtureInstances } from './survey-fixture-instances.js';

// The November frontage shows that the W3 canopy shares its back edge with
// the lobby. OSM maps the canopy separately but includes it in the hall outline.
export const galileiPorticoId=1262016808;
const hallId=78058725, door=[-320.5,316.7], mouth=[-314.35,325.70];
const length=Math.hypot(mouth[0]-door[0],mouth[1]-door[1]);
const dx=(mouth[0]-door[0])/length,dz=(mouth[1]-door[1])/length;
const project=([x,z])=>[(x-door[0])*dz-(z-door[1])*dx,(x-door[0])*dx+(z-door[1])*dz];

export function applyGalileiEntrance(b){
  if(b.id!==hallId)return b;
  const inCanopy=p=>{const [u,v]=project(p);return Math.abs(u)<3.7 && v>.55 && v<length+.6;};
  const p=b.p.filter(q=>!inCanopy(q));
  // Provide the mapped inner doorway as a vertex in the wall it actually serves.
  const i=p.findIndex((a,i)=>{
    const b=p[(i+1)%p.length],u=project(a),v=project(b);
    return Math.abs(u[1])<.55 && Math.abs(v[1])<.55 && u[0]*v[0]<0;
  });
  if(i>=0)p.splice(i+1,0,door);
  return {...b,p,entrances:[...(b.entrances||[]).filter(q=>!inCanopy(q)),[...door,'main']]};
}

export function buildGalileiPortico(scene,hAt){
  const fixtures=new FixtureInstances(),base=Math.max(hAt(...door),hAt(...mouth))+.19;
  const yaw=Math.atan2(dx,dz),at=(u,y,v)=>new T.Vector3(door[0]+u*dz+v*dx,y,door[1]-u*dx+v*dz);
  const box=(u,y,v,w,h,d,col)=>fixtures.box(at(u,y,v),w,h,d,yaw,col);
  const stone=0xb9aca5,edge=0x968b85,dark=0x454c48,warm=0x805941;
  const eave=base+3.17,ridge=base+4.40,half=2.90;
  for(const side of [-1,1]){
    for(const t of [.65,length-.62]){
      const p=at(side*(half-.35),0,t),bottom=hAt(p.x,p.z)-.08,top=eave-.23;
      box(side*(half-.35),(bottom+top)/2,t,.69,top-bottom,1.21,stone);
      for(let h=base+.64;h<top;h+=.64)box(side*(half-.35),h,t,.696,.018,1.217,edge);
    }
    box(side*(half-.27),eave-.23,length/2,.53,.49,length,stone);
  }
  for(const end of [.04,length-.02]){
    box(0,eave-.26,end,half*2,.58,.40,stone);
  }
  const faces=[],normals=[],colors=[],color=new T.Color();
  function triangle(a,b,c,desired,tint){
    const normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    if(normal.dot(desired)<0){[b,c]=[c,b];normal.negate();}
    for(const p of [a,b,c]){
      faces.push(...p.toArray());normals.push(...normal.toArray());colors.push(...color.setHex(tint).toArray());
    }
  }
  const up=new T.Vector3(0,1,0);
  function quad(a,b,c,d,tint){triangle(a,b,c,up,tint);triangle(a,c,d,up,tint);}
  for(const [t,side] of [[-.16,-1],[length+.18,1]]){
    triangle(at(-half,eave,t),at(half,eave,t),at(0,ridge,t),new T.Vector3(side*dx,0,side*dz),stone);
  }
  for(const side of [-1,1]){
    quad(at(0,ridge+.11,-.18),at(side*(half+.31),eave+.09,-.18),
         at(side*(half+.31),eave+.09,length+.48),at(0,ridge+.11,length+.48),0x555847);
    const ends=[-.14,length+.45];
    for(const t of ends)fixtures.rod(at(0,ridge+.03,t),at(side*(half+.30),eave+.01,t),.097,warm);
    box(side*(half+.26),eave+.01,length/2,.12,.17,length+.71,dark);
  }
  const surface=new T.BufferGeometry();
  surface.setAttribute('position',new T.Float32BufferAttribute(faces,3));
  surface.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
  surface.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  const roof=new T.Mesh(surface,new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.88}));
  roof.name='W3 Galilei Hall entrance gable';roof.castShadow=true;roof.receiveShadow=true;scene.add(roof);
  // A real lobby closes the view at the back of the covered passage.
  box(0,base+1.58,.17,4.7,3.16,.18,0x504e47);
  for(let i=0;i<4;i++)box((i-1.5)*1.04,base+1.38,.282,.98,2.68,.07,i%2?0x344d55:0x3e555c);
  box(0,base+2.86,.27,4.36,.23,.09,0x687879);
  box(0,base+.015,length*.52,4.44,.08,length*.98,0x93938b);
  fixtures.put(scene,'W3 entrance stone and lobby');
  if(typeof document==='undefined')return;
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=96;
  const ctx=canvas.getContext('2d');ctx.font='600 74px Georgia, serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle='#e4e0d2';ctx.fillText('Galilei Hall',320,49,620);
  const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;
  const sign=new T.Mesh(new T.PlaneGeometry(3.15,.48),new T.MeshStandardMaterial({map:tex,transparent:true,depthWrite:false,roughness:.78}));
  sign.name='Galilei Hall entrance lettering';sign.position.copy(at(0,eave+.14,length+.199));sign.rotation.y=yaw;scene.add(sign);
}
