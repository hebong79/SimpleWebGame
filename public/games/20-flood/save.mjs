import { STAGES, STAGE_COUNT, scoreFor } from './engine.mjs';
export const STORAGE_KEY = 'simplegames.paint-spread.v1';
export const CAP = 1_000_000;
export const THEMES = Object.freeze(['paint', 'pastel']);
export const WARN_READ = '저장소를 읽지 못했어요. 이번 페이지에서만 기록이 유지돼요.';
export const WARN_WRITE = '저장하지 못했어요. 이번 페이지 기록은 유지되지만 새로고침하면 사라질 수 있어요.';
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const integer = (v, min, max) => Number.isSafeInteger(v) && v >= min && v <= max;
export const emptyStage = () => ({ clearCount: 0, bestUsed: null, bestScore: null });
export const defaultRecord = () => ({ version: 1, settings: { theme: 'paint', muted: true }, records: { completed: 0, unlocked: 1, stages: STAGES.map(emptyStage) } });
// bestUsed lower bound is 1 (not the solving-path length) so valid records survive a future map change; upper bound is the stage limit.
export function validStage(value, index) {
  const stage = STAGES[index];
  if (!stage || !object(value) || !integer(value.clearCount, 0, CAP)) return false;
  if (value.clearCount === 0) return value.bestUsed === null && value.bestScore === null;
  return integer(value.bestUsed, 1, stage.limit) && value.bestScore === scoreFor(stage.limit, value.bestUsed);
}
export function recoverRecord(value) {
  const record = defaultRecord(), warnings = [];
  if (!object(value) || value.version !== 1) return { record, warnings: ['저장 형식을 읽지 못해 기본값으로 복구했어요.'] };
  if (object(value.settings) && THEMES.includes(value.settings.theme)) record.settings.theme = value.settings.theme;
  else warnings.push('테마 설정을 기본값으로 복구했어요.');
  if (object(value.settings) && typeof value.settings.muted === 'boolean') record.settings.muted = value.settings.muted;
  else warnings.push('소리 설정을 기본값으로 복구했어요.');
  const source = object(value.records) ? value.records : {};
  if (!Array.isArray(source.stages) || source.stages.length !== STAGE_COUNT) warnings.push('단계 기록의 손상된 부분을 복구했어요.');
  for (let i = 0; i < STAGE_COUNT; i++) {
    const item = Array.isArray(source.stages) ? source.stages[i] : null;
    if (validStage(item, i) && record.records.completed + item.clearCount <= CAP) {
      record.records.stages[i] = { clearCount: item.clearCount, bestUsed: item.bestUsed, bestScore: item.bestScore };
      record.records.completed += item.clearCount;
      if (item.clearCount > 0) record.records.unlocked = Math.max(record.records.unlocked, Math.min(STAGE_COUNT, i + 2));
    } else warnings.push(`${i + 1}단계 기록만 기본값으로 복구했어요.`);
  }
  if (source.completed !== record.records.completed || source.unlocked !== record.records.unlocked) warnings.push('누적 완료 수와 해금을 유효한 단계 기록에서 다시 계산했어요.');
  return { record, warnings: [...new Set(warnings)] };
}
const browserStorage = () => window.localStorage;
// mode 'memory' = the existing record could not be read; the page must then never write (it would overwrite an unread valid record).
export function loadRecord(getStorage = browserStorage) {
  let raw;
  try { raw = getStorage().getItem(STORAGE_KEY); } catch { return { record: defaultRecord(), warnings: [WARN_READ], mode: 'memory' }; }
  if (raw === null) return { record: defaultRecord(), warnings: [], mode: 'persistent' };
  try { return { ...recoverRecord(JSON.parse(raw)), mode: 'persistent' }; }
  catch { return { record: defaultRecord(), warnings: ['저장 내용이 손상되어 기본값으로 복구했어요.'], mode: 'persistent' }; }
}
export function saveRecord(record, getStorage = browserStorage) {
  try {
    const checked = recoverRecord(record);
    if (checked.warnings.length) return { ok: false, warning: '올바르지 않은 기록은 저장하지 않았어요.' };
    getStorage().setItem(STORAGE_KEY, JSON.stringify(checked.record)); return { ok: true, warning: null };
  } catch { return { ok: false, warning: WARN_WRITE }; }
}
// Returns { record, judge }. judge: 'new-best' | 'tie' | 'not-best' | 'capped' | 'rejected'. Rejected / capped results return the same record object.
export function settleRecord(record, result) {
  const stage = object(result) && integer(result.stageId, 1, STAGE_COUNT) ? STAGES[result.stageId - 1] : null;
  if (!stage || !integer(result.used, 1, stage.limit) || result.score !== scoreFor(stage.limit, result.used)) return { record, judge: 'rejected' };
  const current = record.records.stages[stage.id - 1];
  if (current.clearCount >= CAP || record.records.completed >= CAP) return { record, judge: 'capped' };
  const judge = current.bestUsed === null || result.used < current.bestUsed ? 'new-best' : result.used === current.bestUsed ? 'tie' : 'not-best';
  const bestUsed = current.bestUsed === null ? result.used : Math.min(current.bestUsed, result.used);
  const stages = record.records.stages.map(item => ({ ...item }));
  stages[stage.id - 1] = { clearCount: current.clearCount + 1, bestUsed, bestScore: scoreFor(stage.limit, bestUsed) };
  return {
    record: { ...record, records: { completed: record.records.completed + 1, unlocked: Math.max(record.records.unlocked, Math.min(STAGE_COUNT, stage.id + 1)), stages } },
    judge
  };
}
