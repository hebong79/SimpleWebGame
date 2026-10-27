# G022-RUNNER-FIX — 독립 해금 oracle / 07 한정 단언 보완

- 상태: **TARGET_PASS_SELF_VERIFIED**. 임시 구현 워커 자체 검증이며 독립 QA·전체 릴리스·main/3116 완료가 아닙니다.
- PM 대현자 / 사용자 마스터. 적용 계약: `docs/G022_RUNNER_FIX_CONTRACT.md`.
- 소스 수정은 `tests/e2e/runner-jumper.spec.ts` 1개뿐입니다. 새 문서와 새 전용 증거 외 제품/다른 spec/guard/config/build/server/Git/index/branch/PRIVATE worktree는 쓰지 않았습니다.

## 변경 / 실제 관측

1. **DELTA-01:** 실제 `settleRecord`/`validateRecord`로 실현 가능한 이력을 만드는 경로는 유지했습니다. 아래 독립 boolean 표를 fixture/API와 UI apply 양쪽에 직접 단언합니다. 기존 네 논리 case 제목·개수는 같습니다.

   | metrics | sport | space |
   |---|---|---|
   | 4999 | false | false |
   | 5000 | true | false |
   | 4990+5000+20000 | true | false |
   | 4990+5000+20000+10 | true | true |

2. **DELTA-S01:** 8포즈마다 base/space-hat/sport-body/postal-bag 정확 href·실제 SVG 요소 visibility/opacity/비어 있지 않은 표시를 검사합니다. 실제 3프로젝트의 96개 레이어 관측을 보존했습니다. 혼합 조합·취소0쓰기·적용1쓰기·중간 정산0 기존 단언은 유지했습니다.
3. **DELTA-S02:** 기존 직접/중첩 모달·포커스/Tab/Escape/정지 검사는 유지했습니다. 320×667 및 667×375에서 열린 help/menu/wardrobe/confirm의 문서/모달 수평 overflow0, 모든 버튼 최소44px, viewport 안 dialog, 내부 scroll 정책, 스크롤 후 버튼 전체 기하와 hit-test를 하드 단언합니다. 실제 24개 열린 모달 기하/210개 버튼 도달을 검증했습니다. 기존 320px 결과 검사는 바꾸지 않았습니다.
4. **DELTA-S03:** 실제 trusted mouse duck hold의 height24/duckHeld=true를 관측한 뒤, 그 실제 pointerID로 synthetic pointercancel을 보냈습니다. height48/paused/pointercancel/입력 해제와 명시 재개 전 engine 불변을 검증했습니다. 3프로젝트의 down(trusted=true)와 cancel(trusted=false) ID 일치를 실행 JSON에서도 대조했습니다. 기존 외부 release/모바일 CDP/보드 밖 추가 접촉 검사는 유지했습니다.

## 실행 결과

- 실제 실행기: `C:/Program Files/nodejs/node.exe` **v24.16.0**, 설치된 TypeScript **7.0.2**, Playwright **1.64.1**. 설치·변경 없음.
- strictTS exit0:
  `node_modules/typescript/bin/tsc --ignoreConfig --noEmit --strict --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext --types node --lib ES2022,DOM,DOM.Iterable tests/e2e/runner-jumper.spec.ts artifacts/g022-integration/playwright.config.ts`
- 원본 config / PM3130 불변 런타임 / 1worker / retry0로 07-05/06/09/10만 실행했습니다. **수집21 / 실행21 / PASS21 / FAIL0 / skip0 / flaky0**, desktop-chromium/mobile-chromium/mobile-webkit 각각7/7입니다.
- 무필터 진단 attachment21: console warning/error·pageerror·CSP·외부요청·HTTP실패·요청실패 모두0. WebKit은 스크린샷 없이 DOM/layout 및 기능 단언을 유지했습니다.
- child 시작 전에 build=`artifacts/g022-build`, 새 candidate 경로, mode=`candidate`, phase=`full`을 명시하고 `GAME_LIVE_ORIGIN`은 제거했습니다. TMP/TEMP/TMPDIR/cache/log도 자기 새 artifact 아래로 지정했습니다. 정확 명령/exit/env는 `artifacts/g022-runner-fix/checks-v3.json`입니다.
- 최종 실제 결과: `artifacts/g022-integration/runs/runnerfix-20261027T130731219Z-8200/candidate/playwright-results.json`.

## negative-control / 보존

- 최종 spec에서 독립 기대표 및 fixture/API·UI의 실제 assertion 문장을 파싱해 실행했습니다. 원본 4행은 수용하고, 메모리 내 순수 save API의 `best>=500 → best>500`, `total>=3000 → total>3000` 두 변이에서 각각 정확 문턱 반례를 **fixture/API와 UI 양쪽에서 거부**했습니다. 기존 자기참조 predicate는 여전히 수용함도 확인했습니다. 제품파일/브라우저 변조 또는 변이 E2E 통과 주장이 아닙니다.
- 원본 입력37 중 spec 외36파일 SHA256 불변, oldQA11 SHA256 전부 불변입니다. old08 **17 literal callsite**와 07-04를 AST 범위 바이트 SHA로 대조했습니다. 08-04 포함 두 longframe 호출은 바이트 그대로이며 기존08의26논리 생성은 보존됐습니다. 해당 기존08/full204는 새로 실행하지 않았습니다.
- spec 수정 전 SHA256: `00170207d1338d095cbcc5406366ced6407bf0c219c747f1f47275b4ef18e0d6`
- spec 수정 후 SHA256: `a8bc6a5bde2abb6698b9e9a09df825e8d3c9c1122e2372810bba54d9b8e5ddc0`
- diff: **+91/-5행**, `artifacts/g022-runner-fix/small-diff.patch`. 원본은 `spec.before.ts`, 보존 증명은 `preservation.json`/`end-binding.json`, negative 원시는 `negative-controls.json`, 실행 집계/actual은 `runtime-summary.json`, 최종 인수는 **`artifacts/g022-runner-fix/handoff.json`**입니다.

## 발생한 관측 문제 / 수용 경계

- 계약 예시의 anchored `--grep ^G022-07-(05|06|09|10)`는 Playwright full title의 파일 suite prefix 때문에 수집0/exit1이었습니다. 같은 네 ID를 unanchored grep으로 지정해 정확21개를 수집/실행했습니다. 원본 config/guard는 바꾸지 않았고 최초 수집 실패 JSON/log도 보존했습니다.
- 첫 target은19PASS/2FAIL이었습니다. Chromium native nearest-edge 스크롤에서 wardrobe 버튼 끝0.390625px가 scrollport에 클립되어 엄격 도달 단언이 실패했습니다. 제품이나 허용오차를 바꾸지 않고 실제 `scrollIntoView({block:'center'})`로 중앙 스크롤한 뒤 **같은 엄격 기하 단언**을 재실행해21/21을 얻었습니다. 최초 실패/trace/JSON은 별도 고유 candidate에 그대로 있습니다. 새 제품 UI 결함으로 보고할 미해결 관측은 없습니다.
- 검증 스크립트의 TypeScript7 legacy parser API 미노출은 기존 Playwright 번들 Babel parser 재사용으로 해결했으며 설치하지 않았습니다.
- 기존 longframe4FAIL은 다른 worker 범위로 미재실행·미수정입니다. PM의 fresh 독립 delta검토·clock 작업 후 full204·main/실제3116 수용은 남아 있습니다. 실물 기기·native WebKit finger scroll·음향 청취는 이번 증거가 아닙니다.
- 허용 쓰기 범위 때문에 공통 HANDOFF/보드/전역 skill은 갱신하지 않았습니다. 재위임·Git stage/commit/push·서버 재시작은 하지 않았습니다.
