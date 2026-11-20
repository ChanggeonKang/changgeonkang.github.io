import * as T from '../lib/three.module.min.js';

// W8-3 and the workshop store are separately mapped footprints. November
// views Frxk_CX, ve3dZIQ, y_iMR7m and Zc0YvPM show one-storey envelopes.
export const workshopStore=1527188981,kaihelp=1527194901;
const mix=(a,b,t)=>a+(b-a)*t;
const lerp=(a,b,t)=>[mix(a[0],b[0],t),mix(a[1],b[1],t)];

export function buildWorkshop(scene,b,terrain){
  const store=b.id===workshopStore,points=store?b.p.slice(0,4):b.p;
  const datum=points.reduce((sum,p)=>sum+terrain(...p),0)/points.length;
  const pos=[],rgb=[],col=new T.Color();
  const v=(p,h)=>[p[0],datum+h,p[1]];
  function triangle(a,b,c,colour){
    col.setHex(colour);
    for(const p of [a,b,c]){pos.push(...p);rgb.push(col.r,col.g,col.b);}
  }
  function quad(a,b,c,d,colour){triangle(a,b,c,colour);triangle(a,c,d,colour);}
  const ring=points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-p[1]*q[0];},0);
  const orient=Math.sign(ring);
  function wall(a,b){
    const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    const nx=orient*dz/length,nz=-orient*dx/length;
    const pt=(u,h,out)=>[mix(a[0],b[0],u)+nx*out,datum+h,mix(a[1],b[1],u)+nz*out];
    const rect=(u,v,h,k,out,colour)=>quad(pt(u,h,out),pt(v,h,out),pt(v,k,out),pt(u,k,out),colour);
    return {length,pt,rect,nx,nz};
  }
  if(store){
    const top=3.30,peak=4.7;
    for(let i=0;i<4;i++){
      const side=wall(points[i],points[(i+1)%4]);
      side.rect(0,1,-.65,top,0,0xcfd2cc);
      side.rect(0,1,-.18,.15,.019,0x8f9282);
      // Occluded corrugations are represented by slim strips, not extra walls.
      const count=Math.round(side.length/.39);
      for(let j=1;j<count;j++)side.rect(j/count-.009/side.length,j/count+.009/side.length,.16,top,.012,0xbcc2bb);
      side.rect(0,1,1.44,1.48,.016,0xa7aaa0);
      if(i%2===0){
        triangle(side.pt(0,top,0),side.pt(1,top,0),side.pt(.5,peak,0),0xcad0c9);
        side.rect(.409,.588,-.1,2.78,.028,0xabb3ab);
        side.rect(.417,.58,-.1,2.73,.038,0xccd1c9);
        side.rect(.548,.568,1.02,1.08,.046,0x646c62);
      }
    }
    const a=lerp(points[0],points[1],.5),c=lerp(points[3],points[2],.5);
    for(const edge of [[0,3],[1,2]]){
      quad(v(points[edge[0]],top),v(points[edge[1]],top),v(c,peak),v(a,peak),0xb7bdb8);
      const length=Math.hypot(c[0]-a[0],c[1]-a[1]);
      for(let j=.45;j<length;j+=.76){
        const ridge=lerp(a,c,j/length),end=lerp(points[edge[0]],points[edge[1]],j/length);
        const ridge2=lerp(a,c,(j+.042)/length),end2=lerp(points[edge[0]],points[edge[1]],(j+.042)/length);
        quad(v(ridge,peak+.022),v(end,top+.022),v(end2,top+.022),v(ridge2,peak+.022),0x9fa9a2);
      }
    }
  }else{
    const cx=-117.36,cz=44.16;
    const upper=points.map(([x,z])=>[cx+(x-cx)*1.105,cz+(z-cz)*1.105]);
    const lip=p=>4.75+(p[0]+.85*p[1]+80)*.047;
    for(let i=0;i<points.length;i++){
      const j=(i+1)%points.length,a=points[i],c=points[j],side=wall(a,c);
      const front=i===2||i===3,glazed=front||i===1||i===4;
      side.rect(0,1,-.50,2.94,0,glazed?0x7d9398:0xc0bfad);
      if(glazed){
        const n=Math.max(1,Math.round(side.length/1.25));
        for(let k=0;k<n;k++){
          const u=k/n,v=(k+1)/n;
          side.rect(u+.028/side.length,v-.028/side.length,.15,2.57,.018,front&&i===2&&k>n-3?0x426677:k%3?0x9fafaa:0x91a29e);
          side.rect(u,u+.06/side.length,.09,2.89,.038,0x535d5d);
        }
        side.rect(0,1,2.48,2.55,.04,0x687271);
      }
      const u=upper[i],w=upper[j],mid=(r,t)=>v(lerp(u,w,r),t);
      quad(v(a,2.73),v(c,2.73),v(w,2.73),v(u,2.73),0xbdbeb2);
      quad(v(u,2.73),v(w,2.73),v(w,lip(w)),v(u,lip(u)),0xe0e0d4);
      for(let k=1;k<=7;k++){
        const fraction=k/8,h=mix(2.73,lip(u),fraction),q=mix(2.73,lip(w),fraction);
        // A lapped horizontal metal fascia spans the projecting front and sides.
        const offset=p=>[p[0]+side.nx*.011,p[1],p[2]+side.nz*.011];
        quad(offset(mid(0,h)),offset(mid(1,q)),offset(mid(1,q+.024)),offset(mid(0,h+.024)),0xbfc1b6);
      }
    }
    for(const face of T.ShapeUtils.triangulateShape(upper.map(p=>new T.Vector2(...p)),[])){
      triangle(...face.map(i=>v(upper[i],lip(upper[i]))),0xa5a89c);
    }
    const front=wall(points[2],points[4]),anchor=front.pt(.55,3.70,.77);
    const cv=document.createElement('canvas');cv.width=768;cv.height=96;
    const pen=cv.getContext('2d');pen.textBaseline='middle';pen.textAlign='center';pen.font='bold 55px Arial';
    pen.fillStyle='#507b39';pen.fillText('W8-3',85,48);
    pen.textAlign='left';let start=246;
    for(const [word,ink] of [['KAI','#294d87'],['HELP','#427e52'],[' CENTER','#294d87']]){
      pen.fillStyle=ink;pen.fillText(word,start,48);start+=pen.measureText(word).width;
    }
    const tex=new T.CanvasTexture(cv);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;
    const sign=new T.Mesh(new T.PlaneGeometry(9,.94),new T.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}));
    sign.name='KAIHELP street sign';sign.position.set(...anchor);sign.rotation.y=Math.atan2(front.nx,front.nz);scene.add(sign);
    const canopy=(p,q,h)=>front.pt(p,h,q);
    quad(canopy(.44,.13,2.77),canopy(.77,.13,2.77),canopy(.77,1.48,2.58),canopy(.44,1.48,2.58),0x355981);
    quad(canopy(.44,1.48,2.57),canopy(.77,1.48,2.57),canopy(.77,1.48,2.67),canopy(.44,1.48,2.67),0x325780);
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
  g.setAttribute('color',new T.Float32BufferAttribute(rgb,3));g.computeVertexNormals();g.computeBoundingSphere();
  const m=new T.Mesh(g,new T.MeshStandardMaterial({vertexColors:true,roughness:.86,side:T.DoubleSide}));
  m.name=store?'W8 corrugated workshop store':'KAIHELP glazed pavilion';m.castShadow=true;m.receiveShadow=true;scene.add(m);
}
