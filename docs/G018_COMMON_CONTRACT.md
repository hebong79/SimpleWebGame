# G018 · 5·6번 병렬 개발 공통 계약 — PM 대현자

- 작성: 2026-10-26 KST. 요청: PM 설계/디자인 후 기존 native cody-01·cody-02에게 개발 지시.
- 대상: E:/Work2/Project/SimpleGames/01-2048. 기존 Node24.16.0 / TypeScript7.0.2 / 브라우저 ES modules를 유지합니다.
- 이 문서는 설계·배정 기준입니다. 신규 게임 구현·QA·배포 완료를 뜻하지 않습니다.

## 소유권과 통합
| 담당 | 단독 쓰기 범위 |
|---|---|
| cody-01 / G018-05 | public/games/05-falling-blocks/**, tests/games/05-falling-blocks.test.mjs, docs/G018_05_IMPLEMENTATION.md, artifacts/g018-05-builder/** |
| cody-02 / G018-06 | public/games/06-flappy/**, tests/games/06-flappy.test.mjs, docs/G018_06_IMPLEMENTATION.md, artifacts/g018-06-builder/** |
| PM 대현자 | 설계/시안/수용표·계약, 공통 홈 src/client/library.ts/public/home.css, 프로젝트 문서·메타데이터, 격리 통합 빌드 |
| 독립 QA | 이후 별도 배정한 spec/증거만. 구현자가 단독 최종 수용하지 않습니다. |

두 구현자는 다른 게임·기존 시험·홈/공통 package/lockfile/README/AGENTS/TEAM/HANDOFF/BACKLOG/project.json/PM2/기존 artifacts를 변경하지 않습니다. 특히 dist, artifacts/g016-build, artifacts/local-server-build를 빌드하거나 운영서버3102/3116을 시작·종료·재시작하지 않습니다. 신규 파일이 이미 있거나 다른 writer가 작업 중이면 덮지 말고 PM에 알립니다. 각자 자체 단위 시험과 자신만의 산출 경로를 사용합니다.

통합 예정 식별자는 `block-workshop` → `/games/05-falling-blocks/index.html`, `balloon-sparrow` → `/games/06-flappy/index.html`입니다. 기존33개 ID/즐겨찾기를 모두 유지하고, 둘의 수용 뒤에만 새 카드2개를 추가하여35/플레이6/준비29로 바꿉니다. 기존 leisure-line/balloon 카드는 다른 기획이므로 몰래 바꾸거나 삭제하지 않습니다. 구현자는 공통 카탈로그를 수정하지 않습니다. 운영3116은 기존4게임 빌드를 그대로 제공합니다. 미래 반영은 PM 검증·별도 사용자 승인 경계에서 수행합니다.

## 런타임 구조와 API
각 폴더는 index.html, styles.css, engine.mjs, save.mjs, main.mjs 및 자체 assets를 갖습니다. 런타임에 다른 게임 폴더/원안/Node API/CDN/외부 폰트/네트워크/DB를 참조하지 않습니다. 순수 engine과 save는 Node 단위시험에서 import 가능합니다. main이 DOM·Canvas·입력·WebAudio·저장 시점을 연결합니다. 엔진이 돌려주는 사실을 UI에 반영하고 렌더 콜백이 점수/보상을 변경하지 않습니다. mutable 게임 상태setter/강제승리/테스트치트/가짜 route/오류필터를 출하하지 않습니다. 읽기 snapshot은 복사본만 허용하며 문서화합니다. API와 DOM ID 목록은 구현 인수 문서에 기록합니다.

## 공통 상태·입력
- 준비(0점, 판 시작 아님) → 명시 시작 → playing → paused / won·lost·quit 결과. 06은 무한 기록형이므로 자연승리 상태가 없습니다.
- 메뉴·확인창·도움말·옷장 중 게임시간/입력/음향은 멈춥니다. ready/paused/result에서 버튼을 닫는 이벤트가 새 입력으로 전달되지 않습니다.
- blur/visibilitychange/pointercancel/다중터치는 눌린 키·포인터·반복입력·지연음향을 정리하고 playing을 보호정지합니다. 재노출해도 자동 재개하지 않습니다. 이전이 paused면 그 원인을 유지하며, 메뉴 중 이탈했다면 닫은 뒤에도 paused입니다.
- Space/방향키는 포커스가 게임영역일 때만 처리하고 해당 키만 preventDefault합니다. Ctrl/Alt/Meta 단축키·문서 스크롤을 방해하지 않습니다. 키 자동repeat은 직접 반복 구현과 중복되지 않게 무시합니다.
- 기본 `<button>`/링크와 명확한 focus-visible, 44×44 CSS px 이상, 단일 primary포인터, 페이지 전체 다중접촉 관찰, pointer capture/cancel 및 메뉴 이벤트 차단을 제공합니다. 게임 바깥 스크롤은 허용합니다.
- 재시작/게임내홈 요청은 진행 중인 판을 정지하고 확인합니다. 취소하면 paused, 확인하면 quit 결과를 정확히1회 확정·저장한 뒤 새준비 또는 같은 origin `/`로 이동합니다. 종료된 결과에서는 중복집계 없이 다시시작/홈 이동합니다. 새로고침은 준비로 돌아가며 진행판은 복원하지 않습니다.

## 저장 공통 정의
- 05키 `simplegames.fallingblocks.v1`, 06키 `simplegames.flappy.v1`. 타게임/홈 즐겨찾기키를 읽거나 삭제하지 않습니다. 초기값/구조/버전/허용ID/소유부위/유한 안전정수/교차관계를 검증합니다. 전용키의 정상 null은 첫방문이며 손상·차단 경고가 아닙니다.
- 결과 한 번 확정 때 `plays`+1, 해당 won/lost/quit 카운트+1, 누적통계+이번판 값을 원자적으로 기록합니다. 준비/시작/중간정지/단순재개/결과재개방/메뉴열기에는 plays·누적을 더하지 않습니다. `plays=각 종료사유 횟수 합`, wins≤plays, best≤total 등 필드관계를 검사합니다. 점수 동점은 새최고가 아닙니다.
- 06의 진행 중 통과·해금은 현재 세션 메모리에 즉시 반영해도 영구 누적기록과 중복하지 않습니다. 외형 장착 확정 시 이미 완료된 누적/최고/plays와 유효 장착만 저장합니다. 아직 끝나지 않은 판의 점수·누적·업적은 영구 저장하지 않습니다. 그 판에서 임시 해금한 아이템은 결과 확정 전까진 미리보기만 가능합니다. 재시작/홈 확인은 quit로 정산하므로 그때 영구 해금됩니다. 이 정책을 UI에 '이번 비행 종료 후 해금'으로 명확히 표시합니다.
- storage getter/getItem/setItem 각각 예외, 손상 JSON, 구버전, NaN/음수/Infinity/과대수/없거나 잠긴 아이템을 시험합니다. 손상은 기본복구 안내, 차단은 계속 보이는 '이 환경에서는 기록이 저장되지 않습니다' 안내와 메모리 플레이를 제공합니다. localStorage.clear()/다른키삭제 금지. 안전정수 누적포화 정책을 명시합니다.

## UI·아트·오디오
외부 원작화면·로고·이미지를 복제하지 않고 PM시안의 독자 아트를 구현합니다. 시안은 명시적 샘플이며 시안의 상태선택 툴바/가짜점수는 실제게임에 넣지 않습니다. 시안 SVG kit와 제작 코드를 로컬 자산으로 재사용하고 실제 게임에서 올바른 상태로 렌더합니다. 자산 경로·직접 제작·라이선스/외부저작물 미사용을 인수문서에 기록합니다. 스크립트/외부참조 없는SVG, 320px부터 가로넘침0, safe-area, 낮은 화면/모달의 세로스크롤, reduced-motion을 지원합니다. 기본 mute=true; 사용자 제스처 뒤 WebAudio를 시도하며 실패해도 무음 플레이합니다. 정지·탭숨김·닫기에서 소리를 정리합니다. API 소리검사는 실청취와 구분합니다.

## 실제 검증과 보고
- 각자 `node --test tests/games/<자기파일>`을 실제 실행하고 핵심 규칙·상태·저장·외형불변을 검증합니다. 필요 시 자기 폴더에서 `node --check`만 사용합니다. 설치·의존 추가·네트워크·Git stash/reset/checkout/commit/merge/push·삭제·보안/인증/모델/전역설정 변경·다른 프로세스 중단·재위임을 금지합니다.
- 기존모델/같은 native UUID/공식 auto_review·workspace-write·networkAccess=false 경계를 유지합니다. 자동검토 거부/usage limit/writer충돌/동일오류2회는 원문을 보존하고 PM에 보고하며 우회하지 않습니다. 파일허용범위는 OS샌드박스라고 주장하지 않습니다.
- 응답은 한국어 존댓말로 task_id,status,changed_files,실제 tests(명령/exit/수),evidence_paths,blockers를 포함합니다. 먼저 계약 읽기 수신 ACK를 한 번 남긴 뒤 실제구현을 진행합니다. 개발목표 약25분, 막힘은 즉시보고. 단순스텁/계획/자체PASS선언은 납품이 아닙니다.
- PM은 통합빌드·기존4게임 회귀·PC Chromium/모바일 Chromium/WebKit·실제HTTP 흐름·독립QA를 이후 별도수행합니다. 실물기기·음향·인간플레이시간은 검증하지 않았다면 미검증입니다. 전체회귀 출력env/모든고정경로를 사전분리하여 과거증거를 덮지 않습니다.
