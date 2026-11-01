export const STORAGE_KEY = 'simplegames.four-star-song.v1';
export const PLAY_CAP = 1000000;
export function defaultRecord() {
  return { version: 1, settings: { theme: 'night', muted: true }, records: { plays: 0, bestLength: 0, totalCompleted: 0 } };
}
const integer = (n, cap) => Number.isSafeInteger(n) && n >= 0 && n <= cap;
export function validateRecord(value) {
  const record = defaultRecord(), warnings = [];
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1) return { record, warnings: ['저장 형식을 읽을 수 없어 기본값으로 복구했어요.'] };
  if (value.settings?.theme === 'night' || value.settings?.theme === 'dawn') record.settings.theme = value.settings.theme;
  else warnings.push('테마 설정을 기본값으로 복구했어요.');
  if (typeof value.settings?.muted === 'boolean') record.settings.muted = value.settings.muted;
  else warnings.push('소리 설정을 기본값으로 복구했어요.');
  const r = value.records;
  if (r && integer(r.plays, PLAY_CAP) && integer(r.bestLength, 1000) && integer(r.totalCompleted, 1000000000)
    && r.bestLength <= r.totalCompleted && r.totalCompleted <= r.plays * 1000
    && (r.plays !== 0 || r.bestLength === 0 && r.totalCompleted === 0)) record.records = { plays: r.plays, bestLength: r.bestLength, totalCompleted: r.totalCompleted };
  else warnings.push('완료 기록이 손상되어 기록만 복구했어요.');
  return { record, warnings };
}
export function loadRecord(getStorage = () => globalThis.localStorage) {
  try {
    const value = getStorage().getItem(STORAGE_KEY);
    return value === null ? { record: defaultRecord(), warnings: [] } : validateRecord(JSON.parse(value));
  } catch { return { record: defaultRecord(), warnings: ['저장소를 읽을 수 없어요. 이 화면에서는 기록을 기억하지만 저장되지 않을 수 있어요.'] }; }
}
export function saveRecord(record, getStorage = () => globalThis.localStorage) {
  try { getStorage().setItem(STORAGE_KEY, JSON.stringify(record)); return { ok: true }; }
  catch { return { ok: false, warning: '기록을 저장하지 못했어요. 이 화면에서는 계속 플레이할 수 있어요.' }; }
}
export function settleRecord(record, completedLength) {
  if (!integer(completedLength, 1000) || record.records.plays >= PLAY_CAP) return record;
  return { ...record, records: { plays: record.records.plays + 1,
    bestLength: Math.max(record.records.bestLength, completedLength), totalCompleted: record.records.totalCompleted + completedLength } };
}
