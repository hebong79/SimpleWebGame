# G028-INTEGRATE 새후보 및 초기smoke 결과

- task_id: G028-INTEGRATE
- status: **INITIAL_SMOKE_FAILED_C06_PRODUCT_FIX_PENDING**. 홈 통합/후보 생성은 완료했으나 전체 개발수용·운영 완료가 아닙니다.
- 실제 작업: 2026-11-01 KST. PM 지시에 따라 두 실제 구현보고/API를 인수하고 어댑터를 완성, 사용자 추가승인 범위의 ecosystem 해당게임script만 g028-build로 변경한 뒤 새 후보와 초기3180smoke를 실행했습니다. Git/PM2/운영조작/게임소스/공유최종상태/기존증거는 수정하지 않았습니다.

## 변경 파일

이번 재개: `tests/e2e/g028-new-games.spec.ts` 실제15/16어댑터·G028_ADAPTERS_READY=true, `src/client/library.ts`의 네별 카드에 직접제작 SVG연결선, `ecosystem.config.cjs`의 해당게임script 한줄. 신규 API보고 `20261101-112414_G028_SHARED_IMPLEMENTATION_API.md`와 이 결과보고, 전용 artifacts. 이전사전작업의 홈2record/SVG·package description·기존8spec기대수·신규runner/config는유지합니다.

## 실제 검증

1. `& 'C:/Program Files/nodejs/node.exe' scripts/g028-verify.mjs --mode build` → **exit0**, `artifacts/g028-integration/runs/d4ed49c7/report.json`, BUILD_CREATED_NOT_PLAYTESTED. 소스/시험 strict타입검사·신규게임4+4mjs/게임단위2파일/하네스 구문검사 모두exit0. 실제후보 `artifacts/g028-build` 새생성, 이전빌드덮기없음. 기존5705파일SHA/size/mtime보존.
2. 후보 `artifacts/g028-build/g028-build-manifest.json` → source196/output156개 SHA. manifest SHA256 `2922f9705293ce069436d0cfd923372bd94ee48a700fb0279383fa482adc841c`.
3. `& 'C:/Program Files/nodejs/node.exe' scripts/g028-verify.mjs --mode smoke` → **exit1**, `artifacts/g028-integration/runs/3d3a9bef/report.json`, FAILED. 실제18발견/18실행, **15PASS/3FAIL**, skip0/pending0/flaky0/retry0. DesktopChromium1366×900, MobileChromium375×812, MobileWebKit390×844. 이초기smoke에서게임단위시험은0개이며builder/PM단위를재실행한것으로계상하지않습니다.
4. HTTP제공131파일 모두 실제바이트·CSP·nosniff일치. 세환경홈45/16/29·16링크·375/320DOM레이아웃·즐겨찾기·기존upcoming보존PASS. audit의모든console/pageerror/CSP/외부요청/HTTP실패/실패요청은0입니다.
5. 16 lifecycle 세환경PASS: 실제정답→prefix2→오답결과/1회정산·token재도전, 정지동결·테마적용/미리보기·음소거·도움말·재시작/홈취소·홈확인. actual trusted 클릭각19개, 실제최소hold PC100.90ms/MobileChromium100.80ms/WebKit104ms. 가상시계없음.
6. 원FAIL3건모두15의준비화면 `#home` 링크높이 **21px**, width90.453125px로strict44px조작영역기준C06실패입니다. 첫화면기하에서종료되어15lifecycle은미실행이며PASS로추정하지않습니다. 단언완화/게임수정/자동재시도없습니다. 원JSON·trace·error-context는3d3a9bef/execution아래보존했습니다.
7. finally서버close뒤연결거부를확인해 `server.stoppedAndRefused=true`. 별도실제3180LISTEN조회0. G028_BROWSER_GATE_RELEASED확인,QA15에슬롯양보보고. smoke전기존5898파일SHA/size/mtime전부보존.

## 제한 및 후속

PM이15제품결함을인수해BUILD15만수정하도록배정했습니다. 다음후보는 `artifacts/g028-build-fix1`로지정되었으며ecosystem을그경로로맞추는후속배정은대기합니다. 현재원후보/manifest/원FAIL/시험단언을보존했습니다. 신규후보가필요하며이번원후보를운영완료로사용하면안됩니다.

전체회귀full·독립QA·수정후재시험·16시작직후패드viewport추가관측·사람플레이·실기기·실청취·네이티브OS이탈·운영3116은이보고범위에서미검증입니다. PM의추가패드관측요청은headless실행페이지를외부에서연결할수없어별도관측하지않았고QA16전용검사로전달했습니다. 최종HANDOFF/KST일지/게시/Git/실제운영은PM전용입니다.
