# G028-INTEGRATE 실제 API 인수 및 후보 검증 준비

두 실제 main.mjs와 15 `20261101-112300_G028_15_IMPLEMENTATION.md`, 16 `20261101-000500_G028_16_IMPLEMENTATION.md`를 읽고 별도 어댑터를 확정했습니다. G028_ADAPTERS_READY=true입니다. 관측은 읽기 전용 snapshot만 사용하며 조작은 실제 DOM 클릭100ms로 수행합니다. 시계 동결·정답/승리 주입·테스트 전용 제품분기는 없습니다.

- 15: `.column[data-column]`, #start/#pause/#resume/#settings/.theme-option/#settings-apply/#mute/#help/#restart/#home/#modal-close/#modal-confirm/#next. snapshot의 board/moves/subphase/remainingMs/starter/records/settings/modal을 관측합니다. 실제7수승리·정산·다음판선공교대, 정지·테마·취소보존·홈복귀를 단언합니다.
- 16: #pad-0..3/#start/#pause/#resume/#theme/#theme-night/#theme-dawn/#modal-apply/#modal-close/#mute/#help/#restart/#home/#retry. snapshot의 sequence/cursor/remaining/completedLength/token/records/settings/modal을 관측합니다. 첫정답·prefix+1·오답결과·정산·재도전token, 정지·설정·취소보존·홈복귀를 단언합니다. round는순서길이이므로재도전검증은token증가로수행합니다.
- 320px·낮은모달·44px·실제측정80ms이상trusted누름·CSP/콘솔/페이지/외부요청0 단언은 유지했습니다. SVG 패드 사이 직접제작 연결선을 추가했습니다.
- 사용자 추가승인과 PM 소유권 배정에 따라 ecosystem의 number-garden-2048 script만 artifacts/g028-build/src/server/index.js로 변경했습니다. PM2 실제조작/Git/운영전환은 PM 전용이며 수행하지 않았습니다.
- 이제 새후보 빌드와3180초기smoke를 실행합니다. 이 문서의 작성 자체는시험PASS를뜻하지않으며실제결과는후속공통보고와고유artifacts/g028-integration/runs/<id>/report.json을기준으로합니다. 전체회귀full은아직배정되지않았습니다.
