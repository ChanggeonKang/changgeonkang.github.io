import {PavementCutouts,trimPavementMesh} from './pavement-cutouts.js';
import {intersectPavementPolygon} from './paint-surface.js';
import {Color} from '../lib/three.module.min.js';

export function trimParkingApproaches(scene,data,inside){
  const cutouts=new PavementCutouts();
  for(const lot of data.parking){
    if(lot.id===503892533||String(lot.id).startsWith('503892533-apron-'))
      cutouts.addPolygon(lot.p,lot.holes);
  }
  trimPavementMesh(scene.getObjectByName('Mapped campus streets and service lanes'),cutouts);

  // A pedestrian connector may end at the mapped centreline of a parking
  // aisle. Its paving ends at the kerb. Through paths and marked crossings
  // retain their own finish, as do the approaches beyond the motor surface.
  const terminals=new Map(),stepCuts=new PavementCutouts();
  for(const road of data.roads||[]){
    if(road.drivable||road.bridge||road.tunnel||road.sharedParkingSurface)continue;
    const ids=road.nodes||[];
    for(let i=0;i<ids.length;i++){
      const end=i===0||i===ids.length-1,stair=road.roadClass==='steps';
      if((road.roadClass!=='walk'&&!stair)||!end||terminals.has(ids[i])){
        terminals.set(ids[i],null);continue;
      }
      const p=road.p[i],q=road.p[i===0?1:i-1];
      if(!q)continue;
      const length=Math.hypot(q[0]-p[0],q[1]-p[1]);
      if(length<.02)continue;
      const dx=(q[0]-p[0])/length,dz=(q[1]-p[1])/length,half=road.width/2;
      const along=a=>(a[0]-p[0])*dx+(a[1]-p[1])*dz;
      const side=a=>(a[0]-p[0])*dz-(a[1]-p[1])*dx;
      terminals.set(ids[i],{stair,planes:[a=>along(a)+.001,a=>length+.001-along(a),
        a=>half+.001-side(a),a=>half+.001+side(a)]});
    }
  }
  const marked=(p)=>(data.crossings||[]).some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<3);
  const inLot=p=>data.parking.some(l=>inside(p,l.p)&&!(l.holes||[]).some(h=>inside(p,h)));
  const caps=new Set();
  for(const road of data.roads||[]){
    if(!road.drivable||road.bridge||road.tunnel||road.sharedParkingSurface||
      !['parking','service'].includes(road.roadClass))continue;
    const half=road.width/2;
    for(let i=0;i<(road.nodes||[]).length;i++){
      const node=road.nodes[i],p=road.p[i];
      const terminal=terminals.get(node);
      if(!terminal||marked(p)||(road.roadClass==='service'&&!inLot(p)))continue;
      const trim=ring=>{
        // An independent crossing can run beside this short stub. Keep the
        // cut inside this walkway's own strip, including its junction edge.
        const polygon=intersectPavementPolygon(ring,terminal.planes);
        if(polygon.length<3)return;
        cutouts.add(polygon);
        if(terminal.stair)stepCuts.add(polygon);
      };
      // Match the rendered round cap at the common node and each incident
      // strip. Only the short section that can overlap the terminal is needed.
      const capKey=node+'/'+half;
      if(!caps.has(capKey)){
        caps.add(capKey);
        const sides=Math.max(12,Math.ceil(Math.PI/Math.acos(1-.022/half)));
        trim(Array.from({length:sides},(_,j)=>{
          const a=j*2*Math.PI/sides;return [p[0]+Math.cos(a)*half,p[1]+Math.sin(a)*half];
        }));
      }
      for(const q of [road.p[i-1],road.p[i+1]]){
        if(!q)continue;
        const dx=q[0]-p[0],dz=q[1]-p[1],len=Math.hypot(dx,dz);
        if(len<.02)continue;
        const t=Math.min(1,(half*2+2)/len),nx=dz*half/len,nz=-dx*half/len;
        trim([[p[0]+nx,p[1]+nz],[p[0]+t*dx+nx,p[1]+t*dz+nz],
          [p[0]+t*dx-nx,p[1]+t*dz-nz],[p[0]-nx,p[1]-nz]]);
      }
    }
  }
  trimPavementMesh(scene.getObjectByName('Mapped walks, cycleways and steps'),cutouts);
  const stepTint=new Color(0xaaa79b).multiplyScalar(.66);
  trimPavementMesh(scene.getObjectByName('Crosswalks, lane paint and step nosings'),stepCuts,(g,i)=>{
    const c=g.attributes.color;
    return Math.abs(c.getX(i)-stepTint.r)<1e-5&&Math.abs(c.getY(i)-stepTint.g)<1e-5&&Math.abs(c.getZ(i)-stepTint.b)<1e-5;
  });
}
