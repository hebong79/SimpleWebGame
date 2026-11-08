# 다섯 번째 모음 · 81~100

사용자 지정 `E:/Work2/Codex/Games/게임제작-001/simple-games-61-100`의 81~100 기획서·디자인을 참고했습니다. 기존 80게임과 109 ID·기록·즐겨찾기를 보존하여 **129카드 / 실행100 / 준비29**로 확장하는 릴리스입니다. 현재 운영 수용 상태는 최신 HANDOFF와 작업일지를 따릅니다.

| 번호 | 게임 | 경로 |
|---|---|---|
| 81 | 오름내림 기록실 | `/games/81-the-game/index.html` |
| 82 | 꽃인가 가시인가 | `/games/82-skull/index.html` |
| 83 | 칩 하나 아끼기 | `/games/83-no-thanks/index.html` |
| 84 | 여섯째 짐칸 | `/games/84-six-nimmt/index.html` |
| 85 | 움직이는 박물관 | `/games/85-labyrinth/index.html` |
| 86 | 구름길 타일 | `/games/86-tsuro/index.html` |
| 87 | 위성 방어선 | `/games/87-space-invaders/index.html` |
| 88 | 포자 정원 방제 | `/games/88-centipede/index.html` |
| 89 | 구름 창 경기 | `/games/89-joust/index.html` |
| 90 | 유리구슬 경사로 | `/games/90-marble-madness/index.html` |
| 91 | 달빛 착륙 시험 | `/games/91-lunar-lander/index.html` |
| 92 | 새벽 자전거 배달 | `/games/92-paperboy/index.html` |
| 93 | 사다리 금고 | `/games/93-lode-runner/index.html` |
| 94 | 네 줄 찻집 | `/games/94-tapper/index.html` |
| 95 | 5초 작업실 | `/games/95-warioware/index.html` |
| 96 | 굴러가는 장난감방 | `/games/96-katamari/index.html` |
| 97 | 양쪽 수련장 | `/games/97-one-finger-death-punch/index.html` |
| 98 | 단어가 움직이는 방 | `/games/98-baba-is-you/index.html` |
| 99 | 한 그릇 급식소 | `/games/99-overcooked/index.html` |
| 100 | 멈춘 경비실 | `/games/100-superhot/index.html` |

## 실행과 검증

- 실사용 목표: http://192.168.0.195:15010/ → **81–100 · 다섯 번째 게임 모음**. 실제 반영 여부는 최신 작업일지에 명시합니다.
- 새 후보: `artifacts/g035-release-build`. 운영 중인 검증 빌드에는 덮어쓰지 않습니다.
- 검증: `node scripts/vol5-validate.mjs`, `node scripts/vol5-smoke.mjs`. 운영 재확인: `node scripts/vol5-runtime.mjs`, `node scripts/vol5-smoke.mjs --live`.
- 규칙·자동 브라우저: `npm run test:games`. 독립 QA 보고서는 [81~85](QA_A.md), [86~90](QA_PM_GAMES.md), [91~95](QA_PM.md), [96~100](QA_C.md)입니다.
- 실행 ZIP은 `releases/simple-games-vol5-100games-*.zip`와 manifest. Node.js 24 이상에서 압축을 풀고 `start-local.cmd` 또는 `node src/server/index.js --host 127.0.0.1 --port 3101`. 별도 npm 설치는 필요 없습니다.
- [실행 계약](PLAN.md) · [PM/소유권/승인 경계](PM_CONTRACT.md) · [자산 출처](ASSETS.md). 구현 보고: [A](BUILD_A.md), [PM](BUILD_PM.md), [B](BUILD_B.md), [C](BUILD_C.md).

## 콘텐츠와 제한

- 카드/보드81~86은 로컬 전달·대전과 공개/비공개 상태를 구분합니다. 81은 전체38장,82·83·84는3인,85는 고정3판,86은2/3인·고정25타일입니다.
- 87·88은 두 파,89는45초5깃발,90은3코스,91은3임무,92는3골목,93은14×9고정4판,94는2줄/4줄14주문,95는5종10과제입니다.
- 96은2방·12종24물건,97은두속도20인형,98은7×7규칙퍼즐6판,99는두주방·5그릇,100은9×7경비실6개를 제공합니다.
- 외형은 자체 도형·색·부착물 중심이며 원작 그림을 복제하지 않았습니다. 일부 고정판은 구조를 공유하는 변형과 입문형입니다. 사람 난이도·예상 플레이 시간·원안 시안의 세부 장식은 후속 조정 여지가 있습니다.
- 좁은 격자는 44px 입력 영역을 유지하며 보드 내부 스크롤을 씁니다. WebKit 기능 검사 중에는 스크린샷 CSS 주입을 분리하며 CSP나 오류 필터를 완화하지 않습니다.
- 실제 휴대폰·실제 Safari·물리 멀티터치·음향 청취·스크린리더·사람 다인 완전 플레이는 별도 수용입니다. 자동 탐색/입력열 완주와 사람이 직접 푼 결과를 구분합니다.
- 기존 PM2 저장 dump의 구버전 복귀 위험과 과거 증거 제한은 유지합니다. 전역 save·다른 서비스·방화벽·설치·기록 삭제는 범위 밖입니다. Git은 이번 새 작업에 별도로 요청되지 않았습니다.

- 독립 QA의 LOW QAC-L01: 96/97 읽기 전용 상태 문구와99 상태/주문 띠가 같은 값도 RAF에서 갱신됩니다. 버튼 입력 소실은 없었으며 성능·보조기기 관점의 후속 정리 항목입니다.

- 전체 게임 검사는 새 실행마다 증거를 격리하는 `npm run test:games`를 사용합니다. 최초 회귀에서 과거 고정 경로 QA 상세파일18개가 재기록된 한계는 `artifacts/g035-pm/legacy-evidence-audit/audit.json`에 기록했습니다. 당시 집계·운영 manifest·일지는 별도로 유지하며 상세 이전 바이트는 복원하지 못했습니다.
