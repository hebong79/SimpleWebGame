# G033-QA-PM5 · 46~50 및 공통 셸 독립 QA

- 역할: 구현에 참여하지 않은 46~50의 독립 QA입니다. 이전 builder 작업51~54는 이번 QA 대상에 포함하지 않았습니다.
- 기준: 원안46~50 개별 문서, 공통 사양, `docs/vol3/PLAN.md`, 실제 `public/games/46-towers`~`50-signpost` 및 `vol3/shared.mjs/css`를 대조했습니다.
- 최신 판정: **PASS_WITH_LIMITATIONS · 발견한 기능 결함5건 CLOSED**. 최종 델타검사와 미변경 범위 재사용 근거는 아래 최종 재검증 절을 따릅니다.
- baseline 판정: **FAIL · PM 수정 및 재검증 대기**. 규칙 엔진은 통과했지만 키보드·통과 표시·드래그에서 재현된 결함이 있습니다.
- source SHA256은 각 실행 폴더 `source-hashes.json`에 저장했습니다. 후보 빌드/운영15010 검사가 아닌 현재 public 소스의 임시 loopback HTTP 검사입니다.

## 최종 재검증 · PASS_WITH_LIMITATIONS

- 최종 판정: **발견한 기능 결함 모두 해결 확인, source HTTP 기준 PASS_WITH_LIMITATIONS**. 후보 빌드·운영15010·사람/실물 수용은 PM 후속입니다.
- PM 수정 후 `node --test tests/games/vol3-independent-pm-engine.test.mjs tests/games/vol3-independent-pm-browser.test.mjs`에서 엔진 **53/53 PASS**를 재확인했습니다(7/8번의 새 대각선/멀리연결 데이터 포함). `2026-11-08T03-11-42-993Z` 전체UI 재검사는46/48/47의 기존 수정 확인 뒤 새50 드래그 보완의 단순탭 회귀를 찾아 FAIL로 보존했습니다. 모바일47의 포인터완주 실패는 재시작 후 보드가 화면 밖으로 스크롤된 상태에서 좌표 입력한 QA 도구 문제였으며 스크롤 보완으로 해결했습니다.
- 새50 회귀: pointercapture가 단순탭 click을 격자 부모로 바꿔 두 번 탭해도 선택/연결되지 않았습니다. 최소 재현 원본 `50-tap-regression-1794107602809/result.json`. PM이 pointerup에서 같은칸/다른칸을 각각 처리하고 native 중복click을 억제했습니다.
- 최종 전용 검사 `tests/games/vol3-independent-pm-delta.test.mjs`: Chromium **7/7**, mobile WebKit **7/7** 확인 항목 PASS. 실제80ms 탭2회, trusted 드래그1회,15개연결 전체완승, 포커스된 정확한 칸Enter/초점유지,정지 후 상태 보존,47 SVG경계 초점보존과 직접 좌표벽 입력 완승,console/pageerror0.
- Chromium 최종원본: `artifacts/g033-qa-pm5/delta-2026-11-08T03-14-35-675Z/desktop-chromium.json`. 같은 실행의 모바일은 QA의 드래그 전 스크롤 누락으로 중단됐으므로 통과로 표시하지 않았습니다.
- 스크롤 보완 후 모바일 최종원본: `artifacts/g033-qa-pm5/delta-2026-11-08T03-15-07-660Z/mobile-webkit.json`. 실행 `node --test --test-name-pattern=mobile-webkit tests/games/vol3-independent-pm-delta.test.mjs` →1 PASS/0 FAIL. 두 환경의 동등한 최종 항목14개가 통과했습니다.
- 마지막 mobile WebKit 보조재검증: `artifacts/g033-qa-pm5/controls-final-1794107755099/result.json`.46 단서Enter→미리보기·보드불변,48 포트Enter→조사1·후보불변,48 입구0/출구15 양끝 `통과 1` 일치,console/pageerror0을 별도 확인했습니다.
- 최종 source hash 비교에서 직전 전체검사 대비 변경된 제품 파일은 **50-signpost/main.mjs 하나뿐**입니다.46~49/50엔진/공통셸의 이전 결과를 재사용하고 변경된50 입력을 전용검사로 덮었습니다. hash근거 `delta-2026-11-08T03-15-07-660Z/source-hashes.json`. 최종50 수정 뒤5종 전체UI를 같은 한 실행에서 다시 통과시킨 것은 아니며, 기존 정상 범위+변경 델타 검증입니다.
- D1/D2/D3/D4/O1 모두 CLOSED. 기능 blocker 없음. LOW 관찰(46 사방단서의 쌓인 가로줄 배치,46/47의 변형 문제군 콘텐츠 다양성)은 남아 있습니다. 실제 이미지로46 화면과 `2026-11-08T03-11-42-993Z/47-desktop.png`를 확인했고47은 격자·중심별·경계·설명의 겹침 없이 읽힙니다.
- 테스트도구의0폭 SVG locator/스크롤·변수범위 문제와 제품 결함, 초기FAIL과최종PASS를 분리했으며 모든 원본을 보존했습니다. WebKit screenshot 호출/오류필터링/제품 소스수정은 QA가 하지 않았습니다.

## 독립 엔진 검사

`node --test tests/games/vol3-independent-pm-engine.test.mjs` → **53 PASS / 0 FAIL**.

- 46: 제품 `solve()`를 호출하지 않고 순열 행+열중복+사방시야를 독립 열거해8문제 모두 정확히1해임을 확인했습니다. 빈칸·중복·단일단서 불일치 거부,2·1·4·3 양방향2개를 확인했습니다.
- 47: 여덟 정답의 직교 연결요소·중심 정확히1개·모든 칸180°반사 포함을 별도로 확인했습니다. 한 구역내 불필요벽·좌우대칭만인 비회전대칭·중심2개를 거부했고 변/꼭짓점 중심을 수용했습니다.
- 48: [Simon Tatham의 공식 Black Box 규칙](https://www.chiark.greenend.org.uk/~sgtatham/puzzles/doc/blackbox.html)을 실제 읽고 앞대각선 회절·입구반사·정면흡수 우선을 적용한 별도 행/열 벡터 시뮬레이터를 작성했습니다. 두구슬300배치×20포트 **6,000반응 전부 일치**. 각 고정판을 구별하는12개 이하 포트집합에 대해 다른299배치가 실제 배제됨을 독립 확인했습니다. 조사12회/반복무료/제출3회/후보2개/승리중복 방지를 검사했습니다.
- 49: 각틀의 비중첩·두칸인접·정답 행/열 극수 검증, 대각동극 허용/직교동극 금지, 세로반전시 두행 극수 변경, 중립과미정의 완료상태 차이를 검사했습니다.
- 50: 여덟 경로의16칸 단일방문·모든화살표·중간고정번호를 별도 확인했습니다. 먼방향 연결·8방향 좌표 판별·전후임중복/순환·부분사슬/고정번호모순 거부를 검사했습니다.

## 실제 HTTP 브라우저 baseline

실행: `node --test tests/games/vol3-independent-pm-browser.test.mjs`.

- Desktop Chromium과 mobile WebKit에서 비동결 실제 시계·80ms trusted 누름을 사용했습니다. WebKit screenshot 호출은 하지 않았으며 CSP오류를 필터링하지 않았습니다.
- 최초 실행: `artifacts/g033-qa-pm5/2026-11-08T03-07-56-987Z/`. 각 환경16개 통과 후 46/47결함을 기록했고, SVG 선의0폭에 대한 Playwright `locator.click` 가시성판정으로 나머지검사가 중단됐습니다. 해당 SVG 예외는 제품결함으로 분류하지 않았습니다.
- 검사 보완: 실제 SVG좌표에서 `page.mouse.click(...,{delay:80})`로 경계를 누르도록 변경했습니다. 이미 확인된 46/47 실패를 반복하지 않기 위해 `QA_CONTINUE=1` 부분검사로48~50를 계속했습니다.
- 부분 실행 `03-09-22-372Z`는 QA 스크립트의 변수범위오류입니다. 제품결함과 분리해 원본을 보존했습니다.
- 남은 기능검사: `artifacts/g033-qa-pm5/2026-11-08T03-09-31-751Z/`. 각 환경 **46개 PASS /3개 제품결함 FAIL**. 포트12회·반복무료·정답승리·3실패위치공개·복기,49의4상태·완승,50의탭완승, 정지동결/재시작취소·모달초점/문제전환확인·취소/폭320px/저장차단후승리/홈복귀가 통과했습니다. console/page/request 오류0, CSP오류0.
- 첫 실행에서 46 pointer높이입력·완승·완료저장 및 단서미리보기도 통과했습니다.

## 재현 결함

| ID | 심각도 | 실제 재현과 관찰 | 기대 |
|---|---|---|---|
| QA-PM5-D1 | MEDIUM | 46 시작→`위1` 단서버튼focus→80ms Enter. `preview:null`, `data[0]:1`로 현재칸 높이가 변경됩니다. 양 환경 재현. | 단서미리보기를 토글하고 보드높이는 유지. |
| QA-PM5-D2 | MEDIUM | 48 시작→첫 포트버튼focus→80ms Enter. `attempts:0`, `shots:{}`, `guesses:[0]`. 양 환경 재현. | 포트1회 조사, 후보는 변경하지 않기. |
| QA-PM5-D3 | MEDIUM | 48 첫판 포트0은 통과출구15. 입구에만 결과가 추가되고 출구버튼은 `왼쪽1` 그대로이며 marked없음. 양 환경 재현. | 출입구 양끝에 동일 조사번호/쌍 표시. |
| QA-PM5-D4 | MEDIUM | 50 시작→1칸에서2칸까지 실제 pointer down/move/up. 모든후임이-1로 남습니다. 탭두번 연결은 정상. 양 환경 재현. | 원안의 드래그 연결 지원. |
| QA-PM5-O1 | LOW | 47 SVG경계focus→Enter는 벽을 토글하지만 render로 해당노드가 삭제되어 `document.activeElement`가body로 이탈합니다. | 경계포커스를 유지해 연속키보드작업 가능. |

PM에게 실제 재현을 즉시 전달했으며 QA는 제품 소스를 수정하지 않았습니다. PM은D1~D4 및50의대각선/멀리연결 콘텐츠 보완 계획을 전달했습니다. 수정 후 새 경로로 전체 재검증이 필요합니다.

## 화면·콘텐츠·미검증

- `03-07-56-987Z/46-desktop.png`를 실제 이미지로 확인했습니다. 제목·격자·높이/기둥·조작·설명은 읽을 수 있습니다. 사방단서는현재 모두가로줄로 위아래 배치되어 방향명은있지만 원안의물리적인사방배치와차이가 있습니다(LOW 디자인관찰).
- 46은 원본라틴4개와전치/회전/높이변환,47은네분할과90°회전으로8레벨을 구성합니다. 즉8레벨 모두독립된새문제군은 아닙니다. `PLAN.md`의 대칭변형고지 요구에 따라 콘텐츠 다양성 한계로 기록합니다.
- baseline50은 엔진이8방향을 판정하지만 제공경로는직교화살표뿐입니다. PM이후반판대각선/멀리연결을보완예정입니다.
- 사람플레이·실물모바일·실청취·스크린리더·운영15010·PM2·후보빌드는 이번QA에서 미검증입니다.
- 다음: PM 수정→53엔진사례 재실행+5종 전체 UI 새경로 재검사→PM통합판/실사용15010 수용. baseline 실패·검사도구실패·수정후결과를 서로 덮어쓰지 않습니다.
