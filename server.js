import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import axios from 'axios';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3259);
const KIWOOM_BASE_URL = process.env.KIWOOM_BASE_URL || 'https://api.kiwoom.com';

app.use(cors());
app.use(express.json());
app.use(express.static(path.resolve('public')));

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
  value: null,
  expiresAt: 0
};

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
              password: String(user.password),
              apiKey: String(user.apiKey || '')
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
    const apiKey = process.env[`APP_USER_${i}_APIKEY`] || '';
    if (id && password) users.push({ id, password, apiKey });
  }

  if (process.env.USER_ID && process.env.USER_PW) {
    users.push({
      id: process.env.USER_ID,
      password: process.env.USER_PW,
      apiKey: process.env.USER_APIKEY || ''
    });
  }

  return users;
}

function validateKiwoomEnv() {
  const appKey = process.env.KIWOOM_APPKEY || process.env.KIWOOM_APP_KEY;
  const secretKey = process.env.KIWOOM_SECRETKEY || process.env.KIWOOM_SECRET_KEY;
  const accountNo = process.env.KIWOOM_ACCOUNT;

  if (!appKey || !secretKey || !accountNo) {
    throw new Error('KIWOOM_APPKEY, KIWOOM_SECRETKEY, KIWOOM_ACCOUNT 환경변수를 설정하세요.');
  }

  return { appKey, secretKey, accountNo };
}

async function getAccessToken() {
  if (tokenCache.value && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.value;
  }

  const { appKey, secretKey } = validateKiwoomEnv();

  const response = await axios.post(
    `${KIWOOM_BASE_URL}/oauth2/token`,
    {
      grant_type: 'client_credentials',
      appkey: appKey,
      secretkey: secretKey
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'api-id': 'au10001'
      },
      timeout: 10000
    }
  );

  const token = response.data?.token || response.data?.access_token;
  const expiresIn = Number(response.data?.expires_in || 3600);

  if (!token) throw new Error('토큰 발급 실패: 응답에 token 값이 없습니다.');

  tokenCache.value = token;
  tokenCache.expiresAt = Date.now() + expiresIn * 1000;
  return token;
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
    const { id, password, apiKey } = req.body || {};
    if (!id || !password) {
      return res.status(400).json({ ok: false, message: '아이디/비밀번호를 입력하세요.' });
    }

    const users = getLoginUsers();
    if (!users.length) {
      return res.status(500).json({ ok: false, message: '서버 로그인 계정 설정이 없습니다.' });
    }

    const found = users.find((user) => {
      if (user.id !== id || user.password !== password) return false;
      if (!user.apiKey) return true;
      return user.apiKey === String(apiKey || '');
    });

    if (!found) {
      return res.status(401).json({ ok: false, message: '로그인 정보가 올바르지 않습니다.' });
    }

    return res.json({ ok: true, user: { id: found.id } });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || '로그인 처리 실패' });
  }
});

app.get('/api/kiwoom/search', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  if (!q) return res.json({ ok: true, items: [] });

  const items = STOCK_MASTER.filter((item) =>
    item.name.toLowerCase().includes(q) || item.code.includes(q)
  ).slice(0, 20);

  return res.json({ ok: true, items });
});

app.get('/api/kiwoom/quote', async (req, res) => {
  try {
    const code = String(req.query.code || '').trim();
    if (!code) return res.status(400).json({ ok: false, message: '종목코드가 필요합니다.' });

    const token = await getAccessToken();

    const response = await axios.get(`${KIWOOM_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price`, {
      params: {
        fid_cond_mrkt_div_code: 'J',
        fid_input_iscd: code
      },
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'api-id': 'ka10002'
      },
      timeout: 10000
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
  } catch (error) {
    return res.status(502).json({ ok: false, message: '시세를 불러올 수 없습니다.' });
  }
});

app.get('/api/kiwoom/balance', async (req, res) => {
  try {
    const token = await getAccessToken();
    const { accountNo } = validateKiwoomEnv();

    const response = await axios.post(
      `${KIWOOM_BASE_URL}/uapi/domestic-stock/v1/trading/inquire-balance`,
      {
        account_no: accountNo,
        cont_yn: 'N',
        next_key: ''
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'api-id': 'ka01690'
        },
        timeout: 10000
      }
    );

    const normalized = normalizeBalancePayload(response.data);

    return res.json({
      ok: true,
      summary: normalized.summary,
      items: normalized.items
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      message: '데이터를 불러올 수 없습니다',
      summary: { totalAsset: 0, totalReturnRate: 0 },
      items: []
    });
  }
});

app.post('/api/kiwoom/order', async (req, res) => {
  try {
    const { symbol, qty, side } = req.body || {};
    if (!symbol || !qty || !side) {
      return res.status(400).json({ ok: false, message: '주문 파라미터가 부족합니다.' });
    }

    const token = await getAccessToken();
    const { accountNo } = validateKiwoomEnv();

    const response = await axios.post(
      `${KIWOOM_BASE_URL}/uapi/domestic-stock/v1/trading/order-cash`,
      {
        account_no: accountNo,
        pdno: String(symbol),
        ord_qty: String(qty),
        ord_dvsn: '01',
        trde_tp: side === 'buy' ? '2' : '1'
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'api-id': 'kt10000'
        },
        timeout: 10000
      }
    );

    return res.json({ ok: true, message: response.data?.msg1 || '주문 요청 완료', raw: response.data });
  } catch (error) {
    return res.status(502).json({ ok: false, message: '주문 요청에 실패했습니다.' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.resolve('public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
