// The yellow west-side refuge widens into the external driveway. Stations
// follow way 37972561 northward. Its edges were read from the overhead
// image at the registered November 813 panorama, at roughly 12 cm/pixel.
const profile=[[12.8,7.83,11.79],[17.2,4.29,9.72],[21.5,3.32,8.85],[27.4,3.49,7.85],
  [33.4,3.44,7.21],[39.7,3.31,6.37],[45.7,2.87,5.35],[56.9,3.07,5],[62.8,3.35,4.67],[65.3,3.84,4.2]];
function trim(points,signed){
  const out=[];
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],da=signed(a),db=signed(b);
    if(da>=0)out.push(a);
    if((da>=0)!==(db>=0)){const f=da/(da-db);out.push([a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f]);}
  }
  return out;
}
export function paintWestGwahak(index,face,quad,batch,yellow){
  for(const [road,way] of index.ways){
    if(road.id!==37972561)continue;
    for(const s of way.segments){
      for(let i=1;i<profile.length;i++){
        const [a,lo,hi]=profile[i-1],[b,nextLo,nextHi]=profile[i];
        const from=Math.max(a,s.start),to=Math.min(b,s.start+s.span);
        if(to<=from)continue;
        const section=t=>{
          const f=(t-a)/(b-a);
          return [lo+(nextLo-lo)*f,hi+(nextHi-hi)*f];
        };
        const [il,ol]=section(from),[ir,or]=section(to);
        const pave=poly=>{
          const pts=trim(poly,p=>road.width/2-.16-p[1]).map(([u,v])=>face(s,u-s.start,v,.032));
          for(let k=2;k<pts.length;k++)quad(batch,pts[0],pts[k-1],pts[k],pts[k],yellow);
        };
        for(const [left,right] of [[il,ir],[ol,or]])pave([[from,left-.065],[to,right-.065],[to,right+.065],[from,left+.065]]);
        const inside=[[from,il],[to,ir],[to,or],[from,ol]];
        const u=p=>p[0]+p[1]*.82;
        for(let stripe=Math.floor((from+il*.82)/1.80)*1.80;stripe<to+Math.max(ol,or)*.82+.2;stripe+=1.80){
          pave(trim(trim(inside,p=>u(p)-stripe),p=>stripe+.15-u(p)));
        }
      }
    }
  }
}
