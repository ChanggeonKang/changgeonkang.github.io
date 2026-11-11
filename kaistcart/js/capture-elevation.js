// Qualitative road grades supplied by the user on 2026-11-12, associated with
// camera locations estimated from the supplied minimaps. Percentages below are
// modeling choices, not surveyed measurements or values read from a panorama.
export const OBSERVED_GRADES = Object.freeze([
  { photos:[11,12,13,14,15], from:1342, to:1410, grade:.022, blendM:18, kind:'gentle ascent' },
  { photos:[20,21], from:1512, to:1543, grade:.020, blendM:16, kind:'gentle ascent' },
  { photos:[26,27], from:1629, to:1656, grade:.025, blendM:14, kind:'gentle ascent' },
  { photos:[42,43,44], from:1930, to:1975, grade:-.035, blendM:12, kind:'descent' },
  { photos:[45,46,47], from:1986, to:2046, grade:.030, blendM:14, kind:'ascent' },
  { photos:[50,51], from:2090, to:2110, grade:-.035, blendM:8, kind:'descent' },
  { photos:[52], from:2119, to:2131, grade:0, blendM:8, kind:'level intersection' },
  { photos:[53,54], from:2140, to:2176, grade:-.075, blendM:16, kind:'steep descent' },
].map(x=>Object.freeze({...x, photos:Object.freeze(x.photos)})));

/** Fit a closed, smooth road profile to qualitative grade observations while
 * keeping its absolute elevations near the existing DEM-derived profile.
 * Position and width are never changed. The same result feeds mesh and wheels.
 */
export function applyObservedGrades(C, base) {
  const n=C.n, lengths=new Float64Array(n), target=new Float64Array(n), strength=new Float64Array(n);
  const edgeWeight=new Float64Array(n), desiredDelta=new Float64Array(n);
  const at=i=>(i+n)%n, smooth=x=>x*x*(3-2*x);
  for(let i=0;i<n;i++) {
    const j=(i+1)%n; lengths[i]=Math.hypot(C.x[j]-C.x[i],C.z[j]-C.z[i]);
    target[i]=(base[j]-base[i])/lengths[i];
    for(const obs of OBSERVED_GRADES) {
      const distance=Math.max(obs.from-i,0,i-obs.to)*C.ds;
      const weight=smooth(Math.max(0,1-distance/obs.blendM));
      if(weight>0) { target[i]=target[i]*(1-weight)+obs.grade*weight; strength[i]=Math.max(strength[i],weight); }
    }
    edgeWeight[i]=6+1994*strength[i]; desiredDelta[i]=target[i]*lengths[i];
  }
  // Quadratic least squares: preserve elevation, fit edge rises, and discourage
  // abrupt changes in grade. A cyclic operator also joins the start/finish seam.
  const anchor=.04, curvature=12, rhs=new Float64Array(n), diagonal=new Float64Array(n);
  for(let i=0;i<n;i++) {
    const p=at(i-1); rhs[i]=anchor*base[i]+edgeWeight[p]*desiredDelta[p]-edgeWeight[i]*desiredDelta[i];
    diagonal[i]=anchor+edgeWeight[p]+edgeWeight[i]+6*curvature;
  }
  function multiply(x,out) {
    for(let i=0;i<n;i++) { const p=at(i-1),j=at(i+1);
      out[i]=anchor*x[i]+edgeWeight[p]*(x[i]-x[p])+edgeWeight[i]*(x[i]-x[j])
        +curvature*(6*x[i]-4*(x[p]+x[j])+x[at(i-2)]+x[at(i+2)]);
    }
  }
  const heights=Float64Array.from(base), residual=new Float64Array(n), direction=new Float64Array(n), product=new Float64Array(n);
  multiply(heights,product);let rz=0,initialResidualSquared=0;
  for(let i=0;i<n;i++){residual[i]=rhs[i]-product[i];direction[i]=residual[i]/diagonal[i];rz+=residual[i]*direction[i];initialResidualSquared+=residual[i]**2;}
  let iterations=0,residualSquared=initialResidualSquared;
  for(;iterations<2500&&residualSquared>Math.max(1e-20,initialResidualSquared*1e-20);iterations++){
    multiply(direction,product);let denominator=0;
    for(let i=0;i<n;i++)denominator+=direction[i]*product[i];
    if(!(denominator>0))break;
    const alpha=rz/denominator;let nextRz=0;residualSquared=0;
    for(let i=0;i<n;i++){heights[i]+=alpha*direction[i];residual[i]-=alpha*product[i];nextRz+=residual[i]**2/diagonal[i];residualSquared+=residual[i]**2;}
    const beta=nextRz/rz;for(let i=0;i<n;i++)direction[i]=residual[i]/diagonal[i]+beta*direction[i];rz=nextRz;
  }
  let maximumCorrectionM=0;
  for(let i=0;i<n;i++){if(!Number.isFinite(heights[i]))throw new Error('Non-finite reference-informed road profile');maximumCorrectionM=Math.max(maximumCorrectionM,Math.abs(heights[i]-base[i]));}
  return { heights, metadata:{ source:'User-described grade directions; photo minimap position estimates', measured:false,
    assumedGrades:true, constraints:OBSERVED_GRADES, solverIterations:iterations, relativeResidual:Math.sqrt(residualSquared/Math.max(initialResidualSquared,1e-30)),
    maximumCorrectionM, originalTerrainGridPreserved:true,
    limitations:'Grade signs and relative steepness follow user observations. Numeric grades, camera-to-course positions and smooth transitions are estimates, not a pavement survey.' } };
}
