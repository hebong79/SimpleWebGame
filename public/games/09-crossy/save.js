export const STORAGE_KEY = 'simple-games:chick-picnic:v1';
export const PARTS = Object.freeze(['hat', 'top', 'backpack']);
export const SETS = Object.freeze(['basic', 'straw', 'firefighter', 'frog']);
export const SET_NAMES = Object.freeze({ basic: '기본 병아리', straw: '밀짚 소풍', firefighter: '소방관', frog: '개구리 비옷' });
export function defaults() {
  return { version: 1, plays: 0, bestRows: 0, totalRows: 0, muted: true,
    equipped: { hat: 'basic', top: 'basic', backpack: 'basic' } };
}
const natural = (n) => Number.isSafeInteger(n) && n >= 0;
export function owned(record, set) {
  return set === 'basic' || set === 'straw' || (set === 'firefighter' && record.totalRows >= 300) ||
    (set === 'frog' && record.bestRows >= 50);
}
export function validEquipment(record, equipped) {
  return equipped && typeof equipped === 'object' && PARTS.every((p) => SETS.includes(equipped[p]) && owned(record, equipped[p]));
}
export function validRecord(value) {
  if (!value || typeof value !== 'object' || value.version !== 1 ||
      ![value.plays, value.bestRows, value.totalRows].every(natural) || typeof value.muted !== 'boolean') return false;
  const p = BigInt(value.plays), b = BigInt(value.bestRows), t = BigInt(value.totalRows);
  // Reserve one completed round attaining b; all remaining rounds are in [0,b].
  if (p === 0n ? (b !== 0n || t !== 0n) : (t < b || t > p * b)) return false;
  return Boolean(validEquipment(value, value.equipped));
}
export function parseRecord(raw) {
  if (raw === null) return { record: defaults(), recovered: false };
  try {
    const v = JSON.parse(raw);
    if (!validRecord(v)) return { record: defaults(), recovered: true };
    return { record: { version: 1, plays: v.plays, bestRows: v.bestRows, totalRows: v.totalRows,
      muted: v.muted, equipped: Object.fromEntries(PARTS.map((p) => [p, v.equipped[p]])) }, recovered: false };
  } catch { return { record: defaults(), recovered: true }; }
}
export function settleRecord(record, rows) {
  if (!validRecord(record) || !natural(rows)) throw new TypeError('Invalid completed round');
  const plays = record.plays + 1, totalRows = record.totalRows + rows;
  if (!natural(plays) || !natural(totalRows)) throw new RangeError('Record capacity reached');
  return { ...record, plays, totalRows, bestRows: Math.max(record.bestRows, rows), equipped: { ...record.equipped } };
}
export function equipRecord(record, equipped) {
  if (!validEquipment(record, equipped)) return null;
  return { ...record, equipped: Object.fromEntries(PARTS.map((p) => [p, equipped[p]])) };
}
export function createStore(getStorage = () => globalThis.localStorage) {
  let storage, record = defaults(), warning = '';
  try {
    storage = getStorage();
    const parsed = parseRecord(storage.getItem(STORAGE_KEY));
    record = parsed.record;
    if (parsed.recovered) warning = '저장 기록이 손상되어 기본값을 사용합니다. 기존 키는 지우지 않았습니다.';
  } catch { warning = '기록 저장소를 사용할 수 없습니다. 이 화면에서는 메모리로 플레이합니다.'; }
  return {
    read: () => structuredClone(record),
    warning: () => warning,
    update(next) {
      if (!validRecord(next)) throw new TypeError('Invalid save');
      record = structuredClone(next);
      try {
        if (!storage) throw new Error('Storage unavailable');
        storage.setItem(STORAGE_KEY, JSON.stringify(record));
      } catch { warning = '기록을 영구 저장하지 못했습니다. 현재 기록은 메모리에만 유지됩니다.'; }
      return structuredClone(record);
    },
    warn(message) { warning = message; },
  };
}
