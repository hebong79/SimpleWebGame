export const STORAGE_KEY = 'simplegames.gem-survey.v1';
export const LIMIT = 1_000_000_000;
export const MAX_BEST_MS = Number.MAX_SAFE_INTEGER;
export const THEMES = Object.freeze(['paper', 'forest', 'night']);
export const defaults = () => ({ version: 1, finished: 0, wins: 0, losses: 0, bestMs: null, theme: 'paper', muted: true });
const count = value => Number.isSafeInteger(value) && value >= 0 && value <= LIMIT;
const positiveTime = value => Number.isSafeInteger(value) && value >= 1;
const own = (value, key) => Object.hasOwn(value, key) ? value[key] : undefined;
export function validateRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || own(value, 'version') !== 1) return defaults();
  const result = defaults();
  const theme = own(value, 'theme'), muted = own(value, 'muted');
  if (typeof theme === 'string' && THEMES.includes(theme)) result.theme = theme;
  if (typeof muted === 'boolean') result.muted = muted;
  const finished = own(value, 'finished'), wins = own(value, 'wins'), losses = own(value, 'losses'), bestMs = own(value, 'bestMs');
  // A damaged v1 statistics tuple cannot erase independently valid settings.
  if (count(finished) && count(wins) && count(losses) && finished === wins + losses &&
      (wins === 0 ? bestMs === null : positiveTime(bestMs))) Object.assign(result, { finished, wins, losses, bestMs });
  return result;
}
export function settleRecord(record, outcome, elapsedMs) {
  if (typeof outcome !== 'string' || (outcome !== 'won' && outcome !== 'lost') || !positiveTime(elapsedMs) || record.finished >= LIMIT) return record;
  return { ...record, finished: record.finished + 1, wins: record.wins + (outcome === 'won' ? 1 : 0), losses: record.losses + (outcome === 'lost' ? 1 : 0), bestMs: outcome === 'won' && (record.bestMs === null || elapsedMs < record.bestMs) ? elapsedMs : record.bestMs };
}
export function createStorage(getStorage = () => window.localStorage) {
  let blocked = false, recovered = false;
  return {
    get blocked() { return blocked; },
    get recovered() { return recovered; },
    load() {
      try {
        const raw = getStorage().getItem(STORAGE_KEY);
        if (raw === null) return defaults();
        let parsed;
        try { parsed = JSON.parse(raw); } catch { recovered = true; return defaults(); }
        const record = validateRecord(parsed);
        recovered = JSON.stringify(record) !== JSON.stringify(parsed);
        return record;
      } catch { blocked = true; return defaults(); }
    },
    save(record) {
      try { getStorage().setItem(STORAGE_KEY, JSON.stringify(record)); return true; }
      catch { blocked = true; return false; }
    }
  };
}
