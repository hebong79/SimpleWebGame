import { STAGES, starsFor } from './engine.mjs';
export const STORAGE_KEY = 'simplegames.starlight-switch.v1';
export const CAP = 1_000_000;
export const THEMES = Object.freeze(['night', 'paper']);
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const integer = (v, min, max) => Number.isSafeInteger(v) && v >= min && v <= max;
export const emptyStage = () => ({ bestMoves: null, bestStars: 0, clearCount: 0 });
export const defaultRecord = () => ({ version: 1, settings: { theme: 'night', muted: true }, records: { completed: 0, unlocked: 1, stages: STAGES.map(emptyStage) } });
export function validStage(value, index) {
  if (!object(value) || !integer(value.clearCount, 0, CAP)) return false;
  if (value.clearCount === 0) return value.bestMoves === null && value.bestStars === 0;
  return integer(value.bestMoves, STAGES[index].target, Number.MAX_SAFE_INTEGER) && integer(value.bestStars, 1, 3) && value.bestStars === starsFor(value.bestMoves, STAGES[index].target);
}
export function recoverRecord(value) {
  const record = defaultRecord(), warnings = [];
  if (!object(value) || value.version !== 1) return { record, warnings: ['저장 형식을 읽지 못해 기본값으로 복구했습니다.'] };
  if (object(value.settings) && THEMES.includes(value.settings.theme)) record.settings.theme = value.settings.theme;
  else warnings.push('테마 설정을 기본값으로 복구했습니다.');
  if (object(value.settings) && typeof value.settings.muted === 'boolean') record.settings.muted = value.settings.muted;
  else warnings.push('소리 설정을 기본값으로 복구했습니다.');
  const source = object(value.records) ? value.records : {};
  if (!Array.isArray(source.stages) || source.stages.length !== 15) warnings.push('단계 기록의 손상된 부분을 복구했습니다.');
  for (let i = 0; i < 15; i++) {
    const item = Array.isArray(source.stages) ? source.stages[i] : null;
    if (validStage(item, i) && record.records.completed + item.clearCount <= CAP) {
      record.records.stages[i] = { bestMoves: item.bestMoves, bestStars: item.bestStars, clearCount: item.clearCount };
      record.records.completed += item.clearCount;
      if (item.clearCount > 0) record.records.unlocked = Math.max(record.records.unlocked, Math.min(15, i + 2));
    } else warnings.push(`${i + 1}단계 기록만 기본값으로 복구했습니다.`);
  }
  if (source.completed !== record.records.completed || source.unlocked !== record.records.unlocked) warnings.push('누적 완료 수와 해금을 유효한 단계 기록에서 복구했습니다.');
  return { record, warnings: [...new Set(warnings)] };
}
const browserStorage = () => window.localStorage;
export function loadRecord(getStorage = browserStorage) {
  try {
    const raw = getStorage().getItem(STORAGE_KEY);
    if (raw === null) return { record: defaultRecord(), warnings: [] };
    try { return recoverRecord(JSON.parse(raw)); }
    catch { return { record: defaultRecord(), warnings: ['저장 내용이 손상되어 기본값으로 복구했습니다.'] }; }
  } catch { return { record: defaultRecord(), warnings: ['저장소를 읽지 못했습니다. 이번 페이지에서만 기록을 유지합니다.'] }; }
}
export function saveRecord(record, getStorage = browserStorage) {
  try {
    const checked = recoverRecord(record);
    if (checked.warnings.length) return { ok: false, warning: '올바르지 않은 기록은 저장하지 않았습니다.' };
    getStorage().setItem(STORAGE_KEY, JSON.stringify(checked.record)); return { ok: true, warning: null };
  } catch { return { ok: false, warning: '저장하지 못했습니다. 이번 페이지 기록은 유지되지만 새로고침하면 사라질 수 있습니다.' }; }
}
export function settleRecord(record, result) {
  if (!object(result) || !integer(result.stage, 1, 15) || !integer(result.moves, STAGES[result.stage - 1].target, Number.MAX_SAFE_INTEGER) || result.stars !== starsFor(result.moves, STAGES[result.stage - 1].target) || record.records.completed >= CAP) return record;
  const current = record.records.stages[result.stage - 1];
  if (current.clearCount >= CAP) return record;
  const stages = record.records.stages.map(item => ({ ...item }));
  stages[result.stage - 1] = { clearCount: current.clearCount + 1, bestMoves: current.bestMoves === null ? result.moves : Math.min(current.bestMoves, result.moves), bestStars: Math.max(current.bestStars, result.stars) };
  return { ...record, records: { completed: record.records.completed + 1, unlocked: Math.max(record.records.unlocked, Math.min(15, result.stage + 1)), stages } };
}
