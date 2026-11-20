import * as THREE from '../lib/three.module.min.js';

const up = [0, 1, 0];
const color = value => new THREE.Color(value);
const vector = (x, z) => [x, 0, z];
function frame(a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
  return {a, length, u:[dx/length, dz/length], n:[dz/length, -dx/length]};
}
function at(f, u, height, out = 0) {
  return [f.a[0]+u*f.u[0]+out*f.n[0], height, f.a[1]+u*f.u[1]+out*f.n[1]];
}
function panel(batch, f, start, end, bottom, top, out, shade) {
  if (end <= start || top <= bottom) return;
  batch.quad(at(f,start,bottom,out),at(f,end,bottom,out),at(f,end,top,out),at(f,start,top,out),
    vector(...f.n),[start,bottom],[end,bottom],[end,top],[start,top],shade);
}
function reverseFrame(f) {
  return frame([f.a[0]+f.u[0]*f.length,f.a[1]+f.u[1]*f.length],f.a);
}
function box(batch, f, a, b, back, front, bottom, top, shade) {
  const [x,,z] = at(f,a,bottom,back), [ex,,ez] = at(f,b,bottom,back);
  const [fx,,fz] = at(f,b,bottom,front), [sx,,sz] = at(f,a,bottom,front);
  solid(batch,[[x,z],[ex,ez],[fx,fz],[sx,sz]],bottom,top,shade);
}
function solid(batch, ring, bottom, top, shade, sides = true) {
  const outline = ring.map(p=>new THREE.Vector2(...p));
  const signed = THREE.ShapeUtils.area(outline);
  if (sides) for (let i=0; i<ring.length; i++) {
    const f=frame(ring[i],ring[(i+1)%ring.length]);
    const side=signed>0?f:reverseFrame(f);
    panel(batch,side,0,side.length,bottom,top,0,shade);
  }
  for(const indices of THREE.ShapeUtils.triangulateShape(outline,[])){
    const p=indices.map(i=>[ring[i][0],top,ring[i][1]]);
    batch.tri(...p,up,...indices.map(i=>ring[i]),shade);
  }
}
function column(batch,x,z,r,bottom,top,shade){
  const p=Array.from({length:12},(_,i)=>[x+r*Math.cos(i*Math.PI/6),z+r*Math.sin(i*Math.PI/6)]);
  solid(batch,p,bottom,top,shade);
}
function groundPoint(f,u,d,hAt,lift=0){
  const p=at(f,u,0,d);p[1]=hAt(p[0],p[2])+lift;return p;
}
function strip(batch,a,b,c,d,normal,shade) {
  const L=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]),H=Math.hypot(d[0]-a[0],d[1]-a[1],d[2]-a[2]);
  batch.quad(a,b,c,d,normal,[0,0],[L,0],[L,H],[0,H],shade);
}
function groundPatch(batch,ring,hAt,shade,uvScale=1){
  const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
  function triangle(a,b,c){
    const v=[a,b,c],edge=v.map((p,i)=>Math.hypot(p[0]-v[(i+1)%3][0],p[1]-v[(i+1)%3][1])),longest=Math.max(...edge);
    if(longest>3.1){const i=edge.indexOf(longest),x=v[i],y=v[(i+1)%3],z=v[(i+2)%3],m=mid(x,y);triangle(x,m,z);triangle(m,y,z);return;}
    batch.tri(...v.map(([x,z])=>[x,hAt(x,z)+.072,z]),up,...v.map(([x,z])=>[x*uvScale,z*uvScale]),shade);
  }
  for(const t of THREE.ShapeUtils.triangulateShape(ring.map(q=>new THREE.Vector2(...q)),[]))triangle(...t.map(i=>ring[i]));
}
function plaque(group,text,f,u,y,out,width,height,ink,bg=null){
  const canvas=document.createElement('canvas'); canvas.height=96;
  canvas.width=Math.ceil(canvas.height*width/height);
  const ctx=canvas.getContext('2d');
  if(bg){ctx.fillStyle=bg;ctx.fillRect(0,0,canvas.width,canvas.height);}
  ctx.font='600 67px "Malgun Gothic", Arial, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle=ink;ctx.fillText(text,canvas.width/2,51,canvas.width*.975);
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;
  const mat=new THREE.MeshBasicMaterial({map:tex,transparent:!bg,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),mat);mesh.name=text;
  mesh.position.set(...at(f,u,y,out));mesh.rotation.y=Math.atan2(f.n[0],f.n[1]);group.add(mesh);
}

export { up, color, vector, frame, at, panel, reverseFrame, box, solid, column, groundPoint, strip, groundPatch, plaque };
