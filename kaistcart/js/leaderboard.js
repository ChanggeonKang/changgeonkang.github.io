// Public nickname/time records; no account credentials are bundled in the game.
export const COURSE_ID = 'kaist-accel100-v7';
export const RECORDS_ORIGIN = 'https://kaistcart-records.almondcrown19.chatgpt.site';

export function createRecordsClient(origin = RECORDS_ORIGIN, fetcher = fetch) {
  async function request(path, body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetcher(origin + path, {
        method: body ? 'POST' : 'GET', credentials: 'omit', signal: controller.signal,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      let data;
      try { data = await response.json(); } catch { throw new Error('The records server returned an invalid response. Please try again shortly.'); }
      if (!response.ok) throw new Error(data.error?.message || 'Could not connect to the records server.');
      return data;
    } catch (error) {
      if (error.name === 'AbortError' || error instanceof TypeError) throw new Error('Could not connect to the records server. Check your connection and try again.');
      throw error;
    } finally { clearTimeout(timeout); }
  }
  return {
    list: () => request('/api/leaderboard?course=' + encodeURIComponent(COURSE_ID)),
    start: name => request('/api/runs/start', { name, course: COURSE_ID }),
    finish: (session, timeMs, checkpoints) => request('/api/runs/finish', {
      runId: session.runId, token: session.token, timeMs, checkpoints,
    }),
  };
}
