# 내 주식 주문 PWA (실전 모드)

키움 OpenAPI(REST) 실전 도메인(`https://api.kiwoom.com`)을 사용하는 모바일 퍼스트 주문 웹앱입니다.

## 1) 핵심 변경점

- Docker `environment` 값으로 실전 키 주입
- 백엔드가 `process.env.KIWOOM_APPKEY`, `process.env.KIWOOM_SECRETKEY`, `process.env.KIWOOM_ACCOUNT`를 직접 사용
- 앱 로그인은 `USER_ID`, `USER_PW` 기반 검증
- 루트 `server.js`를 컨테이너 진입점으로 사용

## 2) 필수 환경변수

```env
PORT=4000
NODE_ENV=production
KIWOOM_BASE_URL=https://api.kiwoom.com
USER_ID=your_app_user_id
USER_PW=your_app_user_password
KIWOOM_APPKEY=your_kiwoom_appkey
KIWOOM_SECRETKEY=your_kiwoom_secretkey
KIWOOM_ACCOUNT=1234567890
```

## 3) Portainer 배포

`docker-compose.yml`의 environment 값만 실제 값으로 변경 후 스택 배포:

```bash
docker compose up -d --build
```

## 4) API 흐름

- 토큰 발급: `au10001`
- 잔고 조회: `ka01690`
- 주문 요청: `kt10000`

백엔드 파일:

- 루트 진입점: `server.js`
- 앱 구성: `server/app.js`
- 키움 클라이언트: `server/brokers/kiwoom/client.js`
- 라우팅: `server/routes/auth.js`, `server/routes/brokers.js`

## 5) 주의

실전 주문이므로 반드시 소액/모의 검증 후 사용하세요.
