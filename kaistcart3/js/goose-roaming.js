import {physicalBarrier,rasterPolygon,rasterSegment} from './explore-surfaces.js';

// Grazing clearings around the actual shore, in walking order around each bank.
// Links are choices of destination; the ground between them determines the walk.
const clearings={
  carillon:[41,214],pineLawn:[30,181],northwest:[30,148],northTip:[50,134],
  westLawn:[-11,210],westVerge:[-9,242],westInlet:[-13,271],southTip:[-5,316],
  southMeadow:[25,301],southGrove:[78,291],lowerLawn:[82,308],eastMeadow:[109,264],
  eastBank:[127,239],eastPath:[114,194],northeast:[94,156],upperLawn:[86,146]
};
const links=[
  ['carillon','pineLawn','northwest','northTip','upperLawn','northeast','eastPath','eastBank',
    'eastMeadow','southGrove','southMeadow','southTip','westInlet','westVerge','westLawn','carillon'],
  ['westLawn','pineLawn'],['westLawn','northwest'],['northwest','upperLawn'],
  ['westLawn','westInlet'],['westVerge','southTip'],['southMeadow','lowerLawn','southGrove'],
  ['lowerLawn','eastMeadow'],['southGrove','eastBank'],['eastPath','upperLawn']
];
const neighbours=new Map(Object.keys(clearings).map(name=>[name,new Set()]));
for(const path of links)for(let i=1;i<path.length;i++){
  neighbours.get(path[i]).add(path[i-1]);neighbours.get(path[i-1]).add(path[i]);
}
const pondId=-20786142,shoreRange=44,terrainCache=new WeakMap();
const length=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);

function pondTerrain(world){
  const cacheKey=world.G,cached=terrainCache.get(cacheKey);
  if(cached)return cached;
  const shore=world.D.areas.find(a=>a.id===pondId);
  const xs=shore.p.map(p=>p[0]),zs=shore.p.map(p=>p[1]);
  const x0=Math.floor(Math.min(...xs))-shoreRange-2,z0=Math.floor(Math.min(...zs))-shoreRange-2;
  const w=Math.ceil(Math.max(...xs))+shoreRange+3-x0,h=Math.ceil(Math.max(...zs))+shoreRange+3-z0;
  const grid={x0,z0,w,h,d:new Uint8Array(w*h)},G=world.G;
  const stamp=(a,b,r,value)=>rasterSegment(grid,a,b,r,k=>{grid.d[k]=value;});
  function shoreline(radius,value){
    for(let i=0;i<shore.p.length;i++)stamp(shore.p[i],shore.p[(i+1)%shore.p.length],radius,value);
  }
  shoreline(shoreRange,1);
  for(const area of world.D.areas)if(area.k==='water'||area.k==='parking')rasterPolygon(grid,area,0);
  shoreline(1.2,0); // Include the curved bank between cell centres and the actual bridge deck.
  for(const building of world.D.buildings)rasterPolygon(grid,building,0);
  for(const fence of world.D.barriers)if(physicalBarrier(fence))
    for(let i=1;i<fence.p.length;i++)stamp(fence.p[i-1],fence.p[i],1.05,0);
  for(const road of world.D.roads)if(road.bridge&&road.drivable)
    for(let i=1;i<road.p.length;i++)stamp(road.p[i-1],road.p[i],road.width/2+3,0);
  for(const [x,z,r] of [[55.2,216.1,3.75],...(world.pondPlantings||[])])stamp([x,z],[x,z],r+.85,0);
  for(const [x,z] of world.canopy?.crowns||[]){
    if(x>=x0&&x<x0+w&&z>=z0&&z<z0+h)stamp([x,z],[x,z],1.05,0);
  }
  function surface(x,z){return G.d[(Math.floor(z)-G.z0)*G.w+Math.floor(x)-G.x0];}
  for(let k=0;k<grid.d.length;k++)if(grid.d[k]&&surface(x0+k%w,z0+Math.floor(k/w))>=8)grid.d[k]=0;
  // Reserve room on both sides of the leader so the pair following it can turn,
  // with extra shoreline clearance even where the mapped road overrides water.
  const wide=new Uint8Array(w*h);
  for(let j=2;j<h-2;j++)for(let i=2;i<w-2;i++){
    const k=j*w+i;if(!grid.d[k])continue;
    let open=true;
    for(let z=-2;z<=2&&open;z++)for(let x=-2;x<=2;x++)if(!grid.d[k+z*w+x]){open=false;break;}
    wide[k]=Number(open);
  }
  function index(x,z){
    const i=Math.floor(x)-x0,j=Math.floor(z)-z0;
    return i>=0&&j>=0&&i<w&&j<h?j*w+i:-1;
  }
  const dry=(x,z)=>grid.d[index(x,z)]===1;
  const stride=2,cols=Math.ceil(w/stride),rows=Math.ceil(h/stride),total=cols*rows;
  const point=k=>[x0+(k%cols)*stride+.5,z0+Math.floor(k/cols)*stride+.5];
  const open=new Uint8Array(total),road=new Uint8Array(total);
  for(let k=0;k<total;k++){
    const [x,z]=point(k);open[k]=wide[index(x,z)]||0;road[k]=Number(surface(x,z)===2);
  }
  const dirs=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
  const steps=dirs.map(([dx,dz])=>dx+dz*cols),exits=new Uint8Array(total);
  for(let k=0;k<total;k++)if(open[k]){
    const col=k%cols,row=Math.floor(k/cols);
    for(let dir=0;dir<dirs.length;dir++){
      const [dx,dz]=dirs[dir],i=col+dx,j=row+dz;
      if(i<0||i>=cols||j<0||j>=rows||!open[k+steps[dir]])continue;
      if(dx&&dz&&(!open[k+dx]||!open[k+dz*cols]))continue;
      if(wide[index(x0+(col+dx*.5)*stride+.5,z0+(row+dz*.5)*stride+.5)])exits[k]|=1<<dir;
    }
  }
  // A strip between closely planted trees can be open at a single spot with
  // no room for the flock to enter. Only select sites in the connected habitat.
  const component=new Int16Array(total);let label=0,largest=0,capacity=0;
  for(let k=0;k<total;k++)if(exits[k]&&!component[k]){
    const wave=[k];component[k]=++label;
    for(let i=0;i<wave.length;i++){
      const at=wave[i];
      for(let dir=0;dir<dirs.length;dir++)if(exits[at]&(1<<dir)){
        const n=at+steps[dir];
        if(!component[n]){component[n]=label;wave.push(n);}
      }
    }
    if(wave.length>capacity){capacity=wave.length;largest=label;}
  }
  function nearest(x,z,lawn){
    const col=Math.round((x-x0-.5)/stride),row=Math.round((z-z0-.5)/stride);
    let best=-1,bestDist=Infinity;
    for(let j=row-10;j<=row+10;j++)for(let i=col-10;i<=col+10;i++){
      const k=j*cols+i;
      if(i<0||i>=cols||j<0||j>=rows||component[k]!==largest)continue;
      const p=point(k),dist=(p[0]-x)**2+(p[1]-z)**2;
      if(dist<bestDist&&(!lawn||surface(...p)===0)){best=k;bestDist=dist;}
    }
    return best;
  }
  function corridor(a,b){
    const steps=Math.ceil(length(a,b)/.65);
    for(let i=0;i<=steps;i++){
      const t=steps?i/steps:0;
      if(!wide[index(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t)])return false;
    }
    return true;
  }
  // Shortest dry route on a two-metre grid. Grass is cheaper than the road,
  // so encounters tend to be crossings rather than walks along a traffic lane.
  function path(start,end){
    if(start<0||end<0)return null;
    const costs=new Uint16Array(total).fill(65535),came=new Int32Array(total);
    const ex=end%cols,ez=Math.floor(end/cols);
    const estimate=k=>{
      const dx=Math.abs(k%cols-ex),dz=Math.abs(Math.floor(k/cols)-ez);
      return 10*Math.max(dx,dz)+4*Math.min(dx,dz);
    };
    const buckets=[],first=estimate(start);buckets[first]=[start];costs[start]=0;
    for(let f=first;f<buckets.length;f++){
      const bucket=buckets[f];
      while(bucket?.length){
        const k=bucket.pop();
        if(costs[k]+estimate(k)!==f)continue;
        if(k===end){
          const cells=[point(end)];
          for(let at=end;at!==start;){at=came[at];cells.push(point(at));}
          cells.reverse();
          const smooth=[cells[0]];
          for(let i=0;i<cells.length-1;){
            let j=Math.min(i+5,cells.length-1);
            while(j>i+1&&!corridor(cells[i],cells[j]))j--;
            smooth.push(cells[j]);i=j;
          }
          // Round the turn, preserving the dry corridor even at the waterline.
          const bends=[smooth[0]];
          for(let i=1;i<smooth.length-1;i++){
            const a=smooth[i-1],b=smooth[i],c=smooth[i+1],span=Math.min(3,length(a,b)/2,length(b,c)/2);
            const pull=p=>{const t=span/length(p,b);return [b[0]+(p[0]-b[0])*t,b[1]+(p[1]-b[1])*t];};
            const enter=pull(a),leave=pull(c);
            if(corridor(enter,leave))bends.push(enter,[(enter[0]+2*b[0]+leave[0])/4,(enter[1]+2*b[1]+leave[1])/4],leave);
            else bends.push(b);
          }
          if(smooth.length>1)bends.push(smooth.at(-1));return bends;
        }
        for(let dir=0;dir<dirs.length;dir++){
          if(!(exits[k]&(1<<dir)))continue;
          const n=k+steps[dir],cost=costs[k]+(dir>=4?14:10)+(road[k]+road[n])*9;
          if(cost>=costs[n])continue;
          costs[n]=cost;came[n]=k;(buckets[cost+estimate(n)]??=[]).push(n);
        }
      }
    }
    return null;
  }
  const result={dry,nearest,path,point,surface};
  terrainCache.set(cacheKey,result);return result;
}

export function createPondWalk(world,random=Math.random){
  const ground=pondTerrain(world),trail=[];
  let end=ground.nearest(54,207,true),station=0,origin='carillon',destination='westLawn';
  let visits=0,pause=0,pace=1,phase=random()*Math.PI*2,waiting=false;
  const visited=new Map([['carillon',0]]);
  function append(points){
    for(const [x,z] of points){
      const last=trail.at(-1),d=last?Math.hypot(x-last.x,z-last.z):0;
      if(!last||d>.001)trail.push({x,z,s:(last?.s||0)+d});
    }
  }
  function extend(x,z,lawn){
    const next=ground.nearest(x,z,lawn),points=ground.path(end,next);
    if(!points)return false;
    append(points);end=next;return true;
  }
  // Spawn a complete flock with its tail already on the carillon lawn. The
  // northern crossing leads out to several banks instead of back to the start.
  extend(40,213,true);extend(8,206.1,false);extend(...clearings.westLawn,true);
  station=Math.min(14,trail.at(-1).s);
  function nextLeg(){
    visited.set(destination,++visits);
    const options=[...neighbours.get(destination)].map(name=>({
      name,score:(visits-(visited.get(name)??-2))+random()*4-(name===origin?100:0)
    })).sort((a,b)=>b.score-a.score);
    for(const {name} of options){
      const [x,z]=clearings[name],next=ground.nearest(x+(random()-.5)*7,z+(random()-.5)*7,true);
      const points=ground.path(end,next);
      if(!points||points.length<2)continue;
      const total=points.reduce((sum,p,i)=>sum+(i?length(points[i-1],p):0),0);
      // A pinched shore or a closed passage must not turn a neighbouring meadow
      // into a detour all the way around the pond.
      if(total>length(ground.point(end),ground.point(next))*2.65+12)continue;
      append(points);origin=destination;destination=name;end=next;return;
    }
  }
  function sample(s,across,target){
    let lo=0,hi=trail.length-1;
    while(hi-lo>1){const mid=(lo+hi)>>1;if(trail[mid].s>s)hi=mid;else lo=mid;}
    const a=trail[lo],b=trail[hi],d=b.s-a.s,t=Math.min(1,Math.max(0,(s-a.s)/d));
    const dx=(b.x-a.x)/d,dz=(b.z-a.z)/d;
    target.x=a.x+(b.x-a.x)*t+dz*across;target.z=a.z+(b.z-a.z)*t-dx*across;
    target.heading=Math.atan2(dx,dz);
  }
  function advance(dt,time){
    if(pause>0){pause-=dt;pace=0;return;}
    if(waiting){waiting=false;nextLeg();}
    const remaining=trail.at(-1).s-station;
    const cruise=1.28+.18*Math.sin(time*.16+phase)+.095*Math.sin(time*.39+phase*.5);
    const target=Math.min(cruise,Math.sqrt(1.6*Math.max(0,remaining)));
    pace+=Math.max(-dt*.85,Math.min(dt*.66,target-pace));
    station+=Math.min(remaining,dt*pace);
    if(remaining<.035){
      station=trail.at(-1).s;pace=0;waiting=true;
      // A grazing stop is long enough for a car to arrive. Finish crossing
      // with the last pair before letting the whole flock stop for a while.
      let vergeClear=true;
      for(let lag=0;lag<=13&&vergeClear;lag+=1.5){
        for(const across of [-1.3,0,1.3]){
          const p={};sample(station-lag,across,p);
          if(ground.surface(p.x,p.z)===2){vergeClear=false;break;}
        }
      }
      pause=vergeClear?5+random()*11:0;
      // Keep only the tail of the last approach for the trailing birds.
      while(trail.length>2&&trail[1].s<station-23)trail.shift();
    }
  }
  return {dry:ground.dry,onGrass:(x,z)=>ground.surface(x,z)===0,advance,slot:(lag,across,out)=>sample(station-lag,across,out),
    get resting(){return waiting&&pause>0;}};
}
