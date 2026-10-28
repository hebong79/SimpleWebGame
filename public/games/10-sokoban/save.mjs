import { LEVELS } from './levels.mjs';

export const STORAGE_KEY = 'simplegames.hamster-depot.v1';
export const PARTS = Object.freeze(['hat', 'workwear', 'bag']);
export const SETS = Object.freeze(['basic', 'delivery', 'mechanic', 'chef']);
const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const keysEqual = (v, keys) => isObject(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const integer = n => Number.isSafeInteger(n) && n >= 0;
const clone = v => structuredClone(v);
export const availableSets = record => SETS.filter(s => s === 'basic' || s === 'delivery' || (s === 'mechanic' && record.cleared.length >= 5) || (s === 'chef' && record.cleared.length >= 15));
export const canEquip = (record, equipment) => keysEqual(equipment, PARTS) && PARTS.every(p => availableSets(record).includes(equipment[p]));
export function defaultRecord() {
  return { version: 1, cleared: [], unlocked: 1, bests: {}, muted: true, equipped: { hat: 'basic', workwear: 'basic', bag: 'basic' } };
}
export function validScore(score, levelId) {
  const level = LEVELS[levelId - 1];
  return !!level && keysEqual(score, ['pushes', 'moves']) && integer(score.pushes) && integer(score.moves) && score.pushes >= level.pushes && score.moves >= score.pushes && (score.pushes !== level.pushes || score.moves >= level.moves);
}
export function validateRecord(value) {
  if (!keysEqual(value, ['version', 'cleared', 'unlocked', 'bests', 'muted', 'equipped']) || value.version !== 1 || !Array.isArray(value.cleared) || value.cleared.length > 20 || !isObject(value.bests) || typeof value.muted !== 'boolean') return null;
  if (!value.cleared.every((id, index) => id === index + 1) || value.unlocked !== Math.min(20, value.cleared.length + 1)) return null;
  if (Object.keys(value.bests).length !== value.cleared.length || !value.cleared.every(id => Object.hasOwn(value.bests, String(id)) && validScore(value.bests[id], id))) return null;
  if (!canEquip(value, value.equipped)) return null;
  return clone(value);
}
export function settleClear(record, levelId, score) {
  if (!validateRecord(record) || !Number.isInteger(levelId) || levelId < 1 || levelId > record.unlocked || !validScore(score, levelId)) throw new Error('Invalid clear');
  const next = clone(record);
  if (!next.cleared.includes(levelId)) next.cleared.push(levelId);
  next.unlocked = Math.min(20, next.cleared.length + 1);
  const previous = next.bests[levelId];
  const improved = !previous || score.pushes < previous.pushes || (score.pushes === previous.pushes && score.moves < previous.moves);
  if (improved) next.bests[levelId] = clone(score);
  return { record: next, improved };
}
export function equipRecord(record, equipment) {
  if (!canEquip(record, equipment)) return null;
  return { ...clone(record), equipped: clone(equipment) };
}
/** Never writes during load/recovery; never deletes a key. */
export function createPersistence(getStorage = () => globalThis.localStorage, onWarning = () => {}) {
  let warning = '';
  const warn = message => { warning = message; onWarning(message); };
  return {
    load() {
      try {
        const text = getStorage()?.getItem(STORAGE_KEY);
        if (text == null) return defaultRecord();
        const record = validateRecord(JSON.parse(text));
        if (record) return record;
        warn('저장 기록을 확인할 수 없어 새 기록으로 시작합니다. 기존 저장은 지우지 않았습니다.');
      } catch { warn('저장소를 읽을 수 없습니다. 이번 방문에서는 메모리로 플레이합니다.'); }
      return defaultRecord();
    },
    save(record) {
      if (!validateRecord(record)) throw new Error('Refusing invalid save');
      try {
        const storage = getStorage();
        if (!storage || typeof storage.setItem !== 'function') throw new Error('No storage');
        storage.setItem(STORAGE_KEY, JSON.stringify(record));
        return true;
      } catch { warn('기록을 기기에 저장하지 못했습니다. 현재 방문의 기록과 의상은 메모리에 유지됩니다.'); return false; }
    },
    get warning() { return warning; },
  };
}
