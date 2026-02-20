# me-only-stock (모바일 웹/PWA 스타일 단일 서버)

## 개요
- `server.js` + `public/` 정적 파일 기반으로 동작하는 모바일 주식 주문 웹앱입니다.
- 기본 포트는 `3259`이며 Docker Compose에서 포트를 자유롭게 변경할 수 있습니다.

## 실행
```bash
cp .env.example .env
npm install
npm start
```

## Docker Compose 사용법
```bash
cp .env.example .env
docker compose up -d --build
```

### 포트 변경
- 내부 포트: `PORT`
- 외부 포트: `HOST_PORT`
- 예) 외부 9001 사용
```env
PORT=3259
HOST_PORT=9001
```

## 환경변수
### 키움 REST
- `KIWOOM_BASE_URL` (기본: `https://api.kiwoom.com`)
- `KIWOOM_APPKEY`
- `KIWOOM_SECRETKEY`
- `KIWOOM_ACCOUNT`

### 앱 로그인 (단일)
- `USER_ID`
- `USER_PW`
- `USER_APIKEY` (선택)

### 앱 로그인 (다중)
- `APP_USER_1_ID`, `APP_USER_1_PW`, `APP_USER_1_APIKEY`
- `APP_USER_2_ID`, `APP_USER_2_PW`, `APP_USER_2_APIKEY`
- 또는 `APP_USERS_JSON` 사용

예시:
```env
APP_USERS_JSON=[{"id":"alice","password":"alice-pass","apiKey":"alice-key"},{"id":"bob","password":"bob-pass"}]
```

## 주요 API
- `POST /api/auth/login` 로그인
- `GET /api/kiwoom/balance` 잔고조회(ka01690)
- `GET /api/kiwoom/quote?code=005930` 현재가/등락률(ka10002)
- `GET /api/kiwoom/search?q=삼성` 종목 검색
- `POST /api/kiwoom/order` 주문(kt10000)

## 프론트 파일
- `public/index.html` : 하단 탭 네비게이션 포함
- `public/app.js` : SPA 상태 전환/검색/시세/주문 로직
- `public/style.css` : 모바일 최적화 스타일
