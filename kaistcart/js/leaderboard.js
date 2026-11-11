// Public nickname/time records; no account credentials are bundled in the game.
export const COURSE_ID = 'kaist-timeattack-v2';
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
      try { data = await response.json(); } catch { throw new Error('기록 서버의 응답을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.'); }
      if (!response.ok) throw new Error(data.error?.message || '기록 서버에 연결하지 못했습니다.');
      return data;
    } catch (error) {
      if (error.name === 'AbortError' || error instanceof TypeError) throw new Error('기록 서버에 연결하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.');
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
