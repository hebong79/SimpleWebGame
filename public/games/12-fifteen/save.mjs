import {MODE_IDS, validMode} from './puzzles.mjs';
export const STORAGE_KEY = 'simplegames.number-postbox.v1';
export const THEMES = Object.freeze(['cream', 'meadow', 'evening']);
export const MAX_WINS = 1_000_000_000;
const integer = v => Number.isSafeInteger(v) && v >= 1;
export function defaults() {
  return {version: 1, muted: true, theme: 'cream', records: Object.fromEntries(MODE_IDS.map(id => [id, {wins: 0, bestMoves: null, bestMs: null}]))};
}
function validRecord(r) {
  if (!r || typeof r !== 'object' || !Object.hasOwn(r, 'wins') || !Number.isSafeInteger(r.wins) || r.wins < 0 || r.wins > MAX_WINS) return false;
  if (r.wins === 0) return r.bestMoves === null && r.bestMs === null;
  return integer(r.bestMoves) && integer(r.bestMs);
}
export function sanitize(value) {
  const save = defaults();
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.hasOwn(value, 'version') || value.version !== 1) return {save, recovered: true};
  let recovered = false;
  if (Object.hasOwn(value, 'muted') && typeof value.muted === 'boolean') save.muted = value.muted; else recovered = true;
  if (Object.hasOwn(value, 'theme') && typeof value.theme === 'string' && THEMES.includes(value.theme)) save.theme = value.theme; else recovered = true;
  if (!Object.hasOwn(value, 'records') || !value.records || typeof value.records !== 'object' || Array.isArray(value.records)) return {save, recovered: true};
  for (const id of MODE_IDS) {
    const record = Object.hasOwn(value.records, id) ? value.records[id] : null;
    if (validRecord(record)) save.records[id] = {wins: record.wins, bestMoves: record.bestMoves, bestMs: record.bestMs}; else recovered = true;
  }
  if (Object.keys(value.records).some(id => !validMode(id))) recovered = true;
  return {save, recovered};
}
export function settleRecord(save, modeId, moves, milliseconds) {
  if (!validMode(modeId) || !integer(moves) || !integer(milliseconds)) return {save, improved: false};
  const current = save.records[modeId];
  if (!validRecord(current)) return {save, improved: false};
  const improved = current.wins === 0 || moves < current.bestMoves || (moves === current.bestMoves && milliseconds < current.bestMs);
  const record = {wins: Math.min(MAX_WINS, current.wins + 1), bestMoves: improved ? moves : current.bestMoves, bestMs: improved ? milliseconds : current.bestMs};
  return {save: {...save, records: {...save.records, [modeId]: record}}, improved};
}
export function loadSave(getStorage) {
  try {
    const storage = getStorage(), raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return {save: defaults(), blocked: false, recovered: false};
    try { return {...sanitize(JSON.parse(raw)), blocked: false}; }
    catch { return {save: defaults(), blocked: false, recovered: true}; }
  } catch { return {save: defaults(), blocked: true, recovered: false}; }
}
export function writeSave(getStorage, save) {
  try { getStorage().setItem(STORAGE_KEY, JSON.stringify(save)); return true; }
  catch { return false; }
}
