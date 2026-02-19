# 내 주식 주문 PWA

키움 OpenAPI(REST)를 기준으로 만든 **모바일 퍼스트 초간편 주문 웹앱(PWA)** 입니다.

## 1) 프로젝트 구조

```bash
.
├── client/                  # React(Vite) 프론트엔드
│   ├── public/
│   │   ├── manifest.json
│   │   ├── service-worker.js
│   │   └── icons/
│   └── src/
│       ├── pages/
│       ├── components/
│       └── styles.css
├── server/                  # Express 백엔드
│   ├── brokers/
│   │   ├── kiwoom/client.js
│   │   └── kis/client.js
│   ├── routes/brokers.js
│   └── index.js
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## 2) 실행 방법

```bash
cp .env.example .env
npm --prefix client install
npm --prefix server install
npm --prefix client run build
cp -r client/dist public
npm --prefix server run start
```

브라우저에서 `http://localhost:4000` 접속.

## 3) PWA 설치 방법

1. 안드로이드 Chrome에서 앱 열기
2. 메뉴 > 홈 화면에 추가
3. 설치 후 앱 아이콘으로 실행 시 Standalone 모드로 동작

> iOS Safari도 홈 화면 추가 가능하며, `manifest.json`/아이콘이 반영됩니다.

## 4) 주요 기능

- 큰 글씨/큰 버튼 기반 다크 UI
- 앱 로그인 + 자동 로그인(아이디/비밀번호 저장 체크)
- 증권사 선택 카드(키움/한투 준비중)
- 잔고 핵심 정보(총자산/수익률/보유종목)
- 시장가 즉시 주문(수량 +/- 버튼)
- 서비스워커 기반 앱 셸 캐시

## 5) 키움 API 연동 포인트

- 토큰 발급(au10001 성격): `requestToken()`
- 잔고 조회(ka01690): `getPortfolio()`
- 주문(kt10000): `placeOrder()`

실 계정 키가 없으면 자동으로 mock 응답을 반환하여 UI 검증이 가능합니다.

## 6) 증권사 추가 방법

1. `server/brokers/<broker>/client.js` 생성
2. `server/routes/brokers.js` 라우팅 분기 추가
3. `client/src/pages/BrokerSelectPage.jsx` 카드 추가
4. 필요 시 주문/잔고 파라미터 매핑만 맞추면 동일 UI 재사용 가능

## 7) Docker/Portainer 배포

```bash
docker compose up -d --build
```

Portainer에서는 이 저장소를 스택으로 등록해 동일하게 실행하면 됩니다.
