import { syncRacer } from './race-sim.js';
import { stabilizeVehicle } from './stabilize.js';
import { resolveDrivingBoundary } from './drivable-access.js';

export const RECOVERY_SECONDS = 2;

function clearPosition(pose, searchRadius, access) {
  const { x, z, th } = pose;
  const clear=(px,pz)=>access.canPlace(px,pz,th,pose.groundHint);
  if (clear(x, z)) return pose;
  for (let radius = .25; radius <= searchRadius; radius += .25) {
    for (let direction = 0; direction < 16; direction++) {
      const angle = th + direction * Math.PI / 8;
      const px = x + Math.sin(angle) * radius, pz = z + Math.cos(angle) * radius;
      if (clear(px, pz)) return { x: px, z: pz, th };
    }
  }
  return null;
}

/** Place the kart on a road or parking area open to cars. A selection with
 * insufficient space to fit the kart leaves the current pose intact. */
export function resetFreeDrive(player, pose, access = player.access, searchRadius = 8) {
  const { body } = player;
  if(!access) return false;
  const target = clearPosition(pose, searchRadius,access);
  if (!target) return false;
  player.access=access;
  body.reset(target.x, target.z, target.th, undefined, pose.groundHint);
  stabilizeVehicle(body);
  syncRacer(player);
  player.steer = 0;
  player.reverseHold = 0;
  player.flipT = 0;
  player.recoveryT = 0;
  player.recoveryRetry = 0;
  player.uprightHeading = target.th;
  return true;
}

/** Advance along the connected automobile surface, with swept vehicle contacts
 * at road edges, pedestrian entrances and real restricted gates. */
export function stepFreeDrive(player, dt, buttons) {
  const { body } = player;
  const steering = Number.isFinite(buttons?.steer)
    ? Math.max(-1, Math.min(1, buttons.steer))
    : Number(Boolean(buttons?.right)) - Number(Boolean(buttons?.left));
  player.steer += (steering - player.steer) * (1 - Math.exp(-dt * 7));
  player.reverseHold = buttons?.down && Math.abs(body.vf) < .7 ? player.reverseHold + dt : 0;
  const reversing = player.reverseHold > .35 || (buttons?.down && body.vf < -.3);
  const previous = { x: body.x, z: body.z, q:[...body.q], th:body.th };
  const impact = body.step(dt, {
    throttle: buttons?.up ? 1 : reversing ? -.45 : 0,
    brake: !buttons || (buttons.down && !reversing) ? 1 : 0,
    steer: player.steer,
    drift: Boolean(buttons?.drift),
  }) / body.parameters.mass;
  // Test the pose that will actually be drawn. Rounding after the clearance
  // check could leave a chassis corner on the forbidden side of a tangent
  // kerb and invalidate the following step's last clear position.
  stabilizeVehicle(body);
  const wallHit = resolveDrivingBoundary(body,previous,player.access);
  syncRacer(player);

  if (body.contacts > 0 && body.up > .65) player.uprightHeading = body.th;
  player.recoveryT = Math.max(0, player.recoveryT - dt);
  player.recoveryRetry = Math.max(0, player.recoveryRetry - dt);
  player.flipT = buttons && body.contacts > 0 && body.up < .25 ? Math.min(RECOVERY_SECONDS, player.flipT + dt) : 0;
  let recovered = false;
  if (player.flipT + 1e-9 >= RECOVERY_SECONDS && player.recoveryRetry === 0) {
    // A campus junction has no unique forward course direction. Keep the last
    // upright bearing, correcting the position only if the body needs clearance.
    recovered = resetFreeDrive(player, { x: body.x, z: body.z, th: player.uprightHeading, groundHint: body.y - body.rideHeight }, player.access, 2);
    if (recovered) player.recoveryT = 1.5;
    else player.recoveryRetry = .25;
  }
  return { impact, wallHit, recovered };
}
