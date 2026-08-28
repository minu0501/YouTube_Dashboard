# 📊 내 채널 대시보드

유튜브 채널의 구독자 · 조회수 · 업로드 현황을 **매일 아침 6시에 자동으로 기록**하는 대시보드입니다.
서버도, 켜져 있는 PC도 필요 없습니다. GitHub Actions 가 대신 돌려줍니다.

리포지토리는 **비공개(private)** 로 운영합니다. 기록이 남에게 보이지 않는 대신,
대시보드는 웹 주소로 열지 않고 내 PC 에서 띄워서 봅니다.

## 어떻게 동작하나

```
매일 06:07 (KST)
   └─ GitHub Actions 가 scripts/collect.mjs 실행
        └─ YouTube Data API 로 구독자/조회수/영상목록 조회
             └─ data/*.json 에 기록하고 자동 커밋
                  └─ 볼 때: git pull 후 로컬 서버로 index.html 열기
```

## 파일 구조

| 경로 | 설명 |
|---|---|
| `index.html` | 대시보드 화면 (로컬에서 열어 봄) |
| `dash.html` | 원본 파일 (서버 연동 버전, 참고용) |
| `channels.json` | 수집 대상 채널 목록 |
| `data/snapshots.json` | 날짜별 구독자·조회수 기록 |
| `data/videos.json` | 채널별 업로드 영상 목록 (잔디·월간차트용) |
| `data/status.json` | 마지막 수집 시각 / 사용 쿼터 |
| `scripts/collect.mjs` | 수집 스크립트 |
| `.github/workflows/collect.yml` | 매일 자동 수집 |
| `.github/workflows/add-channel.yml` | 채널 추가 |
| `api_key_paramter.dm/` | API 키 보관 (git 에 올라가지 않음) |

## 대시보드 보기

`index.html` 을 파일로 직접 열면 브라우저 보안 정책 때문에 JSON 을 읽지 못합니다.
최신 기록을 받아온 뒤 간단한 서버를 띄워서 여세요.

```bash
git pull
python3 -m http.server 8000
# http://localhost:8000 접속
```

## 채널 추가

Actions 탭 → `채널 추가` → Run workflow → 채널 URL 또는 `@핸들` 입력

`@핸들`, 채널 URL, `UC...` 채널 ID, 예전 `c/`·`user/` 주소를 모두 인식합니다.
`@핸들` 로 넣으면 쿼터 1 유닛만 쓰고, 이름으로만 검색하면 100 유닛을 씁니다.

## 채널 빼기

`channels.json` 에서 해당 항목을 지우면 됩니다. 관련 기록도 다음 수집 때 함께 정리됩니다.

## 설정 상태 (이미 완료됨)

- `YOUTUBE_API_KEY` 시크릿 등록 — Settings → Secrets and variables → Actions
- Actions 워크플로 권한 `Read and write` — Settings → Actions → General
- 리포지토리 비공개 전환

새로 리포를 만들어 옮길 때만 위 항목을 다시 설정하면 됩니다.

## 비용

전부 무료입니다.

- YouTube Data API: 하루 10,000 유닛 무료 → 채널 1개당 약 15~40 유닛 사용
- GitHub Actions: 비공개 리포 월 2,000분 무료 → 이 프로젝트는 월 15분 남짓
- 비공개 리포라 GitHub Pages 는 쓰지 않습니다 (무료 플랜 미지원)

## 알아둘 점

- 구독자 수는 유튜브 정책상 **유효숫자 3자리로 반올림**되어 제공됩니다 (예: 1,234 → 1,230).
- GitHub 의 예약 실행은 몇 분 지연될 수 있어 06:07 로 잡아두었습니다.
- 성장 그래프는 기록이 쌓여야 그려지므로, 등록 다음날부터 선이 보입니다.
- 마일스톤과 채널 색상은 **접속한 브라우저에만** 저장됩니다.
- API 키는 `api_key_paramter.dm/` 에 있고 `.gitignore` 로 차단돼 있습니다. 절대 커밋하지 마세요.

## 수집 직접 돌려보기

```bash
YOUTUBE_API_KEY=$(cat api_key_paramter.dm/parameter_api.txt) node scripts/collect.mjs
```
