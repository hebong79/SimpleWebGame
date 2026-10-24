# 홈 · 게임 화면 시안

`index.html`을 브라우저로 열어 확인합니다. 설치나 빌드 없이 동작하는 별도 시안입니다.

브라우저 주소로 열려면 프로젝트 루트에서 `npm run preview`를 실행하고 http://127.0.0.1:3102/ 에 접속합니다. 현재 작업에서는 이 주소의 서버를 백그라운드로 실행했습니다. PC를 다시 켠 뒤에는 명령을 다시 실행하면 됩니다. 기존 게임 서버(3101)와는 별도입니다. 포트를 바꾸려면 `npm run preview -- --port 3103`을 사용합니다. 이 명령은 프로젝트에 있는 기존 서버 빌드를 재사용합니다.

G-011에서는 홈을 30개 예시 게임을 탐색하는 화면으로 개편했습니다. 검색·장르·즐겨찾기·정렬 조건을 적용하고 12개씩 더보기로 모든 결과를 확인합니다. 목록은 페이지 전체로 세로 스크롤되며 게임 페이지의 정지·결과 흐름은 유지합니다. 홈 설계 범위는 `../LIBRARY_PREVIEW.md`를 참고하세요.

```powershell
Start-Process .\docs\prototype\index.html
```

1. 홈에서 숫자 정원의 게임 시작을 누릅니다. 게임 전용 HTML 페이지로 이동합니다.
2. 일시정지를 눌러 이어서하기를 확인합니다. 이어서하기를 누르면 원래 보드로 돌아갑니다.
3. 다시시작의 확인·취소를 확인합니다.
4. 게임종료를 누르면 결과 팝업이 나타납니다. 홈으로를 누르면 게임 목록으로 돌아갑니다.
5. 시안 안내 영역의 결과 화면 보기로 자연 종료 결과도 확인합니다.

보드, 기록과 추가 게임명은 예시입니다. 실제 2048 방향키·스와이프 조작과 저장 기능은 기존 게임에 있고 이 화면 시안에는 연결하지 않았습니다.

자동 검증은 프로젝트에 이미 설치된 Playwright와 브라우저를 사용합니다.

```powershell
node --check docs/prototype/prototype.js
node docs/prototype/verify.mjs
node docs/prototype/verify-library.mjs
```

검증 결과는 `verification.json`, 화면 캡처는 `screenshots/`에 기록합니다. 화면 흐름 제안과 다음 구현 범위는 `../STRUCTURE_PREVIEW.md`를 참고합니다.

홈 탐색 검증 결과는 `verification-library.json`, 최신 홈 캡처는 `screenshots-library/`에 기록합니다.

기존 자산은 `../../public/assets/`의 직접 제작 SVG를 재사용합니다. 외부 자산이나 새 런타임 의존성은 없습니다.
