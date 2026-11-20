import {color,strip} from './east-campus-shapes.js';

function branch(batch,a,b,rad,tip,shade){
  const axis=b.map((n,i)=>n-a[i]),length=Math.hypot(...axis);
  if(length<.001)return;
  const n=axis.map(n=>n/length),side=Math.hypot(n[0],n[2])>.001?[n[2],0,-n[0]]:[1,0,0];
  const s=side.map(v=>v/Math.hypot(...side)),v=[n[1]*s[2]-n[2]*s[1],n[2]*s[0]-n[0]*s[2],n[0]*s[1]-n[1]*s[0]];
  const p=(q,k,r)=>q.map((t,i)=>t+(s[i]*Math.cos(k)+v[i]*Math.sin(k))*r);
  for(let j=0;j<7;j++){
    const t=2*Math.PI*j/7,u=2*Math.PI*(j+1)/7,m=(t+u)/2;
    strip(batch,p(a,t,rad),p(a,u,rad),p(b,u,tip),p(b,t,tip),s.map((v1,k)=>v1*Math.cos(m)+v[k]*Math.sin(m)),shade);
  }
}
function crown(batch,origin,radii,shade,seed){
  const rings=5,bays=14;
  const vertex=(j,k)=>{
    const lat=Math.PI*j/rings,azi=2*Math.PI*k/bays+.20*Math.sin(j*1.7+seed);
    const w=1+.10*Math.sin(azi*3+lat*5+seed)+.067*Math.cos(azi*5-seed)+.042*Math.sin(azi*6+lat*7.1+seed);
    return [origin[0]+radii[0]*Math.sin(lat)*Math.cos(azi)*w,
      origin[1]+radii[1]*(Math.cos(lat)+.08*Math.sin(lat)*Math.cos(azi*4+seed+j)),origin[2]+radii[2]*Math.sin(lat)*Math.sin(azi)*w];
  };
  for(let j=0;j<rings;j++)for(let k=0;k<bays;k++){
    const pts=[vertex(j,k),vertex(j,k+1),vertex(j+1,k+1),vertex(j+1,k)];
    const normal=pts[2].map((v,i)=>((pts[0][i]+v)/2-origin[i])/radii[i]**2);
    const length=Math.hypot(...normal)||1,light=shade.clone().multiplyScalar(.88+.13*(1+Math.sin((k+j*3)*2.41+seed))/2);
    strip(batch,...pts,normal.map(n=>n/length),light);
  }
}

export function finishSurveyFoliage(material){
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vSurveyLeaves;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvSurveyLeaves=position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 vSurveyLeaves;
      float foliageHash(vec3 p){
        p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);
      }
      float leafNoise(vec3 p){
        vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(mix(foliageHash(i),foliageHash(i+vec3(1,0,0)),f.x),
                       mix(foliageHash(i+vec3(0,1,0)),foliageHash(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(foliageHash(i+vec3(0,0,1)),foliageHash(i+vec3(1,0,1)),f.x),
                       mix(foliageHash(i+vec3(0,1,1)),foliageHash(i+vec3(1,1,1)),f.x),f.y),f.z);
      }`).replace('#include <color_fragment>',`#include <color_fragment>
        float macro=leafNoise(vSurveyLeaves*1.25),details=leafNoise(vSurveyLeaves*6.4);
        float subpixel=max(length(dFdx(vSurveyLeaves)),length(dFdy(vSurveyLeaves)));
        details=mix(details,.5,smoothstep(.08,.34,subpixel));
        vec3 face=normalize(cross(dFdx(vSurveyLeaves),dFdy(vSurveyLeaves)));
        float grazing=1.-abs(dot(face,normalize(cameraPosition-vSurveyLeaves)));
        // Small, world-anchored gaps break the straight polygon silhouettes.
        // Fade to continuous coverage when a leaf cluster is smaller than a pixel.
        if(details<(.14+.21*grazing)*(1.-smoothstep(.11,.27,subpixel)) && macro<.47)discard;
        float cluster=smoothstep(.23,.78,macro*.51+details*.49);
        diffuseColor.rgb*=mix(vec3(.45,.49,.45),vec3(1.21,1.19,1.04),cluster);`);
  };
  material.customProgramCacheKey=()=>'survey-foliage-2';
  return material;
}
export function clippedConifer(B,x,y,z,scale,seed){
  const bark=color(0x655c4e),green=color(0x476447),base=[x,y-.08,z],stem=[x+.08*scale,y+2.35*scale,z];
  branch(B.trim,base,stem,.12*scale,.065*scale,bark);
  for(let i=0;i<4;i++){
    const a=seed+i*2.13,off=i===3?.10:.56;
    const q=[x+off*scale*Math.cos(a),y+scale*(1.37+i*.40),z+off*scale*Math.sin(a)];
    branch(B.trim,[x,y+scale*(.65+i*.34),z],q,.072*scale,.027*scale,bark);
    crown(B.leaf,q,[scale*(1.02-i*.085),scale*(.66-i*.026),scale*(.90-i*.045)],green,seed+i*2);
  }
}
export function maple(B,x,y,z,scale,seed,leaves,lowBranches=false){
  const bark=color(0x574e43),ruby=color(leaves??[0x60403d,0x623c3c,0x6d413b,0x503c36][Math.abs(Math.floor(seed*1.27))%4]);
  branch(B.trim,[x,y-.10,z],[x+.09*scale,y+2.4*scale,z],.13*scale,.075*scale,bark);
  for(let i=0;i<6;i++){
    const a=seed+i*2.36,d=i<4?.86:.36;
    const lower=lowBranches&&i<3;
    const crownHeight=lower?1.15+.46*i:2.38+.24*i;
    const q=[x+Math.cos(a)*d*scale,y+crownHeight*scale,z+Math.sin(a)*d*scale];
    branch(B.trim,[x,y+(lower?.69:1.2)*scale,z],q,.08*scale,.022*scale,bark);
    crown(B.leaf,q,[scale*(1.32-i*.035),scale*((lower?1.00:.84)-i*.014),1.12*scale],ruby,seed+i);
  }
  if(lowBranches)crown(B.leaf,[x,y+2.34*scale,z],[1.42*scale,1.38*scale,1.37*scale],ruby,seed+.61);
}

export function cedar(B,x,y,z,scale,seed){
  const bark=color(0x5b5247),green=color(0x3e5844);
  branch(B.trim,[x,y-.13,z],[x+.07*scale,y+8.35*scale,z],.19*scale,.031*scale,bark);
  for(let i=0;i<7;i++){
    const a=seed+i*2.42,r=(1.02-i*.099)*scale;
    const branchTip=[x+.84*r*Math.cos(a),y+(3.0+i*.71)*scale,z+.84*r*Math.sin(a)];
    branch(B.trim,[x,y+(2.31+i*.70)*scale,z],branchTip,.08*scale,.028*scale,bark);
    crown(B.leaf,branchTip,[r*2.08,r*.74,r*1.87],green,seed+i);
    crown(B.leaf,[x-.46*r*Math.cos(a),branchTip[1]+r*.31,z-.46*r*Math.sin(a)],[r*1.87,r*.86,r*1.65],green,seed+i+1.6);
  }
  crown(B.leaf,[x,y+8.06*scale,z],[.54*scale,.78*scale,.51*scale],green,seed);
}

// A red pine's exposed, leaning forks and broad pads read from across the
// water. Build connected branches; keep open sky between the individual pads.
export function redPine(B,x,y,z,radius,height,seed){
  const bark=color(0x694f43),needles=color(0x365546);
  const pivot=[x+.10*radius*Math.cos(seed),y+.32*height,z+.10*radius*Math.sin(seed)];
  branch(B.trim,[x,y-.12,z],pivot,.072*radius,.048*radius,bark);
  for(let i=0;i<6;i++){
    const angle=seed+i*2.395,r=radius*(.55+.08*Math.sin(i*3+seed));
    const elbow=[pivot[0]+Math.cos(angle)*r*.65,y+height*(.43+.04*i),pivot[2]+Math.sin(angle)*r*.65];
    const tip=[x+Math.cos(angle)*r,y+height*(.60+.052*i),z+Math.sin(angle)*r];
    branch(B.trim,pivot,elbow,.044*radius,.026*radius,bark);
    branch(B.trim,elbow,tip,.028*radius,.011*radius,bark);
    const spread=radius*(.48+.045*Math.sin(seed+i));
    crown(B.leaf,tip,[spread,.095*height,spread*.91],needles,seed+i);
    const knuckle=[tip[0]+.24*radius*Math.cos(angle+.63),tip[1]+.031*height,tip[2]+.24*radius*Math.sin(angle+.63)];
    crown(B.leaf,knuckle,[spread*.68,.070*height,spread*.71],needles,seed+.51*i);
  }
  crown(B.leaf,[pivot[0],y+.91*height,pivot[2]],[.48*radius,.095*height,.44*radius],needles,seed+1.75);
}
