# SimpleGames · 작은 쉼표

## 실사용 주소 — PM2 여섯 게임 서버

**실사용 주소는 http://192.168.0.195:3116/** 이며, 이 PC에서는 http://127.0.0.1:3116/ 도 사용할 수 있습니다. 기존과 같은 PM2/LAN 주소에서 여섯 게임을 제공합니다. `ecosystem.config.cjs`의 number-garden-2048을 사용하며 이번 G019 반영은 사용자 승인에 따라 이 게임 서버만 새 빌드로 재기동하며 방화벽·다른 서비스를 바꾸지 않습니다.

**플레이 가능 6개 · 준비 중 29개 · 전체 35개**입니다. 이전 시안의 “체험 시안/시안 보기”가 아니라 실제 “플레이 가능/게임 시작” 카드여야 합니다.

### 3116 운영 빌드와 재기동

현재 운영 릴리스 경로는 `artifacts/g019-build`입니다. 이 빌드 디렉터리는 Git에 포함되지 않으므로 다른 PC에서 체크아웃한 뒤에는 먼저 빌드해야 합니다.

```sh
node scripts/build.mjs --out-dir artifacts/g019-build
pm2 restart ecosystem.config.cjs --only number-garden-2048 --update-env
```

새 릴리스는 사용 중인 빌드에 덮어쓰지 말고 별도 디렉터리에 빌드·검증한 뒤 `ecosystem.config.cjs`의 script 경로를 바꿔 재기동하세요. PM2의 실제 script/PID와 3116의 홈·게임 응답을 확인해야 반영 완료입니다. `pm2 restart all`은 사용하지 않습니다. 직전 `artifacts/g016-build`는 롤백용으로 보존합니다.

### 별도 로컬 개발 서버 — 3102

아래 명령은 실사용 PM2 3116을 대체하지 않고 현재 소스를 빌드하는 별도 개발용 **http://127.0.0.1:3102/** 서버를 실행합니다.

```sh
npm start
# 또는
npm run preview
```

Windows에서는 **start-local.bat** 또는 기존 **start-game.cmd**를 실행하셔도 됩니다. VS Code 작업 **SimpleGames: 6개 게임 서버 시작 (3102)**도 같은 실행기를 사용합니다. 브라우저는 자동으로 열지 않으며, 서버 콘솔에서 Ctrl+C로 종료합니다.

- Node.js 24 이상 및 이 프로젝트의 기존 개발 의존성이 필요합니다. 의존성이 이미 설치된 환경에서는 추가 설치/인터넷이 필요하지 않습니다. 최초 개발 설치만 `npm ci`를 직접 실행하세요.
- 매번 **현재 소스**를 `artifacts/local-server-build`에 빌드한 뒤 그 `public`만 제공합니다. 옛 `dist`나 시안을 조용히 대신 실행하지 않습니다. 빌드 실패·포트 사용 중이면 오류로 종료하며 다른 서버를 죽이지 않습니다.
- 기본 포트는3102, 주소는127.0.0.1(loopback)입니다. 다른 포트는 `npm start -- --port 3201`로 선택할 수 있습니다. 이 실행기는 `--port`만 받으며 임의 LAN 공개·방화벽 변경·상주서비스 설치를 하지 않습니다.
- **기존3102 시안 서버가 켜져 있다면 해당 콘솔에서 Ctrl+C로 종료한 뒤 실행**하세요. 다른 프로세스를 무작정 종료하지 마세요.
- `npm run dev`도 같은 현재 서버를 실행합니다. PC/앱 종료 후 자동 재시작은 구성하지 않았습니다.

## 플레이 가능한 여섯 게임

| 게임 | 종류 | 같은 서버의 경로 | 시작과 홈 복귀 |
|---|---|---|---|
| 숫자 정원 |2048|`/game.html`|진입하면 새 판. 작은 쉼표/게임종료→결과→홈으로|
| 꼬마 용 간식 여행 |스네이크|`/games/02-snake/index.html`|여행 시작→방향키/화면 방향버튼. 작은 쉼표 링크|
| 네온 랠리 |퐁|`/games/03-pong/index.html`|경기 시작→방향키/W S·패들 조작. 작은 쉼표 링크|
| 우주 청소부 |벽돌깨기|`/games/04-breakout/index.html`|시작/발사→마우스·방향키/A D·하단 터치. 게임목록→필요시 종료확인|
| 한 판 블록 공방 |낙하 블록|`/games/05-falling-blocks/index.html`|작업 시작→방향키/Space 또는5버튼. 홈→종료 확인|
| 풍선 참새 |플래피|`/games/06-flappy/index.html`|첫 비행 시작→Space/화면 탭. 홈→종료 확인|

준비 중 포함을 끄면 위6개만 남습니다. 검색·장르·즐겨찾기·정렬·더보기는 같은 목록을 사용합니다. 준비 중29개는 아직 구현 완료된 게임이 아닙니다.

## 시안과 실제 서버의 구분

이번 연결 문제의 원인은 `npm run preview`가 `docs/prototype`의 **옛 30개 카드/체험 시안1개**를 제공했기 때문입니다. 현재 소스에는 네 게임의 링크와 실제 페이지가 이미 있었지만 그 빌드를 서비스하지 않았습니다.

이제 start/preview/Windows/VS Code 진입점을 같은 최신 실행기로 통일했습니다. 원래 시안과 코드는 삭제하지 않았으며 필요한 경우 별도 포트에서만 명시적으로 실행합니다.

```sh
npm run preview:design -- --port 3112
```

3101/3104/3105는 이전 검증 주소입니다. **3116은 현재 유지되는 실사용 PM2/LAN 서버**, **3102는 별도 수동 로컬 개발 서버**이며 둘을 혼용하지 마세요. artifacts/g013-build·g014-build는 과거 검증 기록이고 현재 PM2 설정은검증된 artifacts/g019-build를 제공합니다. 이미 열어 둔3102 홈은 시안서버 교체 후 새로고침하세요.

## 기록과 데이터

실제 게임 기록은 게임별 localStorage 키, 공통 즐겨찾기는 `simplegames.library.favorites.v1`에 저장합니다. 저장소를 일괄 삭제하지 않으며 게임규칙/저장키를 바꾸지 않았습니다. 옛 시안의 즐겨찾기는 `simplegames.prototype.library.favorites.v1`라는 별도 키입니다. 시안의 테스트 기록이나 다른 포트의 실제 기록은 자동 이전하지 않습니다. 진행 중 판의 저장 여부는 각 게임 설계에 따릅니다.

## 검증과 제한

```sh
npm run typecheck
npm run test:launcher
```

연결 수정의 실제 HTTP·브라우저·독립검토 결과는 `docs/G017_CONNECTION_FIX.md`, `artifacts/g017-pm/`, `artifacts/g017-qa/`와 최신 `docs/HANDOFF.md`에 기록합니다. 실행 전의 과거 QA 폴더/실패 증거는 덮어쓰지 않으며, 전체 회귀를 다시 실행할 때는 test child 환경과 config의 출력 경로를 모두 새 폴더로 명시해야 합니다.

G-016의 게임 구현 검증은 `docs/G016_COMPLETION.md`·`docs/G016_VERIFICATION.json`을 참조하세요. **실물 기기/실청취·WebKit 네이티브 복합터치·사람의 플레이시간 목표·과거 G013 QA 자료 보존 사고는 이번 연결 수정으로 해결된 것으로 주장하지 않습니다.**

## 구조와 자산

- `src/`:2048/공통홈/보안 정적서버 TypeScript. `public/games/`:게임별 독립 ES모듈·HTML·CSS.
- `scripts/build.mjs`:기존 빌드. `scripts/serve_local.mjs`:현재 로컬 실행기. `docs/prototype`:보존한 옛 시안.
- `tests/unit`, `tests/games`, `tests/e2e`:단위/게임/브라우저 시험. `docs/worklogs`:한국시간별 작업일지.
- SVG·Canvas 벡터·WebAudio 합성음은 프로젝트에서 직접 작성했습니다. 외부 이미지·폰트·CDN·계정·DB·런타임 패키지가 필요하지 않습니다. [자산 명세](docs/ASSETS.md), [설계](docs/GAME_DESIGN.md), [결정](docs/DECISIONS.md), [인수인계](docs/HANDOFF.md).
