// Estimated from the opposed November 2026 views at the bicycle verge and
// the taped east entrance. Coordinates are game metres east and south.
export const n29Parking={x:-220.2,z:-570.1,angle:.057,length:72.8,depth:5.55};
const cos=Math.cos(n29Parking.angle),sin=Math.sin(n29Parking.angle);
export const n29ParkingPoint=(u,v)=>[n29Parking.x+cos*u-sin*v,n29Parking.z+sin*u+cos*v];
const {length,depth}=n29Parking;
export const n29ParkingOutline=[[-.69,-37.08],[58.4,-37.08],[58.4,-20.9],[length+.65,-20.9],
  [length+.65,-10.4],[length+4.0,-10.4],[length+4.0,depth/2+.46],[-.69,depth/2+.46]].map(p=>n29ParkingPoint(...p));
