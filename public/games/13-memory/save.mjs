import { MODES, MAX_ATTEMPTS, MAX_ELAPSED_MS } from './engine.mjs';
export const STORAGE_KEY = 'simplegames.snack-pairs.v1';
export const THEMES = Object.freeze(['cream', 'meadow', 'evening']);
export const MAX_COMPLETIONS = 1000000;
export const defaults = () => ({ version: 1, settings: { mode: 'normal', theme: 'cream', muted: true }, modes: { easy: { completions: 0, best: null }, normal: { completions: 0, best: null } } });
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const integer = (v, low, high) => typeof v === 'number' && Number.isSafeInteger(v) && v >= low && v <= high;
export function validModeRecord(value, mode) {
  if (!object(value) || !integer(value.completions, 0, MAX_COMPLETIONS)) return false;
  if (value.completions === 0) return value.best === null;
  return object(value.best) && integer(value.best.attempts, MODES[mode].pairs, MAX_ATTEMPTS) && integer(value.best.elapsedMs, 1, MAX_ELAPSED_MS);
}
export function parseSave(raw) {
  const data = defaults();
  if (raw === null) return { data, warning: false };
  let input;
  try { input = JSON.parse(raw); } catch { return { data, warning: true }; }
  if (!object(input) || input.version !== 1) return { data, warning: true };
  let warning = false;
  const settings = object(input.settings) ? input.settings : {};
  if (typeof settings.mode === 'string' && Object.hasOwn(MODES, settings.mode)) data.settings.mode = settings.mode; else warning = true;
  if (typeof settings.theme === 'string' && THEMES.includes(settings.theme)) data.settings.theme = settings.theme; else warning = true;
  if (typeof settings.muted === 'boolean') data.settings.muted = settings.muted; else warning = true;
  for (const mode of Object.keys(MODES)) {
    const record = object(input.modes) ? input.modes[mode] : undefined;
    if (validModeRecord(record, mode)) data.modes[mode] = { completions: record.completions, best: record.best === null ? null : { attempts: record.best.attempts, elapsedMs: record.best.elapsedMs } }; else warning = true;
  }
  return { data, warning };
}
export function compareBest(candidate, best) {
  if (best === null) return 'new';
  if (candidate.attempts < best.attempts || candidate.attempts === best.attempts && candidate.elapsedMs < best.elapsedMs) return 'new';
  return candidate.attempts === best.attempts && candidate.elapsedMs === best.elapsedMs ? 'tie' : 'kept';
}
export function settleRecord(record, state) {
  if (state.phase !== 'success') return { record, comparison: null };
  const candidate = { attempts: state.attempts, elapsedMs: Math.max(1, Math.floor(state.activeElapsedMs)) };
  if (!validModeRecord({ completions: 1, best: candidate }, state.mode)) return { record, comparison: null };
  const comparison = compareBest(candidate, record.best);
  return { record: { completions: Math.min(MAX_COMPLETIONS, record.completions + 1), best: comparison === 'new' ? candidate : record.best }, comparison };
}
export function createStore(getStorage = () => globalThis.localStorage) {
  let storage, data = defaults(), warning = false;
  try { storage = getStorage(); const loaded = parseSave(storage.getItem(STORAGE_KEY)); data = loaded.data; warning = loaded.warning; } catch { warning = true; }
  const settled = new Set();
  const save = () => { try { if (!storage) throw new Error('Storage unavailable'); storage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { warning = true; } };
  return {
    snapshot: () => structuredClone(data),
    warning: () => warning,
    applySettings(patch) {
      const next = { ...data.settings };
      if (typeof patch.mode === 'string' && Object.hasOwn(MODES, patch.mode)) next.mode = patch.mode;
      if (typeof patch.theme === 'string' && THEMES.includes(patch.theme)) next.theme = patch.theme;
      if (typeof patch.muted === 'boolean') next.muted = patch.muted;
      if (Object.keys(next).every(k => next[k] === data.settings[k])) return false;
      data = { ...data, settings: next }; save(); return true;
    },
    settle(state) {
      if (state.phase !== 'success' || settled.has(state.roundId)) return null;
      const result = settleRecord(data.modes[state.mode], state);
      if (result.comparison === null) return null;
      settled.add(state.roundId);
      data = { ...data, modes: { ...data.modes, [state.mode]: result.record } };
      save(); return result.comparison;
    }
  };
}
