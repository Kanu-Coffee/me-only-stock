# me-only-stock (모바일 웹/PWA 스타일 단일 서버)

## 개요
- `server.js` + `public/` 정적 파일 기반으로 동작하는 모바일 주식 주문 웹앱입니다.
- Kiwoom 인증/호출은 **서버에서만** 수행합니다.
- JWT 인증(12시간)을 사용하며 `/api/*`는 로그인 후 Bearer 토큰이 필요합니다.

## 실행
```bash
cp .env.example .env
npm install
npm start
```

## Docker Compose 사용법
```bash
# Portainer처럼 .env 없이도 환경변수만 주입 가능
docker compose up -d --build
```

## 환경변수
### 필수
- `KIWOOM_BASE_URL` (기본: `https://api.kiwoom.com`)
- `JWT_SECRET` (JWT 서명용)

### 멀티유저(권장)
각 앱 사용자마다 Kiwoom 키를 따로 설정합니다.
- `APP_USER_1_ID`, `APP_USER_1_PW`, `APP_USER_1_APPKEY`, `APP_USER_1_SECRETKEY`, `APP_USER_1_ACCOUNT`
- `APP_USER_2_ID`, `APP_USER_2_PW`, `APP_USER_2_APPKEY`, `APP_USER_2_SECRETKEY`, `APP_USER_2_ACCOUNT`
- ...

또는 `APP_USERS_JSON` 사용:
```env
APP_USERS_JSON=[
  {"id":"alice","password":"alice-pass","appkey":"alice-appkey","secretkey":"alice-secret","account":"111122223333"},
  {"id":"bob","password":"bob-pass","appkey":"bob-appkey","secretkey":"bob-secret","account":"444455556666"}
]
```

### 단일유저 fallback
- `USER_ID`, `USER_PW`
- `KIWOOM_APPKEY`, `KIWOOM_SECRETKEY`, `KIWOOM_ACCOUNT`

## 보안 원칙
- appkey/secretkey/Kiwoom access token은 클라이언트로 내려가지 않습니다.
- JWT payload는 `userId`만 포함합니다.
- API 응답/로그에 Kiwoom 키나 토큰을 출력하지 않습니다.

## 주요 API
- `POST /api/auth/login` 로그인 + JWT 발급
- `GET /api/accounts` 계좌 목록 조회 (ka00001)
- `GET /api/symbols?query=삼성` 종목 검색
- `GET /api/quote?code=005930` 현재가 (ka10002)
- `GET /api/balance?accountNo=...` 잔고 조회 (ka01690)
- `POST /api/order` 주문 (kt10000)

## 프론트 동작
- JWT를 localStorage에 저장하고, 모든 API 요청에 Bearer 헤더를 자동 추가합니다.
- API가 401을 반환하면 자동 로그아웃 후 홈(로그인)으로 이동합니다.

## 테스트
```bash
npm test
node --check server.js && node --check public/app.js
```
