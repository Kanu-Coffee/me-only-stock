import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import axios from 'axios';
import { parseKiwoomExpiresDt, shouldReuseToken } from './server/kiwoom/tokenManager.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3259);
const KIWOOM_BASE_URL = process.env.KIWOOM_BASE_URL || 'https://api.kiwoom.com';
const KIWOOM_APPKEY = process.env.KIWOOM_APPKEY;
const KIWOOM_SECRETKEY = process.env.KIWOOM_SECRETKEY;

const STOCK_MASTER = [
  { code: '005930', name: '삼성전자', market: 'KOSPI' },
  { code: '000660', name: 'SK하이닉스', market: 'KOSPI' },
  { code: '035420', name: 'NAVER', market: 'KOSPI' },
  { code: '035720', name: '카카오', market: 'KOSPI' },
  { code: '051910', name: 'LG화학', market: 'KOSPI' },
  { code: '032830', name: '삼성생명', market: 'KOSPI' },
  { code: '068270', name: '셀트리온', market: 'KOSPI' },
  { code: '207940', name: '삼성바이오로직스', market: 'KOSPI' },
  { code: '012330', name: '현대모비스', market: 'KOSPI' },
  { code: '091990', name: '셀트리온헬스케어', market: 'KOSDAQ' }
];

const tokenCache = {
  token: null,
  expiresAtMs: 0,
  inFlightPromise: null
};

app.use(cors());
app.use(express.json());
app.use(express.static(path.resolve('public')));

function ensureKiwoomEnv() {
  if (!KIWOOM_APPKEY || !KIWOOM_SECRETKEY) {
    throw new Error('KIWOOM_APPKEY, KIWOOM_SECRETKEY 환경변수를 설정하세요.');
  }
}

function getLoginUsers() {
  const users = [];

  if (process.env.APP_USERS_JSON) {
    try {
      const parsed = JSON.parse(process.env.APP_USERS_JSON);
      if (Array.isArray(parsed)) {
        parsed.forEach((user) => {
          if (user?.id && user?.password) {
            users.push({
              id: String(user.id),
              password: String(user.password)
            });
          }
        });
      }
    } catch {
      throw new Error('APP_USERS_JSON 값이 올바른 JSON 배열이 아닙니다.');
    }
  }

  for (let i = 1; i <= 20; i += 1) {
    const id = process.env[`APP_USER_${i}_ID`];
    const password = process.env[`APP_USER_${i}_PW`];
    if (id && password) users.push({ id, password });
  }

  if (process.env.USER_ID && process.env.USER_PW) {
    users.push({ id: process.env.USER_ID, password: process.env.USER_PW });
  }

  return users;
}

async function issueToken() {
  ensureKiwoomEnv();

  const response = await axios.post(
    `${KIWOOM_BASE_URL}/oauth2/token`,
    {
      granttype: 'clientcredentials',
      appkey: KIWOOM_APPKEY,
      secretkey: KIWOOM_SECRETKEY
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'api-id': 'au10001'
      },
      timeout: 10000
    }
  );

  const token = response.data?.token;
  const expiresAtMs = parseKiwoomExpiresDt(response.data?.expiresdt);

  if (!token) {
    throw new Error('Kiwoom 토큰 발급 실패: token이 없습니다.');
  }

  tokenCache.token = token;
  tokenCache.expiresAtMs = expiresAtMs || Date.now() + 50 * 60 * 1000;

  return token;
}

async function getAccessToken(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && shouldReuseToken(tokenCache, now)) {
    return tokenCache.token;
  }

  if (!forceRefresh && tokenCache.inFlightPromise) {
    return tokenCache.inFlightPromise;
  }

  tokenCache.inFlightPromise = issueToken().finally(() => {
    tokenCache.inFlightPromise = null;
  });

  return tokenCache.inFlightPromise;
}

function isAuthError(error) {
  const status = error?.response?.status;
  if (status === 401 || status === 403) return true;

  const code = String(error?.response?.data?.return_code || error?.response?.data?.code || '').toLowerCase();
  const msg = String(error?.response?.data?.msg1 || error?.response?.data?.message || '').toLowerCase();
  return code.includes('auth') || msg.includes('token') || msg.includes('인증');
}

async function callKiwoom(config, retryOnAuthError = true) {
  try {
    const token = await getAccessToken(false);
    const response = await axios({
      ...config,
      baseURL: KIWOOM_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        ...(config.headers || {}),
        Authorization: `Bearer ${token}`
      }
    });
    return response;
  } catch (error) {
    if (retryOnAuthError && isAuthError(error)) {
      await getAccessToken(true);
      return callKiwoom(config, false);
    }
    throw error;
  }
}

function normalizeBalancePayload(raw) {
  const summary = raw?.output || raw?.summary || {};
  const list = raw?.output1 || raw?.items || [];

  return {
    summary: {
      totalAsset: Number(summary.total_asset || summary.totalAsset || 0),
      totalReturnRate: Number(summary.total_return_rate || summary.totalReturnRate || 0)
    },
    items: Array.isArray(list)
      ? list.map((row) => ({
          code: row.pdno || row.code || '',
          name: row.prdt_name || row.name || '',
          returnRate: Number(row.evlu_erng_rt || row.returnRate || 0),
          evalProfitLoss: Number(row.evlu_pfls_amt || row.evalProfitLoss || 0),
          qty: Number(row.hldg_qty || row.qty || 0),
          avgPrice: Number(row.pchs_avg_pric || row.avgPrice || 0)
        }))
      : []
  };
}

app.post('/api/auth/login', (req, res) => {
  try {
    const { id, password } = req.body || {};
    if (!id || !password) {
      return res.status(400).json({ ok: false, message: '아이디/비밀번호를 입력하세요.' });
    }

    const users = getLoginUsers();
    if (!users.length) {
      return res.status(500).json({ ok: false, message: '서버 로그인 계정 설정이 없습니다.' });
    }

    const found = users.find((user) => user.id === id && user.password === password);

    if (!found) {
      return res.status(401).json({ ok: false, message: '로그인 정보가 올바르지 않습니다.' });
    }

    return res.json({ ok: true, user: { id: found.id } });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || '로그인 처리 실패' });
  }
});

app.get('/api/symbols', (req, res) => {
  const query = String(req.query.query || '').trim().toLowerCase();
  if (!query) return res.json([]);

  const items = STOCK_MASTER
    .filter((item) => item.name.toLowerCase().includes(query))
    .slice(0, 20)
    .map((item) => ({ name: item.name, code: item.code }));

  return res.json(items);
});

app.get('/api/accounts', async (req, res) => {
  try {
    const response = await callKiwoom({
      method: 'POST',
      url: '/api/dostk/acnt',
      headers: { 'api-id': 'ka00001' },
      data: {}
    });

    const raw = response.data;
    const list = [];

    const candidates = [raw?.output, raw?.output1, raw?.acntList, raw?.items].filter(Array.isArray);
    candidates.forEach((rows) => {
      rows.forEach((row) => {
        const acctNo = String(row?.acctNo || row?.acnt_no || row?.accountNo || '').trim();
        if (!acctNo) return;
        const broker = String(row?.brkNm || row?.broker || '키움증권').trim();
        if (!list.some((item) => item.accountNo === acctNo)) {
          list.push({ accountNo: acctNo, broker });
        }
      });
    });

    if (!list.length && process.env.KIWOOM_ACCOUNT) {
      list.push({ accountNo: process.env.KIWOOM_ACCOUNT, broker: '키움증권' });
    }

    return res.json({ ok: true, accounts: list });
  } catch (error) {
    if (process.env.KIWOOM_ACCOUNT) {
      return res.json({ ok: true, accounts: [{ accountNo: process.env.KIWOOM_ACCOUNT, broker: '키움증권' }] });
    }
    return res.status(502).json({ ok: false, message: '계좌 목록을 불러오지 못했습니다.', accounts: [] });
  }
});

app.get('/api/quote', async (req, res) => {
  try {
    const code = String(req.query.code || '').trim();
    if (!code) return res.status(400).json({ ok: false, message: '종목코드가 필요합니다.' });

    const response = await callKiwoom({
      method: 'GET',
      url: '/uapi/domestic-stock/v1/quotations/inquire-price',
      headers: { 'api-id': 'ka10002' },
      params: {
        fid_cond_mrkt_div_code: 'J',
        fid_input_iscd: code
      }
    });

    const out = response.data?.output || {};
    const currentPrice = Number(out.stck_prpr || out.cur_prc || out.current_price || 0);
    const changeRate = Number(out.prdy_ctrt || out.fltt_rt || out.change_rate || 0);
    const sign = changeRate >= 0 ? '+' : '';

    return res.json({
      ok: true,
      quote: {
        code,
        currentPrice,
        changeRate,
        changeRateText: `${sign}${changeRate.toFixed(2)}%`
      }
    });
  } catch {
    return res.status(502).json({ ok: false, message: '시세를 불러올 수 없습니다.' });
  }
});

app.get('/api/balance', async (req, res) => {
  try {
    const accountNo = String(req.query.accountNo || '').trim();
    if (!accountNo) {
      return res.status(400).json({ ok: false, message: '계좌번호를 선택하세요.', summary: { totalAsset: 0, totalReturnRate: 0 }, items: [] });
    }

    const response = await callKiwoom({
      method: 'POST',
      url: '/uapi/domestic-stock/v1/trading/inquire-balance',
      headers: { 'api-id': 'ka01690' },
      data: {
        account_no: accountNo,
        cont_yn: 'N',
        next_key: ''
      }
    });

    const normalized = normalizeBalancePayload(response.data);

    return res.json({ ok: true, summary: normalized.summary, items: normalized.items });
  } catch {
    return res.status(502).json({
      ok: false,
      message: '데이터를 불러올 수 없습니다',
      summary: { totalAsset: 0, totalReturnRate: 0 },
      items: []
    });
  }
});

app.post('/api/order', async (req, res) => {
  try {
    const { symbol, qty, side, accountNo } = req.body || {};
    if (!symbol || !qty || !side || !accountNo) {
      return res.status(400).json({ ok: false, message: '주문 파라미터가 부족합니다.' });
    }

    const response = await callKiwoom({
      method: 'POST',
      url: '/uapi/domestic-stock/v1/trading/order-cash',
      headers: { 'api-id': 'kt10000' },
      data: {
        account_no: String(accountNo),
        pdno: String(symbol),
        ord_qty: String(qty),
        ord_dvsn: '01',
        trde_tp: side === 'buy' ? '2' : '1'
      }
    });

    return res.json({ ok: true, message: response.data?.msg1 || '주문 요청 완료' });
  } catch {
    return res.status(502).json({ ok: false, message: '주문 요청에 실패했습니다.' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.resolve('public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
