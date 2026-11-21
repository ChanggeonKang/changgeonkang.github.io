import * as THREE from '../lib/three.module.min.js';

// Narrow waisted blocks from the November 2026 view looking into Sejong Hall.
// The square's pattern repeats every 3.2 m at the common street UV scale.
export function sejongPaverTexture(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#756e6c';ctx.fillRect(0,0,512,512);
  let state=423743;
  const rand=()=>((state=Math.imul(1664525,state)+1013904223|0)>>>0)/4294967296;
  const block=new Path2D();
  for(const [i,[u,v]] of [[.7,.6],[9,.6],[10.2,2.2],[22.3,2.2],[23.5,.6],[31.4,.6],[31.4,15.3],[24,15.3],[22.8,13.7],[10.2,13.7],[9,15.3],[.7,15.3]].entries()){
    if(i===0)block.moveTo(u,v);else block.lineTo(u,v);
  }
  block.closePath();
  for(let row=0;row<32;row++)for(let column=0;column<16;column++){
    const x=column*32+(row%2)*16,y=row*16;
    const base=166+Math.floor(rand()*26),rose=rand()<.20?8:0;
    ctx.fillStyle=`rgb(${base+3+rose},${base-2-rose/2},${base-3-rose/2})`;
    ctx.setTransform(1,0,0,1,x,y);ctx.fill(block);
    if(x+32>canvas.width){
      ctx.setTransform(1,0,0,1,x-canvas.width,y);ctx.fill(block);
    }
  }
  ctx.resetTransform();
  const tile=ctx.getImageData(0,0,512,512);
  for(let i=0;i<tile.data.length;i+=4){const d=(rand()-.5)*6;for(let k=0;k<3;k++)tile.data[i+k]+=d;}
  ctx.putImageData(tile,0,0);
  const map=new THREE.CanvasTexture(canvas);map.wrapS=map.wrapT=THREE.RepeatWrapping;
  map.repeat.set(1.25,1.25);map.rotation=-.202;map.anisotropy=8;map.colorSpace=THREE.SRGBColorSpace;
  return map;
}
