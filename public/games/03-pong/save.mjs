export const SAVE_KEY = 'neon-rally.pong.v1';
export const THEMES = Object.freeze({
  paddle: ['pulse', 'prism', 'mono'],
  ball: ['core', 'diamond', 'comet'],
  court: ['grid', 'orbit', 'lines'],
});
const count = value => Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000 ? value : 0;
export function normalizeSave(value) {
  const source = value && typeof value === 'object' && value.version === 1 ? value : {};
  const stats = {};
  for (const difficulty of ['easy', 'normal']) {
    stats[difficulty] = { wins: count(source.stats?.[difficulty]?.wins), bestRally: count(source.stats?.[difficulty]?.bestRally) };
  }
  const themes = {};
  for (const [part, choices] of Object.entries(THEMES)) {
    themes[part] = choices.includes(source.themes?.[part]) ? source.themes[part] : choices[0];
  }
  return { version: 1, difficulty: source.difficulty === 'easy' ? 'easy' : 'normal', muted: source.muted === true, themes, stats };
}
export function loadSave(storage) {
  try {
    const raw = storage.getItem(SAVE_KEY);
    return { data: normalizeSave(raw === null ? null : JSON.parse(raw)), available: true };
  } catch { return { data: normalizeSave(null), available: false }; }
}
export function writeSave(storage, data) {
  try { storage.setItem(SAVE_KEY, JSON.stringify(normalizeSave(data))); return true; }
  catch { return false; }
}
