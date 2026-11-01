# G028-INTEGRATE fix1 후보·초기smoke 재검증

- task_id: G028-INTEGRATE
- status: **FIX1_INITIAL_SMOKE_PASSED_QA_PENDING**. PM 최종 수용·독립QA·전체회귀·운영 완료와 구분합니다.
- 실제수정보고를읽고15 styles SHA `0817cc0a4f987fee556c56c3468351e4200daa286038334b8f37629fd99b08c2`,16 main SHA `4654eedf8c253828bc2e0d35d84c3c6a9f9741ebc885a0f256d81819a110bbbd`,16 styles SHA `e7d2a723865a75a44a6940152111d42df4197f1c6202a0ef8a84fbdb5bfbd6e4`를실제파일과대조했습니다. 모두일치합니다.
- 변경파일: `ecosystem.config.cjs` 해당게임script 한줄을 `artifacts/g028-build-fix1/src/server/index.js`로변경. 이문서/전용신규artifacts. 게임제품·하네스·기대값·strict44px·CSP단언은변경하지않았습니다. 원g028-build/원FAIL3d3a9bef는보존했습니다. Git/실제PM2/운영은미조작입니다.

## 실제 명령과 결과

1. `& 'C:/Program Files/nodejs/node.exe' scripts/g028-verify.mjs --mode build --build artifacts/g028-build-fix1`: **exit0**, 새후보생성. 보고 `artifacts/g028-integration/runs/5d089c7b/report.json`, BUILD_CREATED_NOT_PLAYTESTED. 소스/e2e strict타입검사·신규게임및하네스구문검사exit0, 기존5925파일SHA/size/mtime보존.
2. `& 'C:/Program Files/nodejs/node.exe' scripts/g028-verify.mjs --mode smoke --build artifacts/g028-build-fix1`: **exit0**, EXECUTION_PASSED. 보고 `artifacts/g028-integration/runs/379e4d4a/report.json`, 원브라우저JSON `execution/playwright-results.json`. **18발견/18실행/18PASS/0FAIL/0skip/0pending/0flaky/0retry**, 약76초. 단위시험은이모드에서0개이며이전단위를재실행한것으로계상하지않습니다.
3. DesktopChromium1366×900/MobileChromium375×812/MobileWebKit390×844 각각6/6PASS. 홈45/16/29·기존준비29·16링크·375/320기하·검색/즐겨찾기·신규카드SVG·정확게임진입·실제입력·정지/재개·설정/음소거·확인취소보존·결과정산·재도전/홈을검사했습니다. 15정상7수sun승리와다음판sea선공,16첫정답/prefix2/오답결과와1회정산/token재도전도실제PASS입니다.
4. 15의기존C06원결함 `#home`은세환경모두 **90.453125×44px**로실측하여같은단언PASS입니다.
5. 비동결실제trusted클릭관측:15각22개,16각19개. 최소hold(ms):PC15=101.90/16=100.20,MobileChromium15=101/16=100.80,WebKit15=105/16=105. 가상시계/제품상태주입없음.
6. 실제HTTP제공131파일 모두바이트/CSP/nosniff일치. 신규spec의12개unfiltered진단attachment에서console/pageerror/CSP/외부요청/HTTP실패/요청실패/비안전method총0건. live검사도모든오류단언PASS입니다.
7. finally서버종료·연결거부확인 `server.stoppedAndRefused=true`;별도실제3180LISTEN0. G028_BROWSER_GATE_RELEASED확인및QA15슬롯양보보고. smoke기존 **6118파일SHA/size/mtime전부보존**.

## 후보 provenance

- 후보: `artifacts/g028-build-fix1`
- manifest: `artifacts/g028-build-fix1/g028-build-manifest.json`
- SHA256: `f0d56aa86ea3ea1d80f489b4839a1f94d9fb0328f7b8c0c5ceb5841b077feeed`
- 소스198개/출력156개해시가포함되며명령실행전후소스불변·출력일치를검사했습니다. ecosystem및두FIX구현보고도소스manifest에포함됩니다.

## 다음과 제한

PM은이새후보를QA15/QA16의독립실행검증에넘기고그뒤별도배정한full회귀를진행합니다. 본인은추가브라우저/서버를시작하지않습니다.16시작직후/낮은가로화면의패드묶음전체노출추가수용은QA16전용관측범위이며이smoke의일반기하PASS로대체하지않습니다. 실제사람플레이·Android/iPhone/Safari·실손가락·실청취·네이티브OS이탈·3116운영은미검증입니다. 최종상태/HANDOFF/작업일지/게시/Git/PM2/운영은PM담당입니다.
