import { emptyRecords, validRecords, incrementRecords } from './engine.mjs';
export const STORAGE_KEY = 'simplegames.sun-sea-four.v1';
export const THEMES = Object.freeze(['coast', 'evening']);
export const defaultRecord = () => ({ version: 1, settings: { theme: 'coast', muted: true }, records: emptyRecords() });
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
export function recoverRecord(value) {
  const record = defaultRecord(), warnings = [];
  if (!object(value) || value.version !== 1) return { record, warnings: ['저장 형식을 읽지 못해 기본값으로 복구했습니다.'] };
  const settings = object(value.settings) ? value.settings : {};
  if (THEMES.includes(settings.theme)) record.settings.theme = settings.theme;
  else warnings.push('보드 테마를 기본값으로 복구했습니다.');
  if (typeof settings.muted === 'boolean') record.settings.muted = settings.muted;
  else warnings.push('음소거 설정을 기본값으로 복구했습니다.');
  if (validRecords(value.records)) record.records = { sunWins: value.records.sunWins, seaWins: value.records.seaWins, draws: value.records.draws };
  else warnings.push('누적 전적만 기본값으로 복구했습니다.');
  return { record, warnings };
}
const storage = () => window.localStorage;
export function loadRecord(getStorage = storage) {
  try {
    const raw = getStorage().getItem(STORAGE_KEY);
    if (raw === null) return { record: defaultRecord(), warnings: [] };
    try { return recoverRecord(JSON.parse(raw)); }
    catch { return { record: defaultRecord(), warnings: ['저장 내용이 손상되어 기본값으로 복구했습니다.'] }; }
  } catch { return { record: defaultRecord(), warnings: ['저장소를 읽지 못했습니다. 이번 페이지에서만 기록을 유지합니다.'] }; }
}
export function saveRecord(record, getStorage = storage) {
  try {
    const checked = recoverRecord(record);
    if (checked.warnings.length) return { ok: false, warning: '올바르지 않은 기록은 저장하지 않았습니다.' };
    getStorage().setItem(STORAGE_KEY, JSON.stringify(checked.record));
    return { ok: true, warning: null };
  } catch { return { ok: false, warning: '저장하지 못했습니다. 이번 페이지 기록은 유지되지만 새로고침하면 사라질 수 있습니다.' }; }
}
export function settleRecord(record, outcome) {
  const records = incrementRecords(record.records, outcome);
  return records === record.records ? record : { ...record, records };
}
