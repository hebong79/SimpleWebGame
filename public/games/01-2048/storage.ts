import { isTile } from './engine.js';
export const STORAGE_KEY = 'number-garden:profile:v1';
export const GARDENS = ['seed', 'grove', 'bloom'] as const;
export type Garden = typeof GARDENS[number];
export interface Profile {
  version: 1; bestScore: number; bestTile: number; gamesStarted: number; gamesFinished: number; gamesWon: number;
  totalMoves: number; totalScore: number; unlockedGardens: Garden[]; selectedGarden: Garden; muted: boolean;
}
export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }
export interface ProfileResult { profile: Profile; recovered: boolean }
export function gardensFor(bestTile: number): Garden[] { return ['seed', ...(bestTile >= 256 ? ['grove' as const] : []), ...(bestTile >= 1024 ? ['bloom' as const] : [])]; }
export function defaultProfile(): Profile {
  return { version: 1, bestScore: 0, bestTile: 0, gamesStarted: 0, gamesFinished: 0, gamesWon: 0, totalMoves: 0, totalScore: 0, unlockedGardens: ['seed'], selectedGarden: 'seed', muted: true };
}
const numeric = ['bestScore', 'gamesStarted', 'gamesFinished', 'gamesWon', 'totalMoves', 'totalScore'] as const;
export function normalizeProfile(value: unknown): ProfileResult {
  const failed = (): ProfileResult => ({ profile: defaultProfile(), recovered: true });
  if (!value || typeof value !== 'object' || Array.isArray(value)) return failed();
  const data = value as Record<string, unknown>;
  if (data.version !== 1 || numeric.some(key => typeof data[key] !== 'number' || !Number.isSafeInteger(data[key]) || (data[key] as number) < 0) || !isTile(data.bestTile)) return failed();
  const p = defaultProfile();
  for (const key of numeric) p[key] = data[key] as number;
  p.bestTile = data.bestTile;
  if (p.gamesFinished > p.gamesStarted || p.gamesWon > p.gamesStarted || p.totalScore < p.bestScore) return failed();
  p.unlockedGardens = gardensFor(p.bestTile);
  p.selectedGarden = p.unlockedGardens.includes(data.selectedGarden as Garden) ? data.selectedGarden as Garden : 'seed';
  p.muted = typeof data.muted === 'boolean' ? data.muted : true;
  const recovered = data.selectedGarden !== p.selectedGarden || data.muted !== p.muted || !Array.isArray(data.unlockedGardens) || data.unlockedGardens.length !== p.unlockedGardens.length || data.unlockedGardens.some((g, i) => g !== p.unlockedGardens[i]);
  return { profile: p, recovered };
}
export class ProfileStore {
  readonly storage: StorageLike | undefined;
  blocked = false;
  recovered = false;
  constructor(storage?: StorageLike) { this.storage = storage; if (!storage) this.blocked = true; }
  load(): Profile {
    if (!this.storage || this.blocked) return defaultProfile();
    let raw: string | null;
    try { raw = this.storage.getItem(STORAGE_KEY); } catch { this.blocked = true; return defaultProfile(); }
    if (raw === null) return defaultProfile();
    let result: ProfileResult;
    try { result = raw.length <= 16384 ? normalizeProfile(JSON.parse(raw)) : { profile: defaultProfile(), recovered: true }; }
    catch { result = { profile: defaultProfile(), recovered: true }; }
    this.recovered = result.recovered;
    if (result.recovered) this.save(result.profile);
    return result.profile;
  }
  save(profile: Profile): boolean {
    if (this.blocked || !this.storage) return false;
    const checked = normalizeProfile(profile);
    if (checked.recovered) throw new TypeError('Refusing invalid profile write');
    try { this.storage.setItem(STORAGE_KEY, JSON.stringify(checked.profile)); return true; }
    catch { this.blocked = true; return false; }
  }
}
export function browserStore(): ProfileStore {
  try { return new ProfileStore(window.localStorage); } catch { return new ProfileStore(); }
}
