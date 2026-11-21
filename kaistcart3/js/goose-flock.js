import {CatmullRomCurve3,Vector3} from '../lib/three.module.min.js';
import {createGooseModels} from './goose-models.js';

// A circuit on the Duck Pond headland, north of the bridge. It crosses the
// avenue at the mapped crossing (8,206) and returns over the service lane.
const shorelineWalk=[[41,215],[29,212],[17,209],[8,206.1],[.4,203.3],
  [-3.6,207.5],[-2,214.3],[5.4,219.7],[14.6,222.4],[23.3,222],
  [30.1,220.6],[38.7,218.3],[47.5,220.1],[50,217.4],[48,212.4]];
// Stone plinth and the trunks of the prominent pines and maples in lakeGarden.
const fixtures=[[55.2,216.1,3.75],[35.6,221.1,.42],[45.3,224.4,.35],
  [27.1,195.6,.48],[23.4,199.8,.40],[28.7,202,.40],[31,217.4,.24],
  [36,225,.24],[39.5,228.1,.28],[42.6,204,.35],[57.4,204.2,.25]];
const count=17,gravity=9.81;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const angleDelta=(from,to)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));

function walkingRoute(){
  const curve=new CatmullRomCurve3(shorelineWalk.map(([x,z])=>new Vector3(x,0,z)),true);
  const length=curve.getLength(),points=curve.getSpacedPoints(480);
  return (distance,across,target)=>{
    const u=((distance%length+length)%length)/length*480;
    const a=points[Math.floor(u)],b=points[Math.floor(u)+1],t=u%1;
    const dx=b.x-a.x,dz=b.z-a.z,span=Math.hypot(dx,dz);
    target.x=a.x+dx*t+dz/span*across;
    target.z=a.z+dz*t-dx/span*across;
    target.heading=Math.atan2(dx,dz);
  };
}

// The swept kart footprint is a rounded capsule around its longitudinal
// axis. Interpolate its height at closest contact so a jump can clear a bird.
function touchesBird(bird,beforeX,beforeZ,previous,kart){
  const s=Math.sin(kart.th),c=Math.cos(kart.th);
  const ax=(beforeX-previous.x)*c-(beforeZ-previous.z)*s;
  const az=(beforeX-previous.x)*s+(beforeZ-previous.z)*c;
  const bx=(bird.x-kart.x)*c-(bird.z-kart.z)*s;
  const bz=(bird.x-kart.x)*s+(bird.z-kart.z)*c;
  if(Math.min(ax,bx)>.96||Math.max(ax,bx)<-.96||Math.min(az,bz)>1.58||Math.max(az,bz)<-1.58)return false;
  const dx=bx-ax,dz=bz-az,den=dx*dx+dz*dz;
  function contact(t){
    t=clamp(t,0,1);
    const x=ax+t*dx,z=az+t*dz,end=z-clamp(z,-.59,.62);
    if(x*x+end*end>.96**2)return false;
    const base=previous.base+t*(kart.base-previous.base);
    return base<bird.y+.77 && base+1.1>bird.y+.12;
  }
  return contact(0)||contact(1)||(Math.abs(dx)>1e-8&&contact(-ax/dx))||
    (den>1e-8&&(contact((-ax*dx+(-.59-az)*dz)/den)||contact((-ax*dx+(.62-az)*dz)/den)));
}

export function createGooseFlock(scene,world,groundAt){
  const route=walkingRoute(),models=createGooseModels(scene,count);
  const birds=Array.from({length:count},(_,i)=>{
    const row=Math.floor((i+1)/2),side=i===0?0:i%2?1:-1;
    return {x:0,y:0,z:0,heading:0,stride:i*2.39,flap:i*.91,flight:0,tilt:0,bank:0,
      mode:'walking',lag:row*1.44+(side<0?.42:0),side:side*(.89+.15*Math.sin(i*2.2))+.32*Math.sin(row),
      phase:i*2.39,vx:0,vy:0,vz:0,rearm:0};
  });
  const G=world.G,target={};
  let time=0,station=0,lastKart=null,wasNear=false,seen=false;
  function dry(x,z){
    // The flock ranges over the lawns, paths and streets around this bank.
    if(x< -10 || x>60 || z<195 || z>230)return false;
    const k=(Math.floor(z)-G.z0)*G.w+Math.floor(x)-G.x0;
    if(G.d[k]===8 || G.d[k]===9)return false;
    for(const [tx,tz,r] of fixtures)
      if((x-tx)**2+(z-tz)**2<(r+.22)**2)return false;
    return true;
  }
  function slot(b){
    const weave=.22*Math.sin(time*.69+b.phase)+.12*Math.sin(time*.27+b.phase*1.7);
    route(station-b.lag+.19*Math.sin(time*.48+b.phase),b.side+weave,target);
    // Move the formation around an occasional individual tree trunk.
    for(const [x,z,r] of fixtures){
      const dx=target.x-x,dz=target.z-z,d=Math.hypot(dx,dz),clear=r+.36;
      if(d<clear){target.x=x+dx/(d||1)*clear;target.z=z+dz/(d||1)*clear;}
    }
  }
  function groundFormation(){
    for(const b of birds){
      slot(b);b.x=target.x;b.z=target.z;b.y=groundAt(b.x,b.z);b.heading=target.heading;
      b.mode='walking';b.flight=0;b.tilt=0;b.bank=0;b.rearm=0;
    }
    separate(Infinity);
    models.update(birds);
  }
  // Individuals give each other room at tight turns and where a returning
  // bird rejoins its row. They need more clearance from beak to tail than
  // across their shoulders. A low-flying bird has right of way on landing.
  function separate(dt){
    const limit=1.8*dt;
    for(const b of birds){b.shifted=false;b.avoidX=Math.sin(b.heading);b.avoidZ=Math.cos(b.heading);}
    for(let pass=0;pass<4;pass++){
      let adjusted=false;
      for(let i=0;i<birds.length;i++)for(let j=0;j<i;j++){
        const a=birds[i],b=birds[j],airA=a.mode==='airborne',airB=b.mode==='airborne';
        if((airA||airB)&&Math.abs(a.y-b.y)>.8)continue;
        const dx=a.x-b.x,dz=a.z-b.z,d2=dx*dx+dz*dz;
        if(d2>=.96**2)continue;
        const d=Math.sqrt(d2),ux=d>1e-6?dx/d:Math.cos(a.phase),uz=d>1e-6?dz/d:Math.sin(a.phase);
        const alongA=ux*a.avoidX+uz*a.avoidZ,alongB=ux*b.avoidX+uz*b.avoidZ;
        const overlap=.65+.15*(alongA*alongA+alongB*alongB)-d;
        if(overlap<.0001)continue;
        const share=airA&&!airB?.16:airB&&!airA?.84:.5;
        let da=Math.min(limit,share*overlap),db=Math.min(limit,(1-share)*overlap);
        if(!dry(a.x+ux*da,a.z+uz*da)){da=0;db=Math.min(limit,overlap);}
        if(!dry(b.x-ux*db,b.z-uz*db)){
          db=0;const more=Math.min(limit,overlap);
          if(dry(a.x+ux*more,a.z+uz*more))da=more;
        }
        if(da){a.x+=ux*da;a.z+=uz*da;a.shifted=true;}
        if(db){b.x-=ux*db;b.z-=uz*db;b.shifted=true;}
        adjusted||=da>0||db>0;
      }
      if(!adjusted)break;
    }
    for(const b of birds)if(b.shifted&&b.mode!=='airborne')b.y=groundAt(b.x,b.z);
  }
  function launch(b,kart,speed){
    const along=Math.atan2(kart.vx,kart.vz);
    const side=Math.sign((b.x-kart.x)*Math.cos(along)-(b.z-kart.z)*Math.sin(along))||Math.sign(Math.sin(b.phase+.27));
    const heading=along+side*(.13+.13*(1+Math.sin(b.phase))*.5),dx=Math.sin(heading),dz=Math.cos(heading);
    b.vy=3.1+Math.min(4.9,speed*.23);
    const airTime=2*b.vy/gravity,horizontal=2+Math.min(9,speed*.39);
    const travel=(1-Math.exp(-.6*airTime))/.6;
    const reach=travel*horizontal;
    let room=0;
    for(let d=.35;d<=reach+.35;d+=.35){
      if(!dry(b.x+dx*d,b.z+dz*d))break;
      room=d;
    }
    const v=Math.min(horizontal,room/travel);
    b.vx=dx*v;b.vz=dz*v;b.mode='airborne';b.airTime=0;b.launchHeading=heading;b.launchSide=side;
    b.rearm=1.3;
  }
  function airborne(b,dt){
    const drag=Math.exp(-.6*dt),advance=(1-drag)/.6;
    const x=b.x+b.vx*advance,z=b.z+b.vz*advance;
    if(dry(x,z)){b.x=x;b.z=z;}else{b.vx=0;b.vz=0;}
    b.vx*=drag;b.vz*=drag;b.y+=b.vy*dt-.5*gravity*dt*dt;b.vy-=gravity*dt;
    b.airTime+=dt;b.flight=Math.min(1,b.airTime*9);b.flap+=dt*(13.5+1.5*Math.sin(b.phase));
    b.heading+=angleDelta(b.heading,b.launchHeading)*(1-Math.exp(-6*dt));
    b.tilt=clamp(b.vy*.065,-.34,.47)*b.flight;
    b.bank=b.launchSide*.19*Math.sin(Math.min(1,b.airTime*2.5)*Math.PI);
    const floor=groundAt(b.x,b.z);
    if(b.vy<=0 && b.y<=floor){
      b.y=floor;b.mode='returning';b.rearm=1.3;b.bank=0;
    }
  }
  function walk(b,dt){
    slot(b);
    const dx=target.x-b.x,dz=target.z-b.z,d=Math.hypot(dx,dz);
    const catchup=b.mode==='returning',move=Math.min(d,dt*(catchup?2.7:2.1));
    const oldX=b.x,oldZ=b.z;
    if(d>.0001){
      let heading=Math.atan2(dx,dz);
      if(dry(b.x+Math.sin(heading)*move,b.z+Math.cos(heading)*move)){
        b.x+=dx/d*move;b.z+=dz/d*move;
      }else{
        // Walk around the obstruction on the side nearer this bird's slot.
        const sign=b.side>=0?1:-1;
        for(const turn of [.60,-.60,1.15,-1.15,1.65,-1.65]){
          const angle=heading+turn*sign,x=b.x+Math.sin(angle)*move,z=b.z+Math.cos(angle)*move;
          if(dry(x,z)){b.x=x;b.z=z;break;}
        }
      }
      if(b.x!==oldX || b.z!==oldZ)heading=Math.atan2(b.x-oldX,b.z-oldZ);
      b.heading+=angleDelta(b.heading,heading)*(1-Math.exp(-6.5*dt));
    }
    if(catchup&&d<.38)b.mode='walking';
    b.y=groundAt(b.x,b.z);b.stride+=Math.hypot(b.x-oldX,b.z-oldZ)*6.2;
    b.flight=Math.max(0,b.flight-2.5*dt);b.tilt*=Math.exp(-9*dt);b.flap+=dt*10*b.flight;
  }
  groundFormation();
  function resetKartContact(){lastKart=null;}
  function update(dt,player){
    if(!(dt>0)||!player?.body)return;
    dt=Math.min(dt,.12);
    const near=(player.x-24)**2+(player.z-215)**2<190**2;
    if(!near){
      if(seen){time+=dt;station+=dt*(1.18+.17*Math.sin(time*.28));}
      models.group.visible=false;wasNear=false;resetKartContact();return;
    }
    if(!wasNear){if(seen)groundFormation();wasNear=true;seen=true;}
    const kart={x:player.x,z:player.z,th:player.th,base:player.body.y-player.body.rideHeight,
      vx:player.vx,vz:player.vz};
    const speed=Math.hypot(kart.vx,kart.vz);
    const travelled=lastKart?Math.hypot(kart.x-lastKart.x,kart.z-lastKart.z):0;
    const canHit=lastKart && speed>.55 && travelled>.001 && travelled<=Math.max(1.8,(speed+6)*dt*1.65);
    time+=dt;station+=dt*(1.18+.17*Math.sin(time*.28));
    for(const b of birds){
      const beforeX=b.x,beforeZ=b.z;
      b.rearm=Math.max(0,b.rearm-dt);
      if(b.mode==='airborne')airborne(b,dt);
      else{
        walk(b,dt);
        if(canHit&&!b.rearm&&touchesBird(b,beforeX,beforeZ,lastKart,kart))launch(b,kart,speed);
      }
    }
    separate(dt);
    lastKart=kart;models.update(birds);
  }
  return {birds,update,resetKartContact};
}
