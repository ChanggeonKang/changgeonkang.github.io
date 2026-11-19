// Explicit game recovery after a sustained grounded rollover. This module does
// not own race time, progress, checkpoints, or rendering/input state.
import {Vehicle} from './vehicle-physics.js';
import {resolveWalls} from './race-sim.js';
import {courseBarrierFootprint,courseBarrierContactDepth,courseContainsBody,resolveCourseBarrier} from './course-barriers.js';

export const ROLLOVER_RECOVERY_SECONDS = 2;
const MAX_SEPARATION = 2, SEARCH_STEP = .05;
const mod = (v,n) => ((v%n)+n)%n;

/** Call only during active simulation. Any loss of ground contact or recovery
 * of the body angle breaks the continuous two-second interval. */
export function advanceRolloverTimer(body, elapsed, dt) {
  if (!(body.contacts > 0 && body.up < .25)) return 0;
  if (!Number.isFinite(dt) || dt <= 0) return Math.max(0, Math.min(ROLLOVER_RECOVERY_SECONDS, elapsed || 0));
  const next = Math.max(0, elapsed || 0) + dt;
  return next + 1e-10 >= ROLLOVER_RECOVERY_SECONDS ? ROLLOVER_RECOVERY_SECONDS : next;
}

function nearestLocalIndex(body,C,progress) {
  const center = Math.round(progress), radius = Math.min(25, Math.floor(C.n/2));
  let best = center, distance = Infinity;
  for (let i=center-radius;i<=center+radius;i++) {
    const k=mod(i,C.n), d=(C.x[k]-body.x)**2+(C.z[k]-body.z)**2;
    if (d<distance-1e-10 || (Math.abs(d-distance)<1e-10 && Math.abs(i-progress)<Math.abs(best-progress))) {distance=d;best=i;}
  }
  return best;
}

function buildingOverlap(body,surfaceAt) {
  const polygon=courseBarrierFootprint(body);
  if(surfaceAt(body.x,body.z)===9) return true;
  // Use the conservative character hull, not just the narrower tyre chassis.
  // The runtime collision map has one-metre cells; 20cm edge and interior
  // samples also catch a cell lying between its corners.
  for(let i=0;i<polygon.length;i++) {
    const a=polygon[i],b=polygon[(i+1)%polygon.length],steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.2));
    for(let j=0;j<=steps;j++){const t=j/steps;if(surfaceAt(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t)===9)return true;}
    for(let j=1;j<steps;j++){const t=j/steps,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
      const radial=Math.max(1,Math.ceil(Math.hypot(x-body.x,z-body.z)/.2));
      for(let r=1;r<radial;r++)if(surfaceAt(body.x+(x-body.x)*r/radial,body.z+(z-body.z)*r/radial)===9)return true;
    }
  }
  return false;
}

/** Reset upright at the same x/z and local forward course heading. If the new
 * footprint overlaps a boundary, choose the nearest locally sampled clear pose
 * (<=2m, refined below 1mm along each candidate ray). No course/grid relocation.
 * Failure leaves the real vehicle untouched; callers may retry after a delay.
 */
export function recoverOverturned(body,C,progress,surfaceAt=body.surfaceAt) {
  if (!(body.contacts>0 && body.up<.25)) return {recovered:false,reason:'not_grounded_overturned',displacementM:0};
  if (!Number.isFinite(progress) || !C || !(C.n>1)) return {recovered:false,reason:'invalid_course',displacementM:0};
  const origin={x:body.x,z:body.z},index=nearestLocalIndex(body,C,progress),k=mod(index,C.n);
  const heading=Math.atan2(C.tx[k],C.tz[k]);
  const probe=new Vehicle({groundAt:body.groundAt,surfaceAt,parameters:body.parameters});
  const clear=()=>probe.up>.6 && courseContainsBody(probe,C) && courseBarrierContactDepth(probe,C)<1e-8 && !buildingOverlap(probe,surfaceAt);
  const at=(x,z)=>{probe.reset(x,z,heading);return clear();};
  let target=null;
  if(at(origin.x,origin.z)) target={...origin,distance:0};
  else {
    // Existing resolvers provide a useful local separating direction. Probe
    // mutations never touch the real vehicle, and their displacement is bounded
    // before it can become a recovery candidate.
    for(let i=0;i<4;i++) {
      resolveWalls(probe,{x:probe.x,z:probe.z,q:[...probe.q]},surfaceAt);
      resolveCourseBarrier(probe,{x:probe.x,z:probe.z,q:[...probe.q]},C,index);
    }
    const cx=probe.x-origin.x,cz=probe.z-origin.z,correctedDistance=Math.hypot(cx,cz);
    const directions=[];
    if(correctedDistance>1e-8)directions.push([cx/correctedDistance,cz/correctedDistance]);
    // Include exact along/across-course directions as well as world axes.
    directions.push([C.tx[k],C.tz[k]],[-C.tx[k],-C.tz[k]],[C.tz[k],-C.tx[k]],[-C.tz[k],C.tx[k]]);
    for(let i=0;i<64;i++){const angle=i*Math.PI/32;directions.push([Math.cos(angle),Math.sin(angle)]);}
    if(correctedDistance<=MAX_SEPARATION && at(origin.x+cx,origin.z+cz))target={x:origin.x+cx,z:origin.z+cz,distance:correctedDistance};
    const maximum=target?Math.min(MAX_SEPARATION,Math.ceil(target.distance/SEARCH_STEP)*SEARCH_STEP):MAX_SEPARATION;
    for(let radius=SEARCH_STEP;radius<=maximum+1e-9;radius+=SEARCH_STEP) {
      let found=false;
      for(const [dx,dz] of directions) {
        if(!at(origin.x+dx*radius,origin.z+dz*radius))continue;
        let low=Math.max(0,radius-SEARCH_STEP),high=radius;
        for(let i=0;i<7;i++){const middle=(low+high)/2;if(at(origin.x+dx*middle,origin.z+dz*middle))high=middle;else low=middle;}
        const distance=high;
        if(!target||distance<target.distance)target={x:origin.x+dx*distance,z:origin.z+dz*distance,distance};
        found=true;
      }
      if(found)break;
    }
  }
  if(!target||!at(target.x,target.z))return{recovered:false,reason:'no_local_clear_pose',index,heading,displacementM:0};
  body.reset(target.x,target.z,heading);
  return{recovered:true,reason:target.distance?'local_separation':'same_position',index,heading,displacementM:target.distance,x:body.x,z:body.z};
}
