- 기록 시각: 20261023-213301 (Asia/Seoul)

# Codex Remote Control 확인 및 설정 진입

- 상태: 공식 절차 조사·설정 진입 명령 실행 완료, 원격 접근 허용·기기 페어링·실접속은 대기입니다.
- 대상: 현재 Windows PC의 Codex 작업 진행·출력·변경 내용을 휴대폰 또는 지원되는 다른 데스크톱에서 확인하고 지시하는 기능입니다.

## 작업과 실제 검증

- OpenAI 공식 Remote connections, CLI reference, Commands 페이지를 열어 확인했습니다.
- 로컬 `codex --version`: codex-cli 0.137.0. `codex remote-control --help`: start/stop 지원을 확인했습니다. 최신 문서에 있는 pair는 로컬 help에 없으므로 실행하지 않았습니다.
- ChatGPT 데스크톱 앱의 실행 프로세스를 확인했습니다.
- `Start-Process 'codex://settings/connections/computer'` 명령이 오류 없이 종료됐습니다. 설정 화면의 표시 여부와 토글 상태는 직접 확인하지 못했습니다.
- 모바일 초기 연결은 공식 문서에 따라 데스크톱 앱에서 시작합니다. 별도 CLI daemon은 시작하지 않았습니다.
- 읽기 전용 worker가 앱 페어링과 CLI daemon의 구분을 검토했습니다. worker는 샌드박스 오류로 파일 확인을 못했으며 PM이 실제 문서·명령 출력을 확인했습니다.

## 남은 설정

1. 호스트 PC의 ChatGPT 데스크톱 앱에서 Settings → Connections → Control this Mac or PC를 엽니다.
2. Set up 또는 Add를 선택하고 원격 접근 허용 및 요청되는 인증을 완료합니다.
3. 휴대폰에서 같은 ChatGPT 계정·워크스페이스에 로그인한 뒤 PC에 표시된 QR을 스캔해 연결합니다. 모바일 Codex 또는 Remote에서 이 PC와 작업을 선택합니다.
4. 다른 Mac/Windows에서 연결할 때는 지원되는 데스크톱 앱의 Settings → Connections → Control other devices에서 호스트를 추가·페어링합니다. 제공 여부는 계정·배포 상태에 따라 다릅니다.
5. PC 앱을 실행하고 온라인·절전 해제 상태로 유지합니다. 원격 기기에서 작업 진행·테스트 출력이 보이고 후속 지시가 반영되는지 확인합니다.

## 제한 사항과 다음 작업

- 이번 확인은 작업 진행·출력·변경 검토 기능에 대한 것입니다. PC 화면 전체의 연속 영상 중계는 확인하지 않았습니다.
- 현재 도구는 네이티브 앱 화면 조작을 지원하지 않아 원격 접근 허용, QR 표시·스캔, 사용자 인증을 대신 완료할 수 없습니다.
- 휴대폰·다른 데스크톱의 실제 접속과 실시간 반영은 미검증입니다. 사용자 기기에서 페어링 후 확인해야 설정 완료입니다.
- 샌드박스 일반 실행은 helper_sandbox_lock_failed / SetNamedSecurityInfoW 오류로 실패하여 승인된 샌드박스 외 실행으로 필요한 읽기와 설정 진입 명령을 수행했습니다.
- 게임 소스·빌드·서버·방화벽·전역 Codex 설정은 수정하지 않았습니다. 게임 자동 테스트·엔진 빌드·수동 플레이는 이번 설정 작업에 실행하지 않았습니다.

## 공식 근거

- https://learn.chatgpt.com/docs/remote-connections
- https://learn.chatgpt.com/docs/cli/reference
- https://learn.chatgpt.com/docs/reference/commands

## 게시 기록

- 게시 ID: mvkyalt7-14-v2lu
- 원문: http://localhost:18787/api/posts/mvkyalt7-14-v2lu.md
- 상태: doing (페어링 대기). JSON 본문·상태와 Markdown 원문을 재조회해 일치를 확인했습니다.
