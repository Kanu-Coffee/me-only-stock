# me-only-stock (모바일 웹/PWA 스타일 단일 서버)

## 개요
- `server.js` + `public/` 정적 파일 기반으로 동작하는 모바일 주식 주문 웹앱입니다.
- Kiwoom 인증/호출은 **서버에서만** 수행하며, 프론트는 `/api/*` 엔드포인트만 호출합니다.
- 기본 포트는 `3259`이며 Docker Compose에서 외부 포트를 변경할 수 있습니다.

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
### Kiwoom REST (필수)
- `KIWOOM_BASE_URL` (기본: `https://api.kiwoom.com`)
- `KIWOOM_APPKEY`
- `KIWOOM_SECRETKEY`

> 보안 정책: API 키/시크릿/토큰은 프론트로 내려가지 않으며, 브라우저 저장소에 저장되지 않습니다.

### 앱 로그인
- 단일: `USER_ID`, `USER_PW`
- 다중: `APP_USER_1_ID`, `APP_USER_1_PW` ... 또는 `APP_USERS_JSON`

예시:
```env
APP_USERS_JSON=[{"id":"alice","password":"alice-pass"},{"id":"bob","password":"bob-pass"}]
```

## 주요 API
- `POST /api/auth/login` 로그인
- `GET /api/accounts` 계좌 목록 조회 (ka00001 기반)
- `GET /api/symbols?query=삼성` 종목 검색 (종목명 기반)
- `GET /api/quote?code=005930` 현재가/등락률 (ka10002)
- `GET /api/balance?accountNo=12345678` 잔고 조회 (ka01690)
- `POST /api/order` 주문 (kt10000)

## UX 변경 사항
- 홈 로그인 화면에서 API Key 입력을 제거했습니다.
- 주문 탭은 **종목 검색 모달**(입력 + 검색 버튼/엔터 + 결과 선택) 방식입니다.
- 사용자에게는 종목명 중심 UI를 제공하고 내부적으로만 종목코드를 사용합니다.
- 잔고 탭 상단에서 계좌번호(및 증권사 라벨)를 선택할 수 있습니다.
- 마지막 선택 계좌/최근 검색어/최근 선택 종목은 로컬 저장소에 저장됩니다.

## 테스트
```bash
npm test
```
- `server/kiwoom/tokenManager.test.js`에서 토큰 만료 파싱/캐시 재사용 로직을 검증합니다.
