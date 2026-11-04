// 조약돌 하나 save schema `simplegames.pebble-solo.v1`: settings + completion records only (never a board in progress).
import { STAGES } from './engine.mjs';
export const STORAGE_KEY = 'simplegames.pebble-solo.v1';
export const CAP = 1_000_000;
export const THEMES = Object.freeze(['river', 'glass', 'wood']);
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const integer = (v, min, max) => Number.isSafeInteger(v) && v >= min && v <= max;
export const emptyStage = () => ({ bestRemaining: null, clearCount: 0, bestUndos: null });
export const defaultRecord = () => ({ version: 1, settings: { theme: 'river', muted: true }, records: { completed: 0, unlocked: 1, stages: STAGES.map(emptyStage) } });

// Per-stage validity incl. relations: cleared => bestRemaining 1 + bestUndos set; uncleared => bestUndos null, bestRemaining null or >= 2.
export function validStage(value, index) {
  if (!object(value) || !STAGES[index] || !integer(value.clearCount, 0, CAP)) return false;
  const { bestRemaining, bestUndos } = value, count = STAGES[index].count;
  if (bestUndos !== null && !integer(bestUndos, 0, CAP)) return false;
  if (bestRemaining !== null && !integer(bestRemaining, 1, count - 1)) return false;
  if (value.clearCount > 0) return bestRemaining === 1 && bestUndos !== null;
  return bestUndos === null && (bestRemaining === null || bestRemaining >= 2);
}
// completed / unlocked are derived from the stage entries and always re-derived (never trusted from storage).
export function derive(stages) {
  let completed = 0, last = 0;
  stages.forEach((stage, index) => { completed += stage.clearCount; if (stage.clearCount > 0) last = index + 1; });
  return { completed, unlocked: Math.min(STAGES.length, 1 + last) };
}
// Never throws and never writes. `repaired` says whether anything had to be replaced by defaults.
export function recoverRecord(value) {
  const record = defaultRecord();
  if (!object(value) || value.version !== 1) return { record, repaired: true };
  let repaired = false;
  if (object(value.settings) && THEMES.includes(value.settings.theme)) record.settings.theme = value.settings.theme; else repaired = true;
  if (object(value.settings) && typeof value.settings.muted === 'boolean') record.settings.muted = value.settings.muted; else repaired = true;
  const source = object(value.records) ? value.records : null;
  if (!source || !Array.isArray(source.stages) || source.stages.length !== STAGES.length) repaired = true;
  let total = 0;
  for (let i = 0; i < STAGES.length; i++) {
    const item = source && Array.isArray(source.stages) ? source.stages[i] : undefined;
    if (validStage(item, i) && total + item.clearCount <= CAP) {
      record.records.stages[i] = { bestRemaining: item.bestRemaining, clearCount: item.clearCount, bestUndos: item.bestUndos };
      total += item.clearCount;
    } else repaired = true;
  }
  Object.assign(record.records, derive(record.records.stages));
  if (!source || source.completed !== record.records.completed || source.unlocked !== record.records.unlocked) repaired = true;
  return { record, repaired };
}

const browserStorage = () => window.localStorage;
// readOk=false (storage getter/getItem threw): play in memory and never write, so unknown stored data is not overwritten.
export function loadRecord(getStorage = browserStorage) {
  let raw;
  try { raw = getStorage().getItem(STORAGE_KEY); } catch { return { record: defaultRecord(), readOk: false, repaired: false }; }
  if (raw === null) return { record: defaultRecord(), readOk: true, repaired: false };
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return { record: defaultRecord(), readOk: true, repaired: true }; }
  return { ...recoverRecord(parsed), readOk: true };
}
// status: ok | failed (setItem threw / invalid record). Only the pebble-solo key is ever written.
export function saveRecord(record, getStorage = browserStorage) {
  try {
    const checked = recoverRecord(record);
    if (checked.repaired) return { ok: false, status: 'failed' };
    getStorage().setItem(STORAGE_KEY, JSON.stringify(checked.record));
    return { ok: true, status: 'ok' };
  } catch { return { ok: false, status: 'failed' }; }
}
const withStage = (record, index, stage) => {
  const stages = record.records.stages.map(item => ({ ...item })); stages[index] = stage;
  return { ...record, records: { ...derive(stages), stages } };
};
// Win settlement: all-or-nothing. status 'cap' = nothing changed because a related counter would pass CAP.
export function settleWin(record, result) {
  if (!object(result) || result.outcome !== 'win' || !integer(result.stage, 1, STAGES.length) || !integer(result.undoCount, 0, CAP)) return { record, changed: false, status: 'invalid' };
  const index = result.stage - 1, current = record.records.stages[index];
  if (current.clearCount + 1 > CAP || record.records.completed + 1 > CAP) return { record, changed: false, status: 'cap' };
  const bestUndos = current.bestUndos === null ? result.undoCount : Math.min(current.bestUndos, result.undoCount);
  return { record: withStage(record, index, { bestRemaining: 1, clearCount: current.clearCount + 1, bestUndos }), changed: true, status: 'settled' };
}
// Stuck settlement: only an improved bestRemaining is recorded; no clear count, no unlock.
export function settleStuck(record, result) {
  if (!object(result) || result.outcome !== 'stuck' || !integer(result.stage, 1, STAGES.length)) return { record, changed: false, status: 'invalid' };
  const index = result.stage - 1, current = record.records.stages[index];
  if (!integer(result.remaining, 2, STAGES[index].count - 1) || current.clearCount > 0 || (current.bestRemaining !== null && result.remaining >= current.bestRemaining)) return { record, changed: false, status: 'unchanged' };
  return { record: withStage(record, index, { ...current, bestRemaining: result.remaining }), changed: true, status: 'settled' };
}
