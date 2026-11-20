import * as T from '../lib/three.module.min.js';

// Original pavement symbols for the reserved bays visible at W2 and W3.
// Each bay follows the rendered grade at both axles and across its width.
function paintTexture(kind){
  const c=document.createElement('canvas');c.width=256;c.height=384;
  const g=c.getContext('2d'),white='#e8e9e3';
  g.fillStyle=kind==='accessible'?'#397faf':'#397f74';g.fillRect(0,0,c.width,c.height);
  g.strokeStyle=white;g.lineWidth=6;g.strokeRect(3,3,250,378);g.lineJoin='round';g.lineCap='round';
  g.beginPath();g.moveTo(205,0);g.lineTo(205,384);g.stroke();
  g.save();g.beginPath();g.rect(205,2,51,379);g.clip();g.lineWidth=5;
  for(let y=-32;y<441;y+=42){g.beginPath();g.moveTo(202,y);g.lineTo(258,y-43);g.stroke();}
  g.restore();
  g.strokeStyle=white;g.fillStyle=white;g.lineWidth=9;
  if(kind==='accessible'){
    g.beginPath();g.arc(89,218,36,.18*Math.PI,1.40*Math.PI);g.stroke();
    g.beginPath();g.arc(89,143,10,0,Math.PI*2);g.fill();
    g.beginPath();g.moveTo(88,162);g.lineTo(92,199);g.lineTo(125,199);g.lineTo(141,232);g.lineTo(155,226);g.stroke();
    g.beginPath();g.moveTo(93,179);g.lineTo(120,179);g.stroke();
  }else if(kind==='ev'){
    g.beginPath();g.moveTo(78,162);g.lineTo(78,190);g.quadraticCurveTo(78,214,100,214);
    g.quadraticCurveTo(124,214,124,190);g.lineTo(124,162);g.closePath();g.stroke();
    for(const x of [87,115]){g.beginPath();g.moveTo(x,142);g.lineTo(x,162);g.stroke();}
    g.beginPath();g.moveTo(100,214);g.lineTo(100,229);g.quadraticCurveTo(98,249,74,244);g.stroke();
  }
  const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;return tex;
}

export function buildReservedBayPaint(scene,stalls,ground){
  for(const kind of ['accessible','ev','green']){
    const pts=[],uv=[],indices=[];
    for(const s of stalls.filter(b=>b.kind===kind)){
      const w=Math.hypot(s.corners[0][0]-s.corners[1][0],s.corners[0][1]-s.corners[1][1]),d=4.84;
      const n=6,m=9,offset=pts.length/3;
      for(let j=0;j<=m;j++)for(let i=0;i<=n;i++){
        const u=(i/n-.5)*w*s.facing,v=(j/m-.5)*d*s.facing;
        const x=s.x+u*s.u[0]+v*s.v[0],z=s.z+u*s.u[1]+v*s.v[1];
        pts.push(x,ground(x,z)+.009,z);uv.push(i/n,1-j/m);
        if(j===m || i===n)continue;
        const a=offset+j*(n+1)+i;indices.push(a,a+n+1,a+1,a+1,a+n+1,a+n+2);
      }
    }
    if(!pts.length)continue;
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pts,3));
    g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
    const mat=new T.MeshStandardMaterial({map:paintTexture(kind),roughness:.95,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});
    const mesh=new T.Mesh(g,mat);mesh.name='Western parking '+kind+' markings';mesh.receiveShadow=true;scene.add(mesh);
  }
}
