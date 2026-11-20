// timeMs is cumulative elapsed time from the start to the selected checkpoint.
export function checkpointRows(board, name, timeMs) {
  if (!board || !Array.isArray(board.timesMs) || !Array.isArray(board.top) ||
      !Number.isSafeInteger(timeMs) || timeMs <= 0) return [];
  // Earlier posted times win a tie. The full list gives the driver's exact
  // position even when hundreds of people finished outside the visible ten.
  let low = 0, high = board.timesMs.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (board.timesMs[mid] <= timeMs) low = mid + 1;
    else high = mid;
  }
  const own = {name, rank:low + 1, timeMs, own:true};
  const rows = board.top.slice(0, 10).map((entry, index) => ({
    name:entry.name, timeMs:entry.timeMs, rank:index + 1 + Number(index >= low), own:false,
  }));
  if (low < 10) {
    rows.splice(low, 0, own);
    return rows.slice(0, 10);
  }
  return [...rows, own];
}

export function attachCheckpointTower(panel, {time, gap}) {
  const heading = panel.querySelector('.tower-heading'), position = panel.querySelector('.tower-position');
  const list = panel.querySelector('ol'), nodes = new Map();
  const reduceMotion = matchMedia('(prefers-reduced-motion:reduce)');
  let lastBoard = null, lastCheckpoint = 0, lastTime = null, lastName = '';
  function newRow() {
    const row = document.createElement('li');
    for (const part of ['rank','name','time']) {
      const span = document.createElement('span');
      span.className = 'tower-' + part;
      row.appendChild(span);
    }
    return row;
  }
  function clear() {
    lastBoard = null; lastCheckpoint = 0; lastTime = null; lastName = '';
    panel.hidden = true;
    nodes.clear(); list.replaceChildren();
  }
  return function update(board, checkpoint, name, timeMs) {
    if (!board || !checkpoint || !(timeMs > 0)) {
      if (!panel.hidden) clear();
      return;
    }
    if (board === lastBoard && lastCheckpoint === checkpoint && lastTime === timeMs && lastName === name) return;
    const rows = checkpointRows(board, name, timeMs), me = rows.find(row => row.own);
    if (!me) { clear(); return; }
    const animate = !panel.hidden && !reduceMotion.matches;
    const before = new Map();
    if (animate) for (const [key, node] of nodes) before.set(key, node.getBoundingClientRect().top);
    heading.textContent = 'Checkpoint ' + String(checkpoint).padStart(2, '0') + ' / 32';
    position.textContent = 'P' + me.rank;
    const retained = new Set();
    for (const entry of rows) {
      const key = entry.own ? '' : entry.name.normalize('NFC').toLowerCase();
      retained.add(key);
      const node = nodes.get(key) ?? newRow();
      node.classList.toggle('own', entry.own);
      node.classList.toggle('beyond', entry.own && entry.rank > 11);
      node.children[0].textContent = entry.rank;
      node.children[1].textContent = entry.name;
      node.children[2].textContent = entry.own ? time(timeMs) : gap(entry.timeMs - timeMs, '');
      if (entry.own) node.setAttribute('aria-current', 'true');
      nodes.set(key, node);
      list.appendChild(node);
    }
    for (const [key, node] of nodes) if (!retained.has(key)) { node.remove(); nodes.delete(key); }
    panel.hidden = false;
    if (animate) {
      for (const [key, node] of nodes) {
        node.getAnimations().forEach(animation => animation.cancel());
        const oldTop = before.get(key);
        const travel = oldTop === undefined ? 8 : oldTop - node.getBoundingClientRect().top;
        if (travel) node.animate([
          {transform:'translateY(' + travel + 'px)', opacity:oldTop === undefined ? 0 : 1},
          {transform:'translateY(0)', opacity:1},
        ], {duration:340, easing:'cubic-bezier(.2,.75,.25,1)'});
      }
    }
    lastBoard = board; lastCheckpoint = checkpoint; lastName = name; lastTime = timeMs;
  };
}
