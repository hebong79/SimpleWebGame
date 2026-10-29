# G025 개발설계 추가 결정 v1.1 — 독립 QA 사전검토 반영

이 문서는 G025_PM_CONTRACT/11_DESIGN/12_DESIGN의 다음 미정·충돌 부분만 구체화합니다. 나머지 규칙은 유지합니다. 근거: 독립 QA11-PREP D01~D04, QA12-PREP OPEN-01/02. 실제 구현결함 판정이 아니라 설계 결정입니다.

## D01 재시작·홈·모드 확인 취소
- 모달을 열기 직전 playing이면 모달 진입 시 active-time을 확정하고 modal 보호정지합니다. 취소/닫기 뒤 board/mines/flags/history/counters/elapsed는 그대로이며 **playing으로 자동복귀하지 않고 명시재개를 요구**합니다. 원래 정지 상태/원인이 있으면 그 원인을 그대로 유지합니다.
- 따라서 원설계의 ‘status 유지’는 기존 paused 원인 보존을 뜻하며 playing 자동재개를 뜻하지 않습니다. 12번 정상 goal-preview release는 원래 명시된 예외(보호정지가 없을 때만 이전 playing 복귀)입니다.

## D02 11번 RNG 방어의 정확 정책
- 유효 RNG 출력은 primitive number, Number.isFinite(r), 0<=r<1입니다. 경계1/음수/NaN/Infinity/비숫자/Symbol/객체/undefined는 **강제변환 없이0으로 대체**합니다. RNG callback 자체가 throw해도 해당 추출은0으로 대체합니다.
- 후보 배열에서 partial Fisher-Yates로 정확10개를 선택하며 **최초유효 reveal당 추출10번**, 중복 재추첨/무한 loop 없이 종료합니다. 전달 RNG가 함수가 아닌 경우에는 deterministic0 공급으로 처리합니다. 정상 게임은 기본 Math.random입니다.
- 잘못된 입력/flag/reveal no-op은 추출0번, 입력state의 부분변형/부분정산 없음. callback 오류가 제품 예외나 손상 board로 새지 않습니다.

## D03 11번 포화 집계와 부분복구
- MAX_FINISHED=1000000000. finished<wins+losses와 같은 불가능 tuple은 수용하지 않습니다. 정상 관계는 finished=wins+losses, finished/wins/losses 각각0..MAX_FINISHED 안전정수입니다.
- finished가 한도에 도달했으면 finished/wins/losses/**bestMs도 모두 동결**합니다. 새 결과화면과 플레이는 가능하나 이 결과를 누적/최고 기록에 합산하지 않고 한도 안내를 표시합니다. 특히 기존 wins0/bestnull에서 최초성공하더라도 best만 새로 쓰지 않아 교차관계를 보존합니다. 설정/테마 저장은 계속 가능합니다.
- v1 통계 tuple/best 관계가 잘못되면 통계만 기본값으로 복구하고 유효 theme/muted는 보존합니다. theme만 무효면 paper로 복구하고 유효 통계는 보존합니다. muted만 무효면 true. root형태/버전이 틀리면 전체 기본값. 상속/unknown 키는 allowlist로 무시합니다.

## D04 공통 수치 상한·12번 복구 단위
- bestMs/bestMoves 상한은 **Number.MAX_SAFE_INTEGER**이며 양의 안전정수만 수용합니다. 성공 elapsed는 측정 active-time을 floor하고 최소1ms. 비유한/음수/비안전 정산 인수는 정산 자체 no-op이며 기록을 거짓으로 clamp하지 않습니다.
- 12번 mode별 wins 상한은1000000000. cap에서는 wins만 포화 유지하고, 이미 wins>0이므로 실제 유효 완료의 사전순 bestMoves/bestMs 개선은 허용합니다. 완료는 언제나 한판1정산입니다.
- 12번은 유효v1 안에서 **mode record별** 복구합니다. 한 mode의 wins/best tuple이 잘못되면 그 mode만 {wins:0,bestMoves:null,bestMs:null}; 나머지 유효mode는 보존합니다. 없는 mode도 기본값, unknown/상속 ID는 무시. records의 컨테이너가 배열/null/비object면 모든 mode 기본값. theme만 무효면 cream·정상기록보존, muted만 무효면 true. 잘못된 root/버전은 전체 기본값.
- 순수 API에 직접 넘긴 부작용 객체/상속 이름/숫자 문자열은 강제변환하지 않습니다. 저장 JSON의 null과 직접 API NaN/Infinity는 구분해 테스트합니다.

## QA 인수의 의미
- QA11/QA12 준비 각100개는 **계획수**이며 제품실행/브라우저PASS는0입니다. 자체 reference1334검사 및16selfcheck/512fixture는 제품수용에 합산하지 않습니다. 최종 seed/배열/route/API/DOM/HTTP origin은 제작 handoff의 실제 값을 인수한 후 동결하여 독립 실행합니다.
- 제작자와 분리한 독립 워커가 최종 기능·버그 검사와 수정 후 재검증을 수행합니다. 현 시점 구현물 수용/머지/운영반영은 아직 하지 않았습니다.
