# 네 번째 모음 · 61~80

원안: 사용자지정 `E:/Work2/Codex/Games/게임제작-001/simple-games-61-100` 중61~80만구현했습니다. 기존89 ID와60게임을보존하여카드109/실행80/준비29입니다.

운영수용 여부는최신HANDOFF/작업일지를따릅니다. 실사용주소 http://192.168.0.195:15010/ 의 **61–80 · 네 번째 게임 모음**에연결하는릴리스입니다.

| 번호 | 게임 | 폴더 |
|---|---|---|
| 61 | 여섯 면 도장 | `public/games/61-cube` |
| 62 | 회전 표지판 | `public/games/62-twiddle` |
| 63 | 빙하 보석 배달 | `public/games/63-inertia` |
| 64 | 숫자 화단 | `public/games/64-filling` |
| 65 | 산수 작업대 | `public/games/65-keen` |
| 66 | 번호 가림막 | `public/games/66-singles` |
| 67 | 전망 통로 | `public/games/67-range` |
| 68 | 거울 야간 전시 | `public/games/68-undead` |
| 69 | 진주길 한 바퀴 | `public/games/69-pearl` |
| 70 | 타일 그림자 | `public/games/70-mosaic` |
| 71 | 작은 목장 울타리 | `public/games/71-palisade` |
| 72 | 낮밤 체크판 | `public/games/72-unruly` |
| 73 | 문양 장터 | `public/games/73-qwirkle` |
| 74 | 모서리 영토 | `public/games/74-blokus` |
| 75 | 지붕 위 한 걸음 | `public/games/75-santorini` |
| 76 | 정지선 없는 로봇 | `public/games/76-ricochet-robots` |
| 77 | 다섯 칸 도장 | `public/games/77-onitama` |
| 78 | 별불꽃 합주 | `public/games/78-hanabi` |
| 79 | 궁전 쪽지 | `public/games/79-love-letter` |
| 80 | 능선에서 멈출까 | `public/games/80-cant-stop` |

## 실행과검증

- 후보: `artifacts/g034-release-build`. 라이브전환후이폴더에덮어쓰기빌드금지. 새실험은새출력디렉터리사용.
- 후보검증 `node scripts/vol4-validate.mjs`, 통합 `node scripts/vol4-smoke.mjs`, 운영재확인 `node scripts/vol4-smoke.mjs --live`, 실제앱상태 `node scripts/vol4-runtime.mjs`.
- 모든규칙/게임시험 `npm run test:games`. 이전모음시험도함께실행하며일부Node test안에는브라우저자동시험이포함됩니다.
- 실행ZIP `releases/simple-games-vol4-80games-*.zip`+manifest: Node24이상으로압축해제폴더의 `start-local.cmd` 또는 `node src/server/index.js --host 127.0.0.1 --port 3101`.
- 기획 [PLAN](PLAN.md),소유권/후속 [PM_CONTRACT](PM_CONTRACT.md),자산 [ASSETS](ASSETS.md).
- 구현 [61~65](BUILD_A.md),[66~70](BUILD_PM.md),[71~75](BUILD_B.md),[76~80](BUILD_C.md).
- 독립QA [61~65](QA_A.md),[66~70](QA_PM.md),[71~75](QA_B.md),[76~80](QA_C.md).

## 실제콘텐츠와제한

- 61~65각8판/66·67각8판/68 6판/69·70각8판/71 8판/72 10판/76 8판으로총104고정문제입니다.77은자체이동카드8종·5장세트3개,78은18장정보제한협력,79는10장4효과/3승,80은주사위4개·능선11개를제공합니다.
- 일부고정판은회전/수치변형이며,66일부4원본변형·69직사각형6/꺾인둘레2 등도입형문제가있습니다. 사람난이도/목표플레이시간은미검증입니다.
- 63실패후에는공유정책에따라재시작하며진행중undo를제공합니다. 73/78/79손패가리개는앞면을DOM/aria/data/snapshot에넣지않고,현재플레이어가명시적으로열었을때만허용된정보를보여줍니다.
- 좁은보드는44px타깃을유지하고안쪽가로스크롤을사용합니다.페이지가로넘침은검사합니다. WebKit native select/스크린샷CSS주입문제를선택버튼/캡처분리로처리하며CSP나오류검사를완화하지않습니다.
- 외형은기호·도형·색/테두리·일부안테나변형으로표현하며원작그림을복사하지않았습니다. 물리폰/실제Safari/음향청취/스크린리더/사람완전플레이는별도수용입니다.
- 기존PM2저장dump·이전LOW·과거G013증거미복구이력은별도로유지합니다. 전역save/타앱/방화벽/설치/기록삭제는범위밖입니다.
