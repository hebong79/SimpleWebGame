# G032 · 21~40 제작 계약

- 원본: `D:/Work/Game/Game-001/simple-games-20-vol2` (읽기 전용). 개별 games/*.md 전체와 해당 PNG를 먼저 확인합니다.
- 엔진: 기존 Node 24.16.0 / TypeScript 빌드 / 브라우저 ES modules, HTML·CSS·Canvas. 외부 의존성 설치 없음.
- PM: 공통 `public/games/vol2/shared.mjs`, `shared.css`, 홈 카탈로그, 빌드·통합·기록. 각 builder는 배정된 게임 폴더와 배정 테스트/보고서만 수정합니다.
- 게임 경로: 21-pattern,22-solo,23-net,24-bridges,25-lightup,26-tents,27-slant,28-untangle,29-guess,30-othello,31-set,32-mancala,33-maze,34-asteroids,35-missile-command,36-hexagon,37-qbert,38-whac-a-mole,39-fruit-ninja,40-cut-the-rope.
- 각 게임 `index.html`: 한국어 title, viewport, `<link rel="stylesheet" href="../vol2/shared.css">`, 필요하면 로컬 styles.css, `<script type="module" src="./main.mjs"></script>`; body는 비워도 됩니다.
- `main.mjs`는 `import { mount, el, button, grid, svg } from '../vol2/shared.mjs'` 사용 가능. DOM 런타임과 순수 규칙 `engine.mjs` 분리를 권장합니다.
- `mount({ id, title, subtitle, help, theme, create })`. theme은 색상 이름이 아닌 `ink|blue|night|sea|forest|glass|violet|wood|berry|slate`. help는 한국어 문자열(개행 지원), subtitle은 장르·조작 요약.
- `create(ctx)`는 `{ reset(), undo?(), key?(event), tick?(dtSeconds), pause?(), snapshot?() }` 반환. 처음 reset으로 준비 화면, 시작마다 reset. 보드 조작은 `ctx.active()`가 true일 때만 허용. tick은 playing에만 실행, dt<=0.05초. 물리는 자체 고정 tick accumulator 사용.
- ctx: `board`(focusable div), `tools`(추가 버튼 div), `record`(게임별 version1 저장 객체, wins/best/theme 포함), `persist()`, `active()`, `status(text)`, `score(number)`, `meta(text)`, `win(text, score=0)`, `lose(text, score=0)`. win/lose는 한 판 한번만 정산. custom 진행 필드는 검증 후 사용. `ctx.record`에는 JSON 가능한 작은 값만 저장.
- helpers: `el(tag, className='', text?)`→HTMLElement; `button(text,fn,className='')`→button; `grid(parent,columns)` adds class and CSS grid columns; `svg(tag,attrs={})` SVG namespace element. 게임 자체 DOM 생성과 스타일 가능.
- 공통 shell: 시작/정지·재개/재시작확인/도움말/테마·기록/홈, 자동 탭 이탈 정지, 안전한 저장, 키 repeat 차단, 게임 포커스 제한. game `key`는 board 안 포커스에만 전달, Esc는 shell. pointer 핸들러와 tools는 active 자체 검사. 공통 버튼 ID: start,pause,restart,undo,help,wardrobe; #board,#tools,#status,#score,#meta. `window.__vol2`는 state와 snapshot() read-only 테스트 관찰.
- 출고: 원안 최소 문제 수·핵심 규칙·키보드+터치·undo(퍼즐)·승패·재시작·외형을 구현합니다. 퍼즐 해 존재/유일 해 요구는 solver 테스트로 증명하고 단순 반복을 서로 다른 문제로 세지 않습니다. 부족한 항목은 숨기지 말고 보고합니다.
- 신규 자산은 직접 그린 CSS/Canvas/SVG, 원작/시안 PNG를 런타임 자산으로 복사하지 않습니다. 디자인의 색·배치를 참고합니다.
- 수용: 실제 파일, 순수 엔진 테스트, fresh build, PC Chromium/모바일 Chromium/WebKit HTTP smoke·80ms 누름·CSP·좁은 화면. 자동검사와 수동 플레이는 분리합니다.
- 후속 의존: 구현인수 → PM 홈 등록(기존49 ID 보존, 신규20, 69/40/29) → 새 빌드 → 독립QA/회귀 → 승인 필요 Git/15010 운영 전환 → 실제 LAN 실행 확인. 이번 제작 요청은 운영 변경 승인으로 해석하지 않습니다.
- 기존 미커밋 파일 보존. 빌드/PM2/공유설정/과거증거 수정·삭제 금지. worker 재위임 금지. 동일 실패 2회면 상황 보고 후 다른 독립 작업 진행.

## 사용자 추가 지시 — 2026-11-07
- 사용자가 "승인요청하지말고 바로 진행해줘"라고 지시했습니다. PM은 추가 승인 질문 없이 검증 후 기존 `number-garden-2048` 앱 하나의15010 운영 반영과 실제LAN 브라우저 확인까지 진행합니다. 이는 본 작업에 필요한 운영 전환 범위이며, 다른 앱 재기동·전역PM2save·방화벽/ACL·유료설치·임의 삭제로 확대하지 않습니다. worker는 기존 제품/테스트 소유권을 유지합니다.
