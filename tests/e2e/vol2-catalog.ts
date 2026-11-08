// G032 scope: preserve the original 49 records and add these 20 playable games.
// These are test expectations, not imported from the product catalog.
export const VOL2_GAMES = [
  { id: 'ink-postcard', href: '/games/21-pattern/index.html' },
  { id: 'four-notebook', href: '/games/22-solo/index.html' },
  { id: 'lamp-network', href: '/games/23-net/index.html' },
  { id: 'island-bridges', href: '/games/24-bridges/index.html' },
  { id: 'night-lamps', href: '/games/25-lightup/index.html' },
  { id: 'forest-camp', href: '/games/26-tents/index.html' },
  { id: 'glass-roof', href: '/games/27-slant/index.html' },
  { id: 'tangled-stars', href: '/games/28-untangle/index.html' },
  { id: 'specimen-vault', href: '/games/29-guess/index.html' },
  { id: 'moon-sun-garden', href: '/games/30-othello/index.html' },
  { id: 'three-specimens', href: '/games/31-set/index.html' },
  { id: 'seed-jars', href: '/games/32-mancala/index.html' },
  { id: 'firefly-post', href: '/games/33-maze/index.html' },
  { id: 'star-patrol', href: '/games/34-asteroids/index.html' },
  { id: 'lighthouse-shield', href: '/games/35-missile-command/index.html' },
  { id: 'gap-orbit', href: '/games/36-hexagon/index.html' },
  { id: 'cloud-stamp', href: '/games/37-qbert/index.html' },
  { id: 'moon-mushrooms', href: '/games/38-whac-a-mole/index.html' },
  { id: 'juice-workshop', href: '/games/39-fruit-ninja/index.html' },
  { id: 'cloud-cookie', href: '/games/40-cut-the-rope/index.html' },
] as const;
// G033 adds twenty independent games while preserving the G032 list above.
export const VOL3_ADDITIONS = 20;
export const VOL4_ADDITIONS = 20;
export const VOL5_ADDITIONS = 20;
export const CATALOG_TOTAL = 49 + VOL2_GAMES.length + VOL3_ADDITIONS + VOL4_ADDITIONS + VOL5_ADDITIONS;
export const CATALOG_AVAILABLE = 20 + VOL2_GAMES.length + VOL3_ADDITIONS + VOL4_ADDITIONS + VOL5_ADDITIONS;
export const CATALOG_UPCOMING = 29;
export const CATALOG_SUMMARY = `플레이 가능 ${CATALOG_AVAILABLE} · 준비 중 ${CATALOG_UPCOMING}`;
export const CATALOG_MORE_COUNTS = Array.from({ length: Math.ceil(CATALOG_TOTAL / 12) - 1 }, (_, i) => Math.min((i + 2) * 12, CATALOG_TOTAL));
