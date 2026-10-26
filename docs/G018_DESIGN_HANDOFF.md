# SimpleGames 5·6번 — PM 설계·디자인 및 실제 개발 배정

- PM·설계·디자인: 대현자
- 기준 시각: 2026-10-26T00:36:36+09:00 (한국 시간)
- 요청: 5·6번 게임을 PM이 설계·디자인하고 cody-01·cody-02에게 개발 지시
- 상태: **설계·디자인 및 실제 개발 지시/수신 확인 완료. 두 게임 구현은 진행 중이며 게임 납품 완료가 아닙니다.**

## 1. 확정 배정
| 번호 | 제작명 | 개발자 | 실제 상태 | 독립 구현 폴더 |
|---|---|---|---|---|
| 05 | 한 판 블록 공방 | native cody-01 | 같은 세션의 계약 ACK·실제 파일 읽기 성공·inProgress | public/games/05-falling-blocks/ |
| 06 | 풍선 참새 | native cody-02 | 같은 세션의 계약 ACK·실제 파일 읽기 성공·inProgress | public/games/06-flappy/ |

대현자가 두 설계와 시안을 직접 작성했습니다. 작업명만 같은 새 워커나 과거 headless cody-02를 대신 실행하지 않았습니다. 현재 native의 정확한 UUID로 개발 지시를 넣고 같은 턴에서 내용 SHA256·수신 ACK를 재조회했습니다.

## 2. 설계와 디자인
### 05 — 한 판 블록 공방
- 10×20 가시 보드+숨김2행, 7bag, 4×4 시계회전과 x킥0/-1/+1, 첫 접촉300ms 무재설정 고정.
- 동시 줄 제거→점수→20줄 이상 승리→승리 아닐 때만 스폰 실패 판정. 19줄에서4줄을 지우면23줄 승리로 처리합니다.
- 1/2/3/4줄 100/300/500/800점, 누적5줄마다900/750/600/450ms 낙하.
- 크림색 공방·짙은숲 보드, 7종 문자/문양 타일, 흙빛·백자·잉크 재질3종. 모바일5버튼/PC키보드와 유지 반복을 명세했습니다.

### 06 — 풍선 참새
- 논리360×640, 판정r12, g900, 탭vy=-280, 아치속도110·간격220, 1/120초 고정시뮬레이션.
- 첫5개180px 틈·같은높이, 이후175/170/165/160으로 좁아집니다. 여백100·연속중심차80 제한, 코너의 둥근 원형 sweep·동tick 충돌 우선·아치당1점.
- 정원 트렐리스와 직접 그린 참새4동작. 머리·몸·발목3부위에 파일럿/비옷/꿀벌9아이템을 조합하는 옷장과 기록 해금을 설계했습니다.
- 결과 뒤500ms 잠금·새 입력으로만 재도전, 옷의 시각장식은 충돌/속도에 영향을 주지 않습니다.

두 게임 모두 준비/플레이/정지/확인·메뉴/결과·재도전/홈, 초점·터치·탭이탈, 전용 저장키·손상/차단, 음소거·아트 출처를 명세했습니다. 결과1회 집계와 통계 상한에서의 원자 보존도 별도 보완했습니다.

## 3. 실제 수행·검증
- PM 작성: 공통계약·게임별GDD/수용표/개발계약·구현보완·실행기정상복구경로·자체벡터·클릭형시안.
- 수용 기준은 게임별24개, 합계48개입니다. **아직 신규게임에서 실행한 PASS 개수가 아닙니다.**
- 실제 Chromium 시안: 1366×900,375×667,320×667,667×375의 준비/플레이/정지/결과 총32조합과 재질·옷장잠금/부위장착/취소 흐름 통과. 가로넘침·44px 미달·console오류/경고·페이지오류·외부요청/요청실패0.
- SVG 05 심볼7개,06 심볼41개 XML·내부참조·중복/누락 검사 및 결정적 생성기 --check 통과. 텍스트 주요색 대비도구검사 최소4.5 이상. PC·모바일·옷장 PNG를 직접 검토했고 O미리보기의 누락2칸을 수정 후 다시 검사했습니다.
- 독립 설계검토: `G018_DESIGN_REVIEW.json` **DESIGN_ONLY PASS**, 차단0. 발송 전22입력 SHA256을 PM이 대조했습니다. 이후 상태문서/워커등록 갱신은 설계규칙 변경과 구분합니다.
- 비차단2제안(코너 sweep 구체화/안전정수 포화관계)은 `G018_IMPLEMENTATION_NOTES.md`로 개발 지시에 포함했습니다.
- 기존 소스/공개자산/과거QA증거 844개 SHA256·mtime 변동0. 원안3문서는 읽기 전용 보존했습니다. 기존3116 홈/4게임은 실제 HTTP200입니다.

## 4. 실제 명령 전달과 초기 오류 처리
| 워커 | 정확 native UUID | 현재 개발 턴 |
|---|---|---|
| cody-01 | 01a16eb2-eae8-78d2-b41a-380d98e6673d | 01a173b0-378c-7a90-bbf4-e610186ae11d |
| cody-02 | 01a17391-f01f-7ce0-821c-79e3fc3cde2f | 01a173b0-3acd-73b0-a18c-df5cf5938787 |

초기 두 턴은 기존 Windows helper_sandbox_lock_failed/SetNamedSecurityInfoW 오류와 엄격한 중단 문구로 정상 중단했습니다. 원본 실패/turn receipt를 보존했습니다. ACL·전역권한·모델을 바꾸거나 다른 실행기로 우회하지 않았습니다. 기존 공식 auto_review가 위험을 검토하는 정식 재실행 경로를 계약에 명확히 하고 같은 native에 후속 개발 턴을 시작했습니다. 두 워커 모두 공식 재실행으로 필수 문서를 실제 읽고 정확한 ACK를 보냈습니다.

```
G018-05-ACK worker=cody-01 thread=01a16eb2-eae8-78d2-b41a-380d98e6673d design=v1.0
G018-06-ACK worker=cody-02 thread=01a17391-f01f-7ce0-821c-79e3fc3cde2f design=v1.0
```

실제 새 턴의 turn_context에서 두 워커 모두 gpt-6.1-sol/openai, on-request/auto_review, workspace-write, network_access=false를 확인했습니다. 모델 override·sandbox 해제·전역설정 변경·운영서버 재시작은 하지 않았습니다. 자동 검토 거부나 사용량 한도에는 중단하도록 했으며 무제한 승인/무한재시도/상주 감시를 구성한 것이 아닙니다.

## 5. 파일 소유권과 다음 단계
각 워커는 자신의 신규 게임 폴더·전용 단위시험1개·구현 인수문서1개·새 builder증거 경로만 씁니다. 공유 홈/카탈로그/프로젝트상태/빌드/운영은 PM만 담당합니다. 구현 후 독립QA와 PC·모바일 실제HTTP·기존4게임 회귀를 거친 다음 홈을35/플레이6/준비29로 확장할 예정입니다. 지금 카탈로그33/플레이4/준비29와 **실사용 `http://192.168.0.195:3116/`는 그대로**입니다. 새 두 게임은 아직 해당 운영 주소에 배포하지 않았습니다.

## 6. 산출물과 실행
- 공통: docs/G018_COMMON_CONTRACT.md
- 게임별: docs/G018_05_GAME_DESIGN.md / G018_06_GAME_DESIGN.md
- 수용: docs/G018_05_ACCEPTANCE.md / G018_06_ACCEPTANCE.md
- 개발 지시: docs/G018_05_IMPLEMENTATION_CONTRACT.md / G018_06_IMPLEMENTATION_CONTRACT.md
- 구현 보완: docs/G018_IMPLEMENTATION_NOTES.md / G018_RUNTIME_CLARIFICATION.md
- 클릭 시안: docs/g018-design/index.html → 05/06/index.html, 각 PC/모바일PNG 및06 옷장PNG.
- 자산 원본/재현: docs/g018-design/05/kit.svg,06/kit.svg,generate_assets.py
- 정확 전달·ACK: artifacts/g018-pm/dispatch-verification.json, actual-turn-contexts.json, dispatch-05/06-continue.json
- 설계 인수 ZIP: E:\Work2\Project\SimpleGames\01-2048\artifacts\g018-delivery\G018_Game05_Game06_PM_Design_and_Contracts.zip — 설계/계약/시안/검증25파일+manifest/설명, CRC·개별 SHA256 확인. **독립 실행 게임 배포본이 아닙니다.**
- 프로젝트 작업일지: E:\Work2\Project\SimpleGames\01-2048\docs\worklogs\20261026-003636_아름.md
- 사용자 문서: E:\Work3\Hermes\Dev\Doc\simplegames_05_06_pm_design_and_dispatch_20261026.md

시안은 ZIP 압축을 풀고 `docs/g018-design/index.html`을 열면 됩니다. 실제 물리/점수/저장을 갖춘 게임은 각 Cody의 다음 구현 산출물입니다. 설치/유료자산/외부폰트/새 DB·엔진은 추가하지 않았습니다.

## 7. 한계와 게시
실물 Android/iPhone·실제손가락 복합입력·실음향·인간 목표시간·신규게임 빌드/QA·홈통합·운영반영은 아직 미검증/미수행입니다. G016 전체수용보류와 과거QA자료 원복 문제도 별개로 유지합니다. 새로운 상주 모니터나 자동 재시작 서비스를 만들지 않았습니다. 실제 게시 URL/첨부 다운로드 검증은 `artifacts/g018-delivery/board-publication.json`에 별도 저장합니다.
