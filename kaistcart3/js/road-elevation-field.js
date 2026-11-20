// Blend the photographed road grade into neighbouring streets over terrain
// distance. The wider transition matters wherever a side street leaves the
// former circuit. Cached metre-based heights are shared by wheels and scenery.
const spacing = 2.5, reach = 63, variance = 2 * 7 ** 2;
const smooth = t => { t = Math.min(1, Math.max(0,t)); return t*t*(3-2*t); };
export function buildRoadElevationField(course, heights, raw, naturalHeight) {
  const x0 = Math.floor((Math.min(...course.x)-reach)/spacing)*spacing;
  const z0 = Math.floor((Math.min(...course.z)-reach)/spacing)*spacing;
  const w = Math.ceil((Math.max(...course.x)+reach-x0)/spacing)+1;
  const h = Math.ceil((Math.max(...course.z)+reach-z0)/spacing)+1;
  const weight = new Float64Array(w*h), absolute = new Float64Array(w*h), offset = new Float64Array(w*h);
  const nearest = new Float32Array(w*h).fill(reach*reach);
  for (let i=0;i<course.n;i++) {
    const x=course.x[i],z=course.z[i],residual=heights[i]-raw[i];
    const left=Math.max(0,Math.ceil((x-reach-x0)/spacing)),right=Math.min(w-1,Math.floor((x+reach-x0)/spacing));
    const top=Math.max(0,Math.ceil((z-reach-z0)/spacing)),bottom=Math.min(h-1,Math.floor((z+reach-z0)/spacing));
    for(let j=top;j<=bottom;j++){
      const dz=z0+j*spacing-z;
      for(let k=left;k<=right;k++){
        const dx=x0+k*spacing-x,d2=dx*dx+dz*dz;
        if(d2>=reach*reach)continue;
        const at=j*w+k,f=Math.exp(-d2/variance);
        weight[at]+=f;absolute[at]+=heights[i]*f;offset[at]+=residual*f;
        if(d2<nearest[at])nearest[at]=d2;
      }
    }
  }
  const values = new Float32Array(w*h);
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){
    const at=j*w+i;
    if(!weight[at])continue;
    const d=Math.sqrt(nearest[at]);
    const crown=.015*(Math.sqrt(nearest[at]+.16)-.4);
    const paved = absolute[at]/weight[at]-crown-naturalHeight(x0+i*spacing,z0+j*spacing);
    const drawIntoSurroundings=smooth((d-4)/22);
    const correction=paved+(offset[at]/weight[at]-paved)*drawIntoSurroundings;
    values[at]=correction*(1-smooth((d-6)/(reach-6)));
  }
  return {x0,z0,w,h,values};
}
export function roadHeightOffset(field,x,z){
  const u=(x-field.x0)/spacing,v=(z-field.z0)/spacing,i=Math.floor(u),j=Math.floor(v);
  if(i<0||j<0||i>=field.w-1||j>=field.h-1)return 0;
  const a=u-i,b=v-j,at=j*field.w+i,d=field.values;
  return (d[at]*(1-a)+d[at+1]*a)*(1-b)+(d[at+field.w]*(1-a)+d[at+field.w+1]*a)*b;
}
