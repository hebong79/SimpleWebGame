// Each playable game supplies its own same-origin launch URL.
// Original CSS artwork and the project's original garden SVG are reused.
export {};
interface CatalogGame {
  id: string;
  title: string;
  genre: string;
  description: string;
  tags: string[];
  minutes: number;
  maxMinutes: number;
  status: 'available' | 'upcoming';
  href?: string;
}
type SortOrder = 'default' | 'name' | 'duration';
interface LibraryState {
  query: string;
  genre: string;
  onlyFavorites: boolean;
  includeUpcoming: boolean;
  sort: SortOrder;
  limit: number;
}
const GAME_CATALOG: CatalogGame[] = [
  { id: 'number-garden', title: '숫자 정원', genre: '숫자', description: '같은 숫자를 합치며 키우는 작은 정원', tags: ['2048', '합치기', '정원'], minutes: 3, maxMinutes: 10, status: 'available', href: '/game.html' },
  { id: 'little-dragon', title: '꼬마 용 간식 여행', genre: '순발력', description: '간식을 모으며 자라는 용과 나만의 코스튬', tags: ['스네이크', 'snake', '용', '간식', '코스튬'], minutes: 1, maxMinutes: 3, status: 'available', href: '/games/02-snake/index.html' },
  { id: 'neon-rally', title: '네온 랠리', genre: '순발력', description: '키보드와 터치로 받아치는 7점 선취 퐁', tags: ['퐁', 'pong', '패들', '랠리', 'AI'], minutes: 1, maxMinutes: 3, status: 'available', href: '/games/03-pong/index.html' },
  { id: 'cosmic-cleanup', title: '우주 청소부', genre: '순발력', description: '공을 튕겨 세 구역의 우주 잔해를 말끔하게', tags: ['벽돌깨기', 'breakout', '우주', '패들', '3스테이지'], minutes: 1, maxMinutes: 4, status: 'available', href: '/games/04-breakout/index.html' },
  { id: 'block-workshop', title: '한 판 블록 공방', genre: '퍼즐', description: '일곱 모양을 쌓고 스무 줄을 완성하는 공방', tags: ['낙하블록', '블록', '공방', '20줄', '회전'], minutes: 2, maxMinutes: 5, status: 'available', href: '/games/05-falling-blocks/index.html' },
  { id: 'balloon-sparrow', title: '풍선 참새', genre: '순발력', description: '가볍게 날갯짓하며 정원 아치 사이로', tags: ['참새', 'flappy', '날갯짓', '풍선', '코스튬'], minutes: 1, maxMinutes: 2, status: 'available', href: '/games/06-flappy/index.html' },
  { id: 'desert-post', title: '사막 우체부', genre: '순발력', description: '소포를 안고 선인장을 넘는 도마뱀 우체부', tags: ['공룡', 'dino', '러너', '도마뱀', '코스튬'], minutes: 1, maxMinutes: 2, status: 'available', href: '/games/07-dino/index.html' },
  { id: 'cloud-bunny', title: '구름 토끼', genre: '순발력', description: '다음 구름에 발을 맞춰 조금 더 높이', tags: ['점프', 'doodle', '토끼', '발판', '코스튬'], minutes: 1, maxMinutes: 3, status: 'available', href: '/games/08-doodle/index.html' },
  { id: 'memory-pieces', title: '기억의 조각', genre: '기억', description: '뒤집고 기억하며 찾아내는 한 쌍', tags: ['카드', '맞추기'], minutes: 2, maxMinutes: 5, status: 'upcoming' },
  { id: 'leisure-line', title: '한 줄의 여유', genre: '퍼즐', description: '빈칸을 채우고 한 줄을 비우는 시간', tags: ['블록', '채우기'], minutes: 3, maxMinutes: 8, status: 'upcoming' },
  { id: 'color-walk', title: '색의 산책', genre: '퍼즐', description: '같은 색을 이어 완성하는 작은 풍경', tags: ['색깔', '연결'], minutes: 2, maxMinutes: 5, status: 'upcoming' },
  { id: 'morning-sudoku', title: '아침 스도쿠', genre: '숫자', description: '차분하게 채워가는 아홉 개의 숫자', tags: ['스도쿠', '논리'], minutes: 5, maxMinutes: 15, status: 'upcoming' },
  { id: 'leaf-cards', title: '잎새 찾기', genre: '기억', description: '흩어진 잎 사이에서 같은 모양 찾기', tags: ['카드', '자연'], minutes: 2, maxMinutes: 4, status: 'upcoming' },
  { id: 'raindrop', title: '빗방울 톡톡', genre: '순발력', description: '떨어지는 빗방울에 가볍게 톡', tags: ['터치', '반응'], minutes: 1, maxMinutes: 3, status: 'upcoming' },
  { id: 'garden-gomoku', title: '정원 오목', genre: '보드', description: '다섯 개의 돌로 이어가는 한 수', tags: ['오목', '전략'], minutes: 5, maxMinutes: 10, status: 'upcoming' },
  { id: 'little-maze', title: '작은 미로', genre: '퍼즐', description: '구불구불한 길 끝에서 만나는 출구', tags: ['미로', '길찾기'], minutes: 2, maxMinutes: 6, status: 'upcoming' },
  { id: 'make-ten', title: '열이 되는 순간', genre: '숫자', description: '숫자 두 개를 골라 만드는 작은 열', tags: ['덧셈', '짝짓기'], minutes: 2, maxMinutes: 5, status: 'upcoming' },
  { id: 'shape-note', title: '모양 노트', genre: '기억', description: '잠깐 본 모양을 마음속에 담아두기', tags: ['도형', '기억력'], minutes: 1, maxMinutes: 4, status: 'upcoming' },
  { id: 'balloon', title: '풍선 산책', genre: '순발력', description: '두둥실 떠오르는 풍선을 따라 톡', tags: ['풍선', '터치'], minutes: 1, maxMinutes: 3, status: 'upcoming' },
  { id: 'leaf-reversi', title: '초록 뒤집기', genre: '보드', description: '한 수씩 달라지는 초록빛 보드', tags: ['리버시', '전략'], minutes: 5, maxMinutes: 12, status: 'upcoming' },
  { id: 'sliding-view', title: '한 칸의 풍경', genre: '퍼즐', description: '조각을 밀어 맞추는 작은 풍경화', tags: ['슬라이드', '조각'], minutes: 3, maxMinutes: 7, status: 'upcoming' },
  { id: 'number-road', title: '숫자 오솔길', genre: '숫자', description: '하나부터 차례로 이어가는 숫자 길', tags: ['순서', '연결'], minutes: 2, maxMinutes: 4, status: 'upcoming' },
  { id: 'forest-melody', title: '숲의 멜로디', genre: '기억', description: '짧은 리듬을 기억해 다시 두드리기', tags: ['리듬', '순서'], minutes: 2, maxMinutes: 5, status: 'upcoming' },
  { id: 'star-catch', title: '별 하나 콕', genre: '순발력', description: '반짝이는 순간을 놓치지 않고 콕', tags: ['타이밍', '반응'], minutes: 1, maxMinutes: 2, status: 'upcoming' },
  { id: 'afternoon-cards', title: '오후의 카드', genre: '보드', description: '한 장씩 정리하는 나만의 카드 시간', tags: ['솔리테어', '카드'], minutes: 5, maxMinutes: 15, status: 'upcoming' },
  { id: 'waterway', title: '물길 잇기', genre: '퍼즐', description: '조각난 물길을 이어 꽃에게 물 주기', tags: ['연결', '회전'], minutes: 3, maxMinutes: 8, status: 'upcoming' },
  { id: 'tiny-calculation', title: '작은 셈', genre: '숫자', description: '부담 없이 풀어보는 짧은 숫자 문제', tags: ['계산', '두뇌'], minutes: 1, maxMinutes: 3, status: 'upcoming' },
  { id: 'word-basket', title: '단어 바구니', genre: '기억', description: '잠깐 스친 단어들을 다시 모아보기', tags: ['단어', '기억력'], minutes: 2, maxMinutes: 5, status: 'upcoming' },
  { id: 'green-signal', title: '초록 신호', genre: '순발력', description: '초록불이 켜지는 순간 가볍게 누르기', tags: ['반응', '타이밍'], minutes: 1, maxMinutes: 2, status: 'upcoming' },
  { id: 'round-checkers', title: '동그란 한 수', genre: '보드', description: '작은 말들과 함께하는 차분한 승부', tags: ['체커', '전략'], minutes: 5, maxMinutes: 10, status: 'upcoming' },
  { id: 'constellation', title: '별자리 잇기', genre: '퍼즐', description: '떨어진 별들을 하나의 선으로 잇기', tags: ['선긋기', '연결'], minutes: 2, maxMinutes: 6, status: 'upcoming' },
  { id: 'falling-leaves', title: '낙엽 받기', genre: '순발력', description: '바람에 내려앉는 잎을 바구니에 쏙', tags: ['낙엽', '받기'], minutes: 1, maxMinutes: 3, status: 'upcoming' },
  { id: 'quiet-chess', title: '고요한 체스', genre: '보드', description: '다음 한 수를 생각하는 조용한 시간', tags: ['체스', '전략'], minutes: 10, maxMinutes: 20, status: 'upcoming' },
  { id: 'mirror-lake', title: '거울 호수', genre: '퍼즐', description: '반대편의 모양을 닮도록 맞춰보기', tags: ['대칭', '도형'], minutes: 3, maxMinutes: 6, status: 'upcoming' },
  { id: 'pebble-stack', title: '조약돌 쌓기', genre: '순발력', description: '흔들리지 않게 조심조심 쌓는 돌탑', tags: ['균형', '타이밍'], minutes: 2, maxMinutes: 4, status: 'upcoming' },
  { id: 'pocket-tangram', title: '주머니 칠교', genre: '퍼즐', description: '일곱 조각에 숨어 있는 모양 찾기', tags: ['칠교', '조각'], minutes: 3, maxMinutes: 10, status: 'upcoming' },
  { id: 'dice-picnic', title: '주사위 소풍', genre: '보드', description: '가벼운 선택으로 완성하는 주사위 한 판', tags: ['주사위', '선택'], minutes: 5, maxMinutes: 10, status: 'upcoming' },
];

const preferredGenres = ['퍼즐', '숫자', '기억', '순발력', '보드'];
const catalogGenres = [...new Set(GAME_CATALOG.map(game => game.genre))];
const GENRES = ['전체', ...preferredGenres.filter(genre => catalogGenres.includes(genre)), ...catalogGenres.filter(genre => !preferredGenres.includes(genre))];
const FAVORITES_KEY = 'simplegames.library.favorites.v1';
const state: LibraryState = { query: '', genre: '전체', onlyFavorites: false, includeUpcoming: true, sort: 'default', limit: 12 };
const validIds = new Set(GAME_CATALOG.map(game => game.id));
const favorites = new Set<string>();
function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing library element: ${id}`);
  return node as T;
}
const grid = el('game-grid');

function storageWarning() {
  el('storage-notice').textContent = '이 환경에서는 즐겨찾기를 저장할 수 없어, 현재 화면에서만 유지됩니다.';
  el('storage-notice').hidden = false;
}
try {
  const saved: unknown = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
  if (Array.isArray(saved)) saved.filter(id => typeof id === 'string' && validIds.has(id)).forEach(id => favorites.add(id));
} catch { storageWarning(); }

function saveFavorites() {
  try { localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites])); }
  catch { storageWarning(); }
}

function create<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function matchesBase(game: CatalogGame): boolean {
  const text = [game.title, game.genre, ...game.tags].join(' ').toLocaleLowerCase('ko-KR');
  return (!state.query || text.includes(state.query))
    && (!state.onlyFavorites || favorites.has(game.id))
    && (state.includeUpcoming || game.status === 'available');
}

function renderGenres(base: CatalogGame[]): void {
  const tabs = el('genre-tabs');
  tabs.replaceChildren();
  GENRES.forEach(genre => {
    const count = genre === '전체' ? base.length : base.filter(game => game.genre === genre).length;
    const button = create('button', 'genre-tab');
    button.dataset.genre = genre;
    button.setAttribute('aria-pressed', String(state.genre === genre));
    button.append(create('span', '', genre), create('span', 'genre-count', String(count)));
    button.addEventListener('click', () => {
      state.genre = genre; changeFilters();
      [...tabs.querySelectorAll<HTMLButtonElement>('button')].find(tab => tab.dataset.genre === genre)?.focus({ preventScroll: true });
    });
    tabs.append(button);
  });
}

function artwork(game: CatalogGame, index: number): HTMLDivElement {
  const genreArtwork: Record<string, string> = { '퍼즐': 'puzzle', '숫자': 'number', '기억': 'memory', '순발력': 'reflex', '보드': 'board' };
  const art = create('div', `card-art art-${genreArtwork[game.genre] ?? 'puzzle'}`);
  art.setAttribute('aria-hidden', 'true');
  art.style.setProperty('--variation', String(index % 4));
  if (game.id === 'little-dragon') {
    art.classList.add('art-snake');
    const mini = create('div', 'mini-snake');
    for (let i = 0; i < 6; i++) mini.append(create('i', ''));
    art.append(mini, create('span', 'mini-snack'));
  } else if (game.id === 'neon-rally') {
    art.classList.add('art-pong');
    const mini = create('div', 'mini-court');
    for (let i = 0; i < 3; i++) mini.append(create('i', ''));
    art.append(mini);
  } else if (game.id === 'cosmic-cleanup') {
    art.classList.add('art-breakout');
    const mini = create('div', 'mini-breakout');
    for (let i = 0; i < 32; i++) mini.append(create('i', ''));
    mini.append(create('span', 'mini-breakout-paddle'), create('span', 'mini-breakout-ball'));
    art.append(mini);
  } else if (game.id === 'block-workshop') {
    art.classList.add('art-falling');
    const mini = create('div', 'mini-falling');
    for (const value of ['','','T','','','T','T','T','','','','','L','J','','','L','L','J','J']) mini.append(create('i', value ? 'filled' : '', value));
    art.append(mini);
  } else if (game.id === 'balloon-sparrow') {
    art.classList.add('art-sparrow');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 96 96');
    svg.classList.add('mini-sparrow');
    const bird = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    bird.setAttribute('href', '/games/06-flappy/assets/kit.svg#sparrow-fly0');
    svg.append(bird); art.append(svg);
  } else if (game.id === 'desert-post' || game.id === 'cloud-bunny') {
    const desert = game.id === 'desert-post';
    art.classList.add(desert ? 'art-desert' : 'art-cloud-bunny');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 96 96');
    svg.classList.add('mini-g022');
    const directory = desert ? '07-dino' : '08-doodle';
    const pose = desert ? 'run0' : 'idle';
    const layers = desert ? ['postal-bag-run0', `base-${pose}`, 'postal-body-run0', 'postal-hat-run0'] : [`base-${pose}`];
    for (const layer of layers) {
      const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      use.setAttribute('href', `/games/${directory}/assets/kit.svg#${layer}`);
      svg.append(use);
    }
    art.append(svg);
    if (!desert) for (let step = 0; step < 3; step++) art.append(create('i', `mini-cloud-step cloud-step-${step}`));
  } else if (game.id === 'number-garden') {
    art.classList.add('art-garden');
    const mini = create('div', 'mini-numbers');
    ['2', '4', '8', '16'].forEach(value => mini.append(create('i', '', value)));
    art.append(mini);
  } else {
    const shapes = create('div', 'art-shapes');
    const symbols = game.genre === '숫자' ? ['2', '4', '8'] : game.genre === '기억' ? ['✳', '❋', '❋'] : ['', '', ''];
    symbols.forEach(symbol => shapes.append(create('i', '', symbol)));
    art.append(shapes);
  }
  art.append(create('span', 'art-index', String(index + 1).padStart(2, '0')));
  return art;
}

function createCard(game: CatalogGame): HTMLElement {
  const index = GAME_CATALOG.indexOf(game);
  const card = create('article', `game-card ${game.status === 'available' ? 'available' : 'upcoming'}`);
  card.dataset.id = game.id;
  const cover = create('div', 'card-cover');
  cover.append(artwork(game, index));
  const favorite = create('button', 'favorite-button', favorites.has(game.id) ? '★' : '☆');
  favorite.dataset.id = game.id;
  favorite.setAttribute('aria-pressed', String(favorites.has(game.id)));
  favorite.setAttribute('aria-label', `${game.title} 즐겨찾기 ${favorites.has(game.id) ? '해제' : '추가'}`);
  favorite.addEventListener('click', () => {
    if (favorites.has(game.id)) favorites.delete(game.id); else favorites.add(game.id);
    saveFavorites();
    if (state.onlyFavorites) state.limit = 12;
    render();
    const replacement = grid.querySelector<HTMLButtonElement>(`.favorite-button[data-id="${game.id}"]`);
    (replacement || el('favorites-only')).focus({ preventScroll: true });
  });
  cover.append(favorite);
  const body = create('div', 'card-content');
  const meta = create('div', 'card-meta');
  meta.append(create('span', `status-pill ${game.status}`, game.status === 'available' ? '플레이 가능' : '준비 중'), create('span', 'genre-label', game.genre));
  const description = create('p', 'card-description', game.description);
  description.title = game.description;
  body.append(meta, create('h3', '', game.title), description);
  const bottom = create('div', 'card-bottom');
  bottom.append(create('span', 'duration', `${game.minutes}–${game.maxMinutes}분 예상`));
  let action: HTMLAnchorElement | HTMLButtonElement;
  if (game.status === 'available') {
    const link = create('a', 'button card-action primary', '게임 시작 ↗');
    if (!game.href) throw new Error(`Playable game is missing a launch URL: ${game.id}`);
    link.href = game.href;
    link.setAttribute('aria-label', `${game.title} 게임 시작`);
    action = link;
  } else {
    const button = create('button', 'button card-action', '준비 중');
    button.disabled = true;
    action = button;
  }
  bottom.append(action); body.append(bottom); card.append(cover, body);
  return card;
}

function render() {
  el('catalog-total').textContent = String(GAME_CATALOG.length);
  el('intro-preview').textContent = `플레이 가능 ${GAME_CATALOG.filter(game => game.status === 'available').length} · 준비 중 ${GAME_CATALOG.filter(game => game.status === 'upcoming').length}`;
  el('catalog-description').textContent = `전체 ${GAME_CATALOG.length}개 목록에는 개발 예정 게임이 포함됩니다. 준비 중인 게임은 아직 플레이할 수 없습니다.`;
  const base = GAME_CATALOG.filter(matchesBase);
  const results = base.filter(game => state.genre === '전체' || game.genre === state.genre);
  if (state.sort === 'name') results.sort((a, b) => a.title.localeCompare(b.title, 'ko'));
  if (state.sort === 'duration') results.sort((a, b) => a.minutes - b.minutes || GAME_CATALOG.indexOf(a) - GAME_CATALOG.indexOf(b));
  renderGenres(base);
  grid.replaceChildren(...results.slice(0, state.limit).map(createCard));
  const shown = Math.min(state.limit, results.length);
  el('result-count').textContent = `${results.length}개`;
  el('results-title').textContent = state.onlyFavorites ? '즐겨찾는 게임' : state.genre === '전체' ? '모든 게임' : `${state.genre} 게임`;
  el('display-count').textContent = `${results.length}개 중 ${shown}개 표시`;
  el('favorite-count').textContent = String(favorites.size);
  const sortLabels: Record<SortOrder, string> = { default: '기본순', name: '이름순', duration: '짧은 시간순' };
  el('game-sort').textContent = sortLabels[state.sort];
  el('game-sort').setAttribute('aria-label', `게임 정렬: ${sortLabels[state.sort]}`);
  document.querySelectorAll<HTMLButtonElement>('[data-sort]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.sort === state.sort));
  });
  el('favorites-only').setAttribute('aria-pressed', String(state.onlyFavorites));
  el('clear-search').hidden = !el<HTMLInputElement>('game-search').value;
  el('empty-state').hidden = results.length !== 0;
  el('load-more-area').hidden = results.length === 0;
  el('load-more').hidden = shown >= results.length;
  el('all-loaded').hidden = shown < results.length;
}

function changeFilters() { state.limit = 12; render(); }
el<HTMLInputElement>('game-search').addEventListener('input', () => { state.query = el<HTMLInputElement>('game-search').value.trim().toLocaleLowerCase('ko-KR'); changeFilters(); });
el('clear-search').addEventListener('click', () => { el<HTMLInputElement>('game-search').value = ''; state.query = ''; changeFilters(); el<HTMLInputElement>('game-search').focus(); });
el('favorites-only').addEventListener('click', () => { state.onlyFavorites = !state.onlyFavorites; changeFilters(); });
el<HTMLInputElement>('include-upcoming').addEventListener('change', () => { state.includeUpcoming = el<HTMLInputElement>('include-upcoming').checked; changeFilters(); });
function closeSortMenu(restoreFocus: boolean): void {
  el<HTMLDetailsElement>('sort-menu').open = false;
  if (restoreFocus) el('game-sort').focus({ preventScroll: true });
}
document.querySelectorAll<HTMLButtonElement>('[data-sort]').forEach(button => {
  button.addEventListener('click', () => {
    const sort = button.dataset.sort;
    state.sort = sort === 'name' || sort === 'duration' ? sort : 'default';
    changeFilters();
    closeSortMenu(true);
  });
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && el<HTMLDetailsElement>('sort-menu').open) {
    event.preventDefault();
    closeSortMenu(true);
  }
});
document.addEventListener('click', event => {
  if (event.target instanceof Node && !el('sort-menu').contains(event.target)) closeSortMenu(false);
});
el('load-more').addEventListener('click', () => {
  const previous = grid.children.length;
  state.limit += 12; render();
  const nextCard = grid.children[previous];
  nextCard?.querySelector<HTMLButtonElement>('.favorite-button')?.focus({ preventScroll: true });
});
el('reset-filters').addEventListener('click', () => {
  Object.assign(state, { query: '', genre: '전체', onlyFavorites: false, includeUpcoming: true, sort: 'default', limit: 12 });
  el<HTMLInputElement>('game-search').value = ''; el<HTMLInputElement>('include-upcoming').checked = true; closeSortMenu(false);
  render(); el<HTMLInputElement>('game-search').focus();
});
el('back-to-top').addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  document.querySelector<HTMLAnchorElement>('.brand')?.focus({ preventScroll: true });
});
render();
