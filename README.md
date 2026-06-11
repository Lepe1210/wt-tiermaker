# WT Tier Lab

구글시트 CSV를 불러와서 워썬더 장비 티어표를 만드는 정적 웹사이트입니다.

## v1.4

- `rank` 열 지원 추가
- 랭크 다중 선택 필터 추가
- 장비 카드 보조 정보에 랭크 표시
- 링크 공유 미리보기용 Open Graph/Twitter Card 메타태그 추가
- `preview.png` 추가

## 시트 컬럼

권장 컬럼:

```csv
id,name,category,nation,type,tag,rank,image,enabled
```

`rank` 값은 `I`, `II`, `III`, `IV`, `V`, `VI`, `VII`, `VIII` 형식을 권장합니다. 숫자 `1~8`로 입력해도 사이트에서 자동으로 로마 숫자로 변환합니다.

`enabled`를 `FALSE`, `0`, `NO`, `N`으로 두면 사이트에서 숨겨집니다.

## 배포

GitHub Pages에서 `main` 브랜치의 `/root`를 배포 대상으로 설정하면 됩니다.


## v1.5 변경점
- 시트에 `rank` 열이 없어도 War Thunder Vehicles API에서 랭크를 자동 보강합니다.
- 시트에 직접 `rank` 열이 있으면 그 값을 우선 사용합니다.


## v1.6

- War Thunder Vehicles API에서 장비 id 기준으로 Rank와 RB BR을 자동 보강합니다.
- 시트에 `rank` 또는 `br_rb` 열이 있으면 시트 값을 우선 사용합니다.
- RB 기준만 사용합니다. AB/SB BR은 표시하지 않습니다.
- 카드에는 `Rank`와 `BR`이 함께 표시됩니다.


## v1.7

- Header notice added: BR/rank data may contain errors.


## 수동 보강 컬럼

자동 API 보강이 안 맞거나 최신 장비가 누락되면 구글시트에 아래 열을 추가해서 직접 입력할 수 있습니다.

- `rank`: 장비 랭크. `I`~`IX` 또는 `1`~`9` 입력 가능.
- `br_rb`: 리얼리스틱 배틀 기준 BR. 예: `10.7`, `12.3`, `13.7`
- `image`: 직접 이미지 파일 주소 또는 저장소 내 상대경로.

사이트는 시트 값을 API 자동 보강보다 우선 사용합니다.


## v1.10

- 카드 풀 목록 자동 정렬 추가
- 정렬 기준: 국가 → 랭크 → RB BR → 타입 → 태그 → 이름
- 시트에 새 장비를 맨 아래에 추가해도 사이트에서 자동 정렬됩니다.
