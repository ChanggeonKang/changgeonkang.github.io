import * as THREE from '../lib/three.module.min.js';

import { crossingSurvey, tactileKerbs } from './street-inventory.js';

export function buildAccessEdges(scene,W,surfaceAt,MB,flat,edgeProfile) {
  const access=W.access, geometry=new MB(),up=[0,1,0],uv=[0,0],bounds=W.D.bounds;
  const shades=[0xa6a69c,0xaaaaa1,0xa5a59d,0x9fa198].map(x=>new THREE.Color(x));
  const front=new THREE.Color(0x8f928a),gutter=new THREE.Color(0x898b83),tactile=new THREE.Color(0xdaa84f),tactileDot=new THREE.Color(0xe7bc66);
  const crossingEdges=[],roadIndex=W.roadIndex,gateData=W.explore.vehicleGates||[],posts=[],postBins=new Map(),arms=[],fixtures=[];
  const near=(a,x,z,r)=>(a[0]-x)**2+(a[1]-z)**2<r*r;
  const bin=(x,z,size)=>Math.floor(x/size)*65536+Math.floor(z/size);
  const carRoad=r=>r.drivable===true;
  const quad=(a,b,c,d,n,color)=>geometry.quad(a,b,c,d,n,uv,uv,uv,uv,color);
  const ground=(x,z)=>surfaceAt(x,z);
  const inBounds=(x,z)=>x>bounds.x0+1&&x<bounds.x1-1&&z>bounds.z0+1&&z<bounds.z1-1;
  const closeToSourceGate=(x,z,r)=>gateData.some(g=>near(g.p,x,z,r));
  const sourceKerbs=W.explore.kerbs || [];
  const nurseryLot=W.D.areas.find(a=>a.id===504338821)?.p || [];
  const nurseryAsphalt=(x,z)=>{
    if(x< -228 || x> -178 || z<304 || z>337)return false;
    let inside=false;
    for(let i=0,j=nurseryLot.length-1;i<nurseryLot.length;j=i++){
      const a=nurseryLot[i],b=nurseryLot[j];
      if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
    }
    return inside;
  };
  const flush=sourceKerbs.filter(k=>k.t==='flush'||k.t==='lowered').map(k=>k.p);
  // The Kaimaru approach is flush at the street. The steps further inside
  // separate the entrance from the shuttle road in both photographed years.
  flush.push([-251,-385.8],[-249,-385.8],[-247,-385.8]);
  const raised=sourceKerbs.filter(k=>k.t==='raised').map(k=>k.p);
  for(const crossing of crossingSurvey){
    const [x,z]=crossing.p;
    const hit=roadIndex.nearest(x,z,7,r=>r.id===crossing.way&&carRoad(r)) || roadIndex.nearest(x,z,7,carRoad);
    if(!hit || hit.distance>hit.s.road.width/2+1)continue;
    for(const side of [-1,1]){
      const o=side*hit.s.road.width/2,angle=(crossing.angle??0)*Math.PI/180;
      const wx=Math.cos(angle),wz=Math.sin(angle),normalProjection=wx*hit.s.dz-wz*hit.s.dx;
      const along=crossing.angle!==undefined && Math.abs(normalProjection)>.45
        ? o*(wx*hit.s.dx+wz*hit.s.dz)/normalProjection : 0;
      const ex=hit.x+hit.s.dz*o+along*hit.s.dx,ez=hit.z-hit.s.dx*o+along*hit.s.dz;
      crossingEdges.push([ex,ez]);
      if(crossing.tactile!=='yes' && !tactileKerbs.some(p=>near(p,ex,ez,1.5)))continue;
      const nx=side*hit.s.dz,nz=-side*hit.s.dx,tx=hit.s.dx,tz=hit.s.dz;
      const point=(u,v,y)=>[ex+tx*u+nx*v,y,ez+tz*u+nz*v];
      const mid=point(0,.65,0);
      if(access.isDrivable(mid[0],mid[2]) || ![1,2].includes(W.G.d[(Math.floor(mid[2])-W.G.z0)*W.G.w+Math.floor(mid[0])-W.G.x0]))continue;
      const pp=(u,v,lift)=>{const p=point(u,v,0);p[1]=ground(p[0],p[2])+lift;return p;};
      quad(pp(-.85,.34,.024),pp(.85,.34,.024),pp(.85,.83,.024),pp(-.85,.83,.024),up,tactile);
      for(let row=0;row<2;row++)for(let col=-4;col<=4;col++){
        const u=col*.16,v=.46+row*.20,d=.025;
        quad(pp(u-d,v-d,.032),pp(u+d,v-d,.032),pp(u+d,v+d,.032),pp(u-d,v+d,.032),up,tactileDot);
      }
    }
  }

  const drops=new Map();
  for(const point of [...crossingEdges,...flush]){
    const id=bin(...point,8);if(!drops.has(id))drops.set(id,[]);
    drops.get(id).push(point);
  }
  const curbHeight=(x,z)=>{
    const id=bin(x,z,8);
    let distance=Infinity;
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){
      for(const p of drops.get(id+dx*65536+dz)||[])distance=Math.min(distance,(p[0]-x)**2+(p[1]-z)**2);
    }
    if(distance>2.65**2 || raised.some(p=>near(p,x,z,1.1)))return .14;
    return .02+.12*Math.min(1,Math.max(0,(Math.sqrt(distance)-1.45)/1.20));
  };
  const allow=access.isDrivable.bind(access);
  const kerbTiles=new Map(),vec=new THREE.Vector3();
  let kerbMetres=0, concretePieces=0;
  for(const line of access.outlines.rings){
    const tangents=line.map(([x,z],i)=>{
      const next=line[(i+1)%line.length],dx=next[0]-x,dz=next[1]-z,length=Math.hypot(dx,dz);
      return [dx/length,dz/length];
    });
    // The swept bevel and gutter share a section at each corner. This avoids
    // hairline cracks and overlapping rectangular stones at street-scale bends.
    const offsets=tangents.map(([dx,dz],i)=>{
      const prev=tangents[(i+line.length-1)%line.length];
      const den=Math.max(.5,1+dx*prev[0]+dz*prev[1]);
      return [(dz+prev[1])/den,-(dx+prev[0])/den];
    });
    let distanceAlong=0;
    for(let i=0;i<line.length;i++){
      const next=(i+1)%line.length,a=line[i],b=line[next],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
      if(length<.009)continue;
      const n=Math.ceil(length/2.25),nx=dz/length,nz=-dx/length;
      const section=f=>{
        const px=a[0]+dx*f,pz=a[1]+dz*f;
        const ox=offsets[i][0]*(1-f)+offsets[next][0]*f,oz=offsets[i][1]*(1-f)+offsets[next][1]*f;
        // Both probes stay on the traffic side, even where the outer lip hangs over a riverbank.
        const x=Math.fround(px-.22*ox),z=Math.fround(pz-.22*oz);
        const gutterY=ground(x,z),insideY=ground(px-.70*ox,pz-.70*oz);
        return {f,px,pz,ox,oz,x,z,gutterY,slope:Math.max(-.32,Math.min(.32,(gutterY-insideY)/.48))};
      };
      let previous=section(0);
      for(let j=0;j<n;j++){
        const u=j/n,v=(j+1)/n,m=(u+v)/2,x=a[0]+dx*m,z=a[1]+dz*m;
        const start=previous,end=section(v);
        previous=end;
        if(!inBounds(x,z) || closeToSourceGate(x,z,1.8))continue;
        // Do not draw a horizontal bar across a grade-separated street or
        // through a building wall. A real facade is its own boundary.
        const outsideX=x+nx*.85,outsideZ=z+nz*.85;
        // The private W2 bays meet the public aisle across ordinary asphalt.
        // Its access limit is not a concrete kerb across the visible court.
        if(nurseryAsphalt(x+nx*.35,z+nz*.35))continue;
        const outside=(Math.floor(outsideZ)-W.G.z0)*W.G.w+Math.floor(outsideX)-W.G.x0;
        if(W.G.d[outside]===9)continue;
        const top=shades[(concretePieces++ + Math.floor((x+z)*.7))&3];
        const key=bin(x,z,160);
        if(!kerbTiles.has(key))kerbTiles.set(key,{p:[],n:[],c:[],stone:[],index:[]});
        const tile=kerbTiles.get(key);
        const emit=(left,right)=>{
          const first=tile.p.length/3;
          for(const {f,px,pz,ox,oz,gutterY,slope} of [left,right]){
            const h=curbHeight(px,pz);
            for(const [off,raise,normal,vertical,col] of [[-.22,.011,0,1,gutter],[-.015,.011,0,1,gutter],
                [-.015,h-.012,-.96,.25,front],[.018,h,-.25,.97,top],[.215,h,.14,.99,top],[.215,-.22,1,0,front]]){
              const vx=px+ox*off,vz=pz+oz*off;
              const y=gutterY+(off+.22)*slope;
              tile.p.push(vx,y+raise,vz);vec.set(ox*normal,vertical,oz*normal).normalize();
              tile.n.push(vec.x,vec.y,vec.z);tile.c.push(col.r,col.g,col.b);
              tile.stone.push(distanceAlong+length*f,off+raise);
            }
          }
          for(let k=0;k<5;k++)tile.index.push(first+k,first+7+k,first+1+k,first+k,first+6+k,first+7+k);
        };
        const onPlane=t=>Math.abs(ground(start.x+(end.x-start.x)*t,start.z+(end.z-start.z)*t)
          -(start.gutterY+(end.gutterY-start.gutterY)*t))<=.012;
        if(onPlane(.5)&&onPlane(.25)&&onPlane(.75)){
          emit(start,end);
        }else{
          const parts=edgeProfile(start.x,start.z,end.x,end.z);
          const at=(t,face)=>{
            const s=section(u+(v-u)*t);
            if(face&&Math.abs(face.y+t*face.dy-s.gutterY)<.012)s.gutterY=face.y+t*face.dy;
            return s;
          };
          const stitch=(a,b)=>{
            const t=.5,y=ground((a.x+b.x)*t,(a.z+b.z)*t);
            const matches=s=>Math.abs(ground(a.x+s*(b.x-a.x),a.z+s*(b.z-a.z))-(a.gutterY+s*(b.gutterY-a.gutterY)))<=.015;
            if(Math.abs(y-(a.gutterY+b.gutterY)*t)<=.015 && matches(.25)&&matches(.75)){
              emit(a,b);
            }else if((b.f-a.f)*length>.025){
              const mid=section((a.f+b.f)*t);
              stitch(a,mid);stitch(mid,b);
            }
            // A mapped step can pass almost exactly along the gutter edge.
            // End each independent stone at that lip instead of stretching
            // a vertical web across the two levels.
          };
          for(const part of parts){
            let {start:t0,end:t1,face}=part;
            // Separate the two lips around a vertical step by less than
            // half a millimetre, keeping each on its intended triangle.
            const inset=Math.min((t1-t0)*.10,.00030/(length/n));
            if(t0>0)t0+=inset;
            if(t1<1)t1-=inset;
            stitch(at(t0,face),at(t1,face));
          }
        }
        kerbMetres+=length/n;
      }
      distanceAlong+=length;
    }
  }
  const kerbMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.94});
  kerbMat.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>',
      '#include <common>\nattribute vec2 curbStation; varying vec2 vStone;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvStone=curbStation;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vStone;')
      .replace('#include <color_fragment>',`#include <color_fragment>
        float pixel=max(fwidth(vStone.x),.001);
        float period=vStone.y < -.02 ? 3.10 : 1.55;
        float joint=abs(fract(vStone.x/period+.5)-.5)*period;
        float coverage=(1.-smoothstep(.004,.012+pixel*.35,joint))*min(1.,.02/pixel);
        vec2 grains=floor(vStone*69.);
        float grain=fract(sin(dot(grains,vec2(41.3,16.91)))*1879.172)-.5;
        diffuseColor.rgb*= (1.-.40*coverage)*(1.+grain*.095*(1.-smoothstep(.009,.035,pixel)));
      `);
  };
  for(const tile of kerbTiles.values()){
    const g=new THREE.BufferGeometry();
    for(const [key,values] of [['position',tile.p],['normal',tile.n],['color',tile.c]])g.setAttribute(key,new THREE.Float32BufferAttribute(values,3));
    g.setAttribute('curbStation',new THREE.Float32BufferAttribute(tile.stone,2));
    g.setIndex(tile.index);
    const mesh=new THREE.Mesh(g,kerbMat);mesh.name='Roadside kerbs and dropped pedestrian crossings';mesh.receiveShadow=true;scene.add(mesh);
  }
  if(geometry.p.length)flat(scene,geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.94}),4).name='Tactile crossing pads';

  function post(x,z,kind=0){
    const id=bin(x,z,2);
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const p of postBins.get(id+dx*65536+dz)||[])if(near(p,x,z,.67))return;
    if(!postBins.has(id))postBins.set(id,[]);
    postBins.get(id).push([x,z]);
    posts.push([x,ground(x,z),z,kind]);
  }
  for(const gate of gateData){
    if(!inBounds(...gate.p))continue;
    if(gate.id===910330595)continue; // The surveyed E17 threshold supplies its masonry piers and gate.
    const [x,z]=gate.p,dr=roadIndex.nearest(x,z,8,r=>r.nodes?.includes(gate.id)),width=gate.width || dr?.s.road.width || 2.4;
    const angle=gate.heading??(dr?Math.atan2(dr.s.dx,dr.s.dz):0),nx=Math.cos(angle),nz=-Math.sin(angle);
    if(['gate','lift_gate','swing_gate','chain','cable_barrier'].includes(gate.t)){
      const offset=width/2+.16,ax=x+nx*offset,az=z+nz*offset;
      post(ax,az,2);
      arms.push({x:ax,z:az,y:ground(ax,az)+.79,nx,nz,width,raised:gate.passable,type:gate.t});
    }else if(['planter','barrier_board','cycle_barrier'].includes(gate.t)){
      fixtures.push({x,z,y:ground(x,z),nx,nz,type:gate.t});
    }else if(!gate.passable)post(x,z,1);
  }

  // At a mapped pedestrian entrance use posts beyond the carriageway. Test
  // both directions and the complete road/lot mask, keeping driveways open.
  const entrances=[];
  for(const [road,way] of roadIndex.ways){
    if(road.drivable || road.sharedParkingSurface || !['walk','cycle','steps','trail'].includes(road.roadClass))continue;
    if(road.id===470177363)continue; // N11 entry steps have no row of bollards.
    for(const s of way.segments){
      const n=Math.ceil(s.span/1.3);
      let previous=allow(s.a[0],s.a[1]);
      for(let i=1;i<=n;i++){
        const f=i/n,x=s.a[0]+s.dx*s.span*f,z=s.a[1]+s.dz*s.span*f,inside=allow(x,z);
        if(inside===previous)continue;
        const sign=previous?1:-1;previous=inside;
        const along=Math.min(s.span,Math.max(0,(i-.5)*s.span/n+sign*1.05));
        const px=s.a[0]+s.dx*along,pz=s.a[1]+s.dz*along;
        if(!inBounds(px,pz)||allow(px,pz)||closeToSourceGate(px,pz,3)||entrances.some(p=>near(p,px,pz,2.6)))continue;
        // The W3 door, its accessible stalls and the two W13 aisle
        // crossings are clear in S5Z_0un, g6FoUO6 and 7znqEr. These
        // are flush pedestrian connections, not lanes closed with posts.
        if(px>-326 && px<-305 && pz>318 && pz<332 ||
           px>-231 && px<-217 && pz>333 && pz<353)continue;
          // Four perpendicular views at the KRAFTON table and garage mouth
          // show clear sidewalk ramps. The mapped garage gate is separate.
          if(near([276.4,279.7],px,pz,6.4)||near([310.4,301.6],px,pz,6)||
             near([317,293.4],px,pz,6))continue;
        // Ground and aerial views show continuous flush crossings in front
        // of the E19 drop-off and E22 delivery doors.
        if(near([475.5,179.2],px,pz,4.75)||near([477.9,103.5],px,pz,4.85))continue;
        const service=roadIndex.nearest(px,pz,10,carRoad);
        if(!service || Math.abs(service.s.dx*s.dx+service.s.dz*s.dz)>.82)continue;
        if(W.G.d[(Math.floor(pz)-W.G.z0)*W.G.w+Math.floor(px)-W.G.x0]!==1)continue;
        entrances.push([px,pz]);
        const span=Math.max(.8,Math.min(road.width-.40,4.8)),intervals=Math.max(1,Math.ceil(span/1.52));
        for(let j=0;j<=intervals;j++){
          const o=-span/2+span*j/intervals,ex=px+s.dz*o,ez=pz-s.dx*o;
          if(!allow(ex,ez))post(ex,ez);
        }
      }
    }
  }
  const transform=new THREE.Matrix4(),color=new THREE.Color(),position=new THREE.Vector3(),quat=new THREE.Quaternion(),scale=new THREE.Vector3();
  const material=new THREE.MeshStandardMaterial({roughness:.59,metalness:.36});
  for(const [radius,len,above,band] of [[.088,.72,.36,false],[.089,.08,.60,true],[.089,.035,.725,true]]){
    const mesh=new THREE.InstancedMesh(new THREE.CylinderGeometry(radius,radius,len,8),material,posts.length);
    mesh.name=band?'Reflective bollard bands':'Pedestrian access bollards';
    posts.forEach(([x,y,z,kind],i)=>{
      transform.makeTranslation(x,y+above,z);mesh.setMatrixAt(i,transform);
      const c=band?(kind===2?0xffded1:0xecc879):(kind===2?0xb1553f:kind===1?0x858982:0x565d5b);
      mesh.setColorAt(i,color.setHex(c));
    });
    mesh.castShadow=true;mesh.computeBoundingSphere();scene.add(mesh);
  }
  const pieces=[],upVec=new THREE.Vector3(0,1,0);
  const beam=(a,b,width,depth,c)=>{
    const dir=new THREE.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]),span=dir.length();
    if(span<.005)return;
    quat.setFromUnitVectors(upVec,dir.divideScalar(span));scale.set(width,span,depth);
    position.set((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);
    pieces.push([transform.compose(position,quat,scale).clone(),c]);
  };
  for(const {x,y,z,nx,nz,width,raised,type} of arms){
    const folding=raised && (type==='gate'||type==='swing_gate'),tilt=raised&&!folding?Math.PI*.46:0;
    const dx=folding?-nz:-nx*Math.cos(tilt),dz=folding?nx:-nz*Math.cos(tilt),dy=Math.sin(tilt);
    const line=(f,h)=>[x+dx*width*f,y+dy*width*f+h,z+dz*width*f];
    if(type==='lift_gate'){
      for(let j=0;j<6;j++)beam(line(j/6,0),line((j+1)/6,0),.09,.10,j%2?0xe9e5d3:0xb5594a);
    }else if(type==='gate'||type==='swing_gate'){
      beam(line(0,.14),line(1,.14),.065,.065,0x777c73);
      beam(line(0,-.35),line(1,-.35),.06,.06,0x777c73);
      const bars=Math.max(3,Math.ceil(width/.55));
      for(let j=0;j<=bars;j++)beam(line(j/bars,-.35),line(j/bars,.14),.032,.032,0x7f857d);
    }else{
      for(let j=0;j<8;j++)beam(line(j/8,-.25*Math.sin(j*Math.PI/8)),line((j+1)/8,-.25*Math.sin((j+1)*Math.PI/8)),.035,.035,0x706e60);
    }
  }
  for(const {x,y,z,nx,nz,type} of fixtures){
    const point=(o,h,along=0)=>[x+nx*o-nz*along,y+h,z+nz*o+nx*along];
    if(type==='planter'){
      beam(point(0,.04),point(0,.53),.86,.86,0x999486);
      beam(point(0,.52),point(0,1.10),.73,.77,0x69794c);
    }else if(type==='barrier_board'){
      for(const side of [-1,1])beam(point(side*.46,0),point(side*.46,.83),.042,.052,0x717779);
      beam(point(-.55,.68),point(.55,.68),.28,.08,0xc9844d);
    }else{
      for(const side of [-1,1])beam(point(side*.48,0),point(side*.48,.83),.055,.055,0x929999);
      beam(point(-.48,.83),point(.48,.83),.055,.055,0x929999);
    }
  }
  const arm=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),material,pieces.length);
  pieces.forEach(([matrix,c],i)=>{arm.setMatrixAt(i,matrix);arm.setColorAt(i,color.setHex(c));});
  arm.name='Mapped vehicle gates';arm.castShadow=true;arm.computeBoundingSphere();scene.add(arm);
  return {curbMetres:Math.round(kerbMetres),pedestrianEntrances:entrances.length,bollards:posts.length,gateArms:arms.length};
}
