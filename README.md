# WT Tier Lab

Google Sheets CSV 기반 War Thunder 티어메이커 MVP입니다.

## 파일 구조

```txt
index.html
style.css
script.js
README.md
```

## 구글시트 컬럼

```csv
id,name,category,nation,type,tag,image,enabled
```

- `category`: ground / air / naval
- `tag`: regular / premium / squadron / event
- `enabled`: TRUE / FALSE

## GitHub Pages 배포

1. GitHub 저장소 생성
2. 위 파일 4개 업로드
3. Settings → Pages
4. Branch: `main`, Folder: `/root`
5. Save

배포 주소는 보통 아래 형태입니다.

```txt
https://사용자이름.github.io/저장소이름/
```
