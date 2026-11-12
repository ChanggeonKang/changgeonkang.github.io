// Checkpoint times are cumulative race-clock milliseconds, never wall-clock
// timestamps. The target is copied once when a run starts and remains fixed.
function validSplits(splits, count, partial = false) {
  if (!Array.isArray(splits) || !splits.length || (partial ? splits.length > count : splits.length !== count)) return false;
  let previous = 0;
  for (const value of splits) {
    if (!Number.isSafeInteger(value) || value <= previous) return false;
    previous = value;
  }
  return true;
}

export function snapshotLeader(value, checkpointCount = 32) {
  if (!Number.isInteger(checkpointCount) || checkpointCount < 1 || !value ||
      typeof value.name !== 'string' || !value.name.trim() ||
      !Number.isSafeInteger(value.timeMs) || value.timeMs <= 0 ||
      !validSplits(value.splitsMs, checkpointCount) || value.splitsMs.at(-1) !== value.timeMs) return null;
  return Object.freeze({
    name: value.name,
    timeMs: value.timeMs,
    splitsMs: Object.freeze([...value.splitsMs]),
  });
}

/** Positive differences mean slower than the reference at the same gate. */
export function compareSplit(ownSplitsMs, leader) {
  const reference = snapshotLeader(leader);
  if (!reference || !validSplits(ownSplitsMs, reference.splitsMs.length, true)) return null;
  const index = ownSplitsMs.length - 1;
  const elapsedMs = ownSplitsMs[index], leaderElapsedMs = reference.splitsMs[index];
  const ownSector = elapsedMs - (ownSplitsMs[index - 1] ?? 0);
  const leaderSector = leaderElapsedMs - (reference.splitsMs[index - 1] ?? 0);
  return {
    checkpoint: index + 1,
    gapMs: elapsedMs - leaderElapsedMs,
    sectorGapMs: ownSector - leaderSector,
    elapsedMs,
    leaderElapsedMs,
  };
}

/** Project onto the two segments beside the nearest unwrapped course sample.
 * Searching only those neighbours avoids jumping to a nearby crossing road.
 */
export function timingProgress(r, C) {
  const progress = r.prog;
  if (r.lost || !Number.isInteger(progress) || !Number.isFinite(r.x) || !Number.isFinite(r.z) ||
      !C || !Number.isInteger(C.n) || C.n < 2) return progress;
  const mod = value => ((value % C.n) + C.n) % C.n;
  let closest = Infinity, projected = progress;
  for (const start of [progress - 1, progress]) {
    const a = mod(start), b = mod(start + 1);
    const ax = C.x?.[a], az = C.z?.[a], bx = C.x?.[b], bz = C.z?.[b];
    if (![ax, az, bx, bz].every(Number.isFinite)) continue;
    const dx = bx - ax, dz = bz - az, lengthSquared = dx * dx + dz * dz;
    if (lengthSquared === 0) continue;
    const fraction = Math.max(0, Math.min(1, ((r.x - ax) * dx + (r.z - az) * dz) / lengthSquared));
    const distance = (r.x - ax - fraction * dx) ** 2 + (r.z - az - fraction * dz) ** 2;
    if (distance < closest) { closest = distance; projected = start + fraction; }
  }
  return projected;
}
