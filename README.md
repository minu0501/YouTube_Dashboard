# 📊 내 채널 대시보드

유튜브 채널의 구독자 · 조회수 · 업로드 현황을 **매일 아침 6시에 자동으로 기록**하는 대시보드입니다.
서버도, 켜져 있는 PC도 필요 없습니다. GitHub Actions 가 대신 돌려줍니다.

## 어떻게 동작하나

```
매일 06:07 (KST)
   └─ GitHub Actions 가 scripts/collect.mjs 실행
        └─ YouTube Data API 로 구독자/조회수/영상목록 조회
             └─ data/*.json 에 기록하고 자동 커밋
                  └─ index.html (GitHub Pages) 이 그 JSON 을 읽어 그래프로 표시
```

## 파일 구조

| 경로 | 설명 |
|---|---|
| `index.html` | 대시보드 화면 (GitHub Pages 로 서비스) |
| `dash.html` | 원본 파일 (서버 연동 버전, 참고용) |
| `channels.json` | 수집 대상 채널 목록 |
| `data/snapshots.json` | 날짜별 구독자·조회수 기록 |
| `data/videos.json` | 채널별 업로드 영상 목록 (잔디·월간차트용) |
| `data/status.json` | 마지막 수집 시각 / 사용 쿼터 |
| `scripts/collect.mjs` | 수집 스크립트 |
| `.github/workflows/collect.yml` | 매일 자동 수집 |
| `.github/workflows/add-channel.yml` | 채널 추가 |

## 최초 설정 (한 번만)

**1. API 키 등록**
Settings → Secrets and variables → Actions → New repository secret
- Name: `YOUTUBE_API_KEY`
- Secret: 발급받은 YouTube Data API v3 키

**2. GitHub Pages 켜기**
Settings → Pages → Source: `Deploy from a branch` → Branch: `main` / `(root)` → Save

**3. Actions 쓰기 권한 확인**
Settings → Actions → General → Workflow permissions → `Read and write permissions` 선택

**4. 채널 추가**
Actions 탭 → `채널 추가` → Run workflow → 채널 URL 또는 `@핸들` 입력

`@핸들`, 채널 URL, `UC...` 채널 ID, 예전 `c/`·`user/` 주소를 모두 인식합니다.
`@핸들` 로 넣으면 쿼터 1 유닛만 쓰고, 이름으로만 검색하면 100 유닛을 씁니다.

## 대시보드에서 직접 하기 (GitHub 안 들어가도 됨)

대시보드 화면에서 **채널 추가**와 **지금 수집**을 바로 할 수 있습니다.
Pages 는 서버가 없는 정적 사이트라, 브라우저가 GitHub API 를 직접 부르는 방식입니다.
그러려면 열쇠(토큰)가 필요한데 공개 리포에 담을 수 없으므로 **각자 브라우저에만** 보관합니다.

**열쇠 발급 (한 번만)**
설정 → `🔑 GitHub에서 열쇠 발급받기` → 아래대로 고르고 발급 → 대시보드에 붙여넣기

| 항목 | 고를 것 |
|---|---|
| Repository access | `Only select repositories` → `YouTube_Dashboard` |
| Permissions → Actions | `Read and write` |

터미널에서 쓰는 `gh` 토큰과는 별개입니다. 그쪽은 모든 저장소 권한을 갖고 있어
브라우저에 두기엔 범위가 너무 넓으므로, 이 저장소 전용으로 따로 발급하세요.

**지금 수집**
헤더의 `⚡ 지금 수집` 을 누르면 아침 6시를 기다리지 않고 즉시 수집합니다.
같은 날 여러 번 눌러도 그날 기록을 덮어쓰기 때문에 줄이 중복되지 않습니다.
수집부터 화면 반영까지 1~2분 걸립니다 (Pages 재배포 시간 포함).

`↻ 새로고침` 은 수집 없이 이미 쌓인 기록만 다시 읽습니다.

## 채널 빼기

`channels.json` 에서 해당 항목을 지우면 됩니다. 관련 기록도 다음 수집 때 함께 정리됩니다.

## 비용

전부 무료입니다.
- YouTube Data API: 하루 10,000 유닛 무료 → 채널 1개당 약 15~40 유닛 사용
- GitHub Actions: 공개 리포는 무제한 → 하루 약 30초 사용
- GitHub Pages: 공개 리포 무료

## 알아둘 점

- 구독자 수는 유튜브 정책상 **유효숫자 3자리로 반올림**되어 제공됩니다 (예: 1,234 → 1,230).
- GitHub 의 예약 실행은 몇 분 지연될 수 있어 06:07 로 잡아두었습니다.
- 성장 그래프는 기록이 쌓여야 그려지므로, 등록 다음날부터 선이 보입니다.
- 마일스톤과 채널 색상은 **접속한 브라우저에만** 저장됩니다.
- 리포가 공개라서 채널 목록과 기록도 함께 공개됩니다. 숫자 자체는 유튜브에 이미 공개된 값이지만,
  어떤 채널을 추적하는지와 날짜별 추이는 새로 드러나는 정보입니다.
- API 키는 `api_key_paramter.dm/` 에 있고 `.gitignore` 로 차단돼 있습니다. 절대 커밋하지 마세요.

## 로컬에서 확인하기

`index.html` 을 파일로 직접 열면 브라우저 보안 정책 때문에 JSON 을 읽지 못합니다.
간단한 서버를 띄워서 여세요:

```bash
python3 -m http.server 8000
# http://localhost:8000 접속
```

수집을 직접 돌려보려면:

```bash
YOUTUBE_API_KEY=발급받은키 node scripts/collect.mjs
```
