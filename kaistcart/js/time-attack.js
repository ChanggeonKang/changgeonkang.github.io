// Pure time-attack progress bookkeeping. Progress is an UNWRAPPED course-sample
// index, updated once per physics step; rendering frame cadence is irrelevant.
// This detects accidental shortcuts/teleports, not a malicious modified client.
export class LapTracker {
  constructor(n, { checkpointCount = 32, maxForwardStep = 5 } = {}) {
    if (!Number.isFinite(n) || n <= 0) throw new RangeError('Course length must be positive and finite.');
    if (!Number.isInteger(checkpointCount) || checkpointCount < 1) throw new RangeError('Checkpoint count must be a positive integer.');
    if (!Number.isFinite(maxForwardStep) || maxForwardStep <= 0) throw new RangeError('Maximum progress step must be positive and finite.');
    this.n = n;
    this.checkpointCount = checkpointCount;
    this.maxForwardStep = maxForwardStep;
    this.reset();
  }

  get checkpoints() { return [...this._checkpoints]; }
  get valid() { return this.invalidReason === null; }

  reset() {
    this.previousProgress = 0;
    this._checkpoints = [];
    this.completed = false;
    this.invalidReason = null;
    return this;
  }

  /** Returns persistent completion state; callers should emit a finish event once.
   * Backward travel never credits gates. A skipped forward segment invalidates
   * the current attempt permanently until reset(), including skips between gates.
   */
  advance(progress) {
    if (this.completed) return true;
    if (!this.valid) return false;
    if (!Number.isFinite(progress)) {
      this.invalidReason = 'non_finite_progress';
      return false;
    }
    const previous = this.previousProgress, delta = progress - previous;
    if (delta > this.maxForwardStep + 1e-9) {
      this.invalidReason = 'forward_progress_skip';
      return false;
    }
    this.previousProgress = progress;
    if (delta <= 0) return false;

    while (this._checkpoints.length < this.checkpointCount) {
      const index = this._checkpoints.length;
      const gate = (index + 1) * this.n / this.checkpointCount;
      if (previous >= gate || progress < gate) break;
      this._checkpoints.push(index);
    }
    this.completed = this._checkpoints.length === this.checkpointCount && progress >= this.n;
    return this.completed;
  }
}

/** Normalize a display name without truncating or silently removing characters.
 * Accept Hangul, ASCII letters/digits, spaces, underscore, period and hyphen.
 * The backend should apply the same checks independently before saving a score.
 */
export function normalizeName(value) {
  if (typeof value !== 'string') return { valid: false, name: '', error: '이름을 입력해 주세요.' };
  const name = value.normalize('NFC').trim().replace(/ +/g, ' ');
  if (name.length === 0) return { valid: false, name, error: '이름을 입력해 주세요.' };
  if ([...name].length > 20) return { valid: false, name, error: '이름은 20자 이하로 입력해 주세요.' };
  if (!/^[\p{Script=Hangul}A-Za-z0-9 _.\-]+$/u.test(name)) {
    return { valid: false, name, error: '한글, 영문, 숫자, 공백, _, ., -만 사용할 수 있습니다.' };
  }
  return { valid: true, name, error: null };
}
