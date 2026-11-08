# G033 독립 QA · 41~45 추론 게임

- 판정: **PASS_WITH_LIMITATIONS**. 핵심 규칙·최소 고정 콘텐츠·키보드/포인터 성공 흐름에서 차단 제품 결함을 찾지 못했습니다. 후보빌드·홈·운영 수용을 대신하지 않습니다.
- 검토자: builder_55_60가 자신의55~60 소스를 동결한 뒤 역할을 전환했습니다. 이 검토에서는 **41~45 제품 소스를 수정하지 않았으며**, 작성자의 시험/솔버를 재실행하는 것으로 독립 검사를 대체하지 않았습니다.
- 원안: 사용자 `simple-games-20-vol3` 41~45 문서, 공통 사양, `docs/vol3/PLAN.md`. 대상 main/engine/levels/style/index와 전용 공통 puzzle-ui 및 셸 총28파일 SHA256: `artifacts/g033-qa-logic/source-manifest.json`.

## 실제 수행 결과

1. `node --test tests/games/vol3-independent-logic-engine.test.mjs` → **44/44 PASS, 실패/skip0**.
   - 41: 별도 직사각형 열거/칸 exact-cover 탐색으로8판 모두 해수1. 면적만맞는2단서·중첩·빈단서 거부/1×N 허용.
   - 42: 별도 무순서숫자쌍 테셀레이션으로8판 모두 해수1. 0·2/2·0중복·대각·행끝wrap·겹침 거부.
   - 43: 독립 로컬단서/차수/연결 그래프 검사가8정답과 모든 단일변변경에서 제품판정과 일치. 단서가맞는2고리/열린끝 거부.
   - 44: 독립 그래프/차수/사용칸 행열검사가8정답과 모든 단일변변경에서 일치. 수량이맞는 A-B+별도고리 거부. 고정선로 검사.
   - 45: 다각형 선분의 공선·양의길이 겹침으로 독립 계산한8지도 인접관계가 실제그래프와 일치. 꼭짓점만의 접촉은 인접아님. 고정색변경거부·다른합법색칠허용.
2. `node --test tests/games/vol3-independent-logic-browser.test.mjs` 최종 → **4/4 node:test PASS**, 실제게임 **15/15** + 저장차단 **5/5**.
   - 비동결 실제시계·약80ms trusted 입력. PC Chromium/320px모바일 Chromium/320px모바일 WebKit에서 각5게임 첫판을 **키보드 첫유효입력+포인터 나머지입력으로 완주**했습니다.44는 실제1.8초열차연출뒤결과를 확인했습니다.
   - 완료0번/minHints0 저장→다음문제시작→정지snapshot동결→재개→도움말초점→reload의문제선택/완료기록보존. 가로넘침없음. 제품 console/pageerror/request/CSP 오류0.
   - 별도 Storage 읽기/쓰기 모두예외 환경에서5게임이 경고를 표시하고 시작/정지/재개 가능했습니다.
3. 실제 화면 관찰: Chromium 캡처의 모바일41·42·43·45, PC44를 이미지로 열어 직접 보았습니다. 크림격자/타일·쌍선반/고리단서·변/철길·행열수량/색기호·잠금·다각형이 구분되고 글자/버튼/모달이 가려지지 않았습니다.

## 첫 WebKit 캡처 실패와 분리 증거

- 최초 브라우저 실행은 **3 PASS/1 FAIL**이었습니다. WebKit41에서 `page.screenshot` 직후 style-src CSP 1건을 검출했습니다. 초기원본은 `browser-output.txt`와 `browser-2026-11-08T03-11-00-398Z/results.json`에 보존했습니다.
- 분리 재현 `webkit-screenshot-isolation.json`: 게임실행 콘솔0→기본스크린샷1건→reload/재시작0→caret:initial스크린샷도1건. 게임행위와 캡처호출을 분리해 Playwright WebKit 캡처의 스타일삽입에서 발생함을 확인했습니다. 제품 CSP를 완화하거나 오류문구를 필터링하지 않았습니다.
- 최종 기능게이트는 WebKit에서 스크린샷호출을 분리하고 **동일 게임 완주/입력/저장/정지 검사를 모두 유지**해5/5 PASS입니다. Chromium 캡처는 최종 검사에도 유지했습니다. WebKit 캡처도구 CSP는 미해결 도구한계이며 제품 PASS 수치에 숨겨 넣지 않습니다.

## 증거

- 엔진 원시출력: `artifacts/g033-qa-logic/engine-output.txt`.
- 최초 브라우저 원시출력: `artifacts/g033-qa-logic/browser-output.txt`.
- 최종 브라우저 원시출력: `artifacts/g033-qa-logic/browser-output-final.txt`.
- 최종 결과·Chromium10장: `artifacts/g033-qa-logic/browser-2026-11-08T03-12-21-253Z/`.
- 도구분리: `artifacts/g033-qa-logic/webkit-screenshot-isolation.json` 및 두 캡처 PNG.

## 한계와 다음 단계

- 실제HTTP는 기존 서버생성API로 소스 public을 loopback 임시포트에 제공한 검사입니다. 제품전체빌드/타입·홈카드·기존40회귀·15010운영·PM2/PID/LISTEN/HTTP바이트는 PM 통합 검증 범위입니다.
- 모든40고정판은 규칙/데이터 검사, 브라우저 완주는 각게임첫판만입니다. 사람수동플레이/실물모바일/실청취/스크린리더/모든해상도는 미검증입니다.
- 43 후반단서축소·45 두인접구조/기하변형 콘텐츠와44px내부보드스크롤은 작성자에 의해 명시된 범위이며 차단제품결함으로 보지 않았습니다. 최소8판수량·핵심규칙은충족합니다.
- 다음: PM이 이 SHA대상과 통합결과를 인수→새후보/전체회귀→승인운영수용→일지/게시readback. 55~60은 본 검토자의 구현이므로 **별도 검토자가 독립 수용**해야 합니다.
