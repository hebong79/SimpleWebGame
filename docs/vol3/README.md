# 세 번째 모음 · 신규41~60

기획·디자인: 사용자 지정 `E:/Work2/Codex/Games/게임제작-001/simple-games-20-vol3`를 읽고 기존 프로젝트에 독립 게임20개를 추가했습니다. 현재 총89카드/실행60/준비29를 유지합니다.

실사용: http://192.168.0.195:15010/ 에서 **41–60 · 세 번째 게임 모음** 선택. 운영 수용 여부와 최신 증거는 HANDOFF/작업일지를 따릅니다.

| 번호 | 게임 | 폴더 |
|---|---|---|
| 41 | 시장 구획도 | `public/games/41-rectangles` |
| 42 | 숫자 타일 창고 | `public/games/42-dominosa` |
| 43 | 울타리 한 바퀴 | `public/games/43-loopy` |
| 44 | 산마루 철길 | `public/games/44-tracks` |
| 45 | 네 빛깔 국경 | `public/games/45-map` |
| 46 | 전망대 설계소 | `public/games/46-towers` |
| 47 | 쌍별 성도 | `public/games/47-galaxies` |
| 48 | 반사 연구실 | `public/games/48-blackbox` |
| 49 | 자석 분류대 | `public/games/49-magnets` |
| 50 | 화살표 탐사록 | `public/games/50-signpost` |
| 51 | 마지막 조약돌 | `public/games/51-nim` |
| 52 | 구슬 경기장 | `public/games/52-abalone` |
| 53 | 새벽 차고 | `public/games/53-rush-hour` |
| 54 | 정원 건너기 | `public/games/54-quoridor` |
| 55 | 순간 도감 | `public/games/55-dobble` |
| 56 | 심장별 수리소 | `public/games/56-rhythm-doctor` |
| 57 | 수정 우물 탐사 | `public/games/57-downwell` |
| 58 | 두더지 구조굴 | `public/games/58-dig-dug` |
| 59 | 위아래 우주실 | `public/games/59-vvvvvv` |
| 60 | 섬마을 셔틀 | `public/games/60-mini-metro` |

## 실행·검사

- 최종후보(라이브전환후 덮어쓰기금지): `artifacts/g033-final-build`.
- 전체 타입/새후보/자동검증: `node scripts/vol3-validate.mjs`. 운영전환 뒤에는 사용중 빌드 재생성이 잠기므로 스크립트의 빌드 출력 경로를 새 디렉터리로 바꿔 실행합니다.
- 규칙/게임회귀: `npm run test:games`.
- 새후보 통합: `node scripts/vol3-smoke.mjs`.
- 실제15010 재확인: `node scripts/vol3-smoke.mjs --live`.
- 운영경로읽기: `node scripts/vol3-runtime.mjs`.
- 실행ZIP: `releases/simple-games-vol3-60games-*.zip`와 인접manifest. 패키지 내 `start-local.cmd`, Node24이상. ZIP무결성·바이트 검증을 수행합니다.

## 설계·검증·제한

- [기획 계약](PLAN.md), [PM소유권/후속](PM_CONTRACT.md), [자산/출처](ASSETS.md).
- 구현 인수: [41~45](BUILD_A1.md), [51~54](BUILD_B.md), [55~60](BUILD_C.md).
- 독립 QA: [41~45](QA_LOGIC.md), [46~50](QA_PM5.md), [51~54](QA_BOARD.md), [55~60](QA_ACTION.md).
- 41~50각8문제와53차고8개,56박자3개,57하강3구간,58굴3맵,59우주실6방을 제공합니다. 일부퍼즐은 회전·전치·높이변형으로 구성하여 독립문제군 다양성이 제한됩니다.
- 46단서위치는물리적인사방대신방향명붙은가로줄입니다. 54동물은진영기호·외형표시,58주인공은공통직접제작로봇도형으로시안과다릅니다. 일부의상은색·테두리변주입니다.
- 좁은화면52/53/54는44px터치칸을유지하고보드안가로스크롤을사용합니다. 페이지가로넘침은없습니다.
- 실제사람게임체감/실물모바일/음향청취/스크린리더는미검증입니다. WebKit스크린샷도구의inline스타일주입CSP오류는별도재현했으며, 제품기능게이트는스크린샷없이엄격CSP를검사했습니다.
- 기존PM2저장dump/과거G013증거미복구/기존낮은관찰은별도이력유지입니다. 전역save·타앱·방화벽·설치변경은하지않습니다.
