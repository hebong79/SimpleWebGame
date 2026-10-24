# G-002 구현 인계 — 숫자 정원 · 2048

## 구현 범위

- 브라우저 TypeScript: `src/client/{engine,state,input,storage,audio,main}.ts`입니다. 외부 런타임 의존성, CDN, 전역 디버그/보드 조작 훅이 없습니다.
- `public/index.html`, `public/style.css`: 크림·숲·흙색 게임 중심 화면, PC 보드 좌측/정원 우측, 모바일 보드 우선 세로 배치입니다.
- 시작 안내, 현재/최고 점수, 목표 배지, 정원 원본 SVG 큰 미리보기, 기록·정원 선택, 도움말, 재시작 확인, 정지/재개, 최초 성공, 막힘 결과를 구현했습니다.
- native `dialog`로 배경 비활성/내부 포커스 이동/닫은 뒤 초점 복귀를 제공합니다. 성공과 막힘 동시에는 축하 우선, 계속하기 비활성, 결과 보기입니다.
- 정원 자산은 G-003 소유입니다. 파일 생성/수정은 하지 않았습니다. 정상 SVG 15개가 존재하는 시점에 실제 화면 연결을 확인했습니다. 숫자는 DOM 텍스트이며 아트 실패 시 기본 배경색이 남습니다.
- HTML 스크립트 `/scripts/main.js`, 스타일 `/style.css`, favicon `/assets/favicon.svg`; 상대 TS import 확장자는 `.js`입니다. 인라인 스크립트/스타일 속성/HTML 문자열 삽입을 사용하지 않습니다.

## 공개 모듈 계약 — QA import용

### `engine.ts` — 순수/불변 연산

- `Board = number[][]`, `Direction = 'up' | 'down' | 'left' | 'right'`, `RNG = () => number`, `Position = { row, col }`입니다.
- `isTile(unknown): boolean`, `validateBoard(unknown): boolean`: 4×4, 빈칸 0 또는 2 이상 안전 정수의 정확한 2의 거듭제곱을 검사합니다. sparse 배열도 거부합니다. 큰 정수에서 log2 반올림만으로 타일을 오인하지 않습니다.
- `emptyBoard(): Board`, `cloneBoard(board): Board`, `emptyCells(board): Position[]`, `maxTile(board): number`, `canMove(board): boolean`을 export합니다.
- `move(board, direction): { board, changed, scoreDelta, merges, mergedPositions }`는 **새 타일 생성 전** 결과입니다. `merges`는 쌍의 수, `mergedPositions`는 결과 타일 좌표입니다. 원본 보드/행 참조를 수정하지 않습니다. 잘못된 입력/안전 정수 초과 연산은 throw합니다.
- `spawnTile(board, rng): { board, position, value }`: 빈칸은 **row-major**, 난수는 **위치 → 값**, 정확히 2회입니다. 값 난수 `< 0.9`는 2, 나머지는 4입니다. 난수 범위는 `[0,1)`이며 빈칸이 없으면 난수 호출 없이 throw합니다.
- `createBoard(rng): Board`: 빈 보드에서 순차 생성 2회, 난수 총 4회입니다. 엔진은 전역 `Math.random`을 호출하지 않습니다.

### `state.ts` — 순수 상태 전이

- `GameState`: `phase`(`ready|playing|paused|won|over`), `modal`(`help|gardens|restartConfirm|null`), `board`, `score`, `highestTile`, `moves`, `won`, `finished`, `bestAtStart`, `profile`입니다.
- `createReady(profile = defaultProfile())`: 보드는 빈 보드, 시작수 미증가, 난수 없음입니다.
- `startGame(state, rng)`: 기존 프로필 보존, 시작수 +1, 시작 타일 2개, 점수/판별 플래그 초기화입니다.
- `applyMove(state, direction, rng): { state, changed, scoreDelta, merges, mergedPositions, spawned? }`: 이동→점수→생성→기록/해금→성공/막힘을 동기 확정합니다. no-op/모달/정지는 같은 state 참조, RNG 0회입니다. 저장/DOM/시간 의존성은 없습니다.
- 최초 성공과 막힘은 각각 판당 1회 기록합니다. 동시 발생은 `phase='won'`, `finished=true`, `gamesWon`과 `gamesFinished` 각각 +1입니다.
- `pauseGame`, `resumeGame`, `openModal`, `closeModal`, `continueGame`, `showResult`, `selectGarden`, `setMuted`, `nextGoal`, `recordLabel`을 export합니다.
- 도움말 중 이탈은 `pauseGame(openModal(...))`로 기존 모달을 보존하면서 phase만 paused로 바꿉니다. 닫아도 paused이며 `resumeGame`을 명시적으로 호출해야 합니다.
- QA fixture는 import한 순수 `GameState` 값으로 만들 수 있습니다. 실제 페이지에는 fixture/임의 상태 주입 인터페이스가 없습니다.

### `storage.ts` — 프로필만 저장

- 키 `number-garden:profile:v1`; 내부 `version: 1`입니다. 진행판은 저장하지 않습니다.
- `Profile` 필드: `version,bestScore,bestTile,gamesStarted,gamesFinished,gamesWon,totalMoves,totalScore,unlockedGardens,selectedGarden,muted`입니다.
- `Garden = 'seed' | 'grove' | 'bloom'`; `gardensFor(bestTile)`는 기본/256/1024 해금을 유도합니다.
- `defaultProfile()`, `normalizeProfile(unknown): {profile,recovered}` 및 `ProfileStore`를 export합니다.
- `new ProfileStore(storage?)`: `StorageLike`는 `getItem(key)`/`setItem(key,value)`만 있으면 됩니다. `load(): Profile`, `save(profile): boolean`, `blocked`, `recovered`로 검사합니다.
- 숫자/버전/객체 구조 불량은 전체 기본값으로 복구합니다. 선택/음소거/해금 문자열만 불량이면 유효 기록을 유지하고 정규화합니다. `finished<=started`, `won<=started`, `totalScore>=bestScore`를 검사하지만 성공+막힘의 합을 시작수와 비교하지 않습니다.
- 원문은 16KiB 상한입니다. 게임 키만 정규화하며 clear/removeItem을 호출하지 않습니다. 저장 접근·읽기·쓰기 예외는 세션 동안 sticky 메모리 모드와 지속 경고로 처리합니다.

### 입력·소리·화면 연결

- `swipeDirection(dx,dy)`는 24 CSS px 이상/우세 축만 허용하고 동률은 무효입니다. `bindInput(board, {enabled,move,pause})`는 `{reset,destroy}`를 반환합니다.
- Pointer Events 단일 경로, primary pointer 1개, 다중 포인터/취소/캡처 해제 시 제스처 폐기입니다. 키는 보드 자체 초점에서만, `repeat`와 held 집합으로 제한합니다.
- `MergeAudio`: `setMuted`, `activate`, `merge`, `stop`, `available`. 기본 음소거, 사용자 버튼 제스처 뒤 AudioContext, 짧은 oscillator+gain 합성음입니다. 합치기 유효 이동당 1회이며 정지/이탈/음소거는 재생 노드를 중단합니다.
- 표시 효과는 최대 120ms입니다. 타이머는 효과/입력잠금만 해제하며 보드·점수·기록을 수정하지 않습니다. 정지/모달/이탈/재시작은 타이머·포인터·누른 키·음을 정리합니다. reduced motion이면 표시 효과/잠금을 생략합니다.

## 자체 검증 — 실제 실행 결과

환경: Windows 11, Node.js **v24.16.0**, 프로젝트 설치 TypeScript **7.0.2**, Playwright Chromium **156.0.8078.4**(headless)입니다.

| 명령/검사 | 실제 결과 |
|---|---|
| `npm run typecheck` | 종료 0, strict 프로젝트 타입 오류 없음 |
| `npm test` | 1회 실패. 아래 PM 빌드 스크립트 차단 원인 참조 |
| `npm exec -- tsc -p tsconfig.json` | 종료 0, 실제 JS 컴파일 완료 |
| `node --test dist/tests/unit/engine.test.js dist/tests/unit/state.test.js dist/tests/unit/storage.test.js dist/tests/unit/input.test.js` | **24 tests / 24 pass / 0 fail**, 종료 0 |
| `node --test dist/tests/unit/*.test.js` | PM 서버 테스트 포함 **44 tests / 44 pass / 0 fail**, 종료 0 |
| 실제 정적 서버 + headless Chromium 스모크 | 시작 타일 2개/보드 초점, 키 이동, 도움말/닫기 초점복귀, 정지/명시 재개, 정원 3종 확인, 콘솔/페이지 오류 **0개** |
| 320×568 에뮬레이션 | 가로 overflow=false, 표시 중 버튼 중 44×44 미만 **0개**, 전체 스크린샷 확인 |
| 추가 자동 브라우저 경계 검사 | 키 길게 누르기 추가 이동 없음, 도움말 중 blur 후 닫아도 paused, 23px 무효/24px 유효 모의 pointer, 재시작 취소/확인 카운터, reload 준비+기록 보존, localStorage getter 차단 시 경고+메모리 플레이 통과 |

자체 단위 테스트 파일: `tests/unit/{engine,state,storage,input}.test.ts`입니다. 순수 엔진 4방향/단일 합치기/합 보존/불변성/난수경계/overflow, 상태의 중복 집계·성공+막힘·정지·정원 불변성, 저장 손상/선택 검증/차단, 스와이프 경계를 다룹니다.

화면 증거(현재 세션 scratch; 임시 보존):
- `C:/Users/hebon/AppData/Local/hermes/cache/scratch/g002/g002-desktop-ready.png`
- `C:/Users/hebon/AppData/Local/hermes/cache/scratch/g002/g002-desktop-play.png`
- `C:/Users/hebon/AppData/Local/hermes/cache/scratch/g002/g002-mobile-play.png`
- `C:/Users/hebon/AppData/Local/hermes/cache/scratch/g002/g002-mobile-gardens.png`

브라우저 스모크는 별도 임시 포트의 loopback 서버를 켜고 finally에서 서버/브라우저를 종료했습니다. Math.random 고정·모의 PointerEvent 테스트는 자동 테스트이며 실제 손가락/음향 청취를 의미하지 않습니다.

## PM 통합 차단 및 미검증

- **PM 소유 `scripts/build.mjs:7`**의 `require.resolve('typescript/bin/tsc')`가 설치된 TS7 패키지 exports에 없어 `ERR_PACKAGE_PATH_NOT_EXPORTED`로 `npm test`의 빌드 단계가 실패했습니다. 워커는 scripts/package 수정 금지이므로 수정하지 않았습니다. `npm exec -- tsc -p tsconfig.json`은 실제 성공했습니다. PM은 패키지 지원 CLI 경로/해당 exports에 맞춰 빌드 스크립트를 수정해야 합니다.
- 자체 브라우저 실행용으로 성공한 tsc 출력과 public을 `dist/public`/`dist/public/scripts`에 복사하여 **실제 PM 정적 서버 구현**으로 검증했습니다. 이는 실패한 npm 빌드를 성공했다고 표시한 것이 아닙니다.
- 모든 AC의 독립 QA 수용을 대신하지 않습니다. 실제 모바일(Android/iOS), Firefox, 실물 터치/회전, 실제 소리 청취, 외부망 차단 환경, 성공·결과 UI 전체 브라우저 fixture 검증은 별도 QA/PM 확인이 필요합니다. 성공+막힘 판정/계속하기 금지는 단위 테스트로 통과했습니다.
- BACKLOG/DECISIONS/HANDOFF/package/서버/아트/QA 소유 파일을 수정하지 않았습니다.
