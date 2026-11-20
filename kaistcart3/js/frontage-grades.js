import {riverbankCut} from './gapcheon-bank.js';

// The 30 m elevation raster gives the E4 entrance a 4.7 m rise from the
// kerb and the W13 parking aisle 3.6 m of crossfall. Four-direction Naver
// views show continuous gently graded paving at both sites. The slopes are
// estimates tied to nearby open-ground elevations relative to the map datum.
function fade(distance,margin){
  const t=Math.max(0,Math.min(1,1-distance/margin));
  return t*t*(3-2*t);
}
function band(n,low,high,margin){
  return fade(Math.max(low-n,n-high,0),margin);
}
function gradedCarriageway(x,z,original,tx,tz,start,end,half,height,grade){
  const along=x*tx+z*tz,across=x*tz-z*tx;
  const blend=band(along,start,end,18)*band(across,-half,half,9);
  return original+(height+grade*along-.012*Math.abs(across)-original)*blend;
}
// Both arms of the W3/W13 block-paved parking aisle are visible in 2cZ7rq,
// -BNzgiL and 7znqEr. Each point has a relative height on the same terrace.
const westAisle=[[-305.8,400.9,8.98],[-328.2,369.3,9.08],[-280.4,338,8.76],[-226.1,356.4,7.83]];
// The east wooded lane bends around the bank before its straight.
const woodlandLane=[[548.64,-331.63,20.17],[572.25,-364.23,19.71],[580.85,-375.78,19.12],
  [586.74,-381.67,18.79],[591.54,-382.51,18.69],[606.20,-382.00,18.71],[736.60,-381.19,19.10],[756.0,-380.93,19.0]];
// Interpolate the open-road longitudinal profile; the 30 m raster samples
// the wooded bank to the west and tilts a hundred metres of carriageway.
// The documented side entrances join the same crowned running surface.
const westAvenue=[[-524.9,-372.5,20.94],[-523.1,-386.8,21.71],[-520.9,-416,22.86],
  [-520.8,-449.9,23.8],[-520.7,-480.6,22.98],[-520.6,-506.5,23.17],[-520.4,-548.9,23.18],
  [-520.3,-585,22.91],[-520.2,-616.5,22.50],[-520,-647,22.24],[-519.9,-677,20.14]];
function roadTerrace(x,z,original,points,half,margin,crown=0){
  let best=(half+margin)**2,height=original;
  for(let i=1;i<points.length;i++){
    const [ax,az,ay]=points[i-1],[bx,bz,by]=points[i];
    const dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));
    const distance=(x-ax-t*dx)**2+(z-az-t*dz)**2;
    if(distance<best){best=distance;height=ay+(by-ay)*t;}
  }
  const offset=Math.sqrt(best);
  return original+(height-crown*Math.min(half,offset)-original)*fade(Math.max(0,offset-half),margin);
}
export function frontageGrade(x,z,original){
  // Registered four-direction views separate the following carriageways
  // from the cut slopes immediately outside their kerbs. The drainage crown
  // and running grades are estimates tied to the nearby road elevations.
  if(x>-568&&x<-496&&z>-682&&z<-373){
    // Widened four-lane Gwahak-ro, November 813/825, both directions.
    // A second narrow driveway runs alongside the east verge near the
    // tennis grounds. Preserve its separate grade and its turning bay.
    const margin=x>-521?13-10*band(z,-481,-388,17):13+22*band(z,-649,-598,18);
    const terrace=roadTerrace(x,z,original,westAvenue,7.7,margin,.012);
    // Retain the downhill tie-in to the private car park beyond the north
    // junction. This section is farther from the registered crossing view.
    const northernTieIn=1-.72*fade(Math.max(0,z+586),17);
    original+=(terrace-original)*band(z,-650,-398,25)*northernTieIn;
  }else if(x>560&&x<755&&z>-105&&z<54){
    // East Gwahak-ro: ZigXpl and wrlsrw show the lane and the hillside beyond its fence.
    original=gradedCarriageway(x-677.69,z+2.69,original,.7881,.6155,-88,23,8.0,12.95,.021);
  }else if(x>531&&x<772&&z>-399&&z<-315){
    // sMOW95 and SV9_mf: the tree-covered bank is on the south side of the road.
    original=roadTerrace(x,z,original,woodlandLane,4.30,9.0);
  }else if(x>634&&x<777&&z>40&&z<171){
    // Daehak-ro: curb-to-curb asphalt is visible in the November leaf-off views.
    original=gradedCarriageway(x-704.90,z-103.5,original,.7741,-.6331,-58,3,8.0,8.65,-.011);
  }
  // E19: pXxg_Y and 7soDrL8 show the hardstanding ending at the stairs.
  if(x>434&&x<506&&z>145&&z<217)
    original=gradedCarriageway(x-465.81,z-184.81,original,.8658,-.5004,-2,18,4.5,9.24,-.017);
  // The short link from the playing-field parking to Gwahak-ro is paved
  // to the bollard line in j8RCm3q. Retain the rising wooded bank beyond.
  if(x>518&&x<577&&z>-130&&z<-74)
    original=gradedCarriageway(x-553.0,z+101.5,original,.804,-.594,-13,4,4.1,11.84,.036);
  if(x>-320&&x<-210&&z>-217&&z<-168){
    // Parking polygon 504216155 opens onto the south side of N7-1.
    // The registered May 2023 panorama t1cfUCF shows level EV bays and
    // wheel stops on both sides; the raster has a false 21% crossfall.
    const lot=band(x,-300,-230,17)*band(z,-204.5,-181,11);
    const terrace=17.70-.015*(x+278)-.010*(z+187.2);
    original+=(terrace-original)*lot;
  }
  if(x>-264 && x<-148 && z>-630 && z<-550){
    // From the upper N20 dormitory lane the roofs of the photovoltaic
    // shelters are below eye level. The 30 m terrain grid carries the hill
    // straight through those parking stalls. Keep the lane and its bicycle
    // verge on the hill; fit the lower car park to N29's eastern approach.
    const offsetFromLane=x+235.2-.52*(z+562.4);
    const bank=1-fade(Math.max(0,offsetFromLane-5.4),9);
    const inside=band(x,-248,-163,14)*band(z,-613,-566,14);
    const terrace=17.8-.006*(x+195)+.009*(z+585);
    return original+(terrace-original)*bank*inside;
  }
  if(x>100 && x<378 && z>80 && z<378){
    // Way 77338232, E4/E3 entrances, eastern parking and bicycle shelters.
    // DNCv3UI, vqCPmgP and WNAIQBQ face along/across the same street.
    const dx=x-222.94,dz=z-197.18,s=.54464*dx+.83867*dz,q=-.83867*dx+.54464*dz;
    const weight=band(s,-46,122,38)*band(q,-40,43,36);
    return original+(11.25-.016*s+.007*q-original)*weight;
  }
  if(x>-321 && x<-100 && z>250 && z<451){
    // The W13 sign, solar carports and W2-1 service frontage are on a
    // shared parking terrace (2IrQXc7 and g6FoUO6). The wooded hill beyond
    // the northwestern bays is visible in both panoramas.
    const dx=x+200.25,dz=z-332.23,s=-.96126*dx-.27564*dz,q=.27564*dx-.96126*dz;
    const main=band(s,-66,19,19)*band(q,-66,24,13);
    const westernBays=band(s,13,72,15)*band(q,-38,-19,12);
    const weight=Math.max(main,westernBays);
    original+=(8.12+.004*s+.013*q-original)*weight;
    // The lane between the white childcare wing and the gym is level with
    // their shared car park. 2IrQXc7 and 7znqEr show the exposed wooded
    // bank behind its west kerb, so this terrace stops at the driveway.
    const gx=x+196.5,gz=z-306.5,along=.838*gx-.546*gz,across=.546*gx+.838*gz;
    const entrance=band(along,-8,45,10)*band(across,-8.5,16,8);
    original+=(8.52+.012*along-.009*across-original)*entrance;
  }
  if(x>-395 && x<-229 && z>252 && z<412){
    // W3's recessed wings and the porte-cochère open onto one court.
    // S5Z_0un shows the first-storey sills above the grass on both sides.
    // Carry the court through the grass up to the entire southern facade:
    // the 30 m elevation raster otherwise raises the east wing by 4 metres.
    // The rear of the building and woodland remain on the hillside.
    const dx=x+307.25,dz=z-325.40,s=-.58779*dx-.80902*dz,q=.80902*dx-.58779*dz;
    const weight=band(s,-34,30,19)*band(q,-53,36,18);
    original+=(9.22+.006*s+.004*q-original)*weight;
  }
  if(x>-370 && x<-184 && z>342 && z<474){
    // 5val-Uc and g6FoUO6 look at opposite ends of the same road. The
    // KISTI forecourt, its pavement and the long grass island meet its
    // kerbs at a shallow grade. The raster runs through the office roofs.
    const roadZ=x<-287?391.6+(-289.1-x)*.61:x<-242?389.65:393.7+.37*(x+232);
    const street=band(x,-331,-226,23)*band(z-roadZ,-11,11,16);
    const gx=x+260,gz=z-413,along=.84*gx-.54*gz,across=.54*gx+.84*gz;
    const court=band(along,-28,27,18)*band(across,-15,17,22);
    const dx=x+200.25,dz=z-332.23,s=-.96126*dx-.27564*dz,q=.27564*dx-.96126*dz;
    const island=band(s,21,80,13)*band(q,-52,-30,11);
    const grade=7.48-.019*(x+232)+.008*(z-394);
    original+=(grade-original)*Math.max(street,court,island);
  }
  if(x>-342&&x<-213&&z>325&&z<414)original=roadTerrace(x,z,original,westAisle,7.75,5.05);
  if(x>-166 && x<-36 && z>457 && z<594){
    // Only the south and west arms of W1-1 parking polygon 974328889.
    // January 2022 panoramas 4xCtiBN and E2_Kf-z show these paved bays
    // against the long south wing and the west service end respectively.
    // The November orthophoto confirms their L-shaped connection.
    const dx=x+134,dz=z-547,s=.97815*dx+.20791*dz,q=.20791*dx-.97815*dz;
    const south=band(s,-6,62,17)*band(q,-10,14,16);
    const west=band(s,-6,14,17)*band(q,-4,55,17);
    original+=(9.52+.006*s+.011*q-original)*Math.max(south,west);
  }
  return original-riverbankCut(x,z);
}
