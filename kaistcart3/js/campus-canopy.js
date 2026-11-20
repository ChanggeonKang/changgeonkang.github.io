import * as T from '../lib/three.module.min.js';

// One lobed branch spray. Transparent gaps between twigs survive at street
// distance. The same mipmapped leaves shade all the mapped canopy instances.
export function leafSprayMaterial(random){
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d');
  const palettes=['#c5cfaa','#d7d6a3','#a7b992','#d9dfb6','#bfd091','#9daf84','#dfdda9'];
  function spray(ax,ay,bx,by,span,depth){
    const dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy);
    ctx.strokeStyle=depth===0?'#8d8869':'#a8a086';ctx.lineWidth=depth===0?2.5:1.1;
    ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.stroke();
    for(let i=1;i<=10;i++){
      const t=i/10, reach=span*(.18+.82*Math.sin(Math.PI*t*.93));
      for(const side of [-1,1]){
        const x=ax+dx*t, y=ay+dy*t;
        const off=reach*(.76+random()*.28);
        const ex=x+(-dy*side*.92+dx*.43)*off/len, ey=y+(dx*side*.92+dy*.43)*off/len;
        if(depth===0){spray(x,y,ex,ey,12+random()*5,1);continue;}
        const angle=Math.atan2(ey-y,ex-x);
        ctx.fillStyle=palettes[Math.floor(random()*palettes.length)];
        ctx.beginPath();ctx.ellipse(ex,ey,5+random()*4,2.4+random()*1.8,angle,0,Math.PI*2);ctx.fill();
      }
    }
  }
  spray(124,235,120,24,86,0);
  spray(119,207,182,78,38,0);
  spray(122,196,61,78,34,0);
  const texture=new T.CanvasTexture(canvas);
  texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
  return new T.MeshStandardMaterial({map:texture,alphaTest:.32,alphaToCoverage:true,
    vertexColors:true,roughness:.96,envMapIntensity:.48});
}

// Intersecting, individually oriented sprays leave sight lines through the
// lower branches. Normals follow the crown volume on both sides of each spray.
export function leafyCrown(seed,distant=false){
  let state=seed;
  const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
  const vertices=[],normals=[],uv=[],colors=[],indices=[];
  function spray(x,y,z,w,h,angle,outward,elevation){
    const tx=Math.cos(angle),tz=Math.sin(angle), nx=-tz,nz=tx;
    const bright=.73+.27*Math.min(1,(y-.38)/.55)+random()*.11;
    const base=vertices.length/3;
    for(const [s,v] of [[-.5,0],[.5,0],[.5,1],[-.5,1]]){
      const bow=outward*(v-.3);
      vertices.push(x+s*w*tx+nx*bow,y+(v-.38)*h,z+s*w*tz+nz*bow);
      const norm=new T.Vector3(x+s*w*tx*.7+nx*.09,elevation+.22*v,z+s*w*tz*.7+nz*.09).normalize();
      normals.push(norm.x,norm.y,norm.z);uv.push(s+.5,v);
      const light=bright*(.83+.17*v);colors.push(light,light,.96*light);
    }
    indices.push(base,base+1,base+2,base,base+2,base+3,base,base+2,base+1,base,base+3,base+2);
  }
  const shape=random(), tilt=(random()-.5)*.15;
  for(let tier=0;tier<3;tier++){
    const count=distant?[4,5,3][tier]:[9,11,7][tier];
    const phase=random()*6.28;
    for(let i=0;i<count;i++){
      const a=phase+(i+random()*.36)*Math.PI*2/count;
      const r=[.25,.23,.115][tier]*(.76+random()*.42)*(1+.14*shape);
      const x=Math.cos(a)*r+tilt*tier*.4,z=Math.sin(a)*r;
      const y=[.55,.69,.86][tier]+(random()-.5)*.08;
      const w=(distant?.54:.39)*(.8+random()*.36),h=(distant?.37:.29)*(.9+random()*.3);
      const cross=distant?1:2;
      for(let j=0;j<cross;j++)spray(x,y,z,w,h,a+Math.PI*(1.48+j*.47),.14+.10*random(),.12+.06*tier);
    }
  }
  const mesh=new T.BufferGeometry();
  mesh.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  mesh.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
  mesh.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  mesh.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  mesh.setIndex(indices);return mesh;
}
