function blendBand(v,low,high,feather){
  const t=Math.max(0,1-Math.max(low-v,v-high,0)/feather);
  return t*t*(3-2*t);
}

// The raster includes the KI Building roof: it placed the middle of the
// lakeside wall at 23.3 m beside a 6.3 m water level. October panoramas from
// Duck Pond Bridge show a low shore, continuous paving and a visible lobby.
// Fit the promenade to open ground, rising gently towards the east street.
// Only cut the high raster cells. The vehicle bridge is west of this patch.
export function duckPondGrade(x,z,original){
  if(x<39||x>239||z<91||z>306)return original;
  const dx=x-118.8,dz=z-191.3,along=.5515*dx+.8342*dz,inland=.8342*dx-.5515*dz;
  const weight=blendBand(along,-46,72,23)*blendBand(inland,-36,47,18);
  if(!weight)return original;
  const rise=Math.max(0,Math.min(1,(inland+23)/92));
  const grade=7.64+3.59*rise+.002*Math.max(-55,Math.min(80,along));
  return original-Math.max(0,original-grade)*weight;
}
