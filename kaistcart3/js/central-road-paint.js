// Geometry traced from the November 2026 four-way panoramas and the overhead
// view. Heights come from the same sloped road sections as the lane lines.
export function isSportsRedLane(id,x,z){
  if(id!==1524928894)return false;
  const station=(x+63.8)*.81-(z+179.6)*.586;
  return station>14.1 && station<78.6;
}

export function paintCampusWarnings(index,face,quad,batch,colour,yellow){
  // Paired approach diamonds in the northbound lanes by W8 and a single
  // warning in front of E3-5. The latter street has only one lane each way.
  const diamonds=[
    {road:979941424,x:-68.2,z:68.0,offsets:[-1.6,-4.75]},
    {road:1255160783,x:-103.2,z:-153.8,offsets:[1.59,4.76]},
    {road:77338232,x:291.1,z:302.8,offsets:[1.38]}
  ];
  for(const d of diamonds){
    const h=index.nearest(d.x,d.z,4,r=>r.id===d.road);
    if(!h)continue;
    for(const offset of d.offsets){
      const diamond=(length,width)=>[[length,0],[0,width],[-length,0],[0,-width]]
        .map(([u,v])=>face(h.s,h.along+u,offset+v,.031));
      const outside=diamond(2.25,.65),inside=diamond(1.74,.47);
      for(let i=0;i<4;i++){
        const j=(i+1)%4;
        quad(batch,outside[i],outside[j],inside[j],inside[i],colour);
      }
    }
  }
  // Bm6XX9H looks northeast at the N3 crossing. The inside lane continues
  // straight, the curb lane turns right and both finish at one stop bar.
  const crossing=index.nearest(-87.4,-164.4,6,r=>r.id===1255160783);
  if(crossing){
    const pt=(u,v)=>face(crossing.s,crossing.along-u,v,.031);
    const fill=(a,b,c,d)=>quad(batch,pt(...a),pt(...b),pt(...c),pt(...d),colour);
    fill([3.55,.24],[3.79,.24],[3.79,6.05],[3.55,6.05]);
    fill([-2.4,1.42],[.92,1.42],[.92,1.68],[-2.4,1.68]);
    fill([.84,.99],[2.19,1.55],[.84,2.12],[.96,1.55]);
    fill([-2.37,4.42],[.12,4.42],[.02,4.70],[-2.37,4.70]);
    fill([.06,4.42],[.91,5.14],[.69,5.32],[-.03,4.70]);
    fill([1.12,4.75],[1.34,5.71],[.34,5.62],[.76,5.21]);
  }
  // White hatching flanks the axial asphalt drive in the E14 court.
  // Project each independent corner so it follows the paving across joins.
  function e14(u,v){
    const norm=.837**2+.547**2,x=(.837*u+.547*v)/norm,z=(-.547*u+.837*v)/norm;
    const h=index.nearest(x,z,9,r=>r.id===220224567);
    if(!h)return null;
    const offset=(x-h.s.a[0])*h.s.dz-(z-h.s.a[1])*h.s.dx;
    const along=(x-h.s.a[0])*h.s.dx+(z-h.s.a[1])*h.s.dz;
    return face(h.s,along,offset,.035);
  }
  for(const sign of [-1,1]){
    const stripe=(a,b,c,d)=>{
      const pts=[a,b,c,d].map(([side,station])=>e14(-21.65+sign*side,station));
      if(pts.every(Boolean))quad(batch,...pts,colour);
    };
    for(const [start,end] of [[-175.7,-161.4],[-156.3,-142.9],[-137.8,-122.3]]){
      for(let t=start;t<end;t+=.74){
        const next=Math.min(t+.74,end);
        stripe([3.16,t],[3.29,t],[3.29,next],[3.16,next]);
        if(t+.71<end)stripe([3.26,t],[4.06,t+.53],[4.06,t+.72],[3.26,t+.18]);
      }
    }
  }
  // Faded reserved strip down the hexagonal paving in the E2-1 parking aisle
  // (s7pyDY9, both bearings). The bays remain reachable from either side.
  const centre=index.nearest(266,344,4,r=>r.id===504188967);
  if(!centre)return;
  const s=centre.s,ink=yellow.clone().lerp(colour,.25);
  const stroke=(a,b,c,d,width)=>{
    const length=Math.hypot(c-a,d-b);
    if(!length)return;
    const du=-(d-b)*width/(2*length),dv=(c-a)*width/(2*length);
    const slices=Math.ceil(length/1.15);
    for(let i=0;i<slices;i++){
      const u=a+(c-a)*i/slices,v=b+(d-b)*i/slices;
      const p=a+(c-a)*(i+1)/slices,q=b+(d-b)*(i+1)/slices;
      quad(batch,face(s,u+du,v+dv,.038),face(s,p+du,q+dv,.038),
        face(s,p-du,q-dv,.038),face(s,u-du,v-dv,.038),ink);
    }
  };
  for(const side of [-.79,.79])stroke(4,side,35.4,side,.073);
  for(const u of [4,19.7,35.4])stroke(u,-.79,u,.79,.085);
  // An arrow and a two-line English stencil read from each end of the aisle.
  const glyphs={
    N:[[0,1,0,0],[0,0,1,1],[1,1,1,0]],O:[[0,0,1,0],[1,0,1,1],[1,1,0,1],[0,1,0,0]],
    P:[[0,1,0,0],[0,0,1,0],[1,0,1,.48],[1,.48,0,.48]],
    A:[[0,1,.5,0],[.5,0,1,1],[.22,.58,.78,.58]],R:[[0,1,0,0],[0,0,1,0],[1,0,1,.48],[1,.48,0,.48],[.4,.48,1,1]],
    K:[[0,1,0,0],[1,0,0,.53],[.38,.33,1,1]],I:[[.5,0,.5,1]],
    G:[[1,0,0,0],[0,0,0,1],[0,1,1,1],[1,1,1,.50],[1,.50,.48,.50]]
  };
  for(const [start,sign] of [[4,1],[35.4,-1]]){
    const move=(u,v)=>[start+sign*u,sign*v];
    const line=(u,v,p,q,width)=>stroke(...move(u,v),...move(p,q),width);
    line(2.1,0,4,0,.13);line(2.1,0,2.8,-.32,.13);line(2.1,0,2.8,.32,.13);
    for(const [word,at,cell] of [['NO',7.5,.38],['PARKING',10.2,.17]]){
      for(const [i,k] of [...word].entries()){
        const left=(i-word.length/2)*cell+.02;
        for(const [x,y,p,q] of glyphs[k])line(at+y*1.18,left+x*cell*.76,at+q*1.18,left+p*cell*.76,.034);
      }
    }
  }
}
