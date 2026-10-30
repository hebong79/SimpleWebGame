# G025-LAUNCHER-FIX

## 결과와 범위

- 기준 커밋: `a68fa820105f4b4bb517dd869045d90a20c48321`.
- 제품 변경은 `scripts/g025-verify.mjs:197` 한 줄뿐입니다.
  `join(out, \`launcher-snapshot-${randomUUID()}\`)`를 `join(out, 'l')`로 바꿨습니다.
  기존 run UUID가 snapshot을 격리하므로 별도 중복 UUID는 필요하지 않습니다.
- 원본 `tests/launch-local.test.mjs`, `scripts/serve_local.mjs`, 모든 fixture 생성 로직,
  preservation guard, 바인딩, 브라우저 설정 및 제품 runtime은 변경하지 않았습니다.
- Windows 전역 설정, ACL, junction, 설치, 서비스 및 3116 조작은 하지 않았습니다.
- 이번 결과는 수정자 실실행 재검증입니다. 최종 독립 검토는 부모 PM의 후속 단계이며
  단일 full 실행 PASS 또는 독립 acceptance PASS를 주장하지 않습니다.

## 원인 확정

원본 full run:
`artifacts/g025-integration/runs/20261029T134017546Z-2ff524ea-6a20-410d-81c4-054013cd0aba`.

`invocation.json.commands`에서 원래 unit-launcher의 executable, argv, cwd 및 reports를
직접 읽었습니다. Node는 실제 존재하는 `C:/Program Files/nodejs/node.exe`, `v24.16.0`입니다.
원본 snapshot cwd는 207자이고 생성 fixture cwd는 283~285자였습니다.
원본 TAP는 29건 중 25 PASS / 4 FAIL이며, fixture 내부 빌드 프로세스가
`spawnSync C:\Program Files\nodejs\node.exe ENOENT`로 실패했습니다.

동일 Node, 동일 `-e` 읽기 전용 명령, `shell:false`를 사용한 비교 probe:

| cwd | 존재 여부 | 길이 | 실제 결과 |
| --- | --- | ---: | --- |
| repository root | 존재 | 63 | exit 0, Node 버전/cwd 출력 |
| 원본 failure fixture | 존재 | 284 | status null, ENOENT / errno -4058 |

따라서 실행 파일 부재가 아니라 이 환경의 Windows/Node 프로세스 생성 경로에서
긴 cwd가 원인임을 확인했습니다. 정확한 OS 내부 API 구현이나 일반적인 한계값을
추정한 결론은 아닙니다. probe는 기존 fixture에 쓰지 않았습니다.
수정 후 실제 snapshot cwd는 154자, 다섯 fixture cwd는 230~232자로 모두 240자 미만입니다.

## 원본 FAIL 및 병렬 검토 산출물 보존

원본 full의 `historical-before.json`과 `historical-after.json`을 독립적으로 비교했습니다.
SHA256, size, mtimeNs 모두 원시 값 그대로 비교한 결과:

- before 615개 / after 654개.
- 기존 파일 changed 0 / deleted 0.
- added 39개 모두 허가된 `artifacts/g025-shared-delta-review/` 하위입니다.

원본 finalizationError는 기존 증거 훼손이 아니라 병렬 검토 산출물 추가로 인해
엄격한 집합 동등성 검사가 실패한 것입니다. 이 가드는 완화하지 않았으며
원본 invocation 및 로그의 `FAILED_PRESERVATION_OR_CLEANUP` 상태도 그대로 보존했습니다.

수정 작업 전 artifact 704개를 별도 metadata manifest로 고정했습니다.
원본 빌드의 명시적 rename 매핑을 적용한 후 전체 파일을 다시 읽어
SHA256/size/mtimeNs changed 0 / deleted 0을 확인했습니다. 원본 실패 run과
병렬 검토 파일도 이 확인에 포함됩니다. 과거 증거 삭제나 제외로 PASS를 만들지 않았습니다.

## 새 빌드와 전체 단위 실실행

기존 빌드는 한 번만 다음 경로로 rename해 보존했습니다.
`artifacts/g025-build-pre-launcher20261029T135722Z`.

새 manifest는 아래 실제 build 명령으로 생성했으며 stale hash를 수작업 수정하지 않았습니다.

```text
C:/Program Files/nodejs/node.exe --check scripts/g025-verify.mjs
C:/Program Files/nodejs/node.exe scripts/g025-verify.mjs --target candidate --mode build
C:/Program Files/nodejs/node.exe scripts/g025-verify.mjs --target candidate --mode full --units-only
```

모든 명령 exit 0입니다. build에는 실제 TypeScript `--noEmit`, 11/12 syntax 검사,
컴파일/복사 및 manifest 검증이 포함됩니다. 전체 단위는 원래 테스트를 실제 실행했습니다.

| 단위 suite | 실제 실행 | PASS | FAIL / skip / todo / cancelled |
| --- | ---: | ---: | --- |
| common | 48 | 48 | 모두 0 |
| games | 468 | 468 | 모두 0 |
| launcher | 29 | 29 | 모두 0 |
| 합계 | 545 | 545 | 모두 0 |

새 build run:
`artifacts/g025-integration/runs/20261029T135722322Z-634f974e-cd5c-48c9-974b-e7abdbd4c946`.

새 units run:
`artifacts/g025-integration/runs/20261029T135732279Z-ca402131-b0ca-4946-9e99-ea66ae65eaf9`.

새 build/units run의 원래 preservation guard도 각각 726개 / 886개에 대해
SHA/size/mtime 보존을 확인했습니다. units 최종 상태는
`unit_execution_passed_browser_not_executed`입니다. snapshot proof의 세 입력 파일은
원본과 복사본 SHA256가 같고, 원본 launcher 테스트는 수정되지 않았습니다.

## 기존 브라우저/HTTP 근거와 결합 가능한 범위

- 구/신 manifest의 source 149개 중 변경은 runner 한 파일뿐이며 나머지 148개가 같습니다.
- 구/신 실제 output 127개 전부 SHA256가 동일합니다. 보존 빌드 실제 바이트도 대조했습니다.
- 추적된 모든 Playwright 관련 설정 및 `.spec.ts` 16개가 기준 커밋과 SHA256 동일합니다.
- 원본 raw Playwright 결과의 실제 228개 테스트/228개 result가 모두 `passed`이며 errors 0입니다.
- 원본 HTTP 93개 관측의 status 200 및 expected/response SHA256 일치를 다시 확인했습니다.
- 따라서 불변 제품 바이트/설정 범위에서 기존 228 브라우저 및 93 HTTP 증거를
  새 545 단위 통과와 함께 PM 판단에 사용할 수 있습니다. 브라우저를 새로 실행한 것은 아닙니다.

원본 browser child 경로는 invocation의 `browser-session` reports에서 찾았고,
그 안 `browser-session.json.execution` 포인터로 raw 결과를 읽었습니다.
실제 디렉터리에는 별도 `command.json`이 없으며 cwd/argv/reports는
`browser-session.json.commands`에 저장되어 있었습니다. 없는 파일을 읽으려던 첫
진단 helper의 FileNotFoundError 로그도 보존하고, 실제 session 기록으로 보정했습니다.

구 manifest SHA256:
`1194c875f9f50e147429fbee54051f36c3ee0905be749aa7707f5c5cd7a66654`.

신 manifest SHA256:
`7ba6b80656e794c539de83cc8da5c65ab4b7629129effa307e318c8734a7e87a`.

## 인계 증거

작업 전용 증거 root:
`artifacts/g025-integration/launcher-fix-6ba3cc20-d84e-4fb7-8f04-93a5e11a5785/`.

- `cwd-probe.command.json`, `cwd-probe.stdout.log`: 긴/짧은 cwd 대조.
- `original-evidence-pointers.json`: 실제 원본 commands/session/raw 결과 포인터.
- `original-historical-comparison.json`: 원시 before/after 차이와 추가 39개 전체 metadata.
- `pre-fix-artifacts.json`: 작업 전 704개 artifact의 SHA/size/mtimeNs.
- `old-build-manifest.json`, `archive-completed.json`: 기존 빌드 보존 기록.
- `new-runs.json`: 새 build/units run 경로.
- UUID가 붙은 `*.command.json`, `*.stdout.log`, `*.stderr.log`: 실제 명령/exit/출력.
- `browser-config-spec-sha256.json`: 설정/spec 16개의 SHA256.
- `verification-summary.json`, `audit.stdout.log`: count, 바이트, metadata 및 재사용 범위 검증.
- 각 새 run의 `invocation.json`, `source-sha256.json`, `historical-before.json`,
  `historical-after.json`; units run의 `unit-summary.json`,
  `launcher-same-byte-snapshot.json`, 각 child의 원시 TAP stdout/stderr.

남은 단계는 부모 PM의 독립적인 최소 delta 검토와 최종 통합 판정입니다.
외부 게시나 push/merge는 이 제한된 작업 범위에 포함하지 않았습니다.
