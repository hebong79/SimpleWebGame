import { COUNTER_CAP, emptyTotals, incrementTotals } from './engine.mjs';
export const STORAGE_KEY = 'simplegames.star-moon.v1';
export const THEMES = Object.freeze(['paper', 'night']);
export const defaultRecord = () => ({ version: 1, settings: { theme: 'paper', muted: true }, lifetime: emptyTotals() });
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function validTotals(value) {
  if (!isObject(value)) return false;
  const values = [value.xWins, value.oWins, value.draws];
  return values.every(n => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && n <= COUNTER_CAP) && values.reduce((sum, n) => sum + BigInt(n), 0n) <= BigInt(COUNTER_CAP);
}
export function recoverRecord(value) {
  const record = defaultRecord(), warnings = [];
  if (!isObject(value) || value.version !== 1) return { record, warnings: ['저장 형식을 읽지 못해 기본 설정으로 복구했습니다.'] };
  const settings = isObject(value.settings) ? value.settings : {};
  if (typeof settings.theme === 'string' && THEMES.includes(settings.theme)) record.settings.theme = settings.theme;
  else warnings.push('보드 테마를 기본값으로 복구했습니다.');
  if (typeof settings.muted === 'boolean') record.settings.muted = settings.muted;
  else warnings.push('음소거 설정을 기본값으로 복구했습니다.');
  if (validTotals(value.lifetime)) record.lifetime = { xWins: value.lifetime.xWins, oWins: value.lifetime.oWins, draws: value.lifetime.draws };
  else warnings.push('누적 전적의 합계가 올바르지 않아 누적 전적만 초기화했습니다.');
  return { record, warnings };
}
const browserStorage = () => window.localStorage;
export function loadRecord(getStorage = browserStorage) {
  let storage;
  try { storage = getStorage(); }
  catch { return { record: defaultRecord(), warnings: ['저장소에 접근할 수 없습니다. 이번 페이지에서만 기록됩니다.'] }; }
  let raw;
  try { raw = storage.getItem(STORAGE_KEY); }
  catch { return { record: defaultRecord(), warnings: ['저장 기록을 읽지 못했습니다. 이번 페이지에서만 기록됩니다.'] }; }
  if (raw === null) return { record: defaultRecord(), warnings: [] };
  try { return recoverRecord(JSON.parse(raw)); }
  catch { return { record: defaultRecord(), warnings: ['저장 내용이 손상되어 기본 설정으로 복구했습니다.'] }; }
}
export function saveRecord(record, getStorage = browserStorage) {
  try {
    const checked = recoverRecord(record);
    if (checked.warnings.length) return { ok: false, warning: '기록이 올바르지 않아 저장하지 않았습니다.' };
    getStorage().setItem(STORAGE_KEY, JSON.stringify(checked.record));
    return { ok: true, warning: null };
  } catch { return { ok: false, warning: '기록을 저장하지 못했습니다. 이번 페이지의 전적은 유지되지만 새로고침하면 사라질 수 있습니다.' }; }
}
export function settleRecord(record, outcome) {
  const lifetime = incrementTotals(record.lifetime, outcome);
  return lifetime === record.lifetime ? record : { ...record, lifetime };
}
