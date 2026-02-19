import axios from 'axios';

const isProd = process.env.NODE_ENV === 'production';
const KIWOOM_BASE_URL = process.env.KIWOOM_BASE_URL || (isProd ? 'https://api.kiwoom.com' : 'https://api.kiwoom.com');

const APP_KEY = process.env.KIWOOM_APPKEY || process.env.KIWOOM_APP_KEY;
const SECRET_KEY = process.env.KIWOOM_SECRETKEY || process.env.KIWOOM_SECRET_KEY;
const ACCOUNT_NO = process.env.KIWOOM_ACCOUNT;

let cachedToken = null;
let cachedExpireAt = 0;

function validateLiveMode() {
  if (!APP_KEY || !SECRET_KEY || !ACCOUNT_NO) {
    throw new Error('실전 모드 환경변수 누락: KIWOOM_APPKEY, KIWOOM_SECRETKEY, KIWOOM_ACCOUNT 를 확인하세요.');
  }
}

async function requestToken() {
  const now = Date.now();
  if (cachedToken && cachedExpireAt > now + 60_000) {
    return cachedToken;
  }

  validateLiveMode();

  const response = await axios.post(
    `${KIWOOM_BASE_URL}/oauth2/token`,
    {
      grant_type: 'client_credentials',
      appkey: APP_KEY,
      secretkey: SECRET_KEY
    },
    { headers: { 'Content-Type': 'application/json', 'api-id': 'au10001' } }
  );

  const token = response.data?.token || response.data?.access_token;
  const expiresIn = Number(response.data?.expires_in || 3600);

  if (!token) {
    throw new Error('키움 토큰 발급 실패: 응답에 토큰이 없습니다.');
  }

  cachedToken = token;
  cachedExpireAt = now + expiresIn * 1000;
  return token;
}

export async function getPortfolio() {
  const token = await requestToken();

  const response = await axios.post(
    `${KIWOOM_BASE_URL}/uapi/domestic-stock/v1/trading/inquire-balance`,
    {
      account_no: ACCOUNT_NO,
      cont_yn: 'N',
      next_key: ''
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'api-id': 'ka01690'
      }
    }
  );

  const data = response.data || {};

  return {
    summary: {
      totalAsset: Number(data?.output?.total_asset || 0),
      totalReturnRate: Number(data?.output?.total_return_rate || 0)
    },
    items: (data?.output1 || []).map((row) => ({
      code: row.pdno,
      name: row.prdt_name,
      returnRate: row.evlu_erng_rt,
      evalProfitLoss: row.evlu_pfls_amt,
      qty: row.hldg_qty,
      avgPrice: row.pchs_avg_pric
    })),
    source: 'kiwoom-live'
  };
}

export async function placeOrder({ symbol, qty, side }) {
  const token = await requestToken();

  const response = await axios.post(
    `${KIWOOM_BASE_URL}/uapi/domestic-stock/v1/trading/order-cash`,
    {
      account_no: ACCOUNT_NO,
      pdno: symbol,
      ord_dvsn: '01',
      ord_qty: String(qty),
      trde_tp: side === 'buy' ? '2' : '1'
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'api-id': 'kt10000'
      }
    }
  );

  const data = response.data || {};
  return { message: data?.msg1 || '주문 요청 완료', raw: data };
}
