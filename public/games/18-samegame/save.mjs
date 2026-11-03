import { MODES, modeOf } from './engine.mjs';
export const STORAGE_KEY = 'simplegames.jelly-bite.v1';
export const CAP = 1000000;
export const emptyModeRecord = () => ({ bestScore: 0, bestRemaining: null, finished: 0, allClears: 0, totalScore: 0 });
export function defaultRecord() { return { version: 1, settings: { theme: 'sugar', muted: true, lastMode: 'normal' }, records: Object.fromEntries(Object.keys(MODES).map(mode => [mode, emptyModeRecord()])) }; }
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = (value, cap = CAP) => Number.isSafeInteger(value) && value >= 0 && value <= cap;
export function validateRecord(value) {
  const record = defaultRecord(), warnings = [];
  if (!object(value) || value.version !== 1) return { record, warnings: ['저장 형식을 읽을 수 없어 기본값으로 복구했어요.'] };
  const settings = object(value.settings) ? value.settings : {};
  for (const [key, valid] of [['theme', ['sugar', 'night'].includes(settings.theme)], ['muted', typeof settings.muted === 'boolean'], ['lastMode', Object.hasOwn(MODES, settings.lastMode ?? '')]]) {
    if (valid) record.settings[key] = settings[key]; else warnings.push(`${key} 설정을 기본값으로 복구했어요.`);
  }
  for (const mode of Object.keys(MODES)) {
    const r = object(value.records) ? value.records[mode] : null, size = MODES[mode].rows * MODES[mode].cols, maxScore = (size - 2) ** 2 + 500;
    if (object(r) && integer(r.finished) && integer(r.allClears) && integer(r.totalScore) && integer(r.bestScore, maxScore)
      && (r.bestRemaining === null || integer(r.bestRemaining, size)) && r.allClears <= r.finished && r.bestScore <= r.totalScore && r.totalScore <= r.finished * maxScore
      && (r.finished > 0 ? r.bestRemaining !== null && r.bestRemaining <= size : r.bestRemaining === null && r.bestScore === 0 && r.allClears === 0 && r.totalScore === 0)
      && (r.allClears === 0 ? r.bestRemaining !== 0 : r.bestRemaining === 0 && r.bestScore >= 500 && r.totalScore >= r.allClears * 500)) {
      record.records[mode] = { bestScore: r.bestScore, bestRemaining: r.bestRemaining, finished: r.finished, allClears: r.allClears, totalScore: r.totalScore };
    } else warnings.push(`${mode} 완료 기록만 복구했어요.`);
  }
  return { record, warnings };
}
export function loadRecord(getStorage = () => globalThis.localStorage) {
  try { const raw = getStorage().getItem(STORAGE_KEY); return raw === null ? { record: defaultRecord(), warnings: [] } : validateRecord(JSON.parse(raw)); }
  catch { return { record: defaultRecord(), warnings: ['저장소를 읽을 수 없어요. 이 화면의 기록은 유지되지만 다시 열면 사라질 수 있어요.'] }; }
}
export function saveRecord(record, getStorage = () => globalThis.localStorage) {
  try { getStorage().setItem(STORAGE_KEY, JSON.stringify(record)); return { ok: true }; }
  catch { return { ok: false, warning: '기록을 저장하지 못했어요. 이 화면에서는 계속 플레이할 수 있어요.' }; }
}
export function settleRecord(record, mode, result) {
  if (!Object.hasOwn(MODES, mode) || !object(result)) return record;
  const size = MODES[mode].rows * MODES[mode].cols, r = record.records[mode];
  if (!integer(result.score, (size - 2) ** 2 + 500) || !integer(result.remaining, size) || !['all-clear', 'no-moves'].includes(result.reason)
    || (result.reason === 'all-clear' ? result.remaining !== 0 || result.bonus !== 500 || result.score < 500 : result.remaining === 0 || result.bonus !== 0)) return record;
  if (r.finished === CAP || r.totalScore + result.score > CAP || r.allClears + Number(result.reason === 'all-clear') > CAP) return record;
  return { ...record, records: { ...record.records, [modeOf(mode)]: { finished: r.finished + 1, allClears: r.allClears + Number(result.reason === 'all-clear'), totalScore: r.totalScore + result.score, bestScore: Math.max(r.bestScore, result.score), bestRemaining: r.bestRemaining === null ? result.remaining : Math.min(r.bestRemaining, result.remaining) } } };
}

