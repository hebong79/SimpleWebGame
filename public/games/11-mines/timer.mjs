// Time is sampled only at valid play boundaries. Rendering cannot advance it.
export function createTimer(now = () => performance.now()) {
  let total = 0, since = null, final = null;
  const read = () => Math.max(0, total + (since === null ? 0 : Math.max(0, now() - since)));
  return {
    start() { if (since === null && final === null) since = now(); },
    pause() { total = read(); since = null; },
    finish() { if (final === null) { total = read(); since = null; final = Math.max(1, Math.floor(total)); } return final; },
    read() { return final ?? Math.floor(read()); },
    reset() { total = 0; since = null; final = null; }
  };
}
