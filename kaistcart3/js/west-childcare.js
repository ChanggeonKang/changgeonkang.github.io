import * as T from '../lib/three.module.min.js';
import {FixtureInstances} from './survey-fixture-instances.js';

// Western, single-storey wing of W2-1, visible next to the curved gym roof
// in 2IrQXc7UQ0JXumYbIqcW1w. The main International Center remains two floors.
export const daycareBuildingId=219734361;
export function buildChildcareWing(scene,b,terrain){
  const p=b.p,cut=[-178.8,296.9],ring=[p[9],p[10],p[11],p[12],p[13],cut];
  const mainOutline=[...p.slice(0,10),cut,...p.slice(14)];
  const y=terrain(...p[12]),top=y+4.25;
  const pos=[],norm=[],rgb=[],c=new T.Color(),set=new FixtureInstances();
  const uv=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
  const at=(p,h)=>[p[0],h,p[1]];
  function tri(a,b,c1,normal,colour){
    c.setHex(colour);let v=[a,b,c1];const n=new T.Vector3(...b).sub(new T.Vector3(...a))
      .cross(new T.Vector3(...c1).sub(new T.Vector3(...a)));
    if(n.dot(new T.Vector3(...normal))<0)v=[a,c1,b];
    for(const q of v){pos.push(...q);norm.push(...normal);rgb.push(c.r,c.g,c.b);}
  }
  const quad=(a,b,c,d,n,col)=>{tri(a,b,c,n,col);tri(a,c,d,n,col);};
  const area=ring.reduce((s,a,i)=>{const b=ring[(i+1)%ring.length];return s+a[0]*b[1]-b[0]*a[1];},0);
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);
    const n=[Math.sign(area)*dz/l,0,-Math.sign(area)*dx/l],base=Math.min(y,terrain(...a),terrain(...b))-.32;
    const panel=(start,end,bottom,upper,d,colour)=>{
      const v=(t,h)=>[a[0]+dx*t+n[0]*d,h,a[1]+dz*t+n[2]*d];
      quad(v(start,bottom),v(end,bottom),v(end,upper),v(start,upper),n,colour);
    };
    panel(0,1,base,top,0,0xe7e3d9);
    panel(0,1,top-.13,top+.08,.035,0xeae7db);
    panel(0,1,base,y+.24,.018,0xc7c6b8);
    if(i===2 || i===3 || i===4){
      // The long southeast frontage has pairs of narrow blue-gray windows.
      const count=i===4?4:i===2?2:1;
      for(let j=0;j<count;j++){
        const t=(j+.52)/count,w=Math.min(.63/l,.31/count);
        panel(t-w-.08/l,t+w+.08/l,y+.97,y+2.72,.031,0xb9b9ae);
        panel(t-w,t+w,y+1.06,y+2.65,.047,j%2?0x65767b:0x50656c);
        panel(t-.025/l,t+.025/l,y+1.06,y+2.65,.061,0xd7dad2);
        panel(t-w,t+w,y+1.03,y+1.1,.067,0xd2d5cb);
      }
    }
    if(i===2){
      const board=document.createElement('canvas');board.width=768;board.height=96;
      const g=board.getContext('2d');g.font='bold 63px Arial';g.textBaseline='middle';
      g.fillStyle='#354d5c';g.fillText('KAIST',35,48);
      const letters='CHILDCARE',colours=['#497580','#a3834d','#6c8b69','#8c676d'];let cursor=260;
      for(let k=0;k<letters.length;k++){g.fillStyle=colours[k%colours.length];g.fillText(letters[k],cursor,48);cursor+=g.measureText(letters[k]).width;}
      const texture=new T.CanvasTexture(board);texture.colorSpace=T.SRGBColorSpace;
      const plate=new T.Mesh(new T.PlaneGeometry(4.65,.65),new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}));
      const mid=uv(a,b,.49);plate.position.set(mid[0]+n[0]*.09,y+3.54,mid[1]+n[2]*.09);
      plate.rotation.y=Math.atan2(n[0],n[2]);plate.name='KAIST Childcare sign';scene.add(plate);
    }
  }
  for(const ids of T.ShapeUtils.triangulateShape(ring.map(q=>new T.Vector2(...q)),[])){
    tri(...ids.map(i=>at(ring[i],top+.01)),[0,1,0],0x698e70);
  }
  for(const [x,z] of [[-191,299.0],[-185.1,294.4]]){
    const a=new T.Vector3(x,top+.025,z);
    set.rod(a,a.clone().add(new T.Vector3(0,.26,0)),.40,0xd6d9ca);
  }
  const meshData=new T.BufferGeometry();
  for(const [name,v] of [['position',pos],['normal',norm],['color',rgb]])meshData.setAttribute(name,new T.Float32BufferAttribute(v,3));
  const mesh=new T.Mesh(meshData,new T.MeshStandardMaterial({vertexColors:true,roughness:.91}));
  mesh.name='W2-1 childcare wing';mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
  set.put(scene,'Childcare roof vents');
  return {...b,p:mainOutline};
}
