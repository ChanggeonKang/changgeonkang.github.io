// The 30 m DEM merges both Gapcheon cycleways into the deck of KAIST Bridge.
// OSM ways 44279307 and 108322109 run under the road on opposite banks.
// Keep the mapped bridge and motor approaches on their surveyed deck datum.
// The 2.6 m lowering is a visual estimate, not a surveyed clearance.
function fade(n,flat,reach){
  const t=Math.max(0,Math.min(1,(Math.abs(n)-flat)/(reach-flat)));
  return 1-t*t*(3-2*t);
}
export function riverbankCut(x,z){
  if(x<447 || x>715 || z<252 || z>545)return 0;
  const west=x<570,mx=west?502.08:659.36,mz=west?305.36:490.08;
  const dx=west?-.79346:-.67919,dz=west?.60862:.73396;
  const sx=x-mx,sz=z-mz,s=sx*dx+sz*dz,q=sx*dz-sz*dx;
  if(Math.abs(s)>=53||Math.abs(q)>=10)return 0;
  return (2.65+q*(west?-.088:.064))*fade(s,14,53)*fade(q,3.8,10);
}
