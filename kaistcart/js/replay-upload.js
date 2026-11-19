export const FINISH_GRACE_TICKS = 240;

export function inputMask(keys) {
  return (keys.up ? 1 : 0) | (keys.down ? 2 : 0) | (keys.left ? 4 : 0)
    | (keys.right ? 8 : 0) | (keys.drift ? 16 : 0);
}

function runs(bytes, length) {
  const inputs = [];
  for (let i = 0; i < length; i++) {
    const last = inputs[inputs.length - 1];
    if (last && last[1] === bytes[i]) last[0]++;
    else inputs.push([1, bytes[i]]);
  }
  return inputs;
}

// The animation loop only records a byte. Encoding and network I/O run after
// the current frame. Keep an unacknowledged packet intact for exact retries.
export class ReplayUpload {
  constructor(session, client, changed) {
    if (session.replayVersion !== 1 || !Number.isSafeInteger(session.chunkTicks)
      || session.chunkTicks < 1 || session.chunkTicks > 65536) {
      throw new Error('This replay version has changed. Reload the game and try again.');
    }
    this.session = session;
    this.client = client;
    this.changed = changed;
    this.buffer = new Uint8Array(session.chunkTicks);
    this.used = 0;
    this.total = 0;
    const durationMs = Date.parse(session.expiresAt) - Date.parse(session.startedAt);
    this.maxTicks = durationMs > 0 ? Math.floor(durationMs * 240 / 1000) : 2 * 3600 * 240;
    this.confirmed = 0;
    this.pending = [];
    this.sending = false;
    this.closed = false;
    this.terminal = false;
    this.disposed = false;
    this.failures = 0;
    this.timer = null;
    this.error = null;
    this.result = null;
  }

  capture(mask, final = false) {
    if (this.disposed || this.closed || this.terminal) return;
    this.buffer[this.used++] = mask;
    this.total++;
    final ||= this.total >= this.maxTicks;
    if (this.used < this.buffer.length && !final) return;
    this.closed = final;
    this.pending.push({fromTick: this.total - this.used, length: this.used, bytes: this.buffer, final});
    this.buffer = final ? null : new Uint8Array(this.session.chunkTicks);
    this.used = 0;
    if (!this.sending && this.timer === null && !this.error) queueMicrotask(() => this.sendPending());
  }

  retry() {
    if (this.disposed || this.terminal) return;
    clearTimeout(this.timer);
    this.timer = null;
    this.error = null;
    void this.sendPending();
  }

  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
    this.pending.length = 0;
    this.buffer = null;
  }

  async sendPending() {
    if (this.sending || this.disposed || this.terminal) return;
    this.sending = true;
    try {
      while (this.pending.length && !this.disposed && !this.terminal) {
        const packet = this.pending[0];
        packet.inputs ??= runs(packet.bytes, packet.length);
        const result = await this.client.inputs(this.session, packet.fromTick, packet.inputs, packet.final);
        if (this.disposed) return;
        if (result.status === 'finished' || result.status === 'invalid') {
          if (result.status === 'finished' && (result.ranked !== true || !Number.isSafeInteger(result.run?.timeMs) || result.run.timeMs <= 0)) {
            throw new Error('The server could not confirm a ranked finish.');
          }
          this.terminal = true;
          this.result = result;
          this.pending.length = 0;
          this.buffer = null;
        } else {
          if (result.status !== 'running' || result.nextTick !== packet.fromTick + packet.length) {
            throw new Error('The server returned an unexpected replay position.');
          }
          this.pending.shift();
          this.confirmed = result.nextTick;
          if (packet.final) {
            this.terminal = true;
            this.result = {status: 'invalid'};
          }
        }
        this.error = null;
        this.failures = 0;
        this.changed(this);
      }
    } catch (error) {
      if (this.disposed) return;
      this.error = error;
      if (error.retryable === false) {
        this.terminal = true;
        this.pending.length = 0;
        this.buffer = null;
      } else {
        this.failures++;
        const delay = Math.min(30000, 1000 * 2 ** Math.min(5, this.failures - 1));
        // Keep the queue moving if the player loses the connection mid-race.
        // On the results screen the retry button remains available as well.
        if (!this.closed || this.failures < 5) this.timer = setTimeout(() => this.retry(), delay);
      }
      this.changed(this);
    } finally {
      this.sending = false;
    }
  }
}
