// Public nickname/time records; no account credentials are bundled in the game.
export const COURSE_ID = 'kaist-splits-v8';
export const RECORDS_ORIGIN = 'https://kaistcart-records.almondcrown19.chatgpt.site';

export function createRecordsClient(origin = RECORDS_ORIGIN, fetcher = fetch) {
  async function request(path, body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetcher(origin + path, {
        method: body ? 'POST' : 'GET', credentials: 'omit', signal: controller.signal,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      let data;
      try { data = await response.json(); } catch { throw new Error('The records server returned an invalid response. Please try again shortly.'); }
      if (!response.ok) {
        const error = new Error(data.error?.message || 'Could not connect to the records server.');
        error.retryable = response.status >= 500 || [408, 425, 429].includes(response.status);
        throw error;
      }
      return data;
    } catch (error) {
      if (error.name === 'AbortError' || error instanceof TypeError) throw new Error('Could not connect to the records server. Check your connection and try again.');
      throw error;
    } finally { clearTimeout(timeout); }
  }
  return {
    list: () => request('/api/leaderboard?course=' + encodeURIComponent(COURSE_ID)),
    start: name => request('/api/runs/start', { name, course: COURSE_ID, replayVersion: 1 }),
    inputs: (session, fromTick, inputs, final) => request('/api/runs/inputs', {
      runId: session.runId, token: session.token, replayVersion: session.replayVersion, fromTick, inputs,
      ...(final ? {final: true} : {}),
    }),
  };
}
