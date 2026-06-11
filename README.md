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
