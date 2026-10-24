# 숫자 정원 — 신규 자산 명세 / G-003

## G-013 홈·게임 통합 재사용

기존 직접 제작 SVG 15종을 같은 경로로 재사용했습니다. 홈 카드의 간단한 도형·숫자·카드·보드 장식은 `public/home.css`와 `src/client/library.ts`에서 직접 구성한 HTML/CSS입니다. 외부 이미지·아이콘 라이브러리·폰트·음원을 추가하지 않았으며 기존 출처·사용 범위 기록을 유지합니다.

## 납품 및 출처

타일 장식 11종, 정원 장면 3종, favicon 1종, **런타임 SVG 정확히 15개**를 이 프로젝트에서 새로 제작했습니다. Python 코드에 직접 정의한 베지어 곡선·기하 도형을 조합한 원본 벡터 아트입니다. 외부 이미지·폰트·원작 소스·아이콘 라이브러리·참고 이미지의 다운로드, 트레이싱, 복제는 하지 않았습니다. 외부 저작물과 원격 참조를 포함하지 않습니다. SVG 네임스페이스의 `http://www.w3.org/2000/svg`는 XML 식별자이며 네트워크 다운로드 주소로 사용하지 않습니다.

- 직접 제작 원본: `assets/generate_assets.py` — Python 3 표준 라이브러리만 필요합니다. 난수·타임스탬프·외부 입력 없이 결정적으로 재생성합니다.
- 보조 렌더/픽셀 검사: `assets/render_assets.py` — 이 호스트에 이미 설치된 Chrome 또는 Edge와 Pillow를 사용합니다. 새 패키지/브라우저 설치는 수행하지 않았습니다. 게임 런타임에는 이 도구가 필요 없습니다.
- 스타일: 크림/모래색 마당, 흙빛 테라코타 화분, 숲녹색 잎·관목에 노랑/코랄 꽃을 더한 차분한 평면 벡터 일러스트입니다.
- 외부 음원은 이 작업에 없습니다. WebAudio 합성음은 게임 구현 worker의 소관입니다.

## 런타임 경로 계약

아래 파일은 모두 직접 제작했습니다. `public`이 웹 공개 루트이며 요청 URL에는 `public`을 붙이지 않습니다. 경로와 값 매핑을 변경하지 않습니다.

| 실제 파일 경로 | 웹 URL | 크기 / 문양·장면 |
|---|---|---|
| `public/assets/tiles/tile-2.svg` | `/assets/tiles/tile-2.svg` | 128×128 / 두 모서리의 씨앗 |
| `public/assets/tiles/tile-4.svg` | `/assets/tiles/tile-4.svg` | 128×128 / 발아한 작은 새싹 |
| `public/assets/tiles/tile-8.svg` | `/assets/tiles/tile-8.svg` | 128×128 / 양 모서리의 쌍잎 |
| `public/assets/tiles/tile-16.svg` | `/assets/tiles/tile-16.svg` | 128×128 / 층이 늘어난 잎줄기 |
| `public/assets/tiles/tile-32.svg` | `/assets/tiles/tile-32.svg` | 128×128 / 길어진 가지와 금빛 씨앗 |
| `public/assets/tiles/tile-64.svg` | `/assets/tiles/tile-64.svg` | 128×128 / 노란 꽃봉오리 |
| `public/assets/tiles/tile-128.svg` | `/assets/tiles/tile-128.svg` | 128×128 / 작은 크림색 꽃 |
| `public/assets/tiles/tile-256.svg` | `/assets/tiles/tile-256.svg` | 128×128 / 복수의 잎줄기와 새잎 |
| `public/assets/tiles/tile-512.svg` | `/assets/tiles/tile-512.svg` | 128×128 / 더 풍성한 네 귀퉁이 잎 |
| `public/assets/tiles/tile-1024.svg` | `/assets/tiles/tile-1024.svg` | 128×128 / 코랄·노랑 두 색 꽃 |
| `public/assets/tiles/tile-2048.svg` | `/assets/tiles/tile-2048.svg` | 128×128 / 네 모서리의 꽃과 하단 금빛 장식 |
| `public/assets/gardens/seed.svg` | `/assets/gardens/seed.svg` | 960×640 / 씨앗 뜰: 아치 벽감, 작은 새싹 화분, 모종 화단, 물뿌리개·삽 |
| `public/assets/gardens/grove.svg` | `/assets/gardens/grove.svg` | 960×640 / 초록 숲: 나무 그늘, 낮은 관목, 고사리 화분, 벤치와 디딤돌 |
| `public/assets/gardens/bloom.svg` | `/assets/gardens/bloom.svg` | 960×640 / 꽃 정원: 꽃 아치, 두 화단, 코랄·노란 꽃, 굽은 디딤돌 길 |
| `public/assets/favicon.svg` | `/assets/favicon.svg` | 64×64 / 둥근 숲색 격자와 새싹 |

### UI 적용 주의

- 타일 SVG는 **투명 장식뿐**이며 숫자 `<text>`나 불투명 바탕이 없습니다. 실제 값은 앱의 중앙 DOM 텍스트로 표시해야 합니다. 장식용 이미지는 `alt=""` 또는 접근성 트리에서 숨기는 방식으로 중복 읽기를 피합니다.
- 모든 타일에서 원본 좌표 **x=20~108, y=40~84의 중앙 직사각형**이 완전 투명임을 실제 Chrome 렌더의 알파 픽셀로 검사했습니다. 숫자는 이 영역 안에 배치하는 것을 권장하며, 특히 4자리 이상은 글자 크기를 맞춰야 합니다. 이는 통합된 게임 UI의 가독성 검증을 대신하지 않습니다.
- 타일 바탕색·글자색·보드 간격은 CSS가 소유합니다. 연락 시트의 색 바탕과 숫자는 미리보기용이며 런타임 SVG에 들어 있지 않습니다.
- SVG 전체를 정사각 타일에 맞추되 보더·패딩 때문에 모서리 문양을 불필요하게 자르지 않습니다. 4096 이상은 `tile-2048.svg`를 재사용하고 실제 DOM 숫자를 유지합니다.
- 정원은 3:2 원본 비율을 유지하는 `contain` 또는 비율 보존 이미지로 표시합니다. `cover`를 사용하면 장면 가장자리가 잘릴 수 있습니다. 그림 자체에는 화면 제목·버튼·잠금 표시가 없습니다.
- 해금 계약: `seed` 기본 / `grove` 역대 최고 타일 256 / `bloom` 역대 최고 타일 1024입니다. SVG가 해금 상태를 판단하지 않으며 잠금·선택 텍스트는 앱이 제공합니다.
- 배경 그림은 숫자 보드를 덮지 않도록 보드 옆/뒤의 보조 위치에 둡니다. 그림에 애니메이션·스크립트·오디오·인터랙션은 없습니다.

## 원본·보조 산출물

| 경로 | 용도 |
|---|---|
| `assets/generate_assets.py` | 15개 런타임 SVG와 연락 시트의 결정적 원본·XML 검증기 |
| `assets/contact-sheet.svg` | 세 정원과 11종 타일, favicon의 한 장 미리보기. 자체 도형을 인라인으로 담으며 런타임에서 요청하지 않습니다. |
| `assets/contact-sheet.png` | 실제 Chrome headless로 렌더한 1560×1090 최종 확인 이미지 |
| `assets/validation.json` | 파일별 치수·SHA-256와 XML/안전성/경로/개수 검사 결과 |
| `assets/render_assets.py` | 설치된 로컬 브라우저로 연락 시트와 투명 장식 아틀라스를 렌더하는 재현 스크립트 |
| `assets/ornament-alpha-atlas.svg` | 실제 납품 타일 파일 11개를 읽어 만든 알파 픽셀 검사용 비런타임 아틀라스 |
| `assets/ornament-alpha-atlas.png` | 1408×256 투명 PNG 렌더 증거 |
| `assets/render-validation.json` | 두 렌더의 크기·종료 코드 및 타일별 비어 있지 않음/투명 비율/중앙 알파 검사 결과 |

보조 파일은 `public/assets` 밖에 있으므로 런타임 SVG 15개 산정에 포함하지 않습니다. `__pycache__`가 생성되면 Python의 실행 캐시이며 게임 자산·배포 필수 파일이 아닙니다.

## 재생성·검증 명령 및 실제 결과

작업 디렉터리: `E:/Work2/Project/SimpleGames/01-2048`

```sh
python assets/generate_assets.py
python assets/generate_assets.py --check
python assets/render_assets.py
```

- 생성 및 읽기 전용 `--check`를 실제 실행했습니다: **PASS, 종료 코드 0**. 공개 자산의 정확한 경로 집합, 타일 11+정원 3+favicon 1, 모든 XML 파싱, width/height/viewBox, 15개 파일 내용의 상이함, 재생성 결과와 기존 파일의 바이트 단위 일치를 검사합니다.
- 스크립트·이벤트 핸들러·foreignObject·래스터 이미지·use/href·스타일/애니메이션·원격 참조·data URI·외부 폰트·DTD/ENTITY가 없음을 자동 검사했습니다. 타일에 `<text>` 및 불투명 `<rect>`가 없음을 검사했습니다. 단, 이 제한된 검사기를 모든 임의 SVG에 대한 범용 보안 검사기라고 주장하지는 않습니다.
- `C:/Program Files/Google/Chrome/Application/chrome.exe`의 headless 렌더를 실제 실행했습니다: 두 PNG 생성 **PASS, 종료 코드 0**. 타일 11종 모두 중앙 알파 최솟값/최댓값 **0/0**이며 모든 타일의 문양은 비어 있지 않습니다. 타일 전체의 완전 투명 픽셀 비율은 각각 `render-validation.json`에 기록됩니다.
- 최종 연락 시트 PNG를 열어 정원 세 장면의 구분, 프레임 간 넘침 없음, 타일 문양·숫자 미리보기 간 간섭 없음, favicon 표시를 시각 확인했습니다. 숲 장면의 화면 경계로 이어지는 큰 수관은 의도한 구도입니다.
- 실행 과정에서 새 브라우저·엔진·Node·외부 패키지는 설치하지 않았습니다. 원본·런타임 이미지·검증 보조물과 이 문서만 작성했습니다.

## 권리·검증 한계 및 인수인계

- 프로젝트용 신규 직접 제작물이며 외부 저작물 이용에 따른 출처 표기나 제3자 라이선스 파일을 요구하는 재료는 사용하지 않았습니다.
- 위 제작 경위는 사실 기록이며 저작권의 성립·독점권·소유권 양도·상업 이용의 법적 무위험성 보증이나 별도의 법률 의견이 아닙니다. 별도 라이선스 양도 계약을 창작하여 부여하지 않습니다.
- Chrome에서 **개별 자산이 포함된 아틀라스 렌더와 시각 확인**을 했으며, 실제 앱에 대한 HTTP 로딩·CSP·네트워크 요청·320px 모바일 가독성·해금/저장·입력·실기기 플레이 테스트는 이 worker 범위 밖이고 **미검증**입니다. G-002 통합 및 G-005/PM 독립 QA가 필요합니다.
- PM 소유 BACKLOG/HANDOFF/DECISIONS 상태와 다른 worker의 코드·패키지는 변경하지 않았습니다. 연락 시트나 이 문서만으로 게임 전체 수용을 선언하지 않습니다.
