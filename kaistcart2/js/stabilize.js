// Canonicalize motion after each tick to limit browser math-library roundoff.
// The grid is much smaller than the tyre and collision solver tolerances.
const round = value => Math.round(value * 1e7) / 1e7 || 0;
export function stabilizeVehicle(body) {
  body.x = round(body.x); body.y = round(body.y); body.z = round(body.z);
  body.vx = round(body.vx); body.vy = round(body.vy); body.vz = round(body.vz);
  body.steer = round(body.steer);
  if (body.flight?.active) {
    body.flight.heading = round(body.flight.heading);
    body.flight.pitch = round(body.flight.pitch);
    body.flight.bank = round(body.flight.bank);
  }
  for (let i = 0; i < 4; i++) body.q[i] = round(body.q[i]);
  for (let i = 0; i < 3; i++) body.angularVelocity[i] = round(body.angularVelocity[i]);
  for (const wheel of body.wheels) wheel.omega = round(wheel.omega);
}
