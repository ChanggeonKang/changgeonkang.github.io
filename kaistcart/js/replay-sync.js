const motionFields = ['x', 'y', 'z', 'vx', 'vy', 'vz', 'q', 'angularVelocity', 'contacts',
  'airT', 'roof', 'steer', 'wallGripDelay', 'driftActive'];
const driverFields = ['steer', 'prog', 'flipT', 'recoveryRetry'];
const lapFields = ['previousProgress', 'previousElapsedMs', '_checkpoints', '_splitsMs', 'completed', 'invalidReason'];

// Serialize just once at each packet boundary so later frames cannot mutate
// the prediction. Wheel angles and per-tick contact forces are visual outputs.
function predictionKey(body, driver, lap, reverseHold, raceT) {
  const flight = body.flight && Object.keys(body.flight).sort().map(key => [key, body.flight[key]]);
  return JSON.stringify([
    raceT, reverseHold, ...driverFields.map(key => driver[key]), ...lapFields.map(key => lap[key]),
    ...motionFields.map(key => body[key]), body.wheels.map(wheel => wheel.omega), flight,
  ]);
}

export function replayPrediction(player, lap, reverseHold, raceT) {
  return predictionKey(player.body, player, lap, reverseHold, raceT);
}

export function matchesReplay(state, prediction) {
  return prediction === predictionKey(state.body, state.driver, state.lap, state.driver.reverseHold, state.raceT);
}

export function restoreReplayState(state, player, lap) {
  const body = player.body, saved = state.body;
  for (const key of [...motionFields, 'load']) body[key] = structuredClone(saved[key]);
  if (saved.flight) body.flight = structuredClone(saved.flight);
  for (let i = 0; i < body.wheels.length; i++) {
    const {x, z, ...motion} = saved.wheels[i];
    Object.assign(body.wheels[i], motion);
  }
  for (const key of driverFields) player[key] = state.driver[key];
  for (const key of lapFields) lap[key] = structuredClone(state.lap[key]);
}
