# G028-INTEGRATE 공통 통합 사전 작업

- 상태: **STATIC_PREPARATION_PASS_API_PENDING**. PM 인수 전이며 게임 구현 완료·브라우저/운영 검증을 뜻하지 않습니다.
- 범위: library.ts, package.json description, 기존 홈 기대수 시험 8개, 신규 G028 러너/config/spec, 전용 artifacts만 수정했습니다. 게임 소스/게임 단위시험/공유 상태 문서/Git/PM2/기존 증거는 수정하지 않았습니다.

## 반영

- `sun-sea-four` 햇빛과 바다 4목 → `/games/15-connect-four/index.html`, 보드/1~4분.
- `four-star-song` 네 별의 노래 → `/games/16-simon/index.html`, 기억/0.5~3분.
- 두 카드는 기존 14개 실행 항목 다음에 추가했습니다. 첫12개/전체 기존43개 레코드의 순서와 내용을 보존하고 합계45/실행16/준비29입니다. memory-pieces/leisure-line은 별도 upcoming입니다.
- 카드 SVG는 이 작업에서 직접 작성한 원·경로·문자·사각형입니다. 외부 저작물/이미지/폰트/원격 참조/유료 자산을 사용하지 않았습니다. 기존 프로젝트 소유 아트 구조를 재사용하며 별도 외부 라이선스가 없습니다.
- `scripts/g028-verify.mjs`, `tests/g028-playwright.config.ts`: Node24.16.0/TS7.0.2/Playwright1.64.1, 후보3180 전용. 새 `artifacts/g028-build[-revision]`만 생성 가능하며 기존 후보 덮어쓰기를 거부합니다. 각 실행은 고유 `artifacts/g028-integration/runs/<8hex>`이며 모든 child 전 `GAME_TEST_ARTIFACT_DIR`를 설정합니다. 소스/출력 SHA manifest, 기존 증거 SHA/size/mtime 보존검사, 실제 HTTP 바이트/CSP/nosniff, 3브라우저 및 기존 회귀를 포함합니다.
- 실제 두 implementation handoff/main을 확인하기 전 `G028_ADAPTERS_READY=false`입니다. 후보 빌드/브라우저 실행은 차단됩니다. placeholder lifecycle은 실행되면 실패하며 skip/PASS로 처리하지 않습니다.
- G028 spec에는 비동결 실제 trusted 누름100ms(driver delay, 실제측정80ms이상), CSP/console/외부요청0, 홈·즐겨찾기·320px·낮은창·기존14게임 저장키 보존 틀을 준비했습니다. API 의존 lifecycle은 아직 미확정입니다.

## 실제 검증

증거: `artifacts/g028-integration/preflight-20261101-000149-b1d4c5/report.json` 및 같은 폴더 stdout/stderr.

실행: `& 'C:/Program Files/nodejs/node.exe' artifacts/g028-integration/preflight-20261101-000149-b1d4c5/verify-static.mjs`

- 카탈로그 정적 비교 1그룹 PASS: g027 실제 빌드 library.js의 기존43레코드와 신규 두항목을 제외한 현재 카탈로그 JSON 전체 동일, 45/16/29·고유ID45·신규경로2·기존upcoming2 보존.
- `node --check scripts/g028-verify.mjs`: exit0.
- `node node_modules/typescript/bin/tsc --noEmit`: exit0.
- e2e config+10개spec strict TypeScript noEmit: exit0. 정확한 전체 인수는 report.json에 있습니다.
- 실행된 게임 단위시험0, 브라우저0, 후보빌드0, 서버시작0. 시각/사람플레이/실기기/실청취/3116운영은 미검증입니다.
- 첫 일반 shell은 helper_sandbox_lock_failed였고 동일 프로젝트 읽기 명령 escalation으로 해결했습니다. 정적 스크립트 작성 중 Python tzdata 부재가 확인돼 설치 없이 UTC+9 datetime으로 작성했습니다. 제품 시험 실패가 아닙니다.

## 다음

PM이 두 실제 implementation handoff 수용/소스 동결을 알리면 공개 selector와 __g028Snapshot 실제 구조를 읽고 lifecycle 어댑터를 확정합니다. PM의 후보 생성·3180 브라우저 시간 승인 후 새 빌드→초기 smoke→독립 QA→회귀 순으로 진행합니다. Git/3116 운영/공유 상태/최종 일지/게시판은 PM 담당입니다.
