# 숫자 정원 · 2048 — 실제 검증 기록

| 항목 | 실제 명령/방법 | 결과 | 증거 |
|---|---|---|---|
| TypeScript strict | npm run typecheck | PASS 종료0 | artifacts/pm/typecheck-final.log |
| 컴파일/정적 패키지 | npm test 내 npm run build | PASS 종료0 | artifacts/pm/unit-final.log |
| 규칙·상태·저장·입력·HTTP | npm test | 44/44 PASS | artifacts/pm/unit-final.log |
| PC Chromium | npm run test:e2e | 19/19 PASS | artifacts/qa/playwright-results.json |
| 모바일 Chromium | 같은 명령, Pixel설정375×667 | 19/19 PASS | 동일 JSON |
| 모바일 WebKit | 같은 명령, iPhone설정390×844 | 19/19 PASS | 동일 JSON; 실물 iPhone이 아님 |
| 레이아웃 | 320×568/375×667/768×1024/1366×768/667×375 | 플레이 정사각보드·가로넘침없음·기본버튼44px PASS | artifacts/qa/layout-*.json·PNG |
| 2048/막힘/4096 UI | QA fixture route adapter, production수정없음 | PASS | 브라우저05/06 |
| 다중터치·모달초점 | 수정후 기존02/14 그대로회귀 | PASS | 최종57개에02/14/17포함; 원래실패증거보존 |
| 신규 SVG | python assets/generate_assets.py --check | 15개 PASS | artifacts/pm/assets-final.log |
| 자산 렌더 | 아트 원본연락시트PNG + PM시각확인 | 장면3종·타일11종·아이콘 확인 | assets/contact-sheet.png·render-validation.json |
| 독립 런타임 | node_modules없는별도scratch로 public/server복사후Node실행 | 정적23자산HTTP200·바이트일치 PASS | artifacts/pm/runtime-isolation.json |
| 외부망 비의존 | localhost만허용route,54개context요청기록 | 외부요청0 | security-*.json·final-verification.json |
| 앱 오류 | console/page error 감시 | 앱오류0 | 동일 JSON; screenshotToolErrors11 별도보존 |
| 정적서버보안 | raw URL,HEAD,POST,외부junction | PASS | 서버단위20개·security-http-static.json |

## 실제 검증의 한계
- 자동 브라우저·CDP/PointerEvent 에뮬레이션은 실물 Android/iPhone/물리 손가락·회전·안전여백 검증이 아닙니다.
- 합성음은 Chromium oscillator 호출과 mute/fallback을 검사했으며 스피커를 직접 듣지 않았습니다. Windows Playwright WebKit에는 AudioContext가 없어 무음 fallback만 검증했습니다.
- Storage getter/read/write 예외 주입은 통과했으나 실제 브라우저 설정권한 차단/물리 용량소진은 미검증입니다.
- blur/hidden 자동검사는 OS의 실제 모든 탭전환 동작을 완전 검증하지 않습니다.
- 모든 해상도×모든모달/결과상태 조합과 Firefox는 미검증입니다.
- 원시로그에는 Playwright WebKit 스크린샷 도구의 CSP오류11개가 따로 있습니다. 앱의 인라인스타일/CSP를 완화하지 않았습니다.

38 AC의 현재 보수적 결과는 자동증거 기준32 PASS / 0 FAIL / 6 UNVERIFIED입니다. 최종 PM 수용은 개발용 MVP 납품과 실기기/운영 배포의 품질보증을 구분합니다.
